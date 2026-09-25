import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Glasses, Palette, Scissors, Shirt, Smile, Sparkles } from "lucide-react";
import type { AvatarConfig } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { avatarChoices, avatarForUsername, avatarSchema, renderAvatar } from "@/lib/avatar";
import { updatePlayerAvatar } from "@/lib/server/users";

type Field = keyof AvatarConfig;
type Category = "Style" | "Hair" | "Face" | "Outfit" | "Details" | "Background";

const categories = [
  { name: "Style", icon: Sparkles },
  { name: "Hair", icon: Scissors },
  { name: "Face", icon: Smile },
  { name: "Outfit", icon: Shirt },
  { name: "Details", icon: Glasses },
  { name: "Background", icon: Palette },
] as const;

const labels: Record<Field, string> = {
  avatarStyle: "Illustration style",
  skinColor: "Skin tone",
  top: "Hair & headwear",
  hairColor: "Hair color",
  eyes: "Eyes",
  eyebrows: "Eyebrows",
  mouth: "Expression",
  clothing: "Clothing",
  clothesColor: "Clothing color",
  clothingGraphic: "Shirt graphic",
  facialHair: "Facial hair",
  facialHairColor: "Facial hair color",
  accessories: "Accessories",
  accessoriesColor: "Accessory color",
  hatColor: "Headwear color",
  backgroundColor: "Background color",
  backgroundAccent: "Second gradient color",
  backgroundType: "Background finish",
  backgroundRotation: "Gradient direction",
  framing: "Portrait framing",
  mirror: "Face direction",
  scale: "Portrait size",
  adventurerHair: "Hairstyle",
  adventurerEyes: "Eyes",
  adventurerEyebrows: "Eyebrows",
  adventurerMouth: "Expression",
  adventurerFeature: "Face detail",
  adventurerGlasses: "Glasses",
  adventurerEarrings: "Earrings",
  loreleiHair: "Hairstyle",
  loreleiEyes: "Eyes",
  loreleiEyebrows: "Eyebrows",
  loreleiMouth: "Expression",
  loreleiHead: "Face shape",
  loreleiNose: "Nose",
  loreleiGlasses: "Glasses",
  loreleiEarrings: "Earrings",
  loreleiBeard: "Beard",
  loreleiFreckles: "Freckles",
  loreleiHairAccessories: "Hair accessories",
};

const colorFields = new Set<Field>([
  "skinColor", "hairColor", "clothesColor", "facialHairColor", "accessoriesColor",
  "hatColor", "backgroundColor", "backgroundAccent",
]);

function fieldsFor(category: Category, config: AvatarConfig): Array<Field> {
  const style = config.avatarStyle;
  if (category === "Style") return ["avatarStyle", "skinColor", "framing", "mirror", "scale"];
  if (category === "Hair") {
    if (style === "adventurer") return ["adventurerHair", "hairColor"];
    if (style === "lorelei") return ["loreleiHair", "hairColor", "loreleiHairAccessories"];
    return ["top", "hairColor", ...(isHeadwear(config.top) ? ["hatColor" as const] : [])];
  }
  if (category === "Face") {
    if (style === "adventurer") return ["adventurerEyes", "adventurerEyebrows", "adventurerMouth"];
    if (style === "lorelei") return ["loreleiHead", "loreleiEyes", "loreleiEyebrows", "loreleiNose", "loreleiMouth"];
    return ["eyes", "eyebrows", "mouth", "facialHair", ...(config.facialHair !== "none" ? ["facialHairColor" as const] : [])];
  }
  if (category === "Outfit") {
    return style === "avataaars"
      ? ["clothing", "clothesColor", ...(config.clothing === "graphicShirt" ? ["clothingGraphic" as const] : [])]
      : [];
  }
  if (category === "Details") {
    if (style === "adventurer") return ["adventurerFeature", "adventurerGlasses", "adventurerEarrings"];
    if (style === "lorelei") return ["loreleiGlasses", "loreleiEarrings", "loreleiBeard", "loreleiFreckles"];
    return ["accessories", ...(config.accessories !== "none" ? ["accessoriesColor" as const] : [])];
  }
  return ["backgroundType", "backgroundColor", ...(config.backgroundType === "gradientLinear" ? ["backgroundAccent" as const, "backgroundRotation" as const] : [])];
}

function isHeadwear(top: string) {
  return ["hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04"].includes(top);
}

