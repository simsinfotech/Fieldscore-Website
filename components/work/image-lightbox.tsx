"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { TbX, TbDotsVertical } from "react-icons/tb"

export type LightboxAction = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}

/**
 * Full-screen image viewer. Click the backdrop or press Esc to close.
 * Optional `actions` render a three-dot menu (e.g. Delete) — useful on mobile
 * where hover controls aren't available.
 */
export function ImageLightbox({
  src, alt, onClose, actions,
}: {
  src: string
  alt?: string
  onClose: () => void
  actions?: LightboxAction[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F172A]/85 p-4 backdrop-blur-sm"
    >
      <div className="absolute right-4 top-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {actions && actions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More options"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D1B2A]/10 text-white transition-colors hover:bg-[#0D1B2A]/20"
            >
              <TbDotsVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-[#0D1B2A] py-1 shadow-soft">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => { setMenuOpen(false); a.onClick() }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary ${a.danger ? "text-destructive" : "text-foreground"}`}
                  >
                    {a.icon}{a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D1B2A]/10 text-white transition-colors hover:bg-[#0D1B2A]/20"
        >
          <TbX className="h-5 w-5" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[94vw] rounded-xl object-contain shadow-2xl"
      />
    </div>,
    document.body
  )
}
