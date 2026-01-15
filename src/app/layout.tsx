import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ColorThemeInit } from "@/components/color-theme-init";
import { Toaster } from "@/components/ui/sonner";
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
  title: "plnngpkr - Story Estimation for Agile Teams",
  description:
    "Free, real-time story estimation for agile teams. Estimate stories together with customizable card decks, no signup required.",
  keywords: [
    "agile estimation",
    "story points",
    "sprint planning",
    "scrum estimation",
    "team voting",
  ],
  openGraph: {
    title: "plnngpkr - Story Estimation for Agile Teams",
    description:
      "Free, real-time story estimation for agile teams. Estimate stories together with customizable card decks.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeInit />
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
