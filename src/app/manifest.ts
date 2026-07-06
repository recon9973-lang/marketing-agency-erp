import type { MetadataRoute } from "next";

// PWA 매니페스트 — "앱 설치" 시 이름/아이콘/실행 방식(standalone)을 정의.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VENOM 마케팅 ERP",
    short_name: "VENOM ERP",
    description: "마케팅 대행사 업무 운영 ERP — 거래처·계약서·주간보고·업무·정산·보고서·카드뉴스",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#d9662e",
    lang: "ko",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
