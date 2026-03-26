import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
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
          <nav className="flex items-center gap-1 px-4 py-1.5 bg-[var(--bg-primary)] border-b border-[var(--border)] text-xs">
            <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]">
              Graph
            </Link>
            <Link href="/pending" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]">
              Pending
            </Link>
            <Link href="/health" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]">
              Health
            </Link>
            <Link href="/config" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]">
              Config
            </Link>
            <Link href="/settings" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]">
              Settings
            </Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </nav>
          <div className="flex-1 min-h-0">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
