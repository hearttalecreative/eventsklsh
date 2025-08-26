import React, { useState } from "react";
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Quote, Code, Link, Eye, EyeOff } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function RichMarkdownEditor({ value, onChange }: Props) {
  const [showPreview, setShowPreview] = useState(true);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newValue = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newValue);
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 10);
  };

  return (
    <div className="border rounded-md bg-background overflow-hidden">
      {/* Custom toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('**', '**')}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('*', '*')}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('\n- ', '')}
          title="List"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('\n1. ', '')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('\n> ', '')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('`', '`')}
          title="Code"
        >
          <Code className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('[', '](url)')}
          title="Link"
        >
          <Link className="w-4 h-4" />
        </Button>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? "Hide preview" : "Show preview"}
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>

      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        preview={showPreview ? "live" : "edit"}
        hideToolbar
        visibleDragbar={false}
        textareaProps={{
          placeholder: "Write here...\n\nUse **bold**, *italic*, lists:\n- Item 1\n- Item 2\n\nPress Enter twice for new paragraphs.",
          style: { 
            fontSize: '14px', 
            fontFamily: 'inherit',
            lineHeight: '1.6',
            padding: '12px',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }
        }}
        height={400}
        previewOptions={{
          components: {
            p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="mb-4 list-disc pl-6 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 list-decimal pl-6 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            blockquote: ({ children }) => <blockquote className="mb-4 pl-4 border-l-4 border-muted italic text-muted-foreground">{children}</blockquote>,
            code: ({ children }) => <code className="px-1 py-0.5 bg-muted rounded text-sm font-mono">{children}</code>,
            pre: ({ children }) => <pre className="mb-4 p-3 bg-muted rounded overflow-x-auto">{children}</pre>,
            h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-2 text-lg font-medium">{children}</h3>,
          }
        }}
      />
    </div>
  );
}
