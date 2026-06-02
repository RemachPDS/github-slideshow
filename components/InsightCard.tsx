"use client";

import { useState } from "react";
import type { InsightType, ReactionType } from "@/lib/types";

const TYPE_CONFIG: Record<InsightType, { label: string; color: string; text: string; border: string }> = {
  attention:     { label: "Atención",       color: "#E6F1FB", text: "#0C447C", border: "#378ADD" },
  repetition:    { label: "Repetición",     color: "#EEEDFE", text: "#3C3489", border: "#7F77DD" },
  friction:      { label: "Fricción",       color: "#FAEEDA", text: "#633806", border: "#EF9F27" },
  contradiction: { label: "Contradicción",  color: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
  identity:      { label: "Identidad",      color: "#E1F5EE", text: "#085041", border: "#1D9E75" },
  evolution:     { label: "Evolución",      color: "#EEEDFE", text: "#26215C", border: "#534AB7" },
  hidden_cost:   { label: "Coste oculto",   color: "#FAECE7", text: "#4A1B0C", border: "#D85A30" },
};

interface Insight {
  id: string;
  type: InsightType;
  pattern: string;
  title: string;
  evidence: string[];
  insightText: string;
  question: string;
}

interface FeedbackState {
  stage: "surprise" | "resonance" | "correcting" | "done";
  surprised: boolean | null;
  reaction: ReactionType | null;
  correction: string;
}

function FeedbackButtons({ insight }: { insight: Insight }) {
  const [state, setState] = useState<FeedbackState>({
    stage: "surprise",
    surprised: null,
    reaction: null,
    correction: "",
  });
  const config = TYPE_CONFIG[insight.type];

  async function postFeedback(body: object) {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId: insight.id, ...body }),
    });
  }

  async function handleSurprise(val: boolean) {
    setState((s) => ({ ...s, surprised: val, stage: "resonance" }));
    await postFeedback({ surprised: val });
  }

  async function handleReaction(r: ReactionType) {
    setState((s) => ({ ...s, reaction: r, stage: r === "yes" ? "done" : "correcting" }));
    await postFeedback({ reaction: r });
  }

  async function submitCorrection() {
    if (!state.correction.trim()) return;
    await postFeedback({ correctionText: state.correction.trim(), correctionType: "contextual" });
    setState((s) => ({ ...s, stage: "done" }));
  }

  if (state.stage === "done") {
    return (
      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        {state.reaction === "yes"
          ? "Guardado. Refuerza el patrón."
          : "Guardado. Tu corrección es el dato más valioso que podés dar."}
      </p>
    );
  }

  if (state.stage === "correcting") {
    return (
      <div className="mt-3">
        <label className="text-xs text-gray-500 block mb-1.5">
          {state.reaction === "partial" ? "¿Qué parte es correcta y cuál no?" : "¿Qué estamos interpretando mal?"}
        </label>
        <textarea
          value={state.correction}
          onChange={(e) => setState((s) => ({ ...s, correction: e.target.value }))}
          rows={2}
          autoFocus
          placeholder="Escribí acá..."
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 resize-y focus:outline-none focus:ring-1 focus:ring-gray-400"
          style={{ borderColor: config.border }}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={submitCorrection}
            disabled={!state.correction.trim()}
            className="text-xs px-4 py-1.5 rounded-lg border border-gray-300 bg-gray-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
          <button
            onClick={() => setState((s) => ({ ...s, stage: "resonance", reaction: null }))}
            className="text-xs px-4 py-1.5 rounded-lg border border-gray-200 text-gray-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (state.stage === "resonance") {
    return (
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">¿Esto resuena?</span>
        {(["yes", "partial", "no"] as ReactionType[]).map((r) => (
          <button
            key={r}
            onClick={() => handleReaction(r)}
            className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
          >
            {r === "yes" ? "Sí, exacto" : r === "partial" ? "En parte" : "No aplica"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400">¿Esto te sorprendió?</span>
      <button
        onClick={() => handleSurprise(true)}
        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
      >
        Sí
      </button>
      <button
        onClick={() => handleSurprise(false)}
        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
      >
        No, ya lo sabía
      </button>
    </div>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const config = TYPE_CONFIG[insight.type];

  return (
    <div
      className="bg-white border border-gray-100 rounded-xl p-5 mb-3"
      style={{ borderLeft: `3px solid ${config.border}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-xs font-medium px-2.5 py-0.5 rounded-md"
          style={{ background: config.color, color: config.text }}
        >
          {config.label}
        </span>
        <span className="text-sm font-medium text-gray-800">{insight.title}</span>
      </div>

      <div className="mb-3">
        {insight.evidence.map((e, i) => (
          <div
            key={i}
            className="text-xs text-gray-500 border-l-2 border-gray-200 pl-3 mb-1 leading-relaxed italic"
          >
            &ldquo;{e}&rdquo;
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-800 leading-relaxed mb-3">{insight.insightText}</p>

      <p
        className="text-sm rounded-lg px-3 py-2 leading-relaxed"
        style={{ background: config.color, color: config.text }}
      >
        {insight.question}
      </p>

      <FeedbackButtons insight={insight} />
    </div>
  );
}
