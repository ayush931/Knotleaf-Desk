import { brandAsset } from "@/lib/brandAssets";
import type { Metadata, Viewport } from "next";
import {
  Inter,
  Caveat,
  Fira_Code,
  Lora,
  Nunito,
  Roboto_Condensed,
  Patrick_Hand,
  Manrope,
  DM_Sans,
  Space_Grotesk,
  Outfit,
  Quicksand,
  Comfortaa,
  Playfair_Display,
  Cormorant_Garamond,
  Libre_Baskerville,
  DM_Serif_Display,
  Kalam,
  Shadows_Into_Light,
  Indie_Flower,
  Permanent_Marker,
  Architects_Daughter,
  Fredoka,
  Baloo_2,
  Righteous,
  Lobster,
  Bangers,
  Abril_Fatface,
  Special_Elite,
  Space_Mono,
} from "next/font/google";
import "./globals.css";

// Bundle fonts with the website instead of fetching them while editing.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});
const firaCode = Fira_Code({
  variable: "--font-fira",
  subsets: ["latin"],
  display: "swap",
});
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
const condensed = Roboto_Condensed({
  variable: "--font-condensed",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
const patrick = Patrick_Hand({
  variable: "--font-patrick",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const fontManrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontDMSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontSpaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontOutfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontQuicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontComfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontPlayfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontCormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontLibreBaskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontDMSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontKalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
});
const fontShadowsIntoLight = Shadows_Into_Light({
  variable: "--font-shadows",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontIndieFlower = Indie_Flower({
  variable: "--font-indie",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontPermanentMarker = Permanent_Marker({
  variable: "--font-marker",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontArchitectsDaughter = Architects_Daughter({
  variable: "--font-architect",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontFredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontBaloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fontRighteous = Righteous({
  variable: "--font-righteous",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontLobster = Lobster({
  variable: "--font-lobster",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontBangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontAbrilFatface = Abril_Fatface({
  variable: "--font-abril",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontSpecialElite = Special_Elite({
  variable: "--font-typewriter",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
});
const fontSpaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Knotleaf Desk",
    template: "%s · Knotleaf Desk",
  },
  description:
    "Knotleaf Desk brings diagrams and notes together. Draw, collaborate, and keep editable project backups in your browser.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Knotleaf Desk",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: brandAsset("/icons/icon-192.png"),
    icon: [
      { url: brandAsset("/icons/mark.svg"), type: "image/svg+xml" },
      {
        url: brandAsset("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${inter.variable} ${caveat.variable} ${firaCode.variable} ${lora.variable} ${nunito.variable} ${condensed.variable} ${patrick.variable} ${fontManrope.variable} ${fontDMSans.variable} ${fontSpaceGrotesk.variable} ${fontOutfit.variable} ${fontQuicksand.variable} ${fontComfortaa.variable} ${fontPlayfairDisplay.variable} ${fontCormorantGaramond.variable} ${fontLibreBaskerville.variable} ${fontDMSerifDisplay.variable} ${fontKalam.variable} ${fontShadowsIntoLight.variable} ${fontIndieFlower.variable} ${fontPermanentMarker.variable} ${fontArchitectsDaughter.variable} ${fontFredoka.variable} ${fontBaloo2.variable} ${fontRighteous.variable} ${fontLobster.variable} ${fontBangers.variable} ${fontAbrilFatface.variable} ${fontSpecialElite.variable} ${fontSpaceMono.variable}`}
    >
      {/* Browser extensions can add body attributes before React hydrates. */}
      <body
        suppressHydrationWarning
        className="antialiased bg-[#121212] text-[#f4f4f5]"
      >
        {children}
      </body>
    </html>
  );
}
