import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LBS_THEME } from "@/lib/theme";
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
  title: "Last Bit Standing",
  description:
    "A last-player-standing encoding card game. Play binary, hex, and ASCII cards for points on the clock, and call wrong bots to take a life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${LBS_THEME.primaryMode} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-lbs-body font-sans text-lbs-text">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
