import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "索菲 · 在线读心牌局",
  description: "看见牌的阵营，猜不到牌的点数。支持在线房间和 NPC 对战。",
  openGraph: {
    title: "索菲 · 在线读心牌局",
    description: "看见牌的阵营，猜不到牌的点数。A 最大，但 2 能击败 A。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "索菲 · 在线读心牌局",
    description: "看见牌的阵营，猜不到牌的点数。A 最大，但 2 能击败 A。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
