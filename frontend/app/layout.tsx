import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "offside",
  description: "offside: FPL squad, gameweek stats and ML-powered transfer suggestions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <SiteHeader />
        <div className="min-w-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
