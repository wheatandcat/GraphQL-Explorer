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
  Search,
  Database,
  Edit,
  Trash2,
  Check
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

interface EndpointConfig {
  id: string;
  name: string;
  url: string;
  headers: Header[];
  history: QueryHistory[];
  lastUsed: number;
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
  
  // Endpoint management state
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>(() => {
    const saved = localStorage.getItem('graphql-client-endpoints');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default endpoint configuration
    return [{
      id: 'default',
      name: 'Countries API',
      url: 'https://countries.trevorblades.com/',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      history: [],
      lastUsed: Date.now()
    }];
  });
  
  const [currentEndpointId, setCurrentEndpointId] = useState<string>(() => {
    const saved = localStorage.getItem('graphql-client-current-endpoint');
    return saved || 'default';
  });
  
  // Get current endpoint configuration
  const currentEndpoint = endpoints.find(ep => ep.id === currentEndpointId) || endpoints[0];
  
  // State derived from current endpoint
  const [endpoint, setEndpoint] = useState(currentEndpoint.url);
  const [headers, setHeaders] = useState<Header[]>(currentEndpoint.headers);
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

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [showEndpointManager, setShowEndpointManager] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  
  // Documentation state
  const [schema, setSchema] = useState<GraphQLSchema | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<GraphQLType | null>(null);
  
