"use client"

import {
  forwardRef, useEffect, useImperativeHandle, useState,
} from "react"
import { ReactRenderer } from "@tiptap/react"
import type { SuggestionOptions } from "@tiptap/suggestion"

export type MentionItem = { id: string; label: string }

/** Keyboard-navigable @mention dropdown. */
const MentionList = forwardRef<
  { onKeyDown: (p: { event: KeyboardEvent }) => boolean },
  { items: MentionItem[]; command: (item: MentionItem) => void }
>(function MentionList({ items, command }, ref) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") { setIndex((i) => (i + items.length - 1) % items.length); return true }
      if (event.key === "ArrowDown") { setIndex((i) => (i + 1) % items.length); return true }
      if (event.key === "Enter") { if (items[index]) command(items[index]); return true }
      return false
    },
  }))

  if (!items.length) {
    return (
      <div className="w-56 rounded-xl border border-border bg-[#0D1B2A] p-2 text-xs text-muted-foreground shadow-soft">
        No one to mention here
      </div>
    )
  }

  return (
    <div className="w-56 overflow-hidden rounded-xl border border-border bg-[#0D1B2A] py-1 shadow-soft">
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); command(item) }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === index ? "bg-secondary" : "hover:bg-secondary/60"}`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F172A] text-[10px] font-semibold text-white">
            {item.label.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
})

function place(el: HTMLElement | null, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.()
  if (!el || !rect) return
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.bottom + 6}px`
}

/**
 * Build a TipTap Mention `suggestion` config whose items come from `getItems`
 * (scoped per-usage — e.g. a task's members, or the whole workspace).
 */
export function createMentionSuggestion(
  getItems: (query: string) => MentionItem[]
): Omit<SuggestionOptions, "editor"> {
  return {
    items: ({ query }) => getItems(query),
    render: () => {
      let component: ReactRenderer | null = null
      let el: HTMLDivElement | null = null
      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, { props, editor: props.editor })
          el = document.createElement("div")
          el.style.position = "fixed"
          el.style.zIndex = "9999"
          document.body.appendChild(el)
          el.appendChild(component.element)
          place(el, props.clientRect)
        },
        onUpdate: (props) => {
          component?.updateProps(props)
          place(el, props.clientRect)
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") return true
          return Boolean((component?.ref as { onKeyDown?: (p: unknown) => boolean } | null)?.onKeyDown?.(props))
        },
        onExit: () => {
          el?.remove()
          el = null
          component?.destroy()
          component = null
        },
      }
    },
  }
}
