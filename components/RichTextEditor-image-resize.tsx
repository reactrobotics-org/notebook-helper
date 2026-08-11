"use client";

import { useState } from "react";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import TiptapImage from "@tiptap/extension-image";
import ImagePicker from "@/components/ImagePicker";

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "50%",
        parseHTML: (element) =>
          element.getAttribute("data-width") ||
          element.style.width ||
          element.getAttribute("width") ||
          "50%",
        renderHTML: (attributes) => ({
          "data-width": attributes.width || "50%",
        }),
      },
      alignment: {
        default: "center",
        parseHTML: (element) => {
          const explicit = element.getAttribute("data-align");
          if (explicit === "left" || explicit === "center" || explicit === "right") {
            return explicit;
          }

          if (element.style.marginLeft === "auto" && element.style.marginRight === "0px") {
            return "right";
          }

          if (element.style.marginLeft === "0px" && element.style.marginRight === "auto") {
            return "left";
          }

          return "center";
        },
        renderHTML: (attributes) => ({
          "data-align": attributes.alignment || "center",
        }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const width = HTMLAttributes["data-width"] || "50%";
    const alignment = HTMLAttributes["data-align"] || "center";
    const margin =
      alignment === "left"
        ? "0 auto 1rem 0"
        : alignment === "right"
          ? "0 0 1rem auto"
          : "0 auto 1rem auto";

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `display: block; width: ${width}; max-width: 100%; height: auto; margin: ${margin};`,
      }),
    ];
  },
});

