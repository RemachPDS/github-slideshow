import Groq from "groq-sdk";
import type { CheckinInput, InsightOutput, CorrectionType } from "./types";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Sos un espejo cognitivo, no un resumidor.
Tu trabajo es detectar lo que el usuario todavía no ve sobre sí mismo — la brecha entre lo que creen que hacen y lo que realmente hacen.

Recibís check-ins profesionales de varios días. Cada uno tiene tres campos:
- time: qué ocupó más tiempo
- surprise: qué salió mejor o peor de lo esperado
- preserve: qué quieren recordar en el futuro

Devolvé un array JSON de insights con este schema exacto:
{
  "type": "attention" | "repetition" | "friction" | "contradiction" | "identity" | "evolution" | "hidden_cost",
  "pattern": "snake_case_3_a_5_palabras (ej: constructor_producto_vs_organizacion)",
  "title": "etiqueta corta de 4-6 palabras",
  "evidence": ["cita o paráfrasis del día X", "cita o paráfrasis del día Y"],
  "insight": "2-3 oraciones que le dicen algo que no sabían de sí mismos",
  "question": "una pregunta abierta que les da ganas de responder"
}

Tipos:
- attention: energía real vs energía percibida
- repetition: algo que aparece sin que la persona lo note
- friction: problema recurrente con raíz común
- contradiction: dice una cosa, hace otra
- identity: brecha entre cómo se define y el rol que cumple HOY
- evolution: quién se está convirtiendo — requiere evidencia de trayectoria
- hidden_cost: causa invisible que explica un síntoma visible

Reglas:
- Mínimo 2 insights, máximo 4.
- Priorizá contradiction, identity y hidden_cost — son los que generan más sorpresa.
- Evidencia específica siempre. Cero observaciones genéricas.
- pattern debe ser reutilizable entre usuarios distintos.
- Tono: directo, cálido, preciso.
- Devolvé SOLO el array JSON. Sin texto extra. Sin markdown.`;

export async function analyzeCheckins(checkins: CheckinInput[]): Promise<InsightOutput[]> {
  const content = checkins
    .map(
      (c, i) =>
        `Día ${i + 1}:\n- Tiempo: ${c.responses.time}\n- Sorpresa: ${c.responses.surprise}\n- Preservar: ${c.responses.preserve}`
    )
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analizá estos ${checkins.length} check-ins y devolvé insights como JSON:\n\n${content}`,
      },
    ],
  });

  const raw = response.choices[0].message.content ?? "";
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No se encontró JSON válido en la respuesta.");
  return JSON.parse(raw.slice(start, end + 1)) as InsightOutput[];
}

// Classifies a user correction as defensive / contextual / generative.
// generative = expands the conceptual vocabulary (most valuable).
export async function classifyCorrection(
  insightType: string,
  insightText: string,
  correctionText: string
): Promise<CorrectionType> {
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 10,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `Clasificá esta corrección. Devolvé SOLO una palabra: defensive, contextual o generative.

defensive: protege identidad. "Eso no es así." No mejora el modelo, mejora la formulación.
contextual: aporta info faltante. "Es situación temporal." Mejora el prompt.
generative: mejora el modelo conceptual. "No es X vs Y, es A vs B." Expande el vocabulario. La más valiosa.`,
      },
      {
        role: "user",
        content: `Insight (${insightType}): "${insightText}"\nCorrección: "${correctionText}"`,
      },
    ],
  });

  const raw = (response.choices[0].message.content ?? "").trim().toLowerCase();
  if (raw === "generative") return "generative";
  if (raw === "contextual") return "contextual";
  return "defensive";
}