function optionLabel(field: Field, value: string) {
  if (field === "avatarStyle") return { avataaars: "Classic", adventurer: "Adventurer", lorelei: "Lorelei" }[value] ?? value;
  if (value === "none") return "None";
  if (value === "gradientLinear") return "Gradient";
  if (field === "scale") return `${value}%`;
  if (field === "backgroundRotation") return `${value}°`;
  if (value.startsWith("variant")) return `Look ${value.slice(7)}`;
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(\d+)/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

function ChoiceField({
  field,
  config,
  onChange,
}: {
  field: Field;
  config: AvatarConfig;
  onChange: (field: Field, value: string) => void;
}) {
  const options: ReadonlyArray<string> = avatarChoices[field];
  const color = colorFields.has(field);
  return (
    <fieldset className="space-y-3 border-b pb-6 last:border-0">
      <legend className="mb-3 flex w-full items-baseline justify-between gap-2 text-sm font-semibold">
        {labels[field]}
        <span className="font-mono text-xs font-normal text-muted-foreground">{options.length} choices</span>
      </legend>
      <div className={color ? "grid grid-cols-8 gap-2 sm:grid-cols-10" : "grid grid-cols-3 gap-2 sm:grid-cols-4 2xl:grid-cols-5"}>
        {options.map((value) => {
          const selected = config[field] === value;
          return (
            <button
              type="button"
              key={value}
              aria-label={`${labels[field]}: ${color ? `#${value}` : optionLabel(field, value)}`}
              aria-pressed={selected}
              onClick={() => onChange(field, value)}
              className={color
                ? `group flex aspect-square items-center justify-center rounded-xl border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border"}`
                : `group flex min-w-0 flex-col items-center gap-2 rounded-xl border-2 px-1 py-2 text-center transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card"}`}
              style={color ? { backgroundColor: `#${value}` } : undefined}
            >
              {color ? (
                selected && <span className="rounded-full bg-background/90 px-1.5 text-sm font-bold text-foreground">✓</span>
              ) : (
                <>
                  <img
                    loading="lazy"
                    src={renderAvatar({ ...config, [field]: value })}
                    alt=""
                    className="size-16 rounded-full bg-muted sm:size-20"
                  />
                  <span className="w-full truncate text-xs font-medium">{optionLabel(field, value)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AvatarEditor({ initialConfig, username, onSaved }: { initialConfig: unknown; username: string; onSaved?: (config: AvatarConfig) => void }) {
  const router = useRouter();
  const choicesPanel = useRef<HTMLDivElement>(null);
  const parsed = avatarSchema.safeParse(initialConfig);
  const [saved, setSaved] = useState<AvatarConfig>(parsed.success ? parsed.data : avatarForUsername(username));
  const [config, setConfig] = useState<AvatarConfig>(saved);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("Style");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const visibleCategories = categories.filter((item) => item.name !== "Outfit" || config.avatarStyle === "avataaars");
  const nextCategory = visibleCategories[visibleCategories.findIndex((item) => item.name === category) + 1];

  const goToCategory = (next: Category) => {
    setCategory(next);
    choicesPanel.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const openBuilder = () => {
    setConfig(saved);
    setCategory("Style");
    setError("");
    setOpen(true);
  };

  const choose = (field: Field, value: string) => {
    // All values come from avatarChoices; schema validation still runs on save.
    setConfig((current) => avatarSchema.parse({ ...current, [field]: value }));
  };

  const randomize = () => {
    const next: Record<string, string> = { ...config };
    for (const field of Object.keys(avatarChoices) as Array<Field>) {
      if (field === "avatarStyle") continue;
      const options: ReadonlyArray<string> = avatarChoices[field];
      next[field] = options[Math.floor(Math.random() * options.length)];
    }
    if (next.backgroundType === "gradientLinear" && next.backgroundAccent === next.backgroundColor) {
      next.backgroundAccent = avatarChoices.backgroundAccent.find((value) => value !== next.backgroundColor) ?? "ffffff";
    }
    setConfig(avatarSchema.parse(next));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const next = avatarSchema.parse(config);
      await updatePlayerAvatar({ data: next });
      setSaved(next);
      onSaved?.(next);
      await router.invalidate();
      setOpen(false);
    } catch {
      setError("Could not save your avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <img src={renderAvatar(saved)} alt="Your current avatar" className="size-20 rounded-full ring-2 ring-border" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold">Your avatar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Build a look that feels like you. No uploads or outside images.</p>
          </div>
          <Button type="button" onClick={openBuilder}>Open avatar builder</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0">
          <header className="shrink-0 border-b px-4 py-4 pr-12 sm:px-8">
            <DialogTitle className="font-serif text-2xl">Avatar studio</DialogTitle>
            <DialogDescription>Pick a style, then explore every look visually. Your changes stay private until you save.</DialogDescription>
          </header>

          <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[11rem_minmax(16rem,0.8fr)_minmax(0,1.5fr)]">
            <nav aria-label="Avatar categories" className="flex shrink-0 gap-1 overflow-x-auto border-b bg-muted/20 px-3 py-2 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4">
              {visibleCategories.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => goToCategory(name)}
                  aria-current={category === name ? "step" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${category === name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <Icon className="size-4" />{name}
                </button>
              ))}
            </nav>

            <div className="flex shrink-0 flex-col items-center justify-center gap-3 border-b bg-gradient-to-b from-muted/40 to-background p-4 lg:border-b-0 lg:border-r lg:p-8">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Live preview</span>
              <img src={renderAvatar(config)} alt="Preview of your customized avatar" className="size-28 rounded-full shadow-xl ring-4 ring-background sm:size-36 lg:size-56" />
              <p className="text-center text-xs text-muted-foreground">{username} · {optionLabel("avatarStyle", config.avatarStyle)}</p>
              <Button variant="outline" size="sm" type="button" onClick={randomize}>Surprise me</Button>
            </div>

            <div ref={choicesPanel} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              <div className="mb-5 flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-2xl font-bold">{category}</h3>
                <span className="text-xs text-muted-foreground">Tap a preview to apply it</span>
              </div>
              <div className="space-y-6">
                {fieldsFor(category, config).map((field) => (
                  <ChoiceField key={`${config.avatarStyle}-${field}`} field={field} config={config} onChange={choose} />
                ))}
              </div>
              {nextCategory && (
                <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => goToCategory(nextCategory.name)}>
                  Next: {nextCategory.name} →
                </Button>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-8">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Discard</Button>
              <Button type="button" disabled={saving || JSON.stringify(config) === JSON.stringify(saved)} onClick={save}>{saving ? "Saving…" : "Save avatar"}</Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}
