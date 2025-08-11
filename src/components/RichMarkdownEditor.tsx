import React, { useState } from "react";
import ReactMde from "react-mde";
import "react-mde/lib/styles/css/react-mde-all.css";
import Showdown from "showdown";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const converter = new Showdown.Converter({
  tables: true,
  simplifiedAutoLink: true,
  strikethrough: true,
  tasklists: true,
});

export default function RichMarkdownEditor({ value, onChange }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="border rounded-md bg-background">
      <ReactMde
        value={value}
        onChange={onChange}
        selectedTab={tab}
        onTabChange={setTab}
        generateMarkdownPreview={(markdown) =>
          Promise.resolve(converter.makeHtml(markdown))
        }
        toolbarCommands={[["bold", "italic", "strikethrough", "link"], ["unordered-list", "ordered-list", "quote"], ["code", "image"]]}
      />
    </div>
  );
}
