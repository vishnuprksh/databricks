import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-sm text-[var(--muted)] mb-4">
        <Link href="/" className="hover:text-[var(--accent)]">Team Manager</Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--text)]">About</span>
      </nav>
      <section className="card p-6 md:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          About <span className="text-[var(--accent)]">FPL Manager</span>
        </h1>
        <p className="text-[var(--muted)] mt-4 leading-7">
          FPL Manager brings your Fantasy Premier League squad, gameweek performance,
          player data and transfer suggestions together in one focused workspace.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <h2 className="font-bold">Squad overview</h2>
            <p className="text-[var(--muted)] mt-1">Review your team and gameweek results.</p>
          </div>
          <div>
            <h2 className="font-bold">Player market</h2>
            <p className="text-[var(--muted)] mt-1">Compare current FPL performance and model predictions.</p>
          </div>
          <div>
            <h2 className="font-bold">Smarter moves</h2>
            <p className="text-[var(--muted)] mt-1">Explore transfers while respecting squad constraints.</p>
          </div>
        </div>
      </section>
    </main>
  );
}