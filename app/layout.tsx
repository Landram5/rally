import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/app/pwa-registration";

export const metadata: Metadata = {
  metadataBase: new URL("https://rallytt.net"),
  title: "Rally · Table Tennis",
  description: "Track club matches, player statistics, and table tennis tournaments.",
  openGraph: {
    type: "website",
    siteName: "Rally",
    title: "Rally · Table Tennis",
    description: "Track club matches, player statistics, and table tennis tournaments.",
    images: [{ url: "/rally-share.png", width: 1200, height: 630, type: "image/png", alt: "Rally — table tennis clubs, matches, standings and tournaments. rallytt.net" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally · Table Tennis",
    description: "Track club matches, player statistics, and table tennis tournaments.",
    images: ["/rally-share.png"],
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
  themeColor: "#172e29",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<PwaRegistration /></body>
    </html>
  );
}
