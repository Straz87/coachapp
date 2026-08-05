import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coach App",
  description: "La tua app di coaching personale",
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
