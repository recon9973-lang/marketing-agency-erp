import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VENOM ERP",
  description: "마케팅 에이전시 업무 운영 시스템",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    title: "VENOM",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
