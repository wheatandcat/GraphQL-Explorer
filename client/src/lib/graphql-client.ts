import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

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
    const endpoint = this.endpoint;
    console.log("Executing GraphQL request to:", endpoint);

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(request),
    };

    let clientFetch = fetch;
    if (endpoint.includes("http://localhost")) {
      clientFetch = tauriFetch;
    }

    const response = await clientFetch(endpoint, fetchOptions);

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
      const endpoint = this.endpoint;
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

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
  }
}
