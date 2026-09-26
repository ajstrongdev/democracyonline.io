type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: Array<MarkdownNode>;
};

const referencePattern =
  /\b(?:Bill|Party|Player)\s+#\d+\b|\b(?:Presidential|Senate)\s+Election\s+#\d+\b|\bGovernment\s+Wiki\b/gi;

export function getEntityReferenceHref(reference: string) {
  const id = reference.match(/#(\d+)/)?.[1];
  const normalized = reference.toLowerCase();

  if (normalized.startsWith("bill ") && id) return `/dashboard/bills/${id}`;
  if (normalized.startsWith("party ") && id) return `/dashboard/parties/${id}`;
  if (normalized.startsWith("player ") && id) return `/dashboard/players/${id}`;
  if (normalized.startsWith("presidential election ") && id)
    return `/dashboard/elections/${id}`;
  if (normalized.startsWith("senate election ") && id)
    return `/dashboard/elections/${id}`;
  if (normalized === "government wiki") return "/dashboard/government";
  return null;
}

export function remarkEntityReferences() {
  return (tree: MarkdownNode) => transformNode(tree, false);
}

function transformNode(node: MarkdownNode, excluded: boolean) {
  const skipChildren =
    excluded ||
    node.type === "link" ||
    node.type === "linkReference" ||
    node.type === "code" ||
    node.type === "inlineCode";

  if (!node.children || skipChildren) return;

  node.children = node.children.flatMap((child) => {
    if (child.type !== "text" || !child.value) {
      transformNode(child, false);
      return child;
    }

    return linkTextNode(child.value);
  });
}

function linkTextNode(value: string): Array<MarkdownNode> {
  const nodes: Array<MarkdownNode> = [];
  let offset = 0;

  for (const match of value.matchAll(referencePattern)) {
    const index = match.index;
    const href = getEntityReferenceHref(match[0]);
    if (index > offset)
      nodes.push({ type: "text", value: value.slice(offset, index) });
    if (href) {
      nodes.push({
        type: "link",
        url: href,
        children: [{ type: "text", value: match[0] }],
      });
    } else {
      nodes.push({ type: "text", value: match[0] });
    }
    offset = index + match[0].length;
  }

  if (offset === 0) return [{ type: "text", value }];
  if (offset < value.length)
    nodes.push({ type: "text", value: value.slice(offset) });
  return nodes;
}
