import { useState, useRef, useEffect, useCallback } from 'react';

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

interface GraphQLType {
  name: string;
  kind: string;
  description?: string;
  fields?: GraphQLField[];
  enumValues?: GraphQLEnumValue[];
  inputFields?: GraphQLInputField[];
  ofType?: GraphQLType;
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

interface Suggestion {
  label: string;
  detail?: string;
  documentation?: string;
  insertText: string;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'graphql' | 'json';
  height?: string;
  readOnly?: boolean;
  theme?: 'vs' | 'vs-dark' | 'hc-black';
  schema?: GraphQLSchema;
}

export function MonacoEditor({
  value,
  onChange,
  language,
  height = '100%',
  readOnly = false,
  schema,
}: MonacoEditorProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get type string representation
  const getTypeString = useCallback((type: GraphQLType): string => {
    if (type.kind === 'NON_NULL') {
      return getTypeString(type.ofType!) + '!';
    }
    if (type.kind === 'LIST') {
      return '[' + getTypeString(type.ofType!) + ']';
    }
    return type.name || 'Unknown';
  }, []);

  // Find type by name in schema
  const findTypeByName = useCallback((typeName: string): GraphQLType | null => {
    if (!schema) return null;
    return schema.types.find(type => type.name === typeName) || null;
  }, [schema]);

  // Parse current context and get suggestions
  const getSuggestions = useCallback((text: string, position: number): Suggestion[] => {
    if (!schema || language !== 'graphql') return [];

    const beforeCursor = text.substring(0, position);
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Analyze the current context more precisely
    const getContextType = (): GraphQLType | null => {
      // First check if we're in a basic operation
      if (beforeCursor.includes('mutation')) {
        return schema.mutationType || null;
      }
      if (beforeCursor.includes('subscription')) {
        return schema.subscriptionType || null;
      }
      
      // For queries or nested fields, analyze the path
      const openBraces = (beforeCursor.match(/{/g) || []).length;
      const closeBraces = (beforeCursor.match(/}/g) || []).length;
      
      if (openBraces === 0) {
        // At the root level, suggest operation types
        return null;
      }
      
      if (openBraces === 1 && closeBraces === 0) {
        // First level inside operation
        return schema.queryType || null;
      }
      
      // Try to parse nested field context
      const fieldPath = [];
      let currentType = schema.queryType;
      
      // Simple parsing: look for field selections in braces
      const bracesContent = beforeCursor.split('{');
      if (bracesContent.length > 1) {
        const lastSelection = bracesContent[bracesContent.length - 1];
        const fieldMatches = lastSelection.match(/(\w+)(?:\([^)]*\))?\s*{?/g);
        
        if (fieldMatches) {
          for (const match of fieldMatches) {
            const fieldName = match.replace(/\([^)]*\)|\s*{?/g, '');
            if (currentType?.fields) {
              const field = currentType.fields.find(f => f.name === fieldName);
              if (field) {
                let fieldType = field.type;
                // Unwrap NON_NULL and LIST wrappers
                while (fieldType.kind === 'NON_NULL' || fieldType.kind === 'LIST') {
                  fieldType = fieldType.ofType!;
                }
                currentType = findTypeByName(fieldType.name!);
              }
            }
          }
        }
      }
      
      return currentType;
    };

    const currentType = getContextType();
    
    // Check if we're at root level (no braces yet)
    const openBraces = (beforeCursor.match(/{/g) || []).length;
    if (openBraces === 0) {
      const partial = currentLine.trim();
      const operationSuggestions = [];
      
      if ('query'.startsWith(partial.toLowerCase())) {
        operationSuggestions.push({
          label: 'query',
          detail: 'Query operation',
          documentation: 'Fetch data from the GraphQL endpoint',
          insertText: 'query {\n  ',
        });
      }
      if ('mutation'.startsWith(partial.toLowerCase()) && schema.mutationType) {
        operationSuggestions.push({
          label: 'mutation',
          detail: 'Mutation operation',
          documentation: 'Modify data on the GraphQL endpoint',
          insertText: 'mutation {\n  ',
        });
      }
      if ('subscription'.startsWith(partial.toLowerCase()) && schema.subscriptionType) {
        operationSuggestions.push({
          label: 'subscription',
          detail: 'Subscription operation',
          documentation: 'Listen for real-time updates',
          insertText: 'subscription {\n  ',
        });
      }
      
      return operationSuggestions;
    }

    if (!currentType?.fields) return [];

    // Check if we're looking for field suggestions
    const fieldMatch = currentLine.match(/\s*(\w*)$/);
    if (fieldMatch) {
      const partial = fieldMatch[1];
      
      const suggestions = currentType.fields
        .filter(field => field.name.toLowerCase().startsWith(partial.toLowerCase()))
        .map(field => {
          const hasComplexType = field.type.kind === 'OBJECT' || 
                                (field.type.kind === 'NON_NULL' && field.type.ofType?.kind === 'OBJECT') ||
                                (field.type.kind === 'LIST' && field.type.ofType?.kind === 'OBJECT');
          
          let insertText = field.name;
          if (field.args && field.args.length > 0) {
            insertText += '(';
          } else if (hasComplexType) {
            insertText += ' {\n  ';
          }
          
          return {
            label: field.name,
            detail: getTypeString(field.type),
            documentation: field.description,
            insertText,
          };
        });
      
      // Sort suggestions: exact matches first, then alphabetical
      return suggestions.sort((a, b) => {
        const aExact = a.label.toLowerCase() === partial.toLowerCase();
        const bExact = b.label.toLowerCase() === partial.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.label.localeCompare(b.label);
      });
    }

    return [];
  }, [schema, language, getTypeString, findTypeByName]);

  // Trigger suggestions manually or automatically
  const triggerSuggestions = useCallback((text: string, position: number) => {
    if (language === 'graphql') {
      const newSuggestions = getSuggestions(text, position);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestion(0);
    }
  }, [language, getSuggestions]);

  // Handle input change and update suggestions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(position);

    // Auto-trigger suggestions when typing letters
    const lastChar = newValue[position - 1];
    if (language === 'graphql' && lastChar && /[a-zA-Z{]/.test(lastChar)) {
      triggerSuggestions(newValue, position);
    } else {
      setShowSuggestions(false);
    }
  }, [onChange, language, triggerSuggestions]);

  // Handle key down for suggestion navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl+Space for manual suggestion trigger
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      if (textareaRef.current) {
        const position = textareaRef.current.selectionStart;
        triggerSuggestions(value, position);
      }
      return;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        const suggestion = suggestions[selectedSuggestion];
        if (suggestion && textareaRef.current) {
          const textarea = textareaRef.current;
          const beforeCursor = value.substring(0, cursorPosition);
          const afterCursor = value.substring(cursorPosition);
          
          // Find the start of the current word
          const wordMatch = beforeCursor.match(/\w*$/);
          const wordStart = wordMatch ? cursorPosition - wordMatch[0].length : cursorPosition;
          
          const newValue = value.substring(0, wordStart) + suggestion.insertText + afterCursor;
          const newCursorPosition = wordStart + suggestion.insertText.length;
          
          onChange(newValue);
          setShowSuggestions(false);
          
          // Set cursor position after state update
          setTimeout(() => {
            textarea.setSelectionRange(newCursorPosition, newCursorPosition);
          }, 0);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestion, value, cursorPosition, onChange, triggerSuggestions]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const beforeCursor = value.substring(0, cursorPosition);
      const afterCursor = value.substring(cursorPosition);
      
      // Find the start of the current word
      const wordMatch = beforeCursor.match(/\w*$/);
      const wordStart = wordMatch ? cursorPosition - wordMatch[0].length : cursorPosition;
      
      const newValue = value.substring(0, wordStart) + suggestion.insertText + afterCursor;
      const newCursorPosition = wordStart + suggestion.insertText.length;
      
      onChange(newValue);
      setShowSuggestions(false);
      
      // Set cursor position and focus
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        textarea.focus();
      }, 0);
    }
  }, [value, cursorPosition, onChange]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" style={{ height }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        className="w-full h-full p-4 font-mono text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ 
          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        placeholder={
          language === 'graphql' 
            ? 'Enter your GraphQL query here... (start typing or press Ctrl+Space for suggestions)' 
            : 'Enter JSON variables here...'
        }
        spellCheck={false}
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          style={{
            top: '100%',
            left: '16px',
            minWidth: '300px',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.label}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                index === selectedSuggestion 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-blue-600">
                  {suggestion.label}
                </span>
                {suggestion.detail && (
                  <span className="text-xs text-orange-600 font-mono">
                    {suggestion.detail}
                  </span>
                )}
              </div>
              {suggestion.documentation && (
                <div className="text-xs text-gray-600 mt-1">
                  {suggestion.documentation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
