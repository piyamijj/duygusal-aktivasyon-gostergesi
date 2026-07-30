import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import EthicalFooter from "@/components/EthicalFooter";

// Load Quicksand font with Turkish character support (latin-ext)
const quicksand = Quicksand({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Duygusal Aktivasyon Göstergesi",
  description: "Tarayıcı tabanlı fizyolojik ve akustik sinyal işleme ile sakin, etik ve tıbbi olmayan öz-yansıtma ve farkındalık aracı.",
  manifest: "/manifest.json",
  icons: {
    // Next.js App Router auto-detects app/icon.png and app/apple-icon.png,
    // but we declare them explicitly here for reliability across hosts/CDNs.
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#58816f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${quicksand.variable}`}>
      <body className="min-h-screen flex flex-col bg-sage-50 text-calm-text font-sans antialiased">
        {/* Main content wrapper with bottom padding to prevent footer overlap */}
        <main className="flex-1 flex flex-col pb-24 md:pb-28">
          {children}
        </main>

        {/* Persistent, non-dismissible ethical disclaimer footer */}
        <EthicalFooter />
      </body>
    </html>
  );
}