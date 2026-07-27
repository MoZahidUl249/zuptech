// Static copy for the homepage's post-hero sections, matching the design
// prototype exactly. Deliberately separate from lib/industrial.ts (the full
// /industrial page's copy) — these are shorter, homepage-teaser variants of
// the same three ideas, not the same content reused.

export type HomeIconName = "zap" | "sliders" | "flame";

export interface IndustrialHighlight {
  id: string;
  title: string;
  description: string;
  icon: HomeIconName;
}

export const industrialHighlights: IndustrialHighlight[] = [
  {
    id: "substation-design",
    title: "33/11/0.45 kV Substation Design",
    description:
      "Turnkey development from technical blueprinting to heavy hardware commissioning for regional grids.",
    icon: "zap",
  },
  {
    id: "building-management",
    title: "Building Management Systems",
    description:
      "Data-driven environmental control and energy harvesting for large commercial complexes.",
    icon: "sliders",
  },
  {
    id: "fire-protection",
    title: "Fire Protection & Detection",
    description: "Smart sensor arrays and automated suppression systems meeting international safety standards.",
    icon: "flame",
  },
];

export type CapabilityIconName = "grid" | "sun" | "chart";

export interface Capability {
  id: string;
  title: string;
  description: string;
  icon: CapabilityIconName;
}

export const capabilities: Capability[] = [
  {
    id: "ongrid-offgrid",
    title: "OnGrid / OffGrid",
    description:
      "Hybrid power solutions with seamless switching between the utility grid and independent solar storage.",
    icon: "grid",
  },
  {
    id: "lighting-automation",
    title: "Lighting Automation",
    description: "DALI and KNX integrated lighting control for architectural accenting and major energy savings.",
    icon: "sun",
  },
  {
    id: "smart-energy",
    title: "Smart Energy",
    description: "Real-time visualisation of consumption patterns with predictive maintenance alerts.",
    icon: "chart",
  },
];

export const homeStats = [
  { value: "450+", label: "Projects completed" },
  { value: "12.5", label: "MW solar installed" },
  { value: "99.9%", label: "System uptime" },
  { value: "15+", label: "Industrial awards" },
] as const;
