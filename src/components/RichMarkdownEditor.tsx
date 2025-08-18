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
          placeholder: "Enter markdown text with **bold**, *italic*, and line breaks...",
          style: { fontSize: '14px', fontFamily: 'inherit' }
        }}
        height={300}
      />
    </div>
  );
}
