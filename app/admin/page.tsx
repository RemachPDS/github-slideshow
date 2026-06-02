import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Internal admin dashboard — shows generative corrections (the most valuable data)
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const generativeCorrections = await db.feedback.findMany({
    where: { correctionType: "generative" },
    include: {
      insight: { select: { type: true, pattern: true, title: true } },
      user: { select: { email: true, profileType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const patterns = await db.pattern.findMany({
    orderBy: { seenCount: "desc" },
    include: { originFeedback: { include: { user: { select: { email: true } } } } },
  });

  const userGenerativeCount = patterns.filter((p) => p.origin === "user_generative").length;
  const pcr = patterns.length ? Math.round((userGenerativeCount / patterns.length) * 100) : 0;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs text-gray-400 mb-1">Admin interno</p>
        <h1 className="text-lg font-medium text-gray-900 mb-8">Mirror Engine · Dataset</h1>

        {/* PCR metric */}
        <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 mb-6">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-medium text-gray-900">{pcr}%</span>
            <span className="text-sm text-gray-400">Pattern Creation Rate</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {userGenerativeCount} de {patterns.length} patrones nacieron de correcciones de usuarios.
          </p>
        </div>

        {/* Generative corrections — gold */}
        <h2 className="text-sm font-medium text-gray-600 mb-3">
          Correcciones generativas ({generativeCorrections.length})
        </h2>

        {generativeCorrections.length === 0 ? (
          <p className="text-sm text-gray-300 py-8 text-center">
            Todavía no hay correcciones generativas. Son las más valiosas — aparecen cuando un usuario mejora el modelo conceptual.
          </p>
        ) : (
          generativeCorrections.map((f) => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-xl px-5 py-4 mb-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                  {f.insight.pattern}
                </code>
                <span className="text-xs text-gray-400">
                  {f.user.email} · {f.user.profileType}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;{f.correctionText}&rdquo;
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Sobre insight: <span className="font-medium">{f.insight.title}</span> ({f.insight.type})
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
