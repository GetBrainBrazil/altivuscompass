import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Undo2, Redo2,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadFolder?: string;
  className?: string;
}

function ToolbarButton({
  onClick, active, disabled, children, title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        active && "bg-muted text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("URL do link:", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  }, [editor]);

  return (
    <div className="flex items-center flex-wrap gap-0.5 border-b border-input px-2 py-1.5 bg-muted/30">
      <ToolbarButton title="Negrito" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton title="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton title="Sublinhado" onClick={() => editor.chain().focus().toggleMark("underline" as any).run()} active={editor.isActive("underline")}>
        <UnderlineIcon size={14} />
      </ToolbarButton>
      <ToolbarButton title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
        <Strikethrough size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton title="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
        <Heading2 size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton title="Lista de tarefas" onClick={() => editor.chain().focus().toggleTaskList?.().run?.()} active={editor.isActive("taskList")}>
        <ListChecks size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Alinhar à esquerda" onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}>
        <AlignLeft size={14} />
      </ToolbarButton>
      <ToolbarButton title="Centralizar" onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}>
        <AlignCenter size={14} />
      </ToolbarButton>
      <ToolbarButton title="Alinhar à direita" onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })}>
        <AlignRight size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Inserir link" onClick={setLink} active={editor.isActive("link")}>
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton title="Inserir imagem" onClick={onPickImage}>
        <ImageIcon size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={14} />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value, onChange, placeholder, uploadFolder = "rich-text", className,
}: RichTextEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", class: "text-primary underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[160px] px-3 py-2.5 focus:outline-none",
          "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem muito grande (máx. 10MB)", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop() || "png";
    const path = `${uploadFolder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Erro ao enviar imagem", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = await supabase.storage.from("task-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) {
      editor.chain().focus().setImage({ src: data.signedUrl, alt: file.name }).run();
    }
  }, [editor, toast, uploadFolder]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />
      {!editor.getText() && placeholder && (
        <div className="pointer-events-none absolute -mt-[140px] ml-3 text-sm text-muted-foreground">
          {/* Placeholder simulado */}
        </div>
      )}
    </div>
  );
}
