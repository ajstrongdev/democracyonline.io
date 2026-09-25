import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";
import * as adventurer from "@dicebear/adventurer";
import * as lorelei from "@dicebear/lorelei";
import { z } from "zod";
import type { Options as AdventurerOptions } from "@dicebear/adventurer";
import type { Options as LoreleiOptions } from "@dicebear/lorelei";

// Every choice is predefined: players cannot upload or supply SVG, colors, or image URLs.
const skinTones = [
  "2d2019", "3b281f", "4a3022", "543725", "614335", "704a32", "7d5036",
  "8c593c", "995f3e", "a56843", "ae5d29", "b8754b", "c18054", "d08b5b",
  "d89469", "e0a475", "edb98a", "f1c69b", "f6d3a7", "ffdbb4", "ffe4c7",
  "fd9841", "f8d25c", "f6cfa6", "c49375", "ab795c", "916044", "dbac82",
  "c98e65", "efd0b4", "f4d4c3", "fce1c6",
  // A few playful fantasy tones, still chosen from the same fixed list.
  "8ac0a8", "74b9bf", "b9a1d0", "e8a7b8",
] as const;

const hairColors = [
  "a55728", "2c1b18", "b58143", "d6b370", "724133", "4a312c", "f59797",
  "ecdcbf", "c93305", "e8e1e1", "161616", "28221e", "3a3029", "594231",
  "805333", "a06e46", "c58d54", "dfae68", "f1d49c", "faf0d5", "737373",
  "aaa8a4", "f9f9f6", "8e3427", "ab5434", "d87747", "dba18b", "e978a6",
  "c65494", "a05cb6", "7953bb", "4f5ed9", "467eca", "47b8bc", "4b9b66",
  "9dad48", "e0ab35", "c64554", "ef7b78", "bfc3ca",
] as const;

const outfitColors = [
  "262e33", "65c9ff", "5199e4", "25557c", "e6e6e6", "929598", "3c4f5c",
  "b1e2ff", "a7ffc4", "ffdeb5", "ffafb9", "ffffb1", "ff488e", "ff5c5c",
  "ffffff", "111827", "334155", "64748b", "94a3b8", "f1f5f9", "1e3a8a",
  "2563eb", "38bdf8", "0e7490", "0d9488", "047857", "16a34a", "84cc16",
  "ca8a04", "facc15", "f97316", "ea580c", "b91c1c", "e11d48", "be185d",
  "9333ea", "7c3aed", "4f46e5", "6d28d9", "db2777", "f9a8d4", "fda4af",
  "fdba74", "fde68a", "bbf7d0", "99f6e4", "a5f3fc", "bfdbfe", "ddd6fe",
  "e9d5ff", "78350f", "92400e", "78716c", "57534e", "0f172a", "000000",
] as const;

const backdropColors = [
  "65c9ff", "5199e4", "a7ffc4", "ffdeb5", "ffafb9", "ffffb1", "ff488e",
  "ffffff", "f8fafc", "e2e8f0", "cbd5e1", "94a3b8", "334155", "0f172a",
  "fef2f2", "fecaca", "fb7185", "fce7f3", "f9a8d4", "e9d5ff", "c4b5fd",
  "a5b4fc", "dbeafe", "93c5fd", "7dd3fc", "cffafe", "67e8f9", "99f6e4",
  "6ee7b7", "dcfce7", "bbf7d0", "d9f99d", "fef9c3", "fde68a", "fdba74",
  "ffedd5", "fed7aa", "d6d3d1", "f5f5f4", "f3e8ff", "be123c", "7c3aed",
  "1d4ed8", "0f766e", "15803d", "a16207", "c2410c", "7f1d1d",
] as const;

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);

const adventurerHair = [...numbered("short", 19), ...numbered("long", 26)];
const loreleiHair = numbered("variant", 48);

