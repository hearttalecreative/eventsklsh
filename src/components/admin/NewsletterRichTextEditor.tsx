import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Heading3, Heading4, Pilcrow, CornerDownLeft } from "lucide-react";

interface NewsletterRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function normalizeHtml(input: string) {
  return (input || "")
    .replace(/\s+/g, " ")
    .replace(/<p><\/p>/g, "")
    .trim();
}

export default function NewsletterRichTextEditor({
  value,
  onChange,
  placeholder = "Write your newsletter copy...",
}: NewsletterRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] w-full rounded-b-md border-0 bg-background px-3 py-3 text-sm leading-relaxed focus-visible:outline-none [&_p]:my-2 [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:my-2 [&_h4]:text-base [&_h4]:font-semibold",
      },
    },
    onUpdate({ editor: current }) {
      onChange(current.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = normalizeHtml(editor.getHTML());
    const incoming = normalizeHtml(value || "");
    if (current !== incoming) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previous);
    if (url === null) return;

    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="border rounded-md bg-background overflow-hidden max-w-full min-w-0">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
        <Button
          type="button"
          variant={editor?.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={editor?.isActive("italic") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={editor?.isActive("underline") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={editor?.isActive("link") ? "secondary" : "ghost"}
          size="sm"
          onClick={setLink}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button
          type="button"
          variant={editor?.isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={editor?.isActive("heading", { level: 4 }) ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
          title="Heading 4"
        >
          <Heading4 className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={editor?.isActive("paragraph") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor?.chain().focus().setParagraph().run()}
          title="Paragraph"
        >
          <Pilcrow className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().setHardBreak().run()}
          title="Line break"
        >
          <CornerDownLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="cursor-text">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
