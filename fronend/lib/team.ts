// Static leadership/team roster for the Contact page — code-maintained for
// now (mirrors lib/solutions.ts's fallback-array precedent). No admin editor
// in v1: the design's admin nav has no "Team" module, so this is presumably
// intended as code-owned content that changes rarely.

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  email: string;
  phone: string;
  imgHint: string;
}

export const team: TeamMember[] = [
  {
    id: "zubayer",
    name: "Rezaul Karim Zubayer",
    role: "Founder & CEO",
    bio: "Started ZUP TECH in 2014 after a decade in grid engineering. Handles enterprise and tender relationships.",
    email: "zubayer@zuptech.com.bd",
    phone: "+880 17 1111 1111",
    imgHint: "founder & CEO portrait, formal",
  },
  {
    id: "farhana",
    name: "Farhana Islam",
    role: "CTO",
    bio: "Owns product and firmware for the converter and IPS lines. BUET EEE, ex-Siemens Energy.",
    email: "farhana@zuptech.com.bd",
    phone: "+880 17 2222 2222",
    imgHint: "CTO portrait, engineering lab",
  },
  {
    id: "shakib",
    name: "Md. Shakib Hossain",
    role: "Operations Manager",
    bio: "Runs the Tejgaon warehouse and install crews and the 24/7 service rota across eight districts.",
    email: "shakib@zuptech.com.bd",
    phone: "+880 17 3333 3333",
    imgHint: "operations manager portrait, warehouse",
  },
  {
    id: "nusrat",
    name: "Nusrat Jahan",
    role: "Marketing Lead",
    bio: "Campaigns, retail partnerships and everything you see on this site. Talk to her about co-branding.",
    email: "nusrat@zuptech.com.bd",
    phone: "+880 17 4444 4444",
    imgHint: "marketing lead portrait",
  },
  {
    id: "ashraful",
    name: "Ashraful Alam",
    role: "Lead Field Engineer",
    bio: "Site surveys, load audits and commissioning. Twelve years on substation and solar builds.",
    email: "ashraful@zuptech.com.bd",
    phone: "+880 17 5555 5555",
    imgHint: "field engineer in PPE on site",
  },
  {
    id: "tanjina",
    name: "Tanjina Akter",
    role: "Customer Support Lead",
    bio: "First reply on WhatsApp and phone. Warranty claims, spare parts and service scheduling.",
    email: "support@zuptech.com.bd",
    phone: "+880 17 6666 6666",
    imgHint: "support lead portrait at desk",
  },
];
