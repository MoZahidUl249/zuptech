// Static content for the /industrial B2B page — code-maintained for now
// (mirrors lib/solutions.ts's fallback-array precedent). No admin editor in
// v1: this content changes rarely and the design's admin nav has no module
// for it. Revisit if the backend team wants it admin-manageable later.

export type IndustrialIcon = "zap" | "sliders" | "network" | "shield";

export interface GridSolutionHighlight {
  id: string;
  title: string;
  description: string;
  icon: IndustrialIcon;
}

export const gridSolutionHighlights: GridSolutionHighlight[] = [
  {
    id: "hv-substation-design",
    title: "High-Voltage Substation Design",
    description:
      "Full-cycle engineering from site planning to transformer deployment and commissioning.",
    icon: "zap",
  },
  {
    id: "building-management-systems",
    title: "Building Management Systems",
    description:
      "Automated control networks that optimise HVAC, lighting and power usage across large facilities.",
    icon: "sliders",
  },
  {
    id: "critical-power-distribution",
    title: "Critical Power Distribution",
    description: "Zero-downtime solutions for data centres, hospitals and manufacturing plants.",
    icon: "shield",
  },
];

export interface OperationalStandardRow {
  parameter: string;
  standard: string;
  field: string;
}

export const operationalStandards: OperationalStandardRow[] = [
  { parameter: "Grid response time", standard: "< 15 ms", field: "8 ms (avg)" },
  { parameter: "Operational reliability", standard: "99.999%", field: "99.9979%" },
  { parameter: "Fault clearance speed", standard: "< 100 ms", field: "45 ms" },
  { parameter: "Asset lifecycle", standard: "30+ years", field: "45-year target" },
  { parameter: "Max voltage capacity", standard: "Up to 765 kV", field: "Certified" },
];

export interface IndustrialService {
  id: string;
  num: string;
  title: string;
  description: string;
  tags: string[];
  icon: IndustrialIcon;
}

export const industrialServices: IndustrialService[] = [
  {
    id: "substation-design",
    num: "01",
    title: "Substation Design & Commissioning",
    description:
      "Full-lifecycle development of primary and secondary substations ranging from 33 kV to 765 kV. Includes feasibility studies, civil engineering and final energisation testing.",
    tags: ["Transformer spec", "Switchgear", "SCADA"],
    icon: "zap",
  },
  {
    id: "smart-grid-bms",
    num: "02",
    title: "Smart Grid & BMS",
    description:
      "Integrating advanced Building Management Systems with smart grid infrastructure — real-time load visibility, automated demand response and centralized facility control.",
    tags: ["BMS integration", "Demand response", "Telemetry"],
    icon: "sliders",
  },
  {
    id: "power-distribution",
    num: "03",
    title: "Power Distribution",
    description:
      "Industrial-grade redundancy and UPS deployments for critical facilities — N+1 architectures, automatic transfer systems and load-balanced distribution networks.",
    tags: ["N+1 redundancy", "UPS deployment", "Load balancing"],
    icon: "network",
  },
];

export interface PortfolioProject {
  id: string;
  category: string;
  title: string;
  result: string;
  imgHint: string;
}

export const portfolioProjects: PortfolioProject[] = [
  {
    id: "helios-x-solar-farm",
    category: "Renewables",
    title: "Helios-X Solar Farm",
    result: "120 MW grid integration",
    imgHint: "industrial solar array at sunrise",
  },
  {
    id: "nova-data-centre",
    category: "Critical Power",
    title: "Nova Data Centre",
    result: "Tier IV power redundancy",
    imgHint: "data centre exterior at night",
  },
  {
    id: "metro-grid-node-7",
    category: "Smart Grid",
    title: "Metro Grid Node 7",
    result: "Autonomous load balancing",
    imgHint: "grid control room with telemetry screens",
  },
  {
    id: "steelworks-gen-v",
    category: "Heavy Industry",
    title: "SteelWorks Gen-V",
    result: "Primary substation retrofit",
    imgHint: "heavy manufacturing plant interior",
  },
];
