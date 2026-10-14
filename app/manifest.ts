import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "마음장부",
    short_name: "마음장부",
    description: "축의금·부의금으로 주고받은 마음을 행사별로 한곳에 모아 두는 장부",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#18181b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
