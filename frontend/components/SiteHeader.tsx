import Link from "next/link";

export default function SiteHeader() {
  return (
    <aside className="sticky top-0 flex h-screen w-40 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur sm:w-56">
      <div className="px-4 py-5">
        <Link href="/" className="font-extrabold tracking-tight hover:text-[var(--accent)]">
          <span className="text-[var(--accent)]">offside</span>
        </Link>
      </div>
      <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
        <Link href="/" className="rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Team Manager
        </Link>
        <Link href="/players" className="rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          Players
        </Link>
        <Link href="/about" className="rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-[var(--accent)]">
          About
        </Link>
      </nav>
    </aside>
  );
}
