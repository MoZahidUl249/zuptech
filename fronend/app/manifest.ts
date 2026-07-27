import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — Power Solutions & Services`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fafafb",
    theme_color: "#0b4fe0",
    icons: [
      {
        src: "/images/zup-mark.png",
        sizes: "249x249",
        type: "image/png",
      },
    ],
  };
}
