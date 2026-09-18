import type { Metadata, Viewport } from "next";
import "./globals.css";
import WebMCP from "./webmcp";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  title: "NaTarot — A space between you and the cards",
  description: "Create your tarot ritual. Explore 78 cards, reflect in your journal, and read together.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      { url: "/brand/natarot-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/natarot-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<WebMCP/></body>
    </html>
  );
}
