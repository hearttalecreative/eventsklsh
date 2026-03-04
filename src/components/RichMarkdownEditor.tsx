import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import showdown from "showdown";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Quote, Code, Link as LinkIcon, Heading2, Undo2, Redo2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function normalizeHtml(input: string) {
  return (input || "")
    .replace(/\s+/g, " ")
    .replace(/<p><\/p>/g, "")
    .trim();
}

export default function RichMarkdownEditor({ value, onChange }: Props) {
  const markdownConverter = useMemo(
    () =>
      new showdown.Converter({
        tables: true,
        simplifiedAutoLink: true,
        strikethrough: true,
        tasklists: true,
      }),
    [],
  );

  const contentAsHtml = useMemo(() => {
    if (!value) return "";
    return looksLikeHtml(value) ? value : markdownConverter.makeHtml(value);
  }, [value, markdownConverter]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
      }),
      Placeholder.configure({
        placeholder: "Write event content here...",
      }),
    ],
    content: contentAsHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] md:min-h-[300px] w-full rounded-b-md border-0 bg-background px-3 py-3 text-sm leading-relaxed focus-visible:outline-none [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-xl [&_h2]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:italic",
      },
    },
    onUpdate({ editor: current }) {
      onChange(current.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (!editor.isEditable) {
      editor.setEditable(true);
    }
    const current = normalizeHtml(editor.getHTML());
    const incoming = normalizeHtml(contentAsHtml);
    if (current !== incoming) {
      editor.commands.setContent(contentAsHtml || "", { emitUpdate: false });
    }
  }, [editor, contentAsHtml]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previous);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="border rounded-md bg-background overflow-hidden max-w-full min-w-0">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
        <Button type="button" variant={editor?.isActive("bold") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("italic") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("heading", { level: 2 }) ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("bulletList") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("orderedList") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("blockquote") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleBlockquote().run()} title="Quote">
          <Quote className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("code") ? "secondary" : "ghost"} size="sm" onClick={() => editor?.chain().focus().toggleCode().run()} title="Inline code">
          <Code className="w-4 h-4" />
        </Button>
        <Button type="button" variant={editor?.isActive("link") ? "secondary" : "ghost"} size="sm" onClick={setLink} title="Link">
          <LinkIcon className="w-4 h-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor?.chain().focus().undo().run()} title="Undo">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor?.chain().focus().redo().run()} title="Redo">
          <Redo2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="cursor-text">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
