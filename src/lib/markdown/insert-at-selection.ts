export function insertAtSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after = "",
  placeholder = "",
) {
  const selected = value.slice(start, end);
  const text = selected || placeholder;
  const next = `${value.slice(0, start)}${before}${text}${after}${value.slice(end)}`;
  return {
    value: next,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + text.length,
  };
}

export function prefixSelectedLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
  placeholder: string,
) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", start);
  const lineEnd =
    end > start
      ? value[end - 1] === "\n"
        ? end - 1
        : end
      : nextBreak < 0
        ? value.length
        : nextBreak;
  const original = value.slice(lineStart, lineEnd);
  const text = original || placeholder;
  const prefixed = text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
  return {
    value: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
    selectionStart: original
      ? start + prefix.length
      : lineStart + prefix.length,
    selectionEnd: original
      ? end + prefix.length * text.split("\n").length
      : lineStart + prefix.length + placeholder.length,
  };
}