  // Panel state
  const [showVariables, setShowVariables] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  // Save endpoints to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('graphql-client-endpoints', JSON.stringify(endpoints));
  }, [endpoints]);
  
  // Save current endpoint ID
  useEffect(() => {
    localStorage.setItem('graphql-client-current-endpoint', currentEndpointId);
  }, [currentEndpointId]);
  
  // Update local state when endpoint changes
  useEffect(() => {
    if (currentEndpoint) {
      setEndpoint(currentEndpoint.url);
      setHeaders(currentEndpoint.headers);
    }
  }, [currentEndpoint]);

  // Endpoint management functions
  const updateCurrentEndpoint = useCallback((updates: Partial<Omit<EndpointConfig, 'id'>>) => {
    setEndpoints(prev => prev.map(ep => 
      ep.id === currentEndpointId 
        ? { ...ep, ...updates, lastUsed: Date.now() }
        : ep
    ));
  }, [currentEndpointId]);

  const addHeader = useCallback(() => {
    const newHeaders = [...headers, { key: '', value: '' }];
    setHeaders(newHeaders);
    updateCurrentEndpoint({ headers: newHeaders });
  }, [headers, updateCurrentEndpoint]);

  const removeHeader = useCallback((index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    setHeaders(newHeaders);
    updateCurrentEndpoint({ headers: newHeaders });
  }, [headers, updateCurrentEndpoint]);

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = headers.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    );
    setHeaders(newHeaders);
    updateCurrentEndpoint({ headers: newHeaders });
  }, [headers, updateCurrentEndpoint]);

  // Endpoint switching
  const switchToEndpoint = useCallback((endpointId: string) => {
    const targetEndpoint = endpoints.find(ep => ep.id === endpointId);
    if (targetEndpoint) {
      setCurrentEndpointId(endpointId);
      updateCurrentEndpoint({ lastUsed: Date.now() });
    }
  }, [endpoints, updateCurrentEndpoint]);

  // Add new endpoint
  const addEndpoint = useCallback((name: string, url: string) => {
    if (!name.trim() || !url.trim()) return;
    
    const newEndpoint: EndpointConfig = {
      id: Date.now().toString(),
      name: name.trim(),
      url: url.trim(),
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      history: [],
      lastUsed: Date.now()
    };
    setEndpoints(prev => [...prev, newEndpoint]);
    setCurrentEndpointId(newEndpoint.id);
    setNewEndpointName('');
    setNewEndpointUrl('');
    toast({
      title: 'Endpoint Added',
      description: `"${name}" endpoint has been added`,
    });
  }, [toast]);

  // Remove endpoint
  const removeEndpoint = useCallback((endpointId: string) => {
    if (endpoints.length <= 1) return; // Don't remove last endpoint
    
    setEndpoints(prev => prev.filter(ep => ep.id !== endpointId));
    if (currentEndpointId === endpointId) {
      const remaining = endpoints.filter(ep => ep.id !== endpointId);
      setCurrentEndpointId(remaining[0]?.id || 'default');
    }
  }, [endpoints, currentEndpointId]);

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

    // Update history for current endpoint
    updateCurrentEndpoint({
      history: [historyItem, ...currentEndpoint.history.filter(item => 
        !(item.query === query && item.variables === variables && item.endpoint === endpoint)
      )].slice(0, 50)
    });
  }, [currentEndpoint.history, updateCurrentEndpoint]);

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
      // Simple and reliable GraphQL query formatting
      let formatted = query.trim();
      let indentLevel = 0;
      const lines: string[] = [];
      
      // Split into lines first
      const originalLines = formatted.split('\n');
      
      for (const line of originalLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Handle closing braces
        if (trimmed.startsWith('}')) {
          indentLevel = Math.max(0, indentLevel - 1);
          lines.push('  '.repeat(indentLevel) + trimmed);
          continue;
        }
        
        // Add line with current indentation
        lines.push('  '.repeat(indentLevel) + trimmed);
        
        // Handle opening braces
        if (trimmed.endsWith('{')) {
          indentLevel++;
        }
      }
      
      setQuery(lines.join('\n'));
      
      toast({
        title: 'Query Formatted',
        description: 'GraphQL query has been formatted successfully',
      });
    } catch (error) {
      toast({
        title: 'Format Error',
        description: 'Could not format query. Please check your GraphQL syntax.',
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

  // Load query from history
  const loadFromHistory = useCallback((historyItem: QueryHistory) => {
    setQuery(historyItem.query);
    setVariables(historyItem.variables);
    if (historyItem.endpoint !== endpoint) {
      setEndpoint(historyItem.endpoint);
      updateCurrentEndpoint({ url: historyItem.endpoint });
    }
    setShowHistory(false);
    toast({
      title: 'History Loaded',
      description: `Loaded "${historyItem.name}" from history`,
    });
  }, [toast, endpoint, updateCurrentEndpoint]);

  // Clear history for current endpoint
  const clearHistory = useCallback(() => {
    updateCurrentEndpoint({ history: [] });
    toast({
      title: 'History Cleared',
      description: 'All query history has been cleared for this endpoint',
    });
  }, [toast, updateCurrentEndpoint]);

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
        // Don't auto-open docs on schema load
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

  // Auto-load schema when endpoint changes
  useEffect(() => {
    if (endpoint && endpoint.trim() !== '') {
      fetchSchema();
    }
  }, [endpoint, fetchSchema]);

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

  // Render clickable type with navigation
  const renderClickableType = useCallback((type: GraphQLType): React.ReactNode => {
    if (type.kind === 'NON_NULL') {
      return (
        <>
          {renderClickableType(type.ofType!)}
          <span>!</span>
        </>
      );
    }
    if (type.kind === 'LIST') {
      return (
        <>
          <span>[</span>
          {renderClickableType(type.ofType!)}
          <span>]</span>
        </>
      );
    }
    
    const typeName = type.name || 'Unknown';
    const isBuiltIn = ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(typeName);
    
    if (isBuiltIn) {
      return <span className="text-orange-600 font-mono text-sm font-semibold">{typeName}</span>;
    }
    
    // Check if this type exists in schema for navigation
    const targetType = findTypeByName(typeName);
    
    if (targetType) {
      return (
        <span 
          className="text-orange-600 font-mono text-sm font-semibold cursor-pointer hover:underline hover:bg-orange-50 px-1 rounded transition-colors"
          onClick={(e) => handleTypeClick(typeName, e)}
        >
          {typeName}
        </span>
      );
    }
    
    return <span className="text-orange-600 font-mono text-sm font-semibold">{typeName}</span>;
  }, [findTypeByName, handleTypeClick]);

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
          {/* Endpoint Management */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-gray-700">GraphQL Endpoints</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEndpointManager(true)}
                className="text-xs text-blue-600 hover:text-blue-700 p-0"
              >
                <Database className="w-3 h-3 mr-1" />
                Manage
              </Button>
            </div>
            
            {/* Current Endpoint Selector */}
            <div className="space-y-2">
              <select
                value={currentEndpointId}
                onChange={(e) => switchToEndpoint(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name} - {ep.url}
                  </option>
                ))}
              </select>
              
              {/* Current Endpoint URL Input */}
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="https://api.example.com/graphql"
                  value={endpoint}
                  onChange={(e) => {
                    setEndpoint(e.target.value);
                    updateCurrentEndpoint({ url: e.target.value });
                  }}
                  className="flex-1"
                />
                <Button onClick={testConnection} size="sm">
                  <Plug className="w-4 h-4" />
                </Button>
              </div>
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
                query={query}
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
                    History ({currentEndpoint.history.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!schema && !loadingSchema) {
                        fetchSchema();
                      }
                      setShowDocs(!showDocs);
                    }}
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
              <MonacoEditor
                value={query}
                onChange={setQuery}
                language="graphql"
                height="100%"
                schema={schema}
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
                                  ({field.args.map((arg, index) => (
                                    <span key={arg.name}>
                                      {index > 0 && ', '}
                                      <span className="text-gray-700">{arg.name}</span>
                                      <span>: </span>
                                      {renderClickableType(arg.type)}
                                    </span>
                                  ))})
                                </span>
                              )}
                              <span className="text-gray-500 text-sm mx-1">:</span>
                              <span>
                                {renderClickableType(field.type)}
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

      {/* History Panel - Full Screen Right Side Drawer */}
      {showHistory && (
        <div className="fixed top-0 right-0 w-1/2 h-screen bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              <span className="text-gray-600 text-sm">Query History</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 flex-1 text-center">
              Query History
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(false)}
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
                placeholder="Search history..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {currentEndpoint.history.length} {currentEndpoint.history.length === 1 ? 'query' : 'queries'} saved
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="text-xs text-red-600 hover:text-red-700"
              disabled={currentEndpoint.history.length === 0}
            >
              Clear All
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4">
              {currentEndpoint.history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 pt-20">
                  <Clock className="w-16 h-16 mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No query history yet</h3>
                  <p className="text-sm text-gray-400 text-center">
                    Execute GraphQL queries to build your history.<br />
                    Your queries will be automatically saved here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentEndpoint.history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 truncate flex-1 group-hover:text-blue-600">
                          {item.name}
                        </h4>
                        <span className="text-xs text-gray-500 ml-3 whitespace-nowrap">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 font-mono bg-gray-100 p-3 rounded border overflow-hidden">
                        <pre className="whitespace-pre-wrap text-wrap break-words">
                          {item.query.trim().substring(0, 200)}
                          {item.query.length > 200 ? '...' : ''}
                        </pre>
                      </div>
                      {item.variables && item.variables !== '{}' && (
                        <div className="text-xs text-blue-600 mt-2 flex items-center">
                          <Code className="w-3 h-3 mr-1" />
                          Has variables
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-2">
                        Click to load this query
                      </div>
                    </div>
                  ))}
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

      {/* Endpoint Manager Modal */}
      <Sheet open={showEndpointManager} onOpenChange={setShowEndpointManager}>
        <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Endpoint Manager
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-full">
            {/* Add New Endpoint */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Endpoint</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Endpoint name (e.g., My GraphQL API)"
                  value={newEndpointName}
                  onChange={(e) => setNewEndpointName(e.target.value)}
                  className="text-sm"
                />
                <Input
                  placeholder="Endpoint URL (e.g., https://api.example.com/graphql)"
                  value={newEndpointUrl}
                  onChange={(e) => setNewEndpointUrl(e.target.value)}
                  className="text-sm"
                />
                <Button
                  onClick={() => addEndpoint(newEndpointName, newEndpointUrl)}
                  disabled={!newEndpointName.trim() || !newEndpointUrl.trim()}
                  className="w-full"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Endpoint
                </Button>
              </div>
            </div>

            {/* Endpoint List */}
            <div className="flex-1 overflow-hidden">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Saved Endpoints ({endpoints.length})
              </h3>
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {endpoints.map((ep) => (
                    <div
                      key={ep.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        ep.id === currentEndpointId
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          {editingEndpoint === ep.id ? (
                            <Input
                              value={ep.name}
                              onChange={(e) => {
                                setEndpoints(prev => prev.map(endpoint => 
                                  endpoint.id === ep.id 
                                    ? { ...endpoint, name: e.target.value }
                                    : endpoint
                                ));
                              }}
                              className="text-sm font-medium mb-1"
                              onBlur={() => setEditingEndpoint(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingEndpoint(null);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <h4 
                              className="text-sm font-medium text-gray-900 truncate cursor-pointer"
                              onClick={() => setEditingEndpoint(ep.id)}
                            >
                              {ep.name}
                              {ep.id === currentEndpointId && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Current
                                </span>
                              )}
                            </h4>
                          )}
                          <p className="text-xs text-gray-500 truncate">{ep.url}</p>
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <History className="w-3 h-3 mr-1" />
                            {ep.history.length} queries
                            <span className="mx-2">•</span>
                            Last used: {new Date(ep.lastUsed).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          {ep.id !== currentEndpointId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => switchToEndpoint(ep.id)}
                              className="p-1 text-blue-600 hover:text-blue-700"
                              title="Switch to this endpoint"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingEndpoint(ep.id)}
                            className="p-1 text-gray-600 hover:text-gray-700"
                            title="Edit endpoint name"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {endpoints.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEndpoint(ep.id)}
                              className="p-1 text-red-600 hover:text-red-700"
                              title="Delete endpoint"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
