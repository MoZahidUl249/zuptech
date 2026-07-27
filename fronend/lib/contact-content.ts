// Static content for the Contact page's office/warehouse cards — code-maintained
// for now (mirrors lib/team.ts's precedent). These fields (service line, tenders
// email, opening hours breakdown, warehouse address) have no admin-managed
// equivalent yet; the head office name/phone/email/address itself is pulled
// live from useSiteContact() so it stays in sync with the rest of the site.

export const headOffice = {
  name: "ZUP TECH Ltd.",
  serviceLine: "+880 18 0000 0000",
  tendersEmail: "bids@zuptech.com.bd",
  hours: [
    { days: "Sat – Thu", time: "9:00 am – 8:00 pm" },
    { days: "Friday", time: "Closed" },
    { days: "Emergency service", time: "24/7" },
  ],
};

export const warehouse = {
  title: "Warehouse & Service Centre",
  line1: "Plot 18, Tejgaon Industrial Area",
  line2: "Dhaka 1208 · Gate 2, deliveries 8am–5pm",
};