export const avatarChoices = {
  avatarStyle: ["avataaars", "adventurer", "lorelei"],
  skinColor: skinTones,
  top: ["none", "hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04", "bob", "bun", "curly", "curvy", "dreads", "frida", "fro", "froBand", "longButNotTooLong", "miaWallace", "shavedSides", "straight02", "straight01", "straightAndStrand", "dreads01", "dreads02", "frizzle", "shaggy", "shaggyMullet", "shortCurly", "shortFlat", "shortRound", "shortWaved", "sides", "theCaesar", "theCaesarAndSidePart", "bigHair"],
  hairColor: hairColors,
  eyes: ["closed", "cry", "default", "eyeRoll", "happy", "hearts", "side", "squint", "surprised", "winkWacky", "wink", "xDizzy"],
  eyebrows: ["angryNatural", "defaultNatural", "flatNatural", "frownNatural", "raisedExcitedNatural", "sadConcernedNatural", "unibrowNatural", "upDownNatural", "angry", "default", "raisedExcited", "sadConcerned", "upDown"],
  mouth: ["concerned", "default", "disbelief", "eating", "grimace", "sad", "screamOpen", "serious", "smile", "tongue", "twinkle", "vomit"],
  clothing: ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck"],
  clothesColor: outfitColors,
  clothingGraphic: ["bat", "bear", "cumbia", "deer", "diamond", "hola", "pizza", "resist", "skull", "skullOutline"],
  facialHair: ["none", "beardLight", "beardMajestic", "beardMedium", "moustacheFancy", "moustacheMagnum"],
  facialHairColor: hairColors,
  accessories: ["none", "kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers", "eyepatch"],
  accessoriesColor: outfitColors,
  hatColor: outfitColors,
  backgroundColor: backdropColors,
  backgroundAccent: backdropColors,
  backgroundType: ["solid", "gradientLinear"],
  backgroundRotation: ["0", "45", "90", "135", "180", "225", "270", "315"],
  framing: ["default", "circle"],
  mirror: ["normal", "mirrored"],
  scale: ["80", "90", "100", "110", "120"],
  adventurerHair: ["none", ...adventurerHair],
  adventurerEyes: numbered("variant", 26),
  adventurerEyebrows: numbered("variant", 15),
  adventurerMouth: numbered("variant", 30),
  adventurerFeature: ["none", "mustache", "blush", "birthmark", "freckles"],
  adventurerGlasses: ["none", ...numbered("variant", 5)],
  adventurerEarrings: ["none", ...numbered("variant", 6)],
  loreleiHair,
  loreleiEyes: numbered("variant", 24),
  loreleiEyebrows: numbered("variant", 13),
  loreleiMouth: [...numbered("happy", 18), ...numbered("sad", 9)],
  loreleiHead: numbered("variant", 4),
  loreleiNose: numbered("variant", 6),
  loreleiGlasses: ["none", ...numbered("variant", 5)],
  loreleiEarrings: ["none", ...numbered("variant", 3)],
  loreleiBeard: ["none", ...numbered("variant", 2)],
  loreleiFreckles: ["none", "freckles"],
  loreleiHairAccessories: ["none", "flowers"],
} as const;

