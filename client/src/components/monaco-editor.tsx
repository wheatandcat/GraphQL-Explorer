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
    console.log('getSuggestions called:', { hasSchema: !!schema, language, position, text: text.substring(0, 100) });
    
    if (!schema || language !== 'graphql') {
      console.log('No schema or not GraphQL, returning empty');
      return [];
    }

    const beforeCursor = text.substring(0, position);
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Analyze the current context more precisely
    const getContextType = (): GraphQLType | null => {
      // First check if we're in a basic operation
      if (beforeCursor.includes('mutation') && !beforeCursor.includes('query')) {
        return schema.mutationType || null;
      }
      if (beforeCursor.includes('subscription') && !beforeCursor.includes('query')) {
        return schema.subscriptionType || null;
      }
      
      // For queries or nested fields, analyze the path
      const openBraces = (beforeCursor.match(/{/g) || []).length;
      const closeBraces = (beforeCursor.match(/}/g) || []).length;
      
      if (openBraces === 0) {
        // At the root level, suggest operation types
        return null;
      }
      
      // Get the Query type definition from the types array
      const queryTypeName = schema.queryType?.name || 'Query';
      let currentType = schema.types?.find(t => t.name === queryTypeName) || null;
      
      console.log('Schema queryType name:', queryTypeName);
      console.log('Found Query type in types array:', currentType?.name);
      console.log('Query type fields:', currentType?.fields?.map(f => f.name));
      
      // If still not found, try to find any type with query-like name
      if (!currentType) {
        currentType = schema.types?.find(t => t.name.toLowerCase() === 'query') || null;
        console.log('Fallback Query type found:', currentType?.name);
      }
      
      console.log('Initial currentType:', currentType?.name, 'Fields count:', currentType?.fields?.length);
      
      // Parse the field path more accurately
      // Split by braces and analyze each level
      const parts = beforeCursor.split('{');
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          const content = parts[i];
          // Remove everything after the last closing brace if any
          const lastCloseBrace = content.lastIndexOf('}');
          const relevantContent = lastCloseBrace !== -1 
            ? content.substring(lastCloseBrace + 1) 
            : content;
          
          // Extract field names (handling arguments and whitespace)
          const fieldMatches = relevantContent.match(/(\w+)(?:\s*\([^)]*\))?/g);
          
          if (fieldMatches && currentType?.fields) {
            // Take the last field as the current context
            const lastField = fieldMatches[fieldMatches.length - 1];
            const fieldName = lastField.replace(/\s*\([^)]*\)/, '');
            
            const field = currentType.fields.find(f => f.name === fieldName);
            if (field) {
              let fieldType = field.type;
              // Unwrap NON_NULL and LIST wrappers
              while (fieldType.kind === 'NON_NULL' || fieldType.kind === 'LIST') {
                fieldType = fieldType.ofType!;
              }
              
              if (fieldType.name) {
                const nextType = findTypeByName(fieldType.name);
                if (nextType) {
                  currentType = nextType;
                }
              }
            }
          }
        }
      }
      
      return currentType;
    };

    const currentType = getContextType();
    console.log('Current type:', currentType?.name, 'Fields:', currentType?.fields?.length);
    
    // Check if we're at root level (no braces yet)
    const openBraces = (beforeCursor.match(/{/g) || []).length;
    console.log('Open braces count:', openBraces);
    
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
      
      console.log('Operation suggestions:', operationSuggestions);
      return operationSuggestions;
    }

    if (!currentType?.fields) {
      console.log('No fields in current type');
      return [];
    }

    // Check if we're looking for field suggestions
    const fieldMatch = currentLine.match(/\s*(\w*)$/);
    console.log('Field match:', fieldMatch, 'Current line:', currentLine);
    
    if (fieldMatch) {
      const partial = fieldMatch[1];
      console.log('Partial match:', partial);
      
      if (!currentType?.fields) {
        console.log('No fields in current type for suggestions');
        return [];
      }
      
      console.log('Available fields:', currentType.fields.map(f => f.name));
      
      const suggestions = currentType.fields
        .filter(field => field.name.toLowerCase().includes(partial.toLowerCase()))
        .map(field => {
          const hasComplexType = field.type.kind === 'OBJECT' || 
                                (field.type.kind === 'NON_NULL' && field.type.ofType?.kind === 'OBJECT') ||
                                (field.type.kind === 'LIST' && field.type.ofType?.kind === 'OBJECT');
          
          let insertText = field.name;
          if (field.args && field.args.length > 0) {
            insertText += '(';
          } else if (hasComplexType) {
            insertText += ' {';
          }
          
          return {
            label: field.name,
            detail: getTypeString(field.type),
            documentation: field.description || `Field of type ${getTypeString(field.type)}`,
            insertText,
          };
        });
      
      console.log('Generated field suggestions:', suggestions);
      
      // Sort suggestions: starts with first, then contains, then alphabetical
      return suggestions.sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(partial.toLowerCase());
        const bStarts = b.label.toLowerCase().startsWith(partial.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
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

    // Auto-trigger suggestions when typing letters or after certain characters
    const lastChar = newValue[position - 1];
    const beforeCursor = newValue.substring(0, position);
    const currentLine = beforeCursor.split('\n').pop() || '';
    
    if (language === 'graphql' && schema) {
      console.log('Input change:', { lastChar, currentLine, position });
      
      // More aggressive triggering: trigger on any letter or after braces
      if (lastChar && (/[a-zA-Z]/.test(lastChar) || lastChar === '{' || lastChar === ' ')) {
        console.log('Triggering suggestions due to character:', lastChar);
        triggerSuggestions(newValue, position);
      } else {
        // Continue showing suggestions if we're still typing in a word
        const wordMatch = currentLine.match(/\w+$/);
        if (wordMatch && wordMatch[0].length > 0) {
          console.log('Continuing suggestions for word:', wordMatch[0]);
          triggerSuggestions(newValue, position);
        } else {
          console.log('Hiding suggestions');
          setShowSuggestions(false);
        }
      }
    } else {
      setShowSuggestions(false);
    }
  }, [onChange, language, triggerSuggestions, schema]);

  // Handle key down for suggestion navigation and smart indentation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter key for auto-indentation
    if (e.key === 'Enter' && language === 'graphql' && textareaRef.current) {
      const textarea = textareaRef.current;
      const position = textarea.selectionStart;
      const beforeCursor = value.substring(0, position);
      const afterCursor = value.substring(position);
      
      // Get current line and its indentation
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const currentIndent = currentLine.match(/^\s*/)?.[0] || '';
      
      // Determine if we need to increase indentation
      let newIndent = currentIndent;
      
      // Check if the current line ends with an opening brace
      const trimmedLine = currentLine.trim();
      if (trimmedLine.endsWith('{')) {
        newIndent = currentIndent + '  '; // Add 2 spaces for indentation
      }
      
      // Check if next line starts with closing brace and adjust
      const nextChar = afterCursor.charAt(0);
      const shouldAddClosingBrace = nextChar === '}';
      
      if (!showSuggestions || suggestions.length === 0) {
        e.preventDefault();
        
        let insertText = '\n' + newIndent;
        let newCursorPosition = position + insertText.length;
        
        // If we're inside braces and next char is '}', add extra line for closing brace
        if (shouldAddClosingBrace && newIndent.length > currentIndent.length) {
          insertText = '\n' + newIndent + '\n' + currentIndent;
          newCursorPosition = position + newIndent.length + 1;
        }
        
        const newValue = beforeCursor + insertText + afterCursor;
        onChange(newValue);
        
        setTimeout(() => {
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
        
        return;
      }
    }

    // Handle Tab key for indentation
    if (e.key === 'Tab' && language === 'graphql' && textareaRef.current && (!showSuggestions || suggestions.length === 0)) {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // If there's a selection, indent all selected lines
      if (start !== end) {
        const beforeSelection = value.substring(0, start);
        const selection = value.substring(start, end);
        const afterSelection = value.substring(end);
        
        const lines = selection.split('\n');
        const indentedLines = lines.map(line => '  ' + line);
        const newSelection = indentedLines.join('\n');
        
        const newValue = beforeSelection + newSelection + afterSelection;
        onChange(newValue);
        
        setTimeout(() => {
          textarea.setSelectionRange(start, start + newSelection.length);
        }, 0);
      } else {
        // Insert 2 spaces at cursor position
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(start);
        const newValue = beforeCursor + '  ' + afterCursor;
        onChange(newValue);
        
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
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
  }, [showSuggestions, suggestions, selectedSuggestion, value, cursorPosition, onChange, language]);

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
            ? 'Enter your GraphQL query here... (start typing for suggestions)' 
            : 'Enter JSON variables here...'
        }
        spellCheck={false}
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto"
          style={{
            top: '100%',
            left: '16px',
            minWidth: '300px',
            maxWidth: '500px',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.label}
              className={`px-3 py-2 cursor-pointer ${
                index === selectedSuggestion 
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-gray-100 text-gray-900'
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-sm ${
                  index === selectedSuggestion ? 'text-white' : 'text-gray-900'
                }`}>
                  {suggestion.label}
                </span>
                {suggestion.detail && (
                  <span className={`text-xs font-mono ml-2 ${
                    index === selectedSuggestion ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {suggestion.detail}
                  </span>
                )}
              </div>
              {suggestion.documentation && (
                <div className={`text-xs mt-1 ${
                  index === selectedSuggestion ? 'text-blue-100' : 'text-gray-600'
                }`}>
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
