import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";
import { remarkEntityReferences } from "@/lib/entity-references";

export function MarkdownContent({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`wiki-markdown min-w-0 break-words text-foreground ${compact ? "text-sm leading-6 [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2" : "max-w-[78ch] text-[15px] leading-7"}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEntityReferences]}
        disallowedElements={["img"]}
        components={{
          h1: (props) => <h2 className={`wiki-heading ${compact ? "my-2 text-lg" : "text-3xl"}`} {...props} />,
          h2: (props) => <h2 className={`wiki-heading ${compact ? "my-2 text-base" : "text-2xl"}`} {...props} />,
          h3: (props) => <h3 className={`wiki-heading ${compact ? "my-2 text-sm" : "text-xl"}`} {...props} />,
          p: (props) => <p className={compact ? "my-1" : "my-4"} {...props} />,
          ul: (props) => <ul className="my-4 list-disc pl-7" {...props} />,
          ol: (props) => <ol className="my-4 list-decimal pl-7" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="my-5 border-l-4 border-primary/50 bg-muted/30 px-5 py-2 font-serif text-muted-foreground"
              {...props}
            />
          ),
          a: ({ href, ...props }) => (
            <a
              href={href}
              className="font-medium text-primary underline underline-offset-4"
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              target={href?.startsWith("http") ? "_blank" : undefined}
              {...props}
            />
          ),
          code: MarkdownCode,
          table: (props) => (
            <div className="my-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border bg-muted/60 p-2 text-left font-semibold"
              {...props}
            />
          ),
          td: (props) => <td className="border p-2 align-top" {...props} />,
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MarkdownCode({
  className,
  children,
  ...props
}: ComponentProps<"code">) {
  const block = className?.startsWith("language-");
  return block ? (
    <code
      className="my-5 block overflow-x-auto rounded-md bg-foreground p-4 font-mono text-sm text-background"
      {...props}
    >
      {children}
    </code>
  ) : (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
      {...props}
    >
      {children}
    </code>
  );
}
