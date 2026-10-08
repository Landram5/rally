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
  themeColor: "#1c352d", // keep in sync with --bg-inverse in theme.css
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><AppearanceProvider><SkipLink/>{children}<SupportFooter/><PersistentMobileNavigation/><AnnouncementBanner/><PwaRegistration /></AppearanceProvider></body>
    </html>
  );
}
