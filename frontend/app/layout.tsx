import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Komunite Canli Gorusme",
  description: "Wiro AI destekli, oyunlastirilmis canli Mom Test gorusme simulasyonu"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
