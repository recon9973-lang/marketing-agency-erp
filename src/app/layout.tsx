import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { VersionWatch } from "@/components/pwa/VersionWatch";

export const metadata: Metadata = {
  applicationName: "VENOM ERP",
  title: "VENOM 마케팅 ERP",
  description: "마케팅 대행사 업무 운영 ERP — 거래처·계약서·주간보고·업무·정산·보고서·카드뉴스",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    // iOS 홈화면 아이콘 — manifest 아이콘을 쓰지 않으므로 별도 지정.
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VENOM ERP"
  }
};

export const viewport: Viewport = {
  themeColor: "#d9662e",
  width: "device-width",
  initialScale: 1
};

// 무-FOUC 테마 초기화 — 페인트 전에 저장값(또는 OS 선호)을 data-theme으로 지정.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <RegisterServiceWorker />
        <VersionWatch />
      </body>
    </html>
  );
}
