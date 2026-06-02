import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/checkin");

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <p className="text-xs text-gray-400 mb-2 tracking-widest uppercase">Mirror Engine</p>
        <h1 className="text-3xl font-medium text-gray-900 leading-tight mb-3">
          Capturá lo que aprendés.<br />Usá lo que olvidás.
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          Un espejo cognitivo que detecta patrones en cómo trabajás — no resume, no aconseja.
          Muestra lo que sentís pero todavía no sabés describir.
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block text-sm px-6 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
        >
          Empezar →
        </Link>
      </div>
    </main>
  );
}
