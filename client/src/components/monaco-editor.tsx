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
}: MonacoEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className="w-full h-full p-4 font-mono text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      style={{ 
        height,
        fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
        fontSize: '14px',
        lineHeight: '1.5'
      }}
      placeholder={
        language === 'graphql' 
          ? 'Enter your GraphQL query here...' 
          : 'Enter JSON variables here...'
      }
      spellCheck={false}
    />
  );
}
