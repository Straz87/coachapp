import type { Metadata, Viewport } from "next";
import "./globals.css";

// manifest.json + le icone (public/icon-*.png, apple-touch-icon.png) servono
// perché "Aggiungi alla schermata Home" su iPhone/Android mostri il logo e il
// nome dell'app invece di uno screenshot generico della pagina. appleWebApp
// in particolare è quello che dice a Safari di aprirla come una vera app
// (senza barra degli indirizzi) quando viene lanciata dall'icona sulla Home.
export const metadata: Metadata = {
  title: "Coach App",
  description: "La tua app di coaching personale",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Coach App",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1216",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
