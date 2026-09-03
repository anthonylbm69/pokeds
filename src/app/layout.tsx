import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// `cover` libère les encoches : la coque va jusqu'aux bords de l'écran.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d11",
};

export const metadata: Metadata = {
  title: "Pokédex — Édition Unys",
  description:
    "Un Pokédex double écran façon Pokémon Version Noire et Blanche, alimenté par la PokéAPI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={rubik.variable}>{children}</body>
    </html>
  );
}
