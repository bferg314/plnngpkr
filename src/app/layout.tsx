import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { ColorThemeInit } from "@/components/color-theme-init";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
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
