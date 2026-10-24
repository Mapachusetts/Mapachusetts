"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  /** Section id on the home page, for scroll-based highlighting. */
  section?: string;
}

const LINKS: NavLink[] = [
  { href: "/#home", label: "Home", section: "home" },
  { href: "/#research", label: "Research", section: "research" },
  { href: "/news", label: "News" },
  { href: "/#about", label: "About", section: "about" },
  { href: "/#contact", label: "Contact", section: "contact" },
];

/** Site navbar with the mobile hamburger menu from the candidate-search design. */
export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  // On the home page, highlight the link for whichever section is mid-screen.
  useEffect(() => {
    if (pathname !== "/") return;

    const sections = LINKS.map((l) =>
      l.section ? document.getElementById(l.section) : null
    ).filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname]);

  function isActive(link: NavLink): boolean {
    if (link.section) return pathname === "/" && activeSection === link.section;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link href="/" className="navbar-brand">
          Mapachusetts
        </Link>

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
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "active" : undefined}
                aria-current={
                  active ? (link.section ? "location" : "page") : undefined
                }
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
