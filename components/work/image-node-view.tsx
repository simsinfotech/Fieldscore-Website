"use client"

import { useRef, useState } from "react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { TbTrash, TbArrowsMaximize } from "react-icons/tb"
import { ImageLightbox } from "./image-lightbox"

/**
 * React node view for canvas images:
 *  - desktop: hover shows Expand + Delete controls
 *  - mobile: long-press reveals the same controls
 *  - click / expand: full-screen lightbox (with a three-dot Delete on mobile)
 */
export function ImageNodeView({ node, deleteNode, editor }: NodeViewProps) {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ""
  const editable = editor.isEditable
  const [open, setOpen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  function startPress() {
    if (!editable) return
    longPressed.current = false
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setShowControls(true)
    }, 450)
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }
  function handleClick() {
    if (longPressed.current) { longPressed.current = false; return }
    setOpen(true)
  }
  function remove() {
    setOpen(false)
    setShowControls(false)
    deleteNode()
  }

  return (
    <NodeViewWrapper as="div" className="group relative my-2 w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={handleClick}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onTouchCancel={cancelPress}
        className="canvas-image"
      />
      {editable && (
        <div
          className={`absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-[#1A2B45]/70 p-1 backdrop-blur-sm transition-opacity group-hover:opacity-100 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            title="View full screen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-[#0D1B2A]/20"
          >
            <TbArrowsMaximize className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); remove() }}
            title="Delete image"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-destructive"
          >
            <TbTrash className="h-4 w-4" />
          </button>
        </div>
      )}
      {open && (
        <ImageLightbox
          src={src}
          alt={alt}
          onClose={() => setOpen(false)}
          actions={editable ? [{ label: "Delete image", icon: <TbTrash className="h-4 w-4" />, onClick: remove, danger: true }] : undefined}
        />
      )}
    </NodeViewWrapper>
  )
}
