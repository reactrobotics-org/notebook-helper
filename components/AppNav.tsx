import Link from "next/link";

export default function AppNav() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold">
          Notebook Helper
        </Link>

        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/images" className="hover:underline">
            Images
          </Link>
          <Link href="/meeting-notes" className="hover:underline">
            Meeting Notes
          </Link>
          <Link href="/teams" className="hover:underline">
            Team
          </Link>
        </nav>
      </div>
    </header>
  );
}