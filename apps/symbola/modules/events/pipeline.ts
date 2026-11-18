// Lot 44 (CRM-02 ; D9 à D11 ; ADR 0084) — le pipeline commercial. Une étape est la position d'un
// évènement au statut Option dans la démarche commerciale ; les statuts du cycle de vie ne changent
// pas (ADR 0055) : « Gagné » confirme l'évènement, « Perdu » l'annule avec son motif. Les étapes sont
// la liste de l'organisation (une à dix), copiées des données de départ à la première ouverture.
// Ordre des cartes dans une colonne : la plus ancienne activité en haut (D11).
import { starterPipelineStages } from "@symbola/starter-templates";
import type { Pipeline, PipelineStage } from "@symbola/contracts";
import { buildCards, cleanStageLabel, PIPELINE_MAX_STAGES, PIPELINE_MIN_STAGES, PipelineStageInvalidError, sortCards } from "./pipeline-rules";
import {
  countOptionsByStage,
  deletePipelineStage,
  findBusyDates,
  findPipelineCardRows,
  findPipelineStages,
  insertPipelineStage,
  moveCardRow,
  reorderPipelineStageRows,
  seedPipelineStages,
  updatePipelineStageLabel,
  type PipelineStageRow,
} from "./prospects-repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { buildCards, cleanStageLabel, PIPELINE_MAX_STAGES, PIPELINE_MIN_STAGES, PipelineStageInvalidError, sortCards } from "./pipeline-rules";

export class PipelineMoveRefusedError extends Error {
  constructor(readonly reason: "not_found" | "not_option" | "stage_not_found") {
    super(`déplacement refusé : ${reason}`);
    this.name = "PipelineMoveRefusedError";
  }
}

async function stagesOf(organizationId: string, locale: "fr" | "en"): Promise<PipelineStageRow[]> {
  const stages = await findPipelineStages(organizationId);
  return stages.length > 0 ? stages : seedPipelineStages(organizationId, starterPipelineStages(locale));
}

export async function listPipelineStages(organizationId: string, locale: "fr" | "en"): Promise<PipelineStage[]> {
  const [stages, counts] = await Promise.all([stagesOf(organizationId, locale), countOptionsByStage(organizationId)]);
  const firstId = stages[0]?.id ?? null;
  const count = (stageId: string) => counts.filter((row) => row.stageId === stageId || (row.stageId === null && stageId === firstId)).reduce((sum, row) => sum + row.count, 0);
  return stages.map((stage, position) => ({ id: stage.id, label: stage.label, position, cardCount: count(stage.id) }));
}

// La première étape : celle d'un prospect qui arrive (formulaire), copiée si besoin.
export async function firstPipelineStageId(organizationId: string, locale: "fr" | "en"): Promise<string> {
  const [first] = await stagesOf(organizationId, locale);
  if (!first) throw new Error("pipeline sans étape");
  return first.id;
}

export async function addPipelineStage(organizationId: string, label: string, locale: "fr" | "en"): Promise<PipelineStage> {
  const value = cleanStageLabel(label);
  const stages = await stagesOf(organizationId, locale);
  if (stages.length >= PIPELINE_MAX_STAGES) throw new PipelineStageInvalidError("too_many");
  const row = await insertPipelineStage(organizationId, value);
  return { id: row.id, label: row.label, position: stages.length, cardCount: 0 };
}

export async function renamePipelineStage(organizationId: string, stageId: string, label: string): Promise<void> {
  const value = cleanStageLabel(label);
  if (!UUID.test(stageId) || !(await updatePipelineStageLabel(organizationId, stageId, value))) throw new PipelineStageInvalidError("not_found");
}

export async function movePipelineStage(organizationId: string, stageId: string, direction: "up" | "down", locale: "fr" | "en"): Promise<void> {
  const ids = (await stagesOf(organizationId, locale)).map((stage) => stage.id);
  const index = ids.indexOf(stageId);
  if (index === -1) throw new PipelineStageInvalidError("not_found");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  await reorderPipelineStageRows(organizationId, ids);
}

// Retirer une étape : une étape non vide se vide d'abord, ou ses cartes passent à une autre étape
// choisie ; il reste toujours au moins une étape.
export async function removePipelineStage(input: { organizationId: string; stageId: string; destinationId: string | null; userId: string; locale: "fr" | "en" }): Promise<{ moved: number }> {
  const stages = await stagesOf(input.organizationId, input.locale);
  const index = stages.findIndex((stage) => stage.id === input.stageId);
  if (index === -1) throw new PipelineStageInvalidError("not_found");
  if (stages.length <= PIPELINE_MIN_STAGES) throw new PipelineStageInvalidError("too_few");
  const counts = await countOptionsByStage(input.organizationId);
  // Une option sans étape est à la première : retirer la première emporte aussi celles-là.
  const cards = counts.filter((row) => row.stageId === input.stageId || (index === 0 && row.stageId === null)).reduce((sum, row) => sum + row.count, 0);
  const destination = input.destinationId ? stages.find((stage) => stage.id === input.destinationId && stage.id !== input.stageId) : undefined;
  if (input.destinationId && !destination) throw new PipelineStageInvalidError("destination");
  if (cards > 0 && !destination) throw new PipelineStageInvalidError("not_empty");
  const moved = await deletePipelineStage(input.organizationId, input.stageId, destination ? { id: destination.id, label: destination.label } : null, input.userId, index === 0);
  if (moved === null) throw new PipelineStageInvalidError("not_found");
  return { moved };
}

// Le pipeline : les étapes, et les options (essai guidé compris, jamais compté ailleurs).
export async function getPipeline(organizationId: string, locale: "fr" | "en", names: Map<string, string>): Promise<Pipeline> {
  const [stages, rows, busy] = await Promise.all([listPipelineStages(organizationId, locale), findPipelineCardRows(organizationId), findBusyDates(organizationId)]);
  const firstStageId = stages[0]!.id;
  const cards = sortCards(buildCards(rows, { firstStageId, stageIds: new Set(stages.map((stage) => stage.id)), names, busy }));
  return { stages, cards };
}

// Une carte passe à une étape (CRM-02) ; le passage entre dans le fil d'activité de l'évènement.
export async function movePipelineCard(input: { organizationId: string; eventId: string; stageId: string; userId: string; locale: "fr" | "en" }): Promise<"moved" | "unchanged"> {
  if (!UUID.test(input.eventId) || !UUID.test(input.stageId)) throw new PipelineMoveRefusedError("not_found");
  const firstStageId = await firstPipelineStageId(input.organizationId, input.locale);
  const outcome = await moveCardRow({ organizationId: input.organizationId, eventId: input.eventId, stageId: input.stageId, firstStageId, actorUserId: input.userId });
  if (outcome === "moved" || outcome === "unchanged") return outcome;
  throw new PipelineMoveRefusedError(outcome);
}