export const avatarSchema = z.object({
  avatarStyle: z.enum(avatarChoices.avatarStyle).default("avataaars"),
  skinColor: z.enum(avatarChoices.skinColor),
  top: z.enum(avatarChoices.top),
  hairColor: z.enum(avatarChoices.hairColor),
  eyes: z.enum(avatarChoices.eyes),
  eyebrows: z.enum(avatarChoices.eyebrows),
  mouth: z.enum(avatarChoices.mouth),
  clothing: z.enum(avatarChoices.clothing),
  clothesColor: z.enum(avatarChoices.clothesColor),
  clothingGraphic: z.enum(avatarChoices.clothingGraphic),
  facialHair: z.enum(avatarChoices.facialHair),
  facialHairColor: z.enum(avatarChoices.facialHairColor),
  accessories: z.enum(avatarChoices.accessories),
  accessoriesColor: z.enum(avatarChoices.accessoriesColor),
  hatColor: z.enum(avatarChoices.hatColor),
  backgroundColor: z.enum(avatarChoices.backgroundColor),
  backgroundAccent: z.enum(avatarChoices.backgroundAccent).default("ffffff"),
  backgroundType: z.enum(avatarChoices.backgroundType).default("solid"),
  backgroundRotation: z.enum(avatarChoices.backgroundRotation).default("0"),
  framing: z.enum(avatarChoices.framing).default("default"),
  mirror: z.enum(avatarChoices.mirror).default("normal"),
  scale: z.enum(avatarChoices.scale).default("100"),
  adventurerHair: z.enum(avatarChoices.adventurerHair).default("short01"),
  adventurerEyes: z.enum(avatarChoices.adventurerEyes).default("variant01"),
  adventurerEyebrows: z.enum(avatarChoices.adventurerEyebrows).default("variant01"),
  adventurerMouth: z.enum(avatarChoices.adventurerMouth).default("variant01"),
  adventurerFeature: z.enum(avatarChoices.adventurerFeature).default("none"),
  adventurerGlasses: z.enum(avatarChoices.adventurerGlasses).default("none"),
  adventurerEarrings: z.enum(avatarChoices.adventurerEarrings).default("none"),
  loreleiHair: z.enum(avatarChoices.loreleiHair).default("variant01"),
  loreleiEyes: z.enum(avatarChoices.loreleiEyes).default("variant01"),
  loreleiEyebrows: z.enum(avatarChoices.loreleiEyebrows).default("variant01"),
  loreleiMouth: z.enum(avatarChoices.loreleiMouth).default("happy01"),
  loreleiHead: z.enum(avatarChoices.loreleiHead).default("variant01"),
  loreleiNose: z.enum(avatarChoices.loreleiNose).default("variant01"),
  loreleiGlasses: z.enum(avatarChoices.loreleiGlasses).default("none"),
  loreleiEarrings: z.enum(avatarChoices.loreleiEarrings).default("none"),
  loreleiBeard: z.enum(avatarChoices.loreleiBeard).default("none"),
  loreleiFreckles: z.enum(avatarChoices.loreleiFreckles).default("none"),
  loreleiHairAccessories: z.enum(avatarChoices.loreleiHairAccessories).default("none"),
}).strict();

export type AvatarConfig = z.infer<typeof avatarSchema>;

export const defaultAvatar: AvatarConfig = {
  avatarStyle: "avataaars",
  skinColor: "edb98a",
  top: "shortCurly",
  hairColor: "2c1b18",
  eyes: "default",
  eyebrows: "defaultNatural",
  mouth: "smile",
  clothing: "blazerAndShirt",
  clothesColor: "5199e4",
  clothingGraphic: "diamond",
  facialHair: "none",
  facialHairColor: "2c1b18",
  accessories: "none",
  accessoriesColor: "262e33",
  hatColor: "5199e4",
  backgroundColor: "65c9ff",
  backgroundAccent: "ffffff",
  backgroundType: "solid",
  backgroundRotation: "0",
  framing: "default",
  mirror: "normal",
  scale: "100",
  adventurerHair: "short01",
  adventurerEyes: "variant01",
  adventurerEyebrows: "variant01",
  adventurerMouth: "variant01",
  adventurerFeature: "none",
  adventurerGlasses: "none",
  adventurerEarrings: "none",
  loreleiHair: "variant01",
  loreleiEyes: "variant01",
  loreleiEyebrows: "variant01",
  loreleiMouth: "happy01",
  loreleiHead: "variant01",
  loreleiNose: "variant01",
  loreleiGlasses: "none",
  loreleiEarrings: "none",
  loreleiBeard: "none",
  loreleiFreckles: "none",
  loreleiHairAccessories: "none",
};

export function avatarForUsername(username: string): AvatarConfig {
  let hash = 2166136261;
  for (const char of username.toLowerCase()) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  const result = { ...defaultAvatar };
  for (const key of ["skinColor", "top", "hairColor", "eyes", "eyebrows", "mouth", "clothing", "clothesColor", "clothingGraphic", "hatColor", "backgroundColor", "backgroundAccent"] as const) {
    // Keep the generated default human-like; optional features remain off until chosen.
    const choices = avatarChoices[key];
    hash = Math.imul(hash ^ (hash >>> 13), 16777619) >>> 0;
    (result as Record<string, string>)[key] = choices[hash % choices.length];
  }
  return result;
}

