import { useEffect, useRef } from 'react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'graphql' | 'json';
  height?: string;
  readOnly?: boolean;
  theme?: 'vs' | 'vs-dark' | 'hc-black';
}

export function MonacoEditor({
  value,
  onChange,
  language,
  height = '100%',
  readOnly = false,
  theme = 'vs',
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    const initMonaco = async () => {
      if (!containerRef.current || isInitialized.current) return;

      try {
        // Use a simple fallback for GraphQL - treat it as plain text with syntax highlighting
        const editorLanguage = language === 'graphql' ? 'plaintext' : language;
        
        // For now, use a simple textarea for GraphQL to avoid Monaco worker issues
        if (language === 'graphql') {
          const textarea = document.createElement('textarea');
          textarea.value = value;
          textarea.className = 'w-full h-full p-4 font-mono text-sm border-0 outline-0 resize-none bg-white';
          textarea.style.fontFamily = 'JetBrains Mono, Monaco, Consolas, monospace';
          textarea.style.fontSize = '14px';
          textarea.style.lineHeight = '1.5';
          textarea.readOnly = readOnly;
          
          textarea.addEventListener('input', () => {
            onChange(textarea.value);
          });
          
          containerRef.current.appendChild(textarea);
          editorRef.current = { 
            getValue: () => textarea.value,
            setValue: (val: string) => { textarea.value = val; },
            dispose: () => { if (textarea.parentNode) textarea.parentNode.removeChild(textarea); }
          };
          isInitialized.current = true;
          return;
        }

        // For JSON, use Monaco with minimal configuration
        const monaco = await import('monaco-editor');
        
        editorRef.current = monaco.editor.create(containerRef.current, {
          value,
          language: editorLanguage,
          theme,
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          automaticLayout: true,
          wordWrap: 'on',
        });

        editorRef.current.onDidChangeModelContent(() => {
          const newValue = editorRef.current.getValue();
          onChange(newValue);
        });
        
        isInitialized.current = true;
      } catch (error) {
        console.error('Failed to initialize Monaco editor:', error);
        
        // Fallback to simple textarea
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.className = 'w-full h-full p-4 font-mono text-sm border-0 outline-0 resize-none bg-white';
        textarea.readOnly = readOnly;
        
        textarea.addEventListener('input', () => {
          onChange(textarea.value);
        });
        
        containerRef.current.appendChild(textarea);
        editorRef.current = { 
          getValue: () => textarea.value,
          setValue: (val: string) => { textarea.value = val; },
          dispose: () => { if (textarea.parentNode) textarea.parentNode.removeChild(textarea); }
        };
        isInitialized.current = true;
      }
    };

    initMonaco();

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
      isInitialized.current = false;
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div 
      ref={containerRef} 
      style={{ height }}
      className="border border-gray-300 rounded-md overflow-hidden"
    />
  );
}
