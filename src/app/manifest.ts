import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VENOM ERP",
    short_name: "VENOM",
    description: "마케팅 에이전시 업무 운영 시스템",
    id: "/",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fb",
    theme_color: "#0b0b0c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
