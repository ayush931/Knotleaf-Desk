import type { Metadata, Viewport } from "next";
import { Inter, Caveat, Fira_Code } from "next/font/google";
import "./globals.css";

// Bundle fonts with the website instead of fetching them while editing.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], display: "swap" });
const firaCode = Fira_Code({ variable: "--font-fira", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Whiteboard",
    template: "%s · Whiteboard",
  },
  description: "A fast whiteboard for diagrams, architecture, and notes. Create diagrams and Markdown notes in your browser.",
  icons: {
    icon: [{ url: "/icons/mark.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${caveat.variable} ${firaCode.variable}`}>
      <body className="antialiased bg-[#121212] text-[#f4f4f5]">{children}</body>
    </html>
  );
}
