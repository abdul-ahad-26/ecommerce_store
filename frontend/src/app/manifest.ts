import type { MetadataRoute } from "next";

// PWA manifest — lets the storefront be "added to home screen" with proper
// branding instead of a generic icon/name.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meher — Pakistani Women's Wear",
    short_name: "Meher",
    description:
      "Premium Pakistani women's wear — lawn, stitched & unstitched shalwar kameez. Cash on delivery across Pakistan.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe3",
    theme_color: "#b14a33",
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
