import "./globals.css";
import type { Metadata, Viewport } from "next";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Life OS",
  description: "Your daily personal assistant",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Life OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5efe6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink min-h-screen">
        <div
          className="pointer-events-none fixed top-3 right-4 z-50 text-[10px] uppercase tracking-[0.18em] text-ash"
          aria-label="App version"
        >
          {APP_VERSION}
        </div>
        {children}
      </body>
    </html>
  );
}
