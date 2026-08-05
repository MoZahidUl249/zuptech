// Static copy for the homepage's post-hero sections, matching the design
// prototype exactly.

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
