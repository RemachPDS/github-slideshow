import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InsightCard } from "@/components/InsightCard";
import Link from "next/link";

export default async function MirrorPage({ params }: { params: { sessionId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const checkinSession = await db.checkinSession.findUnique({
    where: { id: params.sessionId, userId: session.user.id },
    include: { insights: { orderBy: { createdAt: "asc" } } },
  });

  if (!checkinSession) notFound();

  const insights = checkinSession.insights;
  const hasContradiction = insights.some((i) => i.type === "contradiction");
  const hasIdentity = insights.some((i) => i.type === "identity" || i.type === "evolution");

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-50 rounded-xl px-5 py-4 mb-6">
          <p className="text-2xl font-medium text-gray-900 mb-1">
            {insights.length === 1 ? "1 patrón detectado" : `${insights.length} patrones detectados`}
            {hasContradiction && (
              <span className="text-sm font-normal text-gray-400 ml-3">incluyendo contradicciones</span>
            )}
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            {hasIdentity
              ? "Hay una brecha entre cómo te definís y lo que estás haciendo realmente."
              : hasContradiction
              ? "Ya empezamos a ver diferencias entre tu trabajo percibido y tu trabajo real."
              : "Identificamos patrones que probablemente no habías notado."}
          </p>
        </div>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
          Lo que detectamos
        </p>

        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={{
              id: insight.id,
              type: insight.type,
              pattern: insight.pattern,
              title: insight.title,
              evidence: insight.evidence,
              insightText: insight.insightText,
              question: insight.question,
            }}
          />
        ))}

        <div className="flex gap-3 mt-4">
          <Link
            href="/checkin"
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300"
          >
            ← nuevo check-in
          </Link>
          <Link
            href="/stats"
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300"
          >
            ver dataset →
          </Link>
        </div>
      </div>
    </main>
  );
}
