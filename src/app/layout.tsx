import { ThemeProvider } from "next-themes";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { moodCss } from "./utils/moodPalettes";

// Self-hosted at build time, so the kiosk needs no font network at runtime.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

export const metadata = {
  title: 'Coat Check',
  description: 'Check if you need a coat',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <head>
        {/* The kiosk's colour tokens, one block per weather mood (plan 017). */}
        <style dangerouslySetInnerHTML={{ __html: moodCss() }} />
      </head>
      <body
        className="antialiased"
      >
        {/* Kept for the vendored map, which reads the theme; the weather mood
            drives colour and basemap instead, so the theme is pinned. */}
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
