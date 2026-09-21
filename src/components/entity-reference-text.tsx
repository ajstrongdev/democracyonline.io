import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkEntityReferences } from "@/lib/entity-references";
import { cn } from "@/lib/utils";

export function EntityReferenceText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <span className={cn("entity-reference-text", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEntityReferences]}
        components={{
          p: ({ children }) => <span>{children}</span>,
          a: ({ href, ...props }) => (
            <a
              href={href}
              className="font-medium text-primary underline underline-offset-4"
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              target={href?.startsWith("http") ? "_blank" : undefined}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </span>
  );
}
