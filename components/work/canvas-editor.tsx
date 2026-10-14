"use client"

import { useEffect, useReducer, useRef, useState } from "react"
import { useEditor, EditorContent, ReactNodeViewRenderer, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import Image from "@tiptap/extension-image"
import { createMentionSuggestion, type MentionItem } from "./mention-suggestion"
import { ImageNodeView } from "./image-node-view"

// Canvas images render through a React node view (hover delete, long-press,
// click-to-maximize).
const CanvasImage = Image.extend({
  addNodeView() { return ReactNodeViewRenderer(ImageNodeView) },
})
import {
  TbBold, TbItalic, TbStrikethrough, TbH1, TbH2, TbH3,
  TbList, TbListNumbers, TbListCheck, TbQuote, TbCode, TbLink, TbPhoto,
} from "react-icons/tb"
import { cn } from "@/lib/utils"

export type CanvasChange = { json: unknown; text: string }
export type ImageUploader = (file: File) => Promise<string | null>

function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const fromFiles = Array.from(dt.files || []).filter((f) => f.type.startsWith("image/"))
  if (fromFiles.length) return fromFiles
  // Pasted screenshots often arrive only via items, not files.
  return Array.from(dt.items || [])
    .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f)
}

/**
 * WYSIWYG document canvas (TipTap v3) with a persistent formatting toolbar on
 * top. Type markdown-style shortcuts ("# ", "- ", "- [ ] ", "> ") and they
 * format live, or use the toolbar. Debounced onChange returns the ProseMirror
 * JSON (persisted in `body`) and a plain-text mirror (persisted in `description`).
 */
export function CanvasEditor({
  content, editable, onChange, placeholder, className, mentionItems, onImageUpload,
}: {
  content: unknown
  editable: boolean
  onChange: (c: CanvasChange) => void
  placeholder?: string
  className?: string
  /** When provided, enables @mentions with this (scoped) people source. */
  mentionItems?: (query: string) => MentionItem[]
  /** When provided, enables pasting/dropping/inserting images in the canvas. */
  onImageUpload?: ImageUploader
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const mentionItemsRef = useRef(mentionItems)
  mentionItemsRef.current = mentionItems
  const uploadRef = useRef(onImageUpload)
  uploadRef.current = onImageUpload
  const editorRef = useRef<Editor | null>(null)
  const [, force] = useReducer((x: number) => x + 1, 0)

  async function insertImages(files: File[]) {
    for (const file of files) {
      const src = await uploadRef.current?.(file)
      if (src) editorRef.current?.chain().focus().setImage({ src }).run()
    }
  }

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: true,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CanvasImage.configure({ HTMLAttributes: { class: "canvas-image" } }),
      Placeholder.configure({ placeholder: placeholder || "Write details… type “/” or use markdown" }),
      ...(mentionItems
        ? [Mention.configure({
            HTMLAttributes: { class: "mention" },
            suggestion: createMentionSuggestion((q) => mentionItemsRef.current?.(q) ?? []),
          })]
        : []),
    ],
    content: (content as never) ?? "",
    editorProps: {
      attributes: { class: "tiptap-canvas" },
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData)
        if (!files.length || !uploadRef.current) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = imageFilesFrom((event as DragEvent).dataTransfer)
        if (!files.length || !uploadRef.current) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        onChangeRef.current({ json: editor.getJSON(), text: editor.getText() })
      }, 700)
    },
    onBlur: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current)
      onChangeRef.current({ json: editor.getJSON(), text: editor.getText() })
    },
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  // Re-render the toolbar as the selection / active marks change.
  useEffect(() => {
    if (!editor) return
    const update = () => force()
    editor.on("transaction", update)
    return () => { editor.off("transaction", update) }
  }, [editor])

  useEffect(() => { editor?.setEditable(editable) }, [editor, editable])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (!editor) return null

  return (
    <div className={cn("relative", className)}>
      {editable && <Toolbar editor={editor} onInsertImages={onImageUpload ? insertImages : undefined} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function Btn({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active && "bg-secondary text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />
}

function Toolbar({ editor, onInsertImages }: { editor: Editor; onInsertImages?: (files: File[]) => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  function openLink() {
    if (linkOpen) { setLinkOpen(false); return }
    setLinkValue((editor.getAttributes("link").href as string) || "")
    setLinkOpen(true)
    setTimeout(() => linkInputRef.current?.focus(), 0)
  }

  function applyLink() {
    const raw = linkValue.trim()
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      if (editor.state.selection.empty) {
        // No selection → insert the URL as linked text.
        editor.chain().focus().insertContent({
          type: "text", text: raw, marks: [{ type: "link", attrs: { href } }],
        }).run()
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
      }
    }
    setLinkOpen(false)
    setLinkValue("")
  }

  return (
    <div className="mb-3 border-b border-border/50 pb-2">
      <div className="flex flex-wrap items-center gap-0.5">
        <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><TbBold className="h-4 w-4" /></Btn>
        <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><TbItalic className="h-4 w-4" /></Btn>
        <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><TbStrikethrough className="h-4 w-4" /></Btn>
        <Divider />
        <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><TbH1 className="h-4 w-4" /></Btn>
        <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><TbH2 className="h-4 w-4" /></Btn>
        <Btn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><TbH3 className="h-4 w-4" /></Btn>
        <Divider />
        <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><TbList className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><TbListNumbers className="h-4 w-4" /></Btn>
        <Btn title="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><TbListCheck className="h-4 w-4" /></Btn>
        <Divider />
        <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><TbQuote className="h-4 w-4" /></Btn>
        <Btn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><TbCode className="h-4 w-4" /></Btn>
        <Btn title="Link" active={linkOpen || editor.isActive("link")} onClick={openLink}><TbLink className="h-4 w-4" /></Btn>
        {onInsertImages && (
          <>
            <Divider />
            <Btn title="Image" onClick={() => imageInputRef.current?.click()}><TbPhoto className="h-4 w-4" /></Btn>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) onInsertImages(files)
                if (imageInputRef.current) imageInputRef.current.value = ""
              }}
            />
          </>
        )}
      </div>

      {linkOpen && (
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={linkInputRef}
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); applyLink() }
              if (e.key === "Escape") { e.preventDefault(); setLinkOpen(false) }
            }}
            placeholder="Paste or type a link, then Enter"
            className="h-8 flex-1 rounded-lg border border-border bg-[#0D1B2A] px-2.5 text-sm outline-none focus:border-[#00BCD4]"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyLink() }}
            className="h-8 rounded-lg bg-[#00BCD4] px-3 text-xs font-medium text-white"
          >
            {linkValue.trim() ? "Apply" : "Remove"}
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setLinkOpen(false) }}
            className="h-8 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
