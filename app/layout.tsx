import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "好好吃饭 · 下一顿吃什么",
  description: "根据家庭菜谱、冰箱库存和临期食材，帮你快速决定下一顿。",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#35431f",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
