import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// FIX: Hapus Amiri + Playfair dari next/font/google (Turbopack conflict)
// Pakai CSS @import dari Google Fonts CDN sebagai gantinya (di globals.css)
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ma'had Lughah IAI STIBA Makassar",
  description: "Sistem Pengembangan Bahasa Arab Ma'had Lughah IAI STIBA Makassar. Tes hafalan mufrodat & tarkib dengan evaluasi terstruktur.",
  keywords: ["Arabic", "mufrodat", "tarkib", "Ma'had Lughah", "IAI STIBA Makassar", "pengembangan bahasa"],
  authors: [{ name: "Ma'had Lughah IAI STIBA Makassar" }],
  icons: {
    icon: "/branding/logo-berwarna-indo.png",
    apple: "/branding/logo-berwarna-indo.png",
  },
  openGraph: {
    title: "Ma'had Lughah IAI STIBA Makassar",
    description: "Sistem Pengembangan Bahasa Arab",
    images: ["/branding/logo-berwarna-indo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* PWA manifest + theme color */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0B2545" />
        {/* Nonaktifkan auto-fullscreen */}
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="mobile-web-app-capable" content="no" />
        <meta name="apple-mobile-web-app-title" content="Ma'had Lughah" />
        <link rel="apple-touch-icon" href="/branding/logo-berwarna-indo.png" />
        {/* FIX: Load Amiri + Playfair via Google Fonts CDN (bukan next/font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${jakartaSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