type ImageSize = "25%" | "50%" | "75%" | "100%";
type ImageAlignment = "left" | "center" | "right";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  enableImages?: boolean;
  enableAI?: boolean;
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  title,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-sm font-medium hover:bg-[#EEF8FF] disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-blue-600 bg-[#8ED4FF] text-[#1C1F23] text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-7 border-l border-slate-300" />;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your notes here...",
  enableImages = true,
  enableAI = true,
}: Props) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [imageSelected, setImageSelected] = useState(false);
    const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      HorizontalRule,
      ResizableImage,
      ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "data-placeholder": placeholder,
        spellCheck: "true",
        lang: "en",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      setImageSelected(editor.isActive("image"));
    },
  });

  if (!editor) {
    return null;
  }

  const currentEditor = editor;

  function setLink() {
      if (!editor) return;

      const previousUrl = editor.getAttributes("link").href;
      const url = window.prompt("Enter a URL", previousUrl || "");

      if (url === null) {
        return;
    }

      if (url === "") {
        editor.chain().focus().unsetLink().run();
        return;
    }

    editor.chain().focus().setLink({ href: url as string }).run();
  }

  function addImage(imageUrl: string, size: ImageSize = "50%") {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { src: imageUrl, width: size, alignment: "center" },
      })
      .run();
  }

  function setImageWidth(size: ImageSize) {
    if (!editor) return;

    editor.chain().focus().updateAttributes("image", { width: size }).run();
  }

  function setImageAlignment(alignment: ImageAlignment) {
    if (!editor) return;

    editor.chain().focus().updateAttributes("image", { alignment }).run();
  }

  async function improveWriting() {
    if (!editor) return;
    setAiLoading(true);
    setAiSuggestions("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "improve-writing",
          text: editor.getHTML(),
        }),
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        setAiSuggestions("The AI route returned an unexpected response. Check the terminal for errors.");
        return;
}

      const data = await response.json();

      if (!response.ok) {
        setAiSuggestions(data.error || "Unable to improve writing.");
        return;
      }

      if (data.result) {
        editor.commands.setContent(data.result);
        onChange(data.result);
      }
    } catch (error) {
      console.error("Improve writing error:", error);
      setAiSuggestions("Unable to connect to the AI helper.");
    } finally {
      setAiLoading(false);
    }
  }

  async function suggestDetails() {
    if (!editor) return;
    setAiLoading(true);
    setAiSuggestions("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "suggest-details",
          text: editor.getHTML(),
        }),
      });

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        setAiSuggestions("The AI route returned an unexpected response. Check the terminal for errors.");
        return;
        }

      const data = await response.json();

      if (!response.ok) {
        setAiSuggestions(data.error || "Unable to generate suggestions.");
        return;
      }

      if (data.result) {
        setAiSuggestions(data.result);
      }
    } catch (error) {
      console.error("Suggest details error:", error);
      setAiSuggestions("Unable to connect to the AI helper.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-lg border-b bg-slate-100 p-2">
        <ToolbarButton
          label="B"
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />

        <ToolbarButton
          label="I"
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />

        <ToolbarButton
          label="U"
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <Separator />

        <ToolbarButton
          label="H1"
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />

        <ToolbarButton
          label="H2"
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />

        <Separator />

        <ToolbarButton
          label="•"
          title="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />

        <ToolbarButton
          label="1."
          title="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <Separator />

        <ToolbarButton
          label="Quote"
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />

        <ToolbarButton
          label="Code"
          title="Code Block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />

        <ToolbarButton
          label="―"
          title="Horizontal Line"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <ToolbarButton
          label="Link"
          title="Add or Remove Link"
          active={editor.isActive("link")}
          onClick={setLink}
        />

        {enableImages && (
          <ToolbarButton
            label="Image"
            title="Insert Image"
            onClick={() => setImagePickerOpen(true)}
          />
        )}

        <Separator />

        {enableAI && (
          <>
            <ToolbarButton
              label={aiLoading ? "Working..." : "Improve"}
              title="Improve Writing"
              disabled={aiLoading}
              onClick={improveWriting}
            />

            <ToolbarButton
              label={aiLoading ? "Working..." : "Suggest"}
              title="Suggest Missing Engineering Details"
              disabled={aiLoading}
              onClick={suggestDetails}
            />

            <Separator />
          </>
        )}

        <ToolbarButton
          label="↶"
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        />

        <ToolbarButton
          label="↷"
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      {imageSelected && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-[#EEF8FF] p-2">
          <span className="text-sm font-medium text-slate-700">Image size:</span>

          {(["25%", "50%", "75%", "100%"] as ImageSize[]).map((size) => (
            <ToolbarButton
              key={size}
              label={size}
              title={`Set image width to ${size}`}
              active={editor.getAttributes("image").width === size}
              onClick={() => setImageWidth(size)}
            />
          ))}

          <Separator />

          <span className="text-sm font-medium text-slate-700">Align:</span>

          {(["left", "center", "right"] as ImageAlignment[]).map((alignment) => (
            <ToolbarButton
              key={alignment}
              label={alignment.charAt(0).toUpperCase() + alignment.slice(1)}
              title={`Align image ${alignment}`}
              active={editor.getAttributes("image").alignment === alignment}
              onClick={() => setImageAlignment(alignment)}
            />
          ))}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="
          min-h-[250px] p-4 text-base text-slate-900
          [&_.ProseMirror]:min-h-[220px]
          [&_.ProseMirror]:text-slate-900
          [&_.ProseMirror]:outline-none
          [&_.ProseMirror]:outline-none
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
          [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold
          [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold
          [&_p]:mb-2
          [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6
          [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6
          [&_blockquote]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600
          [&_pre]:mb-3 [&_pre]:rounded [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-white
          [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1
          [&_a]:text-blue-600 [&_a]:underline
          [&_hr]:my-6
          [&_hr]:border-0
          [&_hr]:border-t-2
          [&_hr]:border-slate-300
          [&_img]:my-4
          [&_img]:max-w-full
          [&_img]:rounded
          [&_img]:border
          [&_.ProseMirror-selectednode]:outline
          [&_.ProseMirror-selectednode]:outline-2
          [&_.ProseMirror-selectednode]:outline-[#8ED4FF]
        "
      />

      {aiSuggestions && (
        <div className="border-t bg-[#EEF8FF] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-[#1C1F23]">AI Suggestions</h3>

            <button
              type="button"
              onClick={() => setAiSuggestions("")}
              className="text-sm text-blue-700 hover:underline"
            >
              Clear
            </button>
          </div>

          <div
            className="prose max-w-none text-sm text-blue-950"
            dangerouslySetInnerHTML={{ __html: aiSuggestions }}
          />
        </div>
      )}

      <ImagePicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(imageUrl) => addImage(imageUrl, "50%")}
      />
    </div>
  );
}