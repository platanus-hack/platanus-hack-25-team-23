import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainFlow - Tu Segundo Cerebro con IA",
  description: "Aprende cualquier tema con un mapa visual, explicaciones pedagogicas y conceptos conectados automaticamente. Tu segundo cerebro potenciado con inteligencia artificial.",
  keywords: ["aprendizaje", "IA", "mapa mental", "conocimiento", "estudio", "notas", "educacion"],
  authors: [{ name: "BrainFlow Team" }],
  openGraph: {
    title: "BrainFlow - Tu Segundo Cerebro con IA",
    description: "Aprende cualquier tema con un mapa visual, explicaciones pedagogicas y conceptos conectados automaticamente.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
