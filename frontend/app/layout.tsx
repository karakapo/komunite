import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mom Test Live Lab",
  description: "Gamified realtime Mom Test interview simulator powered by Wiro AI"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
