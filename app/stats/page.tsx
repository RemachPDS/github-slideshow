import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeSxR } from "@/lib/types";
import type { Pattern } from "@prisma/client";
import Link from "next/link";

function SxRBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-300">sin datos</span>;
  const cls =
    score >= 70
      ? "bg-emerald-50 text-emerald-800"
      : score >= 40
      ? "bg-amber-50 text-amber-800"
      : "bg-red-50 text-red-800";
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-md ${cls}`}>S×R {score}</span>
  );
}

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const patterns = await db.pattern.findMany({ orderBy: { seenCount: "desc" } });

  const sorted = [...patterns].sort((a, b) => {
    const toStats = (p: Pattern) => ({
      pattern: p.slug,
      seen: p.seenCount,
      yes: p.yesCount,
      partial: p.partialCount,
      no: p.noCount,
      surprised: p.surprisedCount,
      not_surprised: p.notSurprisedCount,
      corrections: [],
    });
    const sa = computeSxR(toStats(a));
    const sb = computeSxR(toStats(b));
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa;
  });

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">Mirror Engine</p>
            <h1 className="text-lg font-medium text-gray-900">Dataset de patrones</h1>
          </div>
          <Link
            href="/checkin"
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300"
          >
            nuevo check-in
          </Link>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">
            Todavía no hay datos. Generá un espejo y respondé el feedback.
          </p>
        ) : (
          <>
            {sorted.map((p) => {
              const stats = {
                pattern: p.slug,
                seen: p.seenCount,
                yes: p.yesCount,
                partial: p.partialCount,
                no: p.noCount,
                surprised: p.surprisedCount,
                not_surprised: p.notSurprisedCount,
                corrections: [],
              };
              const sxr = computeSxR(stats);
              const total = p.yesCount + p.partialCount + p.noCount;
              const surpriseTotal = p.surprisedCount + p.notSurprisedCount;
              const yesRate = total ? Math.round((p.yesCount / total) * 100) : null;
              const surpriseRate = surpriseTotal
                ? Math.round((p.surprisedCount / surpriseTotal) * 100)
                : null;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-100 rounded-xl px-5 py-4 mb-3"
                >
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                      {p.slug}
                    </code>
                    <SxRBadge score={sxr} />
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    {[
                      { label: "visto",      value: p.seenCount },
                      { label: "resonancia", value: yesRate !== null ? `${yesRate}%` : "—" },
                      { label: "sorpresa",   value: surpriseRate !== null ? `${surpriseRate}%` : "—" },
                      { label: "origen",     value: p.origin === "user_generative" ? "usuario" : "fundador" },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="text-base font-medium text-gray-800">{m.value}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-300 mt-4 leading-relaxed">
              S×R = sorpresa × resonancia / 100. Alto ≥70 → momento wow. Resonancia alta + sorpresa baja → obvio, candidato a eliminar.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
