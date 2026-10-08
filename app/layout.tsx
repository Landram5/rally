import SupportFooter from './support-footer';
import type { Metadata, Viewport } from "next";
import "./theme.css";
import "./globals.css";
import "./refine.css";
import AppearanceProvider from "./appearance-provider";
import AnnouncementBanner from './announcement-banner';
import PwaRegistration from "@/app/pwa-registration";
import PersistentMobileNavigation from './persistent-mobile-navigation';
import SkipLink from './skip-link';
import ThemeColorSync from './theme-color-sync';
import PreferenceSync from './preference-sync';
import {PALETTE_INIT_SCRIPT} from '@/lib/palettes';

export const metadata: Metadata = {
  metadataBase: new URL("https://rallytt.net"),
  title: "Rally · Table Tennis",
  description: "Track club matches, player statistics, and table tennis tournaments.",
  openGraph: {
    type: "website",
    url: "https://rallytt.net/",
    siteName: "Rally",
    title: "Rally · Table Tennis",
    description: "Track club matches, player statistics, and table tennis tournaments.",
    images: [{ url: "/rally-share-v2.png", secureUrl: "https://rallytt.net/rally-share-v2.png", width: 1200, height: 630, type: "image/png", alt: "Rally — table tennis clubs, matches, standings and tournaments. rallytt.net" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally · Table Tennis",
    description: "Track club matches, player statistics, and table tennis tournaments.",
    images: ["/rally-share-v2.png"],
  },
  applicationName: "Rally",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rally",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{media:"(prefers-color-scheme: light)",color:"#f5f7f4"},{media:"(prefers-color-scheme: dark)",color:"#0a0f0c"}], // match --bg-page in theme.css; ThemeColorSync keeps it current after the user picks a mode or color
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html: PALETTE_INIT_SCRIPT}} /></head>
      <body className="antialiased"><AppearanceProvider><ThemeColorSync/><PreferenceSync/><SkipLink/>{children}<SupportFooter/><PersistentMobileNavigation/><AnnouncementBanner/><PwaRegistration /></AppearanceProvider></body>
    </html>
  );
}
