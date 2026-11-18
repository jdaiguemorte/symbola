// Lot 44 (CRM-02 ; D9, D11 ; ADR 0084) — règles pures du pipeline, sans base : bornes et nom d'une
// étape, construction des cartes (étape par défaut, date prise, ancienneté dans l'étape) et ordre
// dans une colonne. Testées par pipeline-rules.test.ts (seuil de couverture, NFR-21).
import type { PipelineCard } from "@symbola/contracts";
import type { CardRow } from "./prospects-repository";

export const PIPELINE_MIN_STAGES = 1;
export const PIPELINE_MAX_STAGES = 10;
const LABEL_MAX = 60;

export class PipelineStageInvalidError extends Error {
  constructor(readonly reason: "label" | "too_many" | "too_few" | "not_found" | "not_empty" | "destination") {
    super(`étape du pipeline refusée : ${reason}`);
    this.name = "PipelineStageInvalidError";
  }
}

export function cleanStageLabel(label: string): string {
  const value = label.replace(/\s+/g, " ").trim();
  if (!value || value.length > LABEL_MAX) throw new PipelineStageInvalidError("label");
  return value;
}

// D11 : la plus ancienne activité en haut ; à égalité, un ordre stable (identifiant).
export function sortCards(cards: PipelineCard[]): PipelineCard[] {
  return [...cards].sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt) || a.eventId.localeCompare(b.eventId));
}

export function buildCards(rows: CardRow[], input: { firstStageId: string; stageIds: Set<string>; names: Map<string, string>; busy: { eventId: string; eventDate: string }[] }): PipelineCard[] {
  return rows.map(({ event, request, sourceLabel, stageSince }) => {
    const stageId = event.pipelineStageId && input.stageIds.has(event.pipelineStageId) ? event.pipelineStageId : input.firstStageId;
    return {
      eventId: event.id,
      names: input.names.get(event.id) ?? "",
      eventDate: event.eventDate,
      period: request?.period ?? null,
      guestsEstimated: event.guestsEstimated,
      wantedBudgetCents: event.wantedBudgetCents,
      budgetRange: request?.budgetRange ?? null,
      sourceLabel,
      stageId,
      stageSince: (stageSince ?? event.createdAt).toISOString(),
      lastActivityAt: event.updatedAt.toISOString(),
      dateTaken: event.eventDate !== null && !event.isDemo && input.busy.some((other) => other.eventId !== event.id && other.eventDate === event.eventDate),
      isDemo: event.isDemo,
    };
  });
}
