import { describe, expect, it } from "vitest";
import {
  getEntityReferenceHref,
  remarkEntityReferences,
} from "./entity-references";

type Node = {
  type: string;
  value?: string;
  url?: string;
  children?: Array<Node>;
};

describe("entity reference links", () => {
  it.each([
    ["Bill #84", "/dashboard/bills/84"],
    ["Presidential Election #1", "/dashboard/elections/president-1"],
    ["Senate Election #1", "/dashboard/elections/senate-1"],
    ["Party #7", "/dashboard/parties/7"],
    ["Player #12", "/dashboard/players/12"],
    ["Government Wiki", "/dashboard/government"],
  ])("maps %s to its article", (reference, href) => {
    expect(getEntityReferenceHref(reference)).toBe(href);
  });

  it("links every supported reference in prose", () => {
    const tree: Node = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value:
                "See Bill #84, Presidential Election #1, Senate Election #2, Party #3, Player #4, and Government Wiki.",
            },
          ],
        },
      ],
    };

    remarkEntityReferences()(tree);

    const links = tree.children?.[0].children?.filter(
      (node) => node.type === "link",
    );
    expect(links).toHaveLength(6);
    expect(links?.map((node) => node.url)).toEqual([
      "/dashboard/bills/84",
      "/dashboard/elections/president-1",
      "/dashboard/elections/senate-2",
      "/dashboard/parties/3",
      "/dashboard/players/4",
      "/dashboard/government",
    ]);
  });

  it("does not alter code or existing links", () => {
    const tree: Node = {
      type: "root",
      children: [
        { type: "inlineCode", value: "Bill #84" },
        {
          type: "link",
          url: "/custom",
          children: [{ type: "text", value: "Party #2" }],
        },
        { type: "code", value: "Player #3" },
      ],
    };

    remarkEntityReferences()(tree);

    expect(tree).toEqual({
      type: "root",
      children: [
        { type: "inlineCode", value: "Bill #84" },
        {
          type: "link",
          url: "/custom",
          children: [{ type: "text", value: "Party #2" }],
        },
        { type: "code", value: "Player #3" },
      ],
    });
  });
});
