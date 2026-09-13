import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Team Manager",
  description: "FPL squad, gameweek stats and ML-powered transfer suggestions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
