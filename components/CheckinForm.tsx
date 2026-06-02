"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckinInput } from "@/lib/types";

const EMPTY_DAY = (): CheckinInput => ({
  day: 0,
  responses: { time: "", surprise: "", preserve: "" },
});

const SAMPLE: CheckinInput[] = [
  {
    day: 1,
    responses: {
      time: "Tuve tres reuniones sobre el roadmap del producto pero en realidad terminé resolviendo un problema de soporte que nadie más podía resolver.",
      surprise: "Pensé que el equipo de desarrollo tenía claro el sprint. En la reunión me di cuenta que cada uno entendió algo distinto.",
      preserve: "Si querés alineación, tenés que escribir las cosas. Las conversaciones no alcanzan.",
    },
  },
  {
    day: 2,
    responses: {
      time: "Llamadas con tres clientes potenciales. Entre eso y responder mensajes del equipo, no toqué el documento de estrategia.",
      surprise: "Uno de los clientes volvió a escribir solo. Pero me di cuenta que no tengo un proceso claro para hacer seguimiento.",
      preserve: "Necesito delegar el seguimiento de clientes o voy a perder oportunidades.",
    },
  },
];

const QUESTIONS = [
  { key: "time" as const, label: "¿Qué te ocupó más tiempo hoy?" },
  { key: "surprise" as const, label: "¿Hubo algo que salió mejor o peor de lo esperado?" },
  { key: "preserve" as const, label: "¿Hay algo que no quisieras olvidar?" },
];

export function CheckinForm() {
  const router = useRouter();
  const [checkins, setCheckins] = useState<CheckinInput[]>(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCheckin(index: number, key: keyof CheckinInput["responses"], value: string) {
    setCheckins((prev) =>
      prev.map((c, i) => (i === index ? { ...c, responses: { ...c.responses, [key]: value } } : c))
    );
  }

  function addDay() {
    if (checkins.length >= 7) return;
    setCheckins((prev) => [...prev, { ...EMPTY_DAY(), day: prev.length + 1 }]);
  }

  function removeDay(index: number) {
    if (checkins.length <= 2) return;
    setCheckins((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkins: checkins.map((c, i) => ({ ...c, day: i + 1 })) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al analizar.");
      }
      const data = await res.json();
      router.push(`/mirror/${data.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {checkins.map((c, i) => (
        <div key={i} className="relative bg-white border border-gray-100 rounded-xl p-5 mb-3">
          <p className="text-xs font-medium text-gray-400 mb-4">Día {i + 1}</p>
          {checkins.length > 2 && (
            <button
              onClick={() => removeDay(i)}
              className="absolute top-4 right-4 text-xs text-gray-300 hover:text-gray-500 px-2 py-1 border border-gray-100 rounded-md"
            >
              eliminar
            </button>
          )}
          {QUESTIONS.map(({ key, label }) => (
            <div key={key} className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">{label}</label>
              <textarea
                value={c.responses[key]}
                onChange={(e) => updateCheckin(i, key, e.target.value)}
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 resize-y focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-2 mt-1">
        {checkins.length < 7 && (
          <button
            onClick={addDay}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300"
          >
            + agregar día
          </button>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="flex-1 text-sm px-5 py-2 rounded-lg border border-gray-900 bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {loading ? "Analizando..." : "Generar espejo →"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mt-3">Error: {error}</p>}
    </div>
  );
}
