import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "subtle"
  glow?: "blue" | "green" | "none"
}

export function GlassCard({
  className,
  variant = "default",
  glow = "none",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 sm:p-6",
        variant === "default" && "glass",
        variant === "strong" && "glass-strong",
        variant === "subtle" && "glass-subtle",
        glow === "blue" && "glow-blue",
        glow === "green" && "glow-green",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
