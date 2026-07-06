import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";

export const metadata: Metadata = {
  applicationName: "VENOM ERP",
  title: "VENOM 마케팅 ERP",
  description: "마케팅 대행사 업무 운영 ERP — 거래처·계약서·주간보고·업무·정산·보고서·카드뉴스",
  manifest: "/manifest.webmanifest",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
