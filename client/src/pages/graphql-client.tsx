import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GraphQLClient, RequestHeaders } from '@/lib/graphql-client';
import { MonacoEditor } from '@/components/monaco-editor';
import { 
  Copy, 
  Download, 
  Settings, 
  HelpCircle, 
  Play, 
  Plus, 
  X, 
  Code, 
  Plug,
  Loader2
} from 'lucide-react';

interface Header {
  key: string;
  value: string;
}

export default function GraphQLClientPage() {
  const { toast } = useToast();
  
  // State
  const [endpoint, setEndpoint] = useState('https://api.spacex.land/graphql');
  const [headers, setHeaders] = useState<Header[]>([
    { key: 'Authorization', value: 'Bearer eyJ0eXAiOiJKV1Q...' }
  ]);
  const [variables, setVariables] = useState('{\n  "limit": 10,\n  "offset": 0\n}');
  const [query, setQuery] = useState(`query GetLaunches($limit: Int!, $offset: Int!) {
  launches(limit: $limit, offset: $offset) {
    id
    mission_name
    launch_date_local
    rocket {
      rocket_name
    }
    launch_success
  }
}`);
  const [response, setResponse] = useState('');
  const [responseHeaders, setResponseHeaders] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('0 B');
  const [responseStatus, setResponseStatus] = useState({ status: 0, statusText: '' });

  const client = new GraphQLClient(endpoint);

  const addHeader = useCallback(() => {
    setHeaders(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const removeHeader = useCallback((index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setHeaders(prev => 
      prev.map((header, i) => 
        i === index ? { ...header, [field]: value } : header
      )
    );
  }, []);

  const testConnection = useCallback(async () => {
    if (!endpoint) {
      toast({
        title: 'Error',
        description: 'Please enter a GraphQL endpoint URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      const headersObj: RequestHeaders = {};
      headers.forEach(header => {
        if (header.key && header.value) {
          headersObj[header.key] = header.value;
        }
      });
      
      client.setEndpoint(endpoint);
      client.setHeaders(headersObj);
      
      const isConnected = await client.testConnection();
      
      if (isConnected) {
        toast({
          title: 'Success',
          description: 'Connection to GraphQL endpoint established',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: 'Could not connect to the GraphQL endpoint',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  }, [endpoint, headers, toast]);

  const executeQuery = useCallback(async () => {
    if (!endpoint) {
      toast({
        title: 'Error',
        description: 'Please enter a GraphQL endpoint URL',
        variant: 'destructive',
      });
      return;
    }

    if (!query.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a GraphQL query',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const headersObj: RequestHeaders = {};
      headers.forEach(header => {
        if (header.key && header.value) {
          headersObj[header.key] = header.value;
        }
      });

      let parsedVariables = {};
      if (variables.trim()) {
        try {
          parsedVariables = JSON.parse(variables);
        } catch (error) {
          toast({
            title: 'Invalid Variables',
            description: 'Variables must be valid JSON',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      client.setEndpoint(endpoint);
      client.setHeaders(headersObj);

      const result = await client.execute({
        query,
        variables: parsedVariables,
      });

      setResponse(JSON.stringify(result.response, null, 2));
      setResponseHeaders(JSON.stringify(headersObj, null, 2));
      setResponseTime(result.responseTime);
      setResponseSize(result.responseSize);
      setResponseStatus({ status: result.status, statusText: result.statusText });

      if (result.response.errors) {
        toast({
          title: 'GraphQL Errors',
          description: result.response.errors[0]?.message || 'Query returned errors',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Execution Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      setResponse(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }, null, 2));
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers, variables, query, toast]);

  const formatQuery = useCallback(() => {
    try {
      // Basic query formatting - in a real app you'd want a proper GraphQL formatter
      const formatted = query
        .replace(/\s+/g, ' ')
        .replace(/{\s*/g, '{\n  ')
        .replace(/\s*}/g, '\n}')
        .replace(/,\s*/g, ',\n  ');
      setQuery(formatted);
    } catch (error) {
      toast({
        title: 'Format Error',
        description: 'Could not format query',
        variant: 'destructive',
      });
    }
  }, [query, toast]);

  const formatVariables = useCallback(() => {
    try {
      const parsed = JSON.parse(variables);
      setVariables(JSON.stringify(parsed, null, 2));
    } catch (error) {
      toast({
        title: 'Format Error',
        description: 'Variables must be valid JSON',
        variant: 'destructive',
      });
    }
  }, [variables, toast]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const downloadResponse = useCallback(() => {
    const blob = new Blob([response], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphql-response.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [response]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <div className="w-3 h-3 border border-white rounded-full"></div>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">GraphQL Client</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </Button>
              <Button variant="ghost" size="sm">
                <HelpCircle className="w-4 h-4 mr-1" />
                Help
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Endpoint Configuration */}
          <div className="p-4 border-b border-gray-200">
            <Label className="text-sm font-medium text-gray-700 mb-2">GraphQL Endpoint</Label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="https://api.example.com/graphql"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="flex-1"
              />
              <Button onClick={testConnection} size="sm">
                <Plug className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Request Headers */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Headers</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addHeader}
                className="text-xs text-blue-600 hover:text-blue-700 p-0"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Header name"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Input
                    type="text"
                    placeholder="Header value"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHeader(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Query Variables */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Variables</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={formatVariables}
                className="text-xs text-blue-600 hover:text-blue-700 p-0"
              >
                <Code className="w-3 h-3 mr-1" />
                Format
              </Button>
            </div>
            <div className="h-full min-h-[200px]">
              <MonacoEditor
                value={variables}
                onChange={setVariables}
                language="json"
                height="100%"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Query Editor Section */}
          <div className="flex-1 flex flex-col bg-white border-b border-gray-200">
            {/* Query Editor Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-4">
                <h2 className="text-sm font-medium text-gray-700">Query Editor</h2>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={formatQuery}
                    className="text-xs"
                  >
                    <Code className="w-3 h-3 mr-1" />
                    Prettify
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(query, 'Query')}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <Button onClick={executeQuery} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Query
              </Button>
            </div>

            {/* Query Editor */}
            <div className="flex-1 relative">
              <MonacoEditor
                value={query}
                onChange={setQuery}
                language="graphql"
                height="100%"
              />
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Results Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-4">
                <h2 className="text-sm font-medium text-gray-700">Response</h2>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{responseTime}ms</span>
                  <span>•</span>
                  <span>{responseSize}</span>
                  <span>•</span>
                  <span className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-1 ${
                      responseStatus.status >= 200 && responseStatus.status < 300 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                    }`}></div>
                    <span>{responseStatus.status} {responseStatus.statusText}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(response, 'Response')}
                  className="text-xs"
                  disabled={!response}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadResponse}
                  className="text-xs"
                  disabled={!response}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
            </div>

            {/* Results Content */}
            <div className="flex-1 relative">
              {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600">Executing query...</p>
                  </div>
                </div>
              )}

              <Tabs defaultValue="response" className="h-full flex flex-col">
                <TabsList className="w-fit">
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="flex-1 mt-0">
                  <div className="h-full bg-gray-50 overflow-auto">
                    <pre className="p-4 text-sm font-mono text-gray-800 whitespace-pre-wrap">
                      {response || 'No response yet. Execute a query to see results.'}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="headers" className="flex-1 mt-0">
                  <div className="h-full bg-gray-50 overflow-auto">
                    <pre className="p-4 text-sm font-mono text-gray-800 whitespace-pre-wrap">
                      {responseHeaders || 'No headers to display.'}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
