import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { BadgeCheck, Flag, Landmark, Vote } from "lucide-react"

import { Infobox } from "./infobox"

const meta = {
  title: "UI/Infobox",
  component: Infobox,
  argTypes: {
    accentColor: { control: "color" },
    accentForeground: { control: "color" },
    width: { control: "number" },
  },
} satisfies Meta<typeof Infobox>

export default meta
type Story = StoryObj<typeof meta>

function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode
  tone?: "green" | "amber" | "slate" | "sky"
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    slate: "bg-slate-500/15 text-slate-300",
    sky: "bg-sky-500/15 text-sky-400",
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function Ref({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>
}

export const Representative: Story = {
  args: {
    title: "BiMaggieThatcher",
    subtitle: "Representative",
    accentColor: "#3a2a1c",
    width: 340,
    media: {
      type: "icon",
      icon: <BadgeCheck />,
      background: "#f56200",
    },
    sections: [
      {
        rows: [
          { label: "Status", value: <Pill>Active</Pill> },
          { label: "Nation", value: <Ref>Republic of Oscana</Ref> },
          { label: "Party", value: <Ref>Liberal Party of Oscana</Ref> },
          { label: "Leaning", value: "Center Left" },
          { label: "Member since", value: "2 November 2025" },
          { label: "Bills voted", value: "213" },
          { label: "Amendments proposed", value: "11" },
          { label: "Elections won", value: "3" },
        ],
      },
      {
        heading: "Roles",
        rows: [
          { label: "President", value: "Jun 2026 – present" },
          { label: "Senator", value: "Dec 2025 – Jun 2026" },
          { label: "Representative", value: "May 2025 – Dec 2025" },
          { label: "Representative", value: "Nov 2024 – May 2025" },
        ],
      },
    ],
    footer: "Term 4 · Republic of Oscana",
  },
}

export const Party: Story = {
  args: {
    title: "Liberal Party of Oscana",
    subtitle: "Political Party",
    accentColor: "#1d4ed8",
    width: 340,
    media: {
      type: "icon",
      icon: <Flag />,
      background: "#1d4ed8",
    },
    tags: [{ label: "Center Left", color: "#2563eb" }],
    sections: [
      {
        rows: [
          { label: "Leader", value: <Ref>BiMaggieThatcher</Ref> },
          { label: "Nation", value: <Ref>Republic of Oscana</Ref> },
          { label: "Leaning", value: "Center Left" },
          { label: "Founded", value: "14 March 2025" },
          { label: "Members", value: "48" },
          { label: "Coalition", value: <Ref>Progressive Alliance</Ref> },
          { label: "International", value: "Liberal International" },
        ],
      },
      {
        heading: "Platform",
        rows: [
          { label: "Economy", value: "Mixed market" },
          { label: "Healthcare", value: "Universal coverage" },
          { label: "Foreign policy", value: "Multilateralist" },
        ],
      },
    ],
    footer: "3 sitting senators · 12 representatives",
  },
}

export const Election: Story = {
  args: {
    title: "Presidential Election",
    subtitle: "Term 4 · Republic of Oscana",
    accentColor: "#6d28d9",
    width: 340,
    media: {
      type: "icon",
      icon: <Vote />,
      background: "#6d28d9",
    },
    tags: [{ label: "Voting open", color: "#7c3aed" }],
    sections: [
      {
        rows: [
          { label: "Type", value: "Presidential" },
          { label: "Status", value: <Pill tone="sky">Voting</Pill> },
          { label: "Method", value: "Instant-runoff (IRV)" },
          { label: "Seats", value: "1" },
          { label: "Candidates", value: "4" },
          { label: "Opened", value: "18 June 2026" },
          { label: "Closes", value: "in 2 days" },
        ],
      },
      {
        heading: "Standings",
        rows: [
          { label: "BiMaggieThatcher", value: "1,204 (41%)" },
          { label: "J. Caldwell", value: "892 (30%)" },
          { label: "R. Okonkwo", value: "611 (21%)" },
          { label: "T. Vance", value: "238 (8%)" },
        ],
      },
    ],
    footer: "PR-STV is used for Senate races",
  },
}

export const Nation: Story = {
  args: {
    title: "Republic of Oscana",
    subtitle: "Nation",
    accentColor: "#047857",
    width: 340,
    media: {
      type: "icon",
      icon: <Landmark />,
      background: "#047857",
    },
    tags: [
      { label: "Active", color: "#059669" },
      { label: "Republic", color: "#0f766e" },
    ],
    sections: [
      {
        rows: [
          { label: "Government", value: "Republic" },
          { label: "Lifecycle", value: <Pill>Active</Pill> },
          { label: "Visibility", value: "Public" },
          { label: "Founded", value: "2 November 2024" },
          { label: "Politicians", value: "142 active" },
          { label: "Parties", value: "9" },
          { label: "President", value: <Ref>BiMaggieThatcher</Ref> },
        ],
      },
      {
        heading: "Stats",
        rows: [
          { label: "Economy", value: "72 / 100" },
          { label: "Stability", value: "64 / 100" },
          { label: "Welfare", value: "58 / 100" },
          { label: "Military", value: "41 / 100" },
        ],
      },
    ],
    footer: "Stage ladder · Founding → House → Senate → Republic",
  },
}

export const WithImage: Story = {
  args: {
    title: "Mount Reference",
    subtitle: "A sample geographic infobox",
    accentColor: "#0f766e",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640",
      alt: "Mountain landscape",
      caption: "The summit at dawn",
      fit: "cover",
    },
    sections: [
      {
        heading: "Geography",
        rows: [
          { label: "Elevation", value: "4,478 m" },
          { label: "Range", value: "Pennine Alps" },
          { label: "Country", value: "Switzerland / Italy" },
        ],
      },
    ],
  },
}
