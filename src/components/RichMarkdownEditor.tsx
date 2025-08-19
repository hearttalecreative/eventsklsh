import React from "react";
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function RichMarkdownEditor({ value, onChange }: Props) {
  return (
    <div className="border rounded-md bg-background overflow-hidden">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        preview="live"
        hideToolbar={false}
        visibleDragbar={false}
        textareaProps={{
          placeholder: "Presiona Enter para saltos de línea. Usa **negrita**, *cursiva*, y listas:\n• Elemento 1\n• Elemento 2\n\nPárrafos separados...",
          style: { 
            fontSize: '14px', 
            fontFamily: 'inherit',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap'
          }
        }}
        height={300}
        previewOptions={{
          remarkPlugins: [],
          rehypePlugins: [],
          components: {
            p: ({ children }) => <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>{children}</p>,
            br: () => <br style={{ marginBottom: '0.5rem' }} />,
          }
        }}
      />
    </div>
  );
}
