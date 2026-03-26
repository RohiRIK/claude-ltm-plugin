"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/",        label: "Graph" },
  { href: "/pending", label: "Pending" },
  { href: "/health",  label: "Health" },
  { href: "/config",  label: "Config" },
  { href: "/settings",label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex items-center gap-1 px-4 py-1.5 bg-[var(--bg-primary)] border-b border-[var(--border)] text-xs">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-2 py-1 rounded transition-colors ${
            isActive(href)
              ? "text-[var(--text-primary)] bg-[var(--bg-tertiary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          {label}
        </Link>
      ))}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </nav>
  );
}
