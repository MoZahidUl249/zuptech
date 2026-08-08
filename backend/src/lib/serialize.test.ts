import { describe, expect, test } from "bun:test";
import { toIndustrialService, toLead, toService, toShowcaseCard, toSlide } from "./serialize";
import { updateCopyDto } from "../dtos/content.dto";
import type {
  IndustrialService,
  HeroSlide,
  Service,
  ServiceLead,
  ShowcaseCard,
} from "../generated/client";

/**
 * The mappers had no coverage at all, which is how twenty-one `SiteConfig`
 * copy columns survived years after the sections that rendered them were
 * deleted: a column could be renamed, orphaned or dropped and `bun test`
 * stayed green.
 *
 * Two things are pinned here. The `coerceTo` fallbacks, so a row holding a
 * value outside its vocabulary degrades to the documented default instead of
 * shipping an unknown string to the storefront. And the copy contract, so the
 * next section that gets deleted has to take its column with it — the test
 * fails otherwise.
 */

const serviceRow: Service = {
  id: "svc_1",
  slug: "lighting-automation",
  name: "Lighting Automation",
  dsc: "Scene-based lighting control.",
  image: "https://res.cloudinary.com/demo/image/upload/v1/zuptech/service/svc_1/a.jpg",
  features: ["Occupancy sensors", "DALI / KNX"],
  sort: 2,
  imageSide: "right",
  bulletStyle: "dot",
};

describe("toService", () => {
  test("projects every field the storefront card reads", () => {
    expect(toService(serviceRow)).toEqual({
      id: "svc_1",
      slug: "lighting-automation",
      name: "Lighting Automation",
      dsc: "Scene-based lighting control.",
      image: serviceRow.image,
      features: ["Occupancy sensors", "DALI / KNX"],
      sort: 2,
      imageSide: "right",
      bulletStyle: "dot",
    });
  });

  test("falls back to left/tick when the row holds a value outside the vocabulary", () => {
    const rogue = { ...serviceRow, imageSide: "middle", bulletStyle: "star" };
    const dto = toService(rogue);
    expect(dto.imageSide).toBe("left");
    expect(dto.bulletStyle).toBe("tick");
  });

  test("industrial services map identically — the two catalogues share a shape", () => {
    const industrial = { ...serviceRow } as IndustrialService;
    expect(toIndustrialService(industrial)).toEqual(toService(serviceRow));
  });

  test("showcase cards map identically too — same card, different table", () => {
    const showcase = { ...serviceRow } as ShowcaseCard;
    expect(toShowcaseCard(showcase)).toEqual(toService(serviceRow));
  });

  test("a showcase card with a rogue layout value falls back the same way", () => {
    const rogue = { ...serviceRow, imageSide: "sideways", bulletStyle: "" } as ShowcaseCard;
    expect(toShowcaseCard(rogue).imageSide).toBe("left");
    expect(toShowcaseCard(rogue).bulletStyle).toBe("tick");
  });
});

describe("toLead", () => {
  const lead = {
    id: "lead_1",
    serviceId: "svc_1",
    customer: "Karim Uddin",
    address: "House 12, Road 7, Dhanmondi",
    phone: "01711111111",
    email: "karim@example.com",
    notes: "Needs it before Eid.",
    status: "New",
    createdAt: new Date("2026-08-07T10:00:00.000Z"),
  } as ServiceLead;

  const service = { name: "Lighting Automation" } as Service;

  test("projects address and email as their own fields", () => {
    // Both used to be absent: `address` was a required `city`, and the email
    // was concatenated into `notes` by the booking form.
    const dto = toLead({ ...lead, service });
    expect(dto.address).toBe("House 12, Road 7, Dhanmondi");
    expect(dto.email).toBe("karim@example.com");
    expect(dto.notes).toBe("Needs it before Eid.");
    expect(dto.service).toBe("Lighting Automation");
  });

  test("an unknown status degrades to New rather than shipping a bad union", () => {
    expect(toLead({ ...lead, status: "Archived", service }).status).toBe("New");
  });
});

describe("toSlide", () => {
  const slide: HeroSlide = {
    id: "slide_1",
    image: "https://res.cloudinary.com/demo/image/upload/v1/zuptech/heroslide/x/a.jpg",
    mediaType: "video",
    cta: "Shop now",
    href: "/shop",
    active: true,
    fit: "contain",
    bg: "#0B1F3A",
    sort: 0,
    pages: ["home"],
  };

  test("keeps the stored media kind rather than guessing it from the URL", () => {
    expect(toSlide(slide).mediaType).toBe("video");
  });

  test("an unknown fit degrades to cover, which every slide can render", () => {
    expect(toSlide({ ...slide, fit: "stretch" }).fit).toBe("cover");
  });

  test("an unknown media kind degrades to image", () => {
    expect(toSlide({ ...slide, mediaType: "audio" }).mediaType).toBe("image");
  });
  test("keeps only pages the storefront actually renders", () => {
    // The column is a free text array, so a hand-edited or legacy row can hold
    // anything. A junk value must not become a page the carousel tries to match.
    expect(toSlide({ ...slide, pages: ["home", "nonsense", "industrial"] }).pages)
      .toEqual(["home", "industrial"]);
  });

  test("a slide assigned to no page is parked, not shown everywhere", () => {
    expect(toSlide({ ...slide, pages: [] }).pages).toEqual([]);
  });

});

describe("site copy contract", () => {
  /**
   * The exact set GET /api/site-config serves and PUT /admin/api/copy accepts.
   * Every one has a renderer on the storefront — that is the rule this test
   * exists to enforce. Adding a key here without a renderer, or deleting a
   * section without deleting its key, breaks the test on purpose.
   */
  const EXPECTED_COPY_KEYS = [
    "footerDescription",
    "homeHeroHeadline",
    "servicesHeroHeadline",
    "industrialHeroHeadline",
    "contactHeading",
    "contactFormHeading",
    "contactOfficeHeading",
    "contactServiceLine",
    "contactTendersEmail",
  ].sort();

  test("updateCopyDto accepts exactly the keys the storefront renders", () => {
    expect(Object.keys(updateCopyDto.properties).sort()).toEqual(EXPECTED_COPY_KEYS);
  });
});