export function renderAvatar(config: AvatarConfig) {
  const shared = {
    seed: "profile",
    backgroundColor: config.backgroundType === "gradientLinear"
      ? [config.backgroundColor, config.backgroundAccent]
      : [config.backgroundColor],
    backgroundType: [config.backgroundType] as Array<"solid" | "gradientLinear">,
    backgroundRotation: [Number(config.backgroundRotation)],
    flip: config.mirror === "mirrored",
    scale: Number(config.scale),
  };

  if (config.avatarStyle === "adventurer") {
    return createAvatar(adventurer, {
      ...shared,
      skinColor: [config.skinColor],
      hairColor: [config.hairColor],
      hair: config.adventurerHair === "none" ? [] : [config.adventurerHair as NonNullable<AdventurerOptions["hair"]>[number]],
      hairProbability: config.adventurerHair === "none" ? 0 : 100,
      eyes: [config.adventurerEyes as NonNullable<AdventurerOptions["eyes"]>[number]],
      eyebrows: [config.adventurerEyebrows as NonNullable<AdventurerOptions["eyebrows"]>[number]],
      mouth: [config.adventurerMouth as NonNullable<AdventurerOptions["mouth"]>[number]],
      features: config.adventurerFeature === "none" ? [] : [config.adventurerFeature],
      featuresProbability: config.adventurerFeature === "none" ? 0 : 100,
      glasses: config.adventurerGlasses === "none" ? [] : [config.adventurerGlasses as NonNullable<AdventurerOptions["glasses"]>[number]],
      glassesProbability: config.adventurerGlasses === "none" ? 0 : 100,
      earrings: config.adventurerEarrings === "none" ? [] : [config.adventurerEarrings as NonNullable<AdventurerOptions["earrings"]>[number]],
      earringsProbability: config.adventurerEarrings === "none" ? 0 : 100,
    }).toDataUri();
  }

  if (config.avatarStyle === "lorelei") {
    return createAvatar(lorelei, {
      ...shared,
      skinColor: [config.skinColor],
      hairColor: [config.hairColor],
      hair: [config.loreleiHair as NonNullable<LoreleiOptions["hair"]>[number]],
      eyes: [config.loreleiEyes as NonNullable<LoreleiOptions["eyes"]>[number]],
      eyebrows: [config.loreleiEyebrows as NonNullable<LoreleiOptions["eyebrows"]>[number]],
      mouth: [config.loreleiMouth as NonNullable<LoreleiOptions["mouth"]>[number]],
      head: [config.loreleiHead as NonNullable<LoreleiOptions["head"]>[number]],
      nose: [config.loreleiNose as NonNullable<LoreleiOptions["nose"]>[number]],
      glasses: config.loreleiGlasses === "none" ? [] : [config.loreleiGlasses as NonNullable<LoreleiOptions["glasses"]>[number]],
      glassesProbability: config.loreleiGlasses === "none" ? 0 : 100,
      earrings: config.loreleiEarrings === "none" ? [] : [config.loreleiEarrings as NonNullable<LoreleiOptions["earrings"]>[number]],
      earringsProbability: config.loreleiEarrings === "none" ? 0 : 100,
      beard: config.loreleiBeard === "none" ? [] : [config.loreleiBeard as NonNullable<LoreleiOptions["beard"]>[number]],
      beardProbability: config.loreleiBeard === "none" ? 0 : 100,
      freckles: ["variant01"],
      frecklesProbability: config.loreleiFreckles === "none" ? 0 : 100,
      hairAccessories: ["flowers"],
      hairAccessoriesProbability: config.loreleiHairAccessories === "none" ? 0 : 100,
    }).toDataUri();
  }

  return createAvatar(avataaars, {
    ...shared,
    skinColor: [config.skinColor],
    top: config.top === "none" ? [] : [config.top],
    topProbability: config.top === "none" ? 0 : 100,
    hairColor: [config.hairColor],
    eyes: [config.eyes],
    eyebrows: [config.eyebrows],
    mouth: [config.mouth],
    clothing: [config.clothing],
    clothesColor: [config.clothesColor],
    clothingGraphic: [config.clothingGraphic],
    facialHair: config.facialHair === "none" ? [] : [config.facialHair],
    facialHairColor: [config.facialHairColor],
    facialHairProbability: config.facialHair === "none" ? 0 : 100,
    accessories: config.accessories === "none" ? [] : [config.accessories],
    accessoriesColor: [config.accessoriesColor],
    hatColor: [config.hatColor],
    accessoriesProbability: config.accessories === "none" ? 0 : 100,
    style: [config.framing],
  }).toDataUri();
}
