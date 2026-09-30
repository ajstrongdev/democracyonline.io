import {
  Bold,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useRef, useState } from "react";
import { MarkdownContent } from "@/components/wiki/markdown-content";
import {
  insertAtSelection,
  prefixSelectedLines,
} from "@/lib/markdown/insert-at-selection";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MarkdownToolbar({
  textareaId,
  value,
  onChange,
}: {
  textareaId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const selection = useRef<{ start: number; end: number } | null>(null);

  const textarea = () =>
    document.getElementById(textareaId) as HTMLTextAreaElement | null;
  const rememberSelection = () => {
    const field = textarea();
    if (field)
      selection.current = {
        start: field.selectionStart,
        end: field.selectionEnd,
      };
  };
  const insert = (
    before: string,
    after = "",
    placeholder = "",
    line = false,
  ) => {
    const field = textarea();
    const { start, end } = selection.current ?? {
      start: field?.selectionStart ?? value.length,
      end: field?.selectionEnd ?? value.length,
    };
    const result = line
      ? prefixSelectedLines(value, start, end, before, placeholder)
      : insertAtSelection(value, start, end, before, after, placeholder);
    if (
      field?.maxLength !== -1 &&
      field &&
      result.value.length > field.maxLength
    )
      return;
    onChange(result.value);
    selection.current = null;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="toolbar"
      aria-label="Markdown editor tools"
    >
      {(
        [
          {
            label: "Heading",
            icon: Heading2,
            before: "## ",
            after: "",
            placeholder: "Heading",
            line: true,
          },
          {
            label: "Bold",
            icon: Bold,
            before: "**",
            after: "**",
            placeholder: "bold text",
            line: false,
          },
          {
            label: "Italic",
            icon: Italic,
            before: "*",
            after: "*",
            placeholder: "italic text",
            line: false,
          },
          {
            label: "Bulleted list",
            icon: List,
            before: "- ",
            after: "",
            placeholder: "List item",
            line: true,
          },
          {
            label: "Numbered list",
            icon: ListOrdered,
            before: "1. ",
            after: "",
            placeholder: "List item",
            line: true,
          },
          {
            label: "Quote",
            icon: Quote,
            before: "> ",
            after: "",
            placeholder: "Quote",
            line: true,
          },
          {
            label: "Link",
            icon: Link2,
            before: "[",
            after: "](https://example.com)",
            placeholder: "link text",
            line: false,
          },
        ] as const
      ).map(({ label, icon: Icon, before, after, placeholder, line }) => (
        <Button
          key={label}
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={label}
          title={label}
          onPointerDown={rememberSelection}
          onKeyDown={rememberSelection}
          onClick={() => insert(before, after, placeholder, line)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            aria-label="Preview Markdown"
            aria-expanded={previewOpen}
          >
            <Eye className="size-4" /> Preview
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[60vh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto p-4"
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Preview
          </p>
          {value.trim() ? (
            <MarkdownContent content={value} compact />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing to preview yet.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
