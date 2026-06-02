import type { InsightType, ProfileType, ReactionType, CorrectionType, PatternOrigin } from "@prisma/client";

export type { InsightType, ProfileType, ReactionType, CorrectionType, PatternOrigin };

export interface CheckinInput {
  day: number;
  responses: {
    time: string;
    surprise: string;
    preserve: string;
  };
}

export interface InsightOutput {
  type: InsightType;
  pattern: string;
  title: string;
  evidence: string[];
  insight: string;
  question: string;
}

export interface PatternStats {
  pattern: string;
  seen: number;
  yes: number;
  partial: number;
  no: number;
  surprised: number;
  not_surprised: number;
  corrections: Array<{ reaction: ReactionType; text: string; ts: string }>;
}

// S×R = surprise_rate × resonance_rate / 100
export function computeSxR(s: PatternStats): number | null {
  const total = s.yes + s.partial + s.no;
  const surpriseTotal = s.surprised + s.not_surprised;
  if (!total || !surpriseTotal) return null;
  const resonance = Math.round((s.yes / total) * 100);
  const surprise = Math.round((s.surprised / surpriseTotal) * 100);
  return Math.round((resonance * surprise) / 100);
}
