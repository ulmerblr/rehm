import type { MetadataRoute } from "next";

// Makes "Add to Home Screen" install as a standalone app: the mark alone on the
// springboard, opening without browser chrome, on the ink ground.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rehm",
    short_name: "rehm",
    description: "A longitudinal dream study.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1626",
    theme_color: "#0d1626",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
