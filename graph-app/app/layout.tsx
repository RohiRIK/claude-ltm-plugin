import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LTM Graph",
  description: "Long-term memory visualizer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <NavBar />
          <div className="flex-1 min-h-0">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
