import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css"; // RainbowKit stilleri
import { Providers } from "./providers"; // Az önce oluşturduğumuz dosya

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AION - Quantum Bonding Curve",
  description: "Launch your token instantly on AION.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}