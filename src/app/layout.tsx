import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "plnngpkr - Planning Poker for Agile Teams",
  description:
    "Free, real-time planning poker for agile teams. Estimate stories together with customizable card decks, no signup required.",
  keywords: [
    "planning poker",
    "scrum poker",
    "agile estimation",
    "story points",
    "sprint planning",
  ],
  openGraph: {
    title: "plnngpkr - Planning Poker for Agile Teams",
    description:
      "Free, real-time planning poker for agile teams. Estimate stories together with customizable card decks.",
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
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
