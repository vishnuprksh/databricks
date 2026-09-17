"use client";

import Link from "next/link";
import { useState } from "react";

export default function SiteHeader() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur transition-[width] duration-200 ${collapsed ? "w-16" : "w-40 sm:w-56"}`}>
      <div className={`flex items-center py-5 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        <Link href="/" aria-label="offside home" className="font-extrabold tracking-tight hover:text-[var(--accent)]">
          <span className="text-[var(--accent)]">{collapsed ? "o" : "offside"}</span>
        </Link>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((isCollapsed) => !isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-[var(--muted)] hover:bg-white/5 hover:text-[var(--accent)]"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <nav aria-label="Main navigation" className={`flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}>
        <Link href="/" title="Team Manager" className={`rounded-md py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)] ${collapsed ? "px-2 text-center" : "px-3"}`}>
          {collapsed ? "TM" : "Team Manager"}
        </Link>
        <Link href="/players" title="Players" className={`rounded-md py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)] ${collapsed ? "px-2 text-center" : "px-3"}`}>
          {collapsed ? "PL" : "Players"}
        </Link>
        <Link href="/dream15" title="Dream 15" className={`rounded-md py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)] ${collapsed ? "px-2 text-center" : "px-3"}`}>
          {collapsed ? "D15" : "Dream 15"}
        </Link>
        <Link href="/about" title="About" className={`rounded-md py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)] ${collapsed ? "px-2 text-center" : "px-3"}`}>
          {collapsed ? "AB" : "About"}
        </Link>
      </nav>
    </aside>
  );
}
