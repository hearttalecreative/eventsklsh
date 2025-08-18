
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
          placeholder: "Escribe el texto aquí. Usa **negrita**, *itálica* y presiona Enter dos veces para saltos de línea...",
          style: { fontSize: '14px', fontFamily: 'inherit', lineHeight: '1.5' }
        }}
        height={400}
        data-color-mode="light"
      />
    </div>
  );
}
