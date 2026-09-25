import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("renders bill references and markdown as links and formatting", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content="In relation to Bill #53: **support** [source](https://example.com)" compact />,
    );
    expect(html).toContain('href="/dashboard/bills/53"');
    expect(html).toContain("<strong>support</strong>");
    expect(html).toContain('href="https://example.com"');
  });
});
