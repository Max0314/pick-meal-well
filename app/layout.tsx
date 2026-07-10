import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "好好吃饭 · 下一顿吃什么";
const description = "根据家庭菜谱、冰箱库存和临期食材，帮你快速决定下一顿。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const protocol = (requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https"))
    .split(",")[0]
    .trim();
  const metadataBase = new URL(`${protocol}://${host}`);
  const cardUrl = new URL("/og.png", metadataBase).toString();

  return {
    title,
    description,
    manifest: "/manifest.webmanifest",
    metadataBase,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "好好吃饭",
      title,
      description,
      images: [{ url: cardUrl, width: 1731, height: 909, alt: "好好吃饭：下一顿，就吃这个吧" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [cardUrl],
    },
  };
}

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
