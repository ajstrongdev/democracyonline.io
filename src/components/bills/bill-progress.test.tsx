import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BillProgress } from "./bill-progress";

describe("BillProgress", () => {
  it("does not treat result reconciliation as a fifth active stage", () => {
    const markup = renderToStaticMarkup(
      <BillProgress status="Voting" stage="Presidential" />,
    );
    expect(markup.match(/<li /g)).toHaveLength(4);
    expect(markup).toContain("President");
    expect(markup).toContain('aria-current="step"');
    expect(markup).not.toContain("Final decision");
    expect(markup).not.toContain("Result:");
  });

  it("shows the result once voting has concluded, without filling later stages", () => {
    const markup = renderToStaticMarkup(
      <BillProgress status="Defeated" stage="Senate" />,
    );
    expect(markup.match(/<li /g)).toHaveLength(4);
    expect(markup).toContain("Result: Defeated");
    expect(markup).not.toContain('aria-current="step"');
  });
});
