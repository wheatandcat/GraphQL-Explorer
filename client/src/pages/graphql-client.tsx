import { useState, useCallback, useEffect, useRef } from 'react';
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
  Loader2,
  History,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Header {
  key: string;
  value: string;
}

interface QueryHistory {
  id: string;
  query: string;
  variables: string;
  endpoint: string;
  timestamp: number;
  name?: string;
}

interface GraphQLType {
  name: string;
  kind: string;
  description?: string;
  fields?: GraphQLField[];
  enumValues?: GraphQLEnumValue[];
  inputFields?: GraphQLInputField[];
  ofType?: GraphQLType;
}

interface GraphQLField {
  name: string;
  description?: string;
  type: GraphQLType;
  args?: GraphQLInputField[];
}

interface GraphQLInputField {
  name: string;
  description?: string;
  type: GraphQLType;
  defaultValue?: any;
}

interface GraphQLEnumValue {
  name: string;
  description?: string;
}

interface GraphQLSchema {
  queryType?: GraphQLType;
  mutationType?: GraphQLType;
  subscriptionType?: GraphQLType;
  types: GraphQLType[];
}

export default function GraphQLClientPage() {
  const { toast } = useToast();
  
  // State
  const [endpoint, setEndpoint] = useState('https://countries.trevorblades.com/');
  const [headers, setHeaders] = useState<Header[]>([
    { key: 'Content-Type', value: 'application/json' }
  ]);
  const [variables, setVariables] = useState('{}');
  const [query, setQuery] = useState(`query {
  countries {
    code
    name
    capital
    currency
  }
}`);
  const [response, setResponse] = useState('');
  const [responseHeaders, setResponseHeaders] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('0 B');
  const [responseStatus, setResponseStatus] = useState({ status: 0, statusText: '' });

  // Resizable pane state
  const [queryEditorHeight, setQueryEditorHeight] = useState(() => {
    const saved = localStorage.getItem('graphql-client-query-height');
    return saved ? parseInt(saved, 10) : 50; // Default to 50% height
  });
  
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Query history state
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>(() => {
    const saved = localStorage.getItem('graphql-client-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  
  // Documentation state
  const [schema, setSchema] = useState<GraphQLSchema | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<GraphQLType | null>(null);
  
  // Panel state
  const [showVariables, setShowVariables] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

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

  // Add to history after successful query execution
  const addToHistory = useCallback((query: string, variables: string, endpoint: string) => {
    const historyItem: QueryHistory = {
      id: Date.now().toString(),
      query,
      variables,
      endpoint,
      timestamp: Date.now(),
      name: extractQueryName(query) || 'Untitled Query'
    };

    setQueryHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(item => 
        !(item.query === query && item.variables === variables && item.endpoint === endpoint)
      );
      // Add new item at the beginning and keep only last 50
      return [historyItem, ...filtered].slice(0, 50);
    });
  }, []);

  // Extract query name from GraphQL query
  const extractQueryName = useCallback((query: string): string | null => {
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
    return match ? match[1] : null;
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
      
      const client = new GraphQLClient(endpoint, headersObj);
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

      const client = new GraphQLClient(endpoint, headersObj);

      const result = await client.execute({
        query,
        variables: parsedVariables,
      });

      setResponse(JSON.stringify(result.response, null, 2));
      setResponseHeaders(JSON.stringify(headersObj, null, 2));
      setResponseTime(result.responseTime);
      setResponseSize(result.responseSize);
      setResponseStatus({ status: result.status, statusText: result.statusText });

      // Add to history on successful execution (even with GraphQL errors)
      if (result.status >= 200 && result.status < 300) {
        addToHistory(query, variables, endpoint);
      }

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
  }, [endpoint, headers, variables, query, toast, addToHistory]);

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

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeightPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    
    // Limit between 20% and 80%
    const clampedHeight = Math.max(20, Math.min(80, newHeightPercent));
    setQueryEditorHeight(clampedHeight);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Save to localStorage when height changes
  useEffect(() => {
    localStorage.setItem('graphql-client-query-height', queryEditorHeight.toString());
  }, [queryEditorHeight]);

  // Cleanup event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Save query history to localStorage
  useEffect(() => {
    localStorage.setItem('graphql-client-history', JSON.stringify(queryHistory));
  }, [queryHistory]);

  // Load query from history
  const loadFromHistory = useCallback((historyItem: QueryHistory) => {
    setQuery(historyItem.query);
    setVariables(historyItem.variables);
    setEndpoint(historyItem.endpoint);
    setShowHistory(false);
    toast({
      title: 'History Loaded',
      description: `Loaded "${historyItem.name}" from history`,
    });
  }, [toast]);

  // Clear history
  const clearHistory = useCallback(() => {
    setQueryHistory([]);
    toast({
      title: 'History Cleared',
      description: 'All query history has been cleared',
    });
  }, [toast]);

  // Fetch GraphQL schema using introspection
  const fetchSchema = useCallback(async () => {
    if (!endpoint) {
      toast({
        title: 'Error',
        description: 'Please enter a GraphQL endpoint first',
        variant: 'destructive',
      });
      return;
    }

    setLoadingSchema(true);
    try {
      const client = new GraphQLClient(endpoint);
      
      // Set headers for the introspection query
      const headersObj: RequestHeaders = {};
      headers.forEach(header => {
        if (header.key && header.value) {
          headersObj[header.key] = header.value;
        }
      });
      client.setHeaders(headersObj);

      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              ...FullType
            }
          }
        }

        fragment FullType on __Type {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            args {
              ...InputValue
            }
            type {
              ...TypeRef
            }
          }
          inputFields {
            ...InputValue
          }
          interfaces {
            ...TypeRef
          }
          enumValues(includeDeprecated: true) {
            name
            description
          }
          possibleTypes {
            ...TypeRef
          }
        }

        fragment InputValue on __InputValue {
          name
          description
          type { ...TypeRef }
          defaultValue
        }

        fragment TypeRef on __Type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await client.execute({
        query: introspectionQuery,
      });

      if (result.response.errors) {
        throw new Error(result.response.errors[0]?.message || 'Failed to fetch schema');
      }

      if (result.response.data?.__schema) {
        setSchema(result.response.data.__schema);
        setShowDocs(true);
        toast({
          title: 'Schema Loaded',
          description: 'GraphQL schema documentation is now available',
        });
      } else {
        throw new Error('Invalid schema response');
      }
    } catch (error) {
      toast({
        title: 'Schema Error',
        description: error instanceof Error ? error.message : 'Failed to load schema',
        variant: 'destructive',
      });
    } finally {
      setLoadingSchema(false);
    }
  }, [endpoint, headers, toast]);

  // Toggle type expansion in docs
  const toggleTypeExpansion = useCallback((typeName: string) => {
    setExpandedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
  }, []);

  // Render GraphQL type string
  const renderType = useCallback((type: GraphQLType): string => {
    if (type.kind === 'NON_NULL') {
      return renderType(type.ofType!) + '!';
    }
    if (type.kind === 'LIST') {
      return '[' + renderType(type.ofType!) + ']';
    }
    return type.name || 'Unknown';
  }, []);



  // Get user-defined types (filter out built-in GraphQL types and root types)
  const getUserDefinedTypes = useCallback((types: GraphQLType[]) => {
    const rootTypeNames = [];
    if (schema?.queryType) rootTypeNames.push(schema.queryType.name);
    if (schema?.mutationType) rootTypeNames.push(schema.mutationType.name);
    if (schema?.subscriptionType) rootTypeNames.push(schema.subscriptionType.name);
    
    return types.filter(type => 
      !type.name?.startsWith('__') && 
      !['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type.name || '') &&
      !rootTypeNames.includes(type.name || '')
    );
  }, [schema]);

  // Find type by name in schema
  const findTypeByName = useCallback((typeName: string): GraphQLType | null => {
    if (!schema) return null;
    return schema.types.find(type => type.name === typeName) || null;
  }, [schema]);

  // Handle clicking on a type name
  const handleTypeClick = useCallback((typeName: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const type = findTypeByName(typeName);
    if (type) {
      setSelectedType(type);
      setExpandedTypes(prev => new Set([...prev, typeName]));
      
      // Scroll to the type in the types list
      setTimeout(() => {
        const element = document.getElementById(`type-${typeName}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [findTypeByName]);

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

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
        <div ref={containerRef} className="flex-1 flex flex-col">
          {/* Query Editor Section */}
          <div 
            className="flex flex-col bg-white border-b border-gray-200"
            style={{ height: `${queryEditorHeight}%` }}
          >
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs"
                  >
                    <History className="w-3 h-3 mr-1" />
                    History ({queryHistory.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSchema}
                    disabled={loadingSchema}
                    className="text-xs"
                  >
                    {loadingSchema ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <BookOpen className="w-3 h-3 mr-1" />
                    )}
                    Docs
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
              {/* History Panel */}
              {showHistory && (
                <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg z-10 flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-700">Query History</h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="text-xs text-red-600 hover:text-red-700"
                        disabled={queryHistory.length === 0}
                      >
                        Clear All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(false)}
                        className="p-1"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {queryHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Clock className="w-8 h-8 mb-2" />
                        <p className="text-sm">No query history yet</p>
                        <p className="text-xs text-gray-400">Execute queries to build history</p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {queryHistory.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => loadFromHistory(item)}
                            className="p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="text-xs font-medium text-gray-900 truncate flex-1">
                                {item.name}
                              </h4>
                              <span className="text-xs text-gray-500 ml-2">
                                {formatTimestamp(item.timestamp)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 font-mono bg-gray-100 p-1 rounded truncate">
                              {item.query.replace(/\s+/g, ' ').trim().substring(0, 60)}
                              {item.query.length > 60 ? '...' : ''}
                            </div>
                            {item.variables && item.variables !== '{}' && (
                              <div className="text-xs text-gray-400 mt-1">
                                Has variables
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <MonacoEditor
                value={query}
                onChange={setQuery}
                language="graphql"
                height="100%"
              />
            </div>
          </div>

          {/* Resize Bar */}
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className="h-1 bg-gray-200 hover:bg-blue-400 cursor-row-resize border-t border-b border-gray-300 flex items-center justify-center group transition-colors"
          >
            <div className="w-8 h-0.5 bg-gray-400 group-hover:bg-blue-600 transition-colors"></div>
          </div>

          {/* Results Section */}
          <div 
            className="flex flex-col bg-white"
            style={{ height: `${100 - queryEditorHeight}%` }}
          >
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

      {/* Documentation Panel - Full Screen Right Side Drawer */}
      {showDocs && schema && (
        <div className="fixed top-0 right-0 w-1/2 h-screen bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              {selectedType ? (
                <button
                  onClick={() => setSelectedType(null)}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span>Schema</span>
                </button>
              ) : (
                <span className="text-gray-600 text-sm">Documentation Explorer</span>
              )}
            </div>
            <h1 className="text-lg font-semibold text-gray-900 flex-1 text-center">
              {selectedType ? selectedType.name : 'Documentation Explorer'}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDocs(false)}
              className="p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={selectedType ? `Search ${selectedType.name}...` : "Search Schema..."}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4">
              {selectedType ? (
                // Selected Type Details View
                <div>
                  {/* Type Description */}
                  {selectedType.description && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700">{selectedType.description}</p>
                    </div>
                  )}

                  {/* IMPLEMENTS Section */}
                  {selectedType.kind === 'OBJECT' && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                        IMPLEMENTS
                      </h3>
                      <div className="text-sm text-orange-600 font-mono">Node</div>
                    </div>
                  )}

                  {/* FIELDS Section */}
                  {selectedType.fields && selectedType.fields.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                        FIELDS
                      </h3>
                      <div className="space-y-4">
                        {selectedType.fields.map((field) => (
                          <div key={field.name} className="border-b border-gray-100 pb-4 last:border-b-0">
                            <div className="flex items-baseline mb-1">
                              <span className="text-blue-600 font-mono text-sm mr-1">{field.name}</span>
                              {field.args && field.args.length > 0 && (
                                <span className="text-gray-500 text-sm">
                                  ({field.args.map(arg => `${arg.name}: ${renderType(arg.type)}`).join(', ')})
                                </span>
                              )}
                              <span className="text-gray-500 text-sm mx-1">:</span>
                              <span className="text-orange-600 font-mono text-sm font-semibold">
                                {renderType(field.type)}
                              </span>
                            </div>
                            {field.description && (
                              <p className="text-sm text-gray-600 ml-0">{field.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Enum Values */}
                  {selectedType.enumValues && selectedType.enumValues.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                        VALUES
                      </h3>
                      <div className="space-y-2">
                        {selectedType.enumValues.map((enumValue) => (
                          <div key={enumValue.name} className="border-b border-gray-100 pb-2 last:border-b-0">
                            <div className="text-orange-600 font-mono text-sm font-semibold">
                              {enumValue.name}
                            </div>
                            {enumValue.description && (
                              <p className="text-sm text-gray-600 mt-1">{enumValue.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Schema Overview
                <div>
                  {/* Schema Description */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">
                      A GraphQL schema provides a root type for each kind of operation.
                    </p>
                  </div>

                  {/* ROOT TYPES Section */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                      ROOT TYPES
                    </h3>
                    <div className="space-y-2">
                      {schema.queryType && (
                        <div 
                          className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                          onClick={() => handleTypeClick(schema.queryType!.name)}
                        >
                          <span className="text-red-600 text-sm mr-2">query:</span>
                          <span className="text-orange-600 font-mono text-sm font-semibold hover:underline">
                            {schema.queryType.name}
                          </span>
                        </div>
                      )}
                      {schema.mutationType && (
                        <div 
                          className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                          onClick={() => handleTypeClick(schema.mutationType!.name)}
                        >
                          <span className="text-red-600 text-sm mr-2">mutation:</span>
                          <span className="text-orange-600 font-mono text-sm font-semibold hover:underline">
                            {schema.mutationType.name}
                          </span>
                        </div>
                      )}
                      {schema.subscriptionType && (
                        <div 
                          className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                          onClick={() => handleTypeClick(schema.subscriptionType!.name)}
                        >
                          <span className="text-red-600 text-sm mr-2">subscription:</span>
                          <span className="text-orange-600 font-mono text-sm font-semibold hover:underline">
                            {schema.subscriptionType.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ALL TYPES Section */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                      ALL TYPES
                    </h3>
                    <div className="space-y-2">
                      {getUserDefinedTypes(schema.types).map((type) => (
                        <div 
                          key={type.name}
                          className="cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                          onClick={() => handleTypeClick(type.name!)}
                        >
                          <span className="text-orange-600 font-mono text-sm font-semibold hover:underline">
                            {type.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Variables Panel */}
      <Sheet open={showVariables} onOpenChange={setShowVariables}>
        <SheetContent side="bottom" className="h-1/2">
          <SheetHeader>
            <SheetTitle>Query Variables</SheetTitle>
          </SheetHeader>
          <div className="mt-4 h-full">
            <MonacoEditor
              value={variables}
              onChange={setVariables}
              language="json"
              height="100%"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Headers Panel */}
      <Sheet open={showHeaders} onOpenChange={setShowHeaders}>
        <SheetContent side="bottom" className="h-1/2">
          <SheetHeader>
            <SheetTitle>Request Headers</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Header value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHeader(index)}
                  className="p-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addHeader}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Header
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
