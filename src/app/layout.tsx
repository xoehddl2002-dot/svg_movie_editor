import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVG Movie Maker",
  description: "Create animated SVG movies with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
