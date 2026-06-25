import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

function parseColorToRgb(color: string): [number, number, number] | null {
  if (!color) return null
  const value = color.trim().toLowerCase()

  const named: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    transparent: [255, 255, 255],
  }
  if (value in named) return named[value]

  if (value.startsWith("#")) {
    let hex = value.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("")
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      if ([r, g, b].every((n) => !Number.isNaN(n))) return [r, g, b]
    }
    return null
  }

  const rgbMatch = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/,
  )
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
  }

  return null
}

// Pick black or white for readable text on a given background (WCAG luminance).
function readableForeground(background?: string): string {
  if (!background) return "#ffffff"
  const rgb = parseColorToRgb(background)
  if (!rgb) return "#ffffff"

  const [r, g, b] = rgb.map((c) => {
    const channel = c / 255
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? "#111111" : "#ffffff"
}

export interface InfoboxRow {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
}

export interface InfoboxSection {
  heading?: React.ReactNode
  rows?: InfoboxRow[]
  children?: React.ReactNode
  className?: string
}

interface InfoboxMediaBase {
  caption?: React.ReactNode
  className?: string
}

export interface InfoboxImageMedia extends InfoboxMediaBase {
  type: "image"
  src: string
  alt?: string
  fit?: "cover" | "contain"
}

export interface InfoboxIconMedia extends InfoboxMediaBase {
  type: "icon"
  icon: React.ReactNode
  background?: string
  iconColor?: string
  iconSize?: number
}

export type InfoboxMedia = InfoboxImageMedia | InfoboxIconMedia

export interface InfoboxTag {
  label: React.ReactNode
  color?: string
}

export interface InfoboxProps
  extends Omit<React.ComponentProps<typeof Card>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  accentColor?: string
  accentForeground?: string
  media?: InfoboxMedia
  tags?: InfoboxTag[]
  sections?: InfoboxSection[]
  footer?: React.ReactNode
  width?: number | string
  children?: React.ReactNode
}

function InfoboxMediaFrame({
  media,
  accentColor,
}: {
  media: InfoboxMedia
  accentColor: string
}) {
  if (media.type === "image") {
    return (
      <figure className={cn("m-0 flex flex-col", media.className)}>
        <div className="flex w-full items-center justify-center overflow-hidden bg-muted">
          <img
            src={media.src}
            alt={media.alt ?? ""}
            className={cn(
              "max-h-72 w-full",
              media.fit === "contain" ? "object-contain" : "object-cover",
            )}
          />
        </div>
        {media.caption ? (
          <figcaption className="px-4 py-2 text-center text-xs text-muted-foreground">
            {media.caption}
          </figcaption>
        ) : null}
      </figure>
    )
  }

  const background = media.background ?? accentColor
  const iconColor = media.iconColor ?? readableForeground(background)
  const iconSize = media.iconSize ?? 56

  return (
    <figure
      className={cn("m-0 flex flex-col items-center px-4 py-6", media.className)}
    >
      <div
        className="flex size-28 items-center justify-center rounded-full shadow-md"
        style={{ background }}
      >
        <span
          className="flex items-center justify-center [&_svg]:h-[var(--infobox-icon-size)] [&_svg]:w-[var(--infobox-icon-size)]"
          style={
            {
              color: iconColor,
              "--infobox-icon-size": `${iconSize}px`,
            } as React.CSSProperties
          }
          aria-hidden={typeof media.caption === "undefined"}
        >
          {media.icon}
        </span>
      </div>
      {media.caption ? (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function InfoboxSectionBlock({ section }: { section: InfoboxSection }) {
  return (
    <section className={cn("flex flex-col", section.className)}>
      {section.heading ? (
        <h3 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {section.heading}
        </h3>
      ) : null}

      {section.rows?.length ? (
        <dl className="m-0 flex flex-col">
          {section.rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[minmax(6rem,38%)_1fr] items-center gap-x-4 border-b border-border/50 px-4 py-3 text-sm last:border-b-0",
                row.className,
              )}
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="m-0 font-medium break-words text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {section.children ? (
        <div className="px-4 py-3 text-sm">{section.children}</div>
      ) : null}
    </section>
  )
}

export const Infobox = React.forwardRef<HTMLDivElement, InfoboxProps>(
  function Infobox(
    {
      title,
      subtitle,
      accentColor = "var(--primary)",
      accentForeground,
      media,
      tags,
      sections,
      footer,
      width = 320,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) {
    const fg = accentForeground ?? readableForeground(accentColor)

    return (
      <Card
        ref={ref}
        data-slot="infobox"
        className={cn(
          "gap-0 overflow-hidden rounded-2xl border bg-card py-0 text-card-foreground shadow-lg",
          className,
        )}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          ...style,
        }}
        {...props}
      >
        <header
          className="flex flex-col items-center gap-1 px-4 py-4 text-center"
          style={{
            backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${accentColor} 90%, transparent), color-mix(in oklab, ${accentColor} 30%, transparent))`,
            color: fg,
          }}
        >
          <div className="font-serif text-xl leading-tight font-bold">
            {title}
          </div>
          {subtitle ? (
            <div className="text-sm leading-tight opacity-80">{subtitle}</div>
          ) : null}
          {tags?.length ? (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {tags.map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  style={
                    tag.color
                      ? {
                          background: tag.color,
                          color: readableForeground(tag.color),
                        }
                      : undefined
                  }
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        {media ? (
          <InfoboxMediaFrame media={media} accentColor={accentColor} />
        ) : null}

        {sections?.length ? (
          <div className="flex flex-col">
            {sections.map((section, i) => (
              <InfoboxSectionBlock key={i} section={section} />
            ))}
          </div>
        ) : null}

        {children ? <div className="px-4 py-3 text-sm">{children}</div> : null}

        {footer ? (
          <>
            <Separator />
            <footer className="px-4 py-3 text-center text-xs text-muted-foreground">
              {footer}
            </footer>
          </>
        ) : null}
      </Card>
    )
  },
)

export default Infobox
