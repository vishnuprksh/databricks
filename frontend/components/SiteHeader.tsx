"use client";

import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur">
      <Link href="/" aria-label="offside home" className="font-extrabold tracking-tight hover:text-[var(--accent)]">
        <span className="text-[var(--accent)]">offside</span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-1">
        <Link href="/" title="Team Manager" className="rounded-md px-3 py-1.5 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Team Manager
        </Link>
        <Link href="/players" title="Players" className="rounded-md px-3 py-1.5 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Players
        </Link>
        <Link href="/fixtures" title="Fixtures" className="rounded-md px-3 py-1.5 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Fixtures
        </Link>
        <Link href="/dream15" title="Dream 15" className="rounded-md px-3 py-1.5 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Dream 15
        </Link>
        <Link href="/about" title="About" className="rounded-md px-3 py-1.5 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          About
        </Link>
      </nav>
    </header>
  );
}
