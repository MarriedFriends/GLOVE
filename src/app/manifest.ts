import type { MetadataRoute } from "next";

/**
 * Web App Manifest — makes Glove installable on a phone's home screen.
 * Next.js serves this at /manifest.webmanifest and links it automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glove",
    short_name: "Glove",
    description: "같은 캠퍼스, 익명으로 시작하는 설렘 — 대학생 익명 소개팅",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    background_color: "#ffffff",
    theme_color: "#f43f5e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
