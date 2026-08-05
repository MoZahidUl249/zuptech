// Static copy for /services, matching the design prototype exactly. Distinct
// from lib/solutions.ts (the admin-managed AdminSolution list, which powers
// the home-page "Our services" tiles) — this page's Residential/Industrial
// marketing copy is bespoke and not admin-editable in v1, same reasoning as
// lib/industrial.ts.

export interface ResidentialCard {
  id: string;
  badge: string;
  title: string;
  description: string;
  checklist: string[];
  imageHint: string;
}

export const residentialCards: ResidentialCard[] = [
  {
    id: "solar-panel-installation",
    badge: "Active installation",
    title: "Solar Panel Installation",
    description:
      "Tier-1 photovoltaic systems engineered for maximum yield in diverse weather conditions. Our modular approach ensures scalability for growing energy needs.",
    checklist: ["25-year efficiency warranty", "Precision mounting hardware", "Smart inverter integration"],
    imageHint: "Technicians installing monocrystalline panels on a roof",
  },
  {
    id: "smart-home-converters",
    badge: "Smart hub",
    title: "Smart Home Converters",
    description:
      "Real-time energy management hubs that intelligently distribute power between the grid, solar, and battery storage units for peak efficiency.",
    checklist: ["App-based grid monitoring", "Dynamic load balancing", "Surge mitigation technology"],
    imageHint: "Smart energy converter on a wall with digital display",
  },
];

export type TrustIconName = "certified" | "support" | "safety" | "health";

export interface TrustBadge {
  id: string;
  title: string;
  description: string;
  icon: TrustIconName;
}

export const trustBadges: TrustBadge[] = [
  {
    id: "iso-9001",
    title: "ISO 9001 certified",
    description: "International standards for quality management and rigorous engineering audits.",
    icon: "certified",
  },
  {
    id: "247-support",
    title: "24/7 tech support",
    description: "Rapid response teams available around the clock for critical infrastructure failure.",
    icon: "support",
  },
  {
    id: "safety-first",
    title: "Safety-first protocol",
    description: "Strict adherence to OHSAS 18001 and local safety-at-work mandates.",
    icon: "safety",
  },
  {
    id: "predictive-health",
    title: "Predictive health",
    description: "Monitoring that predicts and prevents component failure before it occurs.",
    icon: "health",
  },
];
