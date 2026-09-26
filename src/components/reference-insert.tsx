import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const referenceTypes = [
  { label: "Bill #N", prefix: "Bill", needsId: true },
  {
    label: "Presidential Election #N",
    prefix: "Presidential Election",
    needsId: true,
  },
  { label: "Senate Election #N", prefix: "Senate Election", needsId: true },
  { label: "Party #N", prefix: "Party", needsId: true },
  { label: "Player #N", prefix: "Player", needsId: true },
  { label: "Government Wiki", prefix: "Government Wiki", needsId: false },
] as const;

export function ReferenceInsert({
  textareaId,
  value,
  onChange,
}: {
  textareaId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = query.match(/\d+/)?.[0];
  const normalizedQuery = query.toLowerCase().replace(/\d+/g, "").trim();
  const options = referenceTypes.filter(
    ({ label, prefix }) =>
      !normalizedQuery ||
      label.toLowerCase().includes(normalizedQuery) ||
      prefix.toLowerCase().includes(normalizedQuery),
  );

  const insert = (reference: string) => {
    const textarea = document.getElementById(
      textareaId,
    ) as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}${reference}${value.slice(end)}`);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(
        start + reference.length,
        start + reference.length,
      );
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
        >
          <Link2 className="h-3.5 w-3.5" /> Insert reference
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search type or enter an ID"
          className="h-8"
          autoFocus
        />
        <div className="max-h-56 overflow-y-auto">
          {options.map((option) => {
            const disabled = option.needsId && !id;
            const reference = option.needsId
              ? `${option.prefix} #${id ?? "N"}`
              : option.prefix;
            return (
              <button
                key={option.label}
                type="button"
                disabled={disabled}
                onClick={() => insert(reference)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
              >
                {reference}
              </button>
            );
          })}
          {!options.length && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No reference types found.
            </p>
          )}
        </div>
        {!id && (
          <p className="text-xs text-muted-foreground">
            Include a number to insert numbered references.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
