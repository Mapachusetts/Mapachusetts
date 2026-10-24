"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavLink {
  href: string;
  label: string;
  /** The globe at "/" is a static page, so it needs a full page load. */
  external?: boolean;
}

const LINKS: NavLink[] = [
  { href: "/", label: "Map", external: true },
  { href: "/candidates", label: "Candidates" },
  { href: "/news", label: "News" },
  { href: "/candidates#about", label: "About" },
];

/** Top bar for the Next.js pages, styled to match the globe's top bar. */
export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(link: NavLink): boolean {
    if (link.external || link.href.includes("#")) return false;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Plain <a>: "/" is the static globe page, not a Next.js route. */}
        <a href="/" className="navbar-brand">
          <span className="navbar-brand-mark" aria-hidden="true">
            🌎
          </span>
          Mapachusetts
        </a>

        <button
          type="button"
          className="navbar-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="navLinks"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          className={`navbar-links${menuOpen ? " open" : ""}`}
          id="navLinks"
          aria-label="Main"
        >
          {LINKS.map((link) => {
            const active = isActive(link);
            const props = {
              href: link.href,
              className: active ? "active" : undefined,
              "aria-current": active ? ("page" as const) : undefined,
              onClick: () => setMenuOpen(false),
            };
            return link.external ? (
              <a key={link.href} {...props}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} {...props}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
