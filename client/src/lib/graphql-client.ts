interface GraphQLResponse {
  data?: any;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface RequestHeaders {
  [key: string]: string;
}

export class GraphQLClient {
  private endpoint: string;
  private headers: RequestHeaders;

  constructor(endpoint: string = "", headers: RequestHeaders = {}) {
    this.endpoint = endpoint;
    this.headers = headers;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  setHeaders(headers: RequestHeaders) {
    this.headers = headers;
  }

  async execute(request: GraphQLRequest): Promise<{
    response: GraphQLResponse;
    status: number;
    statusText: string;
    responseTime: number;
    responseSize: string;
  }> {
    if (!this.endpoint) {
      throw new Error("GraphQL endpoint is not configured");
    }

    const startTime = Date.now();

    // Use proxy for localhost endpoints in development
    const endpoint = this.getProxiedEndpoint(this.endpoint);
    console.log("Executing GraphQL request to:", endpoint);

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(request),
    };
    const response = await fetch(endpoint, fetchOptions);

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();
    let responseData: GraphQLResponse;

    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      responseData = {
        errors: [{ message: `Invalid JSON response: ${responseText}` }],
      };
    }

    // Calculate response size
    const responseSize = this.formatBytes(new Blob([responseText]).size);

    return {
      response: responseData,
      status: response.status,
      statusText: response.statusText,
      responseTime,
      responseSize,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      // Use proxy for localhost endpoints in development
      const endpoint = this.getProxiedEndpoint(this.endpoint);
      console.log("Testing connection to:", endpoint);

      const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          query: "{ __typename }",
        }),
      };

      // For localhost endpoints in development, try different CORS modes
      if (this.isLocalhostEndpoint(this.endpoint) && import.meta.env.DEV) {
        fetchOptions.mode = "cors";
        if (endpoint === this.endpoint) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            "Access-Control-Allow-Origin": "*",
          };
        }
      }

      const response = await fetch(endpoint, fetchOptions);
      console.log(
        "Connection test result:",
        response.status,
        response.statusText
      );

      return response.ok;
    } catch (error) {
      console.log("Connection test error:", error);
      return false;
    }
  }

  private isLocalhostEndpoint(endpoint: string): boolean {
    try {
      const url = new URL(endpoint);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }

  private getProxiedEndpoint(endpoint: string): string {
    // In development, try to use proxy for localhost requests
    if (import.meta.env.DEV && this.isLocalhostEndpoint(endpoint)) {
      const url = new URL(endpoint);
      console.log("Original endpoint:", endpoint);
      console.log("Parsed URL:", {
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
      });

      // Try proxy first for localhost:8080
      if (url.hostname === "localhost" && url.port === "8080") {
        const proxiedUrl = `/proxy-graphql${url.pathname}${url.search}`;
        console.log("Attempting proxied endpoint:", proxiedUrl);
        return proxiedUrl;
      }
    }

    console.log("Using direct endpoint:", endpoint);
    return endpoint;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
  }
}
