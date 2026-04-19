import { useRef, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Strikethrough,
  Eye,
  Pencil,
} from "lucide-react";

type MarkdownAction = {
  icon: React.ReactNode;
  label: string;
  apply: (
    value: string,
    selStart: number,
    selEnd: number,
  ) => { newValue: string; newSelStart: number; newSelEnd: number };
};

function wrapSelection(
  value: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
  placeholder: string,
) {
  const selected = value.slice(selStart, selEnd);
  const text = selected || placeholder;
  const newValue =
    value.slice(0, selStart) + before + text + after + value.slice(selEnd);
  const newSelStart = selStart + before.length;
  const newSelEnd = newSelStart + text.length;
  return { newValue, newSelStart, newSelEnd };
}

function prefixLine(
  value: string,
  selStart: number,
  selEnd: number,
  prefix: string,
) {
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const before = value.slice(0, lineStart);
  const after = value.slice(lineStart);
  const newValue = before + prefix + after;
  return {
    newValue,
    newSelStart: selStart + prefix.length,
    newSelEnd: selEnd + prefix.length,
  };
}

const actions: MarkdownAction[] = [
  {
    icon: <Bold className="h-4 w-4" />,
    label: "Bold",
    apply: (v, s, e) => wrapSelection(v, s, e, "**", "**", "bold text"),
  },
  {
    icon: <Italic className="h-4 w-4" />,
    label: "Italic",
    apply: (v, s, e) => wrapSelection(v, s, e, "_", "_", "italic text"),
  },
  {
    icon: <Strikethrough className="h-4 w-4" />,
    label: "Strikethrough",
    apply: (v, s, e) =>
      wrapSelection(v, s, e, "~~", "~~", "strikethrough text"),
  },
  {
    icon: <Heading1 className="h-4 w-4" />,
    label: "Heading 1",
    apply: (v, s, e) => prefixLine(v, s, e, "# "),
  },
  {
    icon: <Heading2 className="h-4 w-4" />,
    label: "Heading 2",
    apply: (v, s, e) => prefixLine(v, s, e, "## "),
  },
  {
    icon: <Heading3 className="h-4 w-4" />,
    label: "Heading 3",
    apply: (v, s, e) => prefixLine(v, s, e, "### "),
  },
  {
    icon: <List className="h-4 w-4" />,
    label: "Bullet List",
    apply: (v, s, e) => prefixLine(v, s, e, "- "),
  },
  {
    icon: <ListOrdered className="h-4 w-4" />,
    label: "Numbered List",
    apply: (v, s, e) => prefixLine(v, s, e, "1. "),
  },
  {
    icon: <Quote className="h-4 w-4" />,
    label: "Quote",
    apply: (v, s, e) => prefixLine(v, s, e, "> "),
  },
  {
    icon: <Code className="h-4 w-4" />,
    label: "Code",
    apply: (v, s, e) => wrapSelection(v, s, e, "`", "`", "code"),
  },
  {
    icon: <Link className="h-4 w-4" />,
    label: "Link",
    apply: (v, s, e) => {
      const selected = v.slice(s, e);
      const text = selected || "link text";
      const newValue = v.slice(0, s) + `[${text}](url)` + v.slice(e);
      return {
        newValue,
        newSelStart: s + 1,
        newSelEnd: s + 1 + text.length,
      };
    },
  },
];

export function MarkdownEditor({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 8,
  id,
  name,
  onBlur,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  id?: string;
  name?: string;
  onBlur?: () => void;
  required?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const applyAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const { newValue, newSelStart, newSelEnd } = action.apply(
        value,
        selStart,
        selEnd,
      );

      onChange(newValue);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelStart, newSelEnd);
      });
    },
    [value, onChange],
  );

  return (
    <div className="rounded-md border border-input shadow-xs overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap border-b bg-muted/30 p-1">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant={mode === "write" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("write")}
            className="h-7 gap-1 text-xs"
          >
            <Pencil className="h-3 w-3" />
            Write
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("preview")}
            className="h-7 gap-1 text-xs"
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
        </div>

        {mode === "write" && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-0.5 flex-wrap">
              {actions.map((action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => applyAction(action)}
                      disabled={disabled}
                      className="h-7 w-7"
                    >
                      {action.icon}
                      <span className="sr-only">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Editor / Preview */}
      {mode === "write" ? (
        <Textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          required={required}
          className="border-0 shadow-none rounded-none focus-visible:ring-0 focus-visible:border-transparent"
        />
      ) : (
        <div className="p-3 sm:p-4 min-h-[200px]">
          {value ? (
            <MarkdownContent content={value} />
          ) : (
            <p className="text-muted-foreground text-sm italic">
              Nothing to preview
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none wrap-break-word
        prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
        prose-p:leading-relaxed prose-p:my-2
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
        prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
        prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
        prose-a:text-primary prose-a:underline
        prose-strong:font-semibold
        ${className ?? ""}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
