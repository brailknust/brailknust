import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRAIL KNUST",
  description: "AI academic planning and study support for KNUST students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
