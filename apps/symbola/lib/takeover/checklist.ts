// Lot 71f (EVT-02, EVT-07, HUB-08, UX-01, UX-06, BUD-01 ; spécification du lot 71, § 5.6 ; maquette 09) —
// ce qui reste à compléter après la reprise d'un mariage, lu à chaque fois dans les modules par leurs
// services : la reprise chez le hub, les postes, prestataires, tâches, programme et liens chez les
// évènements, les prévus et le total « à répartir » chez le budget. Un seul calcul sert la fiche, la page
// de reprise, la liste des évènements et « Aujourd'hui » : un nombre annoncé à un endroit est celui que
// redit l'autre. La session, l'organisation et le rôle sont contrôlés par l'appelant ; tout se lit sous
// RLS, et la reprise d'un évènement hors de vue (lot 52) n'existe pas pour la personne (SEC-13).
import type { BudgetCategory, EventVendorSlot, TakeoverView } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { getUnallocatedTotals, listBudgetLines } from "@/modules/budget/service";
import { getEvent, getEventProgram, listEventLinks, listEventTasks, listEventVendorSlots } from "@/modules/events/service";
import { getEventTakeover, isModuleEnabled, listTakeovers, markTakeoverCompleted, type TakeoverViewer } from "@/modules/hub/service";
import {
  checklistBlock,
  checklistPoints,
  pendingPoints,
  runningStep,
  slotsWithoutAmount,
  takeoverFileCount,
  takeoverFinishedAt,
  takeoverMark,
  type ChecklistBlock,
  type ChecklistFacts,
  type ChecklistPoint,
  type TakeoverMark,
} from "./checklist-rules";

const db = () => appDatabase();

// Le prévu de chaque poste : la somme des prévus connus de ses lignes, null si aucun ne l'est.
export function slotPlannedAmounts(slots: readonly Pick<EventVendorSlot, "id" | "status">[], categories: readonly Pick<BudgetCategory, "eventVendorSlotId" | "lines">[] | null): { status: string; plannedCents: number | null }[] {
  return slots.map((slot) => {
    const lines = categories?.find((category) => category.eventVendorSlotId === slot.id)?.lines ?? [];
    const known = lines.map((line) => line.estimatedAmountCents).filter((value): value is number => value !== null);
    return { status: slot.status, plannedCents: known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null };
  });
}

export type EventChecklistFacts = ChecklistFacts & { budgetAvailable: boolean };

// Ce que les modules disent de l'évènement, sans rien supposer : un nombre d'invités absent est absent.
export async function eventChecklistFacts(organizationId: string, eventId: string): Promise<EventChecklistFacts | null> {
  const event = await getEvent(organizationId, eventId);
  if (!event) return null;
  const budgetAvailable = await isModuleEnabled(db(), organizationId, "budget");
  const [slots, budget, totals, tasks, program, links] = await Promise.all([
    listEventVendorSlots(organizationId, eventId),
    budgetAvailable ? listBudgetLines(organizationId, eventId) : Promise.resolve(null),
    budgetAvailable ? getUnallocatedTotals(organizationId, eventId) : Promise.resolve(null),
    listEventTasks(organizationId, eventId),
    getEventProgram(organizationId, eventId),
    listEventLinks(organizationId, eventId),
  ]);
  const unsigned = slots.flatMap((slot) => slot.retainedVendors.filter((vendor) => vendor.takeoverContract === "unsigned" || vendor.takeoverContract === "unknown").map((vendor) => vendor.vendorName));
  return {
    budgetAvailable,
    remainingCents: totals ? totals.remainingCents : null,
    slotsWithoutAmount: budgetAvailable ? slotsWithoutAmount(slotPlannedAmounts(slots, budget?.categories ?? [])) : 0,
    unsignedContracts: [...new Set(unsigned)],
    taskCount: tasks.length,
    missingEndTimes: program.items.filter((item) => (item.timing ?? "span") === "span" && item.endTime === null).length,
    hasClientLink: links.some((link) => link.audience === "client" && link.status === "active"),
    guestsKnown: event.guestsEstimated !== null,
  };
}

// Les points d'un évènement ; sans le module Budget, le point des montants n'existe pas (ARC-06).
export function pointsOf(facts: EventChecklistFacts): ChecklistPoint[] {
  return checklistPoints(facts).filter((point) => point.key !== "amounts" || facts.budgetAvailable);
}

export type EventChecklist = {
  takeover: TakeoverView;
  points: ChecklistPoint[];
  block: ChecklistBlock;
  // « Repris le 24 nov. de 4 fichiers ».
  fileCount: number;
};

// La fiche d'un mariage repris : sa reprise, ses points, et le bloc de la Synthèse. La première liste
// vide pose la date de fin de la reprise (R9) ; null pour un mariage sans reprise, ou hors de vue.
export async function loadEventChecklist(
  organizationId: string,
  eventId: string,
  options: { viewer?: TakeoverViewer | null; today?: string; now?: Date } = {},
): Promise<EventChecklist | null> {
  const takeover = await getEventTakeover(db(), organizationId, eventId, options.viewer ?? null);
  if (!takeover) return null;
  const facts = await eventChecklistFacts(organizationId, eventId);
  if (!facts) return null;
  const points = pointsOf(facts);
  const now = options.now ?? new Date();
  const today = options.today ?? parisToday(now);
  let completedAt = takeover.completedAt;
  if (!completedAt && pendingPoints(points).length === 0) {
    await markTakeoverCompleted(db(), { organizationId, takeoverId: takeover.id, now });
    completedAt = now;
  }
  return {
    takeover: { ...takeover, completedAt },
    points,
    block: checklistBlock(points, completedAt ? parisToday(completedAt) : null, today),
    fileCount: takeoverFileCount(takeover.steps),
  };
}

export type TakeoverInProgress = {
  takeoverId: string;
  eventId: string;
  mark: Exclude<TakeoverMark, null>;
  // « import du budget en cours ».
  running: TakeoverView["steps"][number]["kind"] | null;
  // « reprise terminée hier ».
  finishedAt: Date | null;
};

// Les reprises qui ne sont pas complétées, avec leur marque : la liste des évènements (« Repris · 3
// fichiers sur 6 ») et « Aujourd'hui » (« Reprises en cours »). Une reprise sans mariage n'y figure pas
// (elle se retrouve sur la page de reprise). Les points ne se comptent que pour une reprise dont les six
// lignes sont réglées.
export async function listTakeoversInProgress(organizationId: string, viewer: TakeoverViewer | null): Promise<TakeoverInProgress[]> {
  const takeovers = (await listTakeovers(db(), organizationId, viewer)).filter((takeover) => takeover.eventId !== null && takeover.completedAt === null);
  const result: TakeoverInProgress[] = [];
  for (const takeover of takeovers) {
    const settledAll = takeover.progress.settled === takeover.progress.total;
    let pending = 0;
    if (settledAll) {
      const facts = await eventChecklistFacts(organizationId, takeover.eventId!);
      if (!facts) continue;
      pending = pendingPoints(pointsOf(facts)).length;
      if (pending === 0) {
        // La liste s'est vidée sans que la fiche ait été ouverte : la reprise est complétée (R9).
        await markTakeoverCompleted(db(), { organizationId, takeoverId: takeover.id });
        continue;
      }
    }
    const mark = takeoverMark({ steps: takeover.steps, completedAt: null, pendingPoints: pending });
    if (!mark) continue;
    result.push({ takeoverId: takeover.id, eventId: takeover.eventId!, mark, running: runningStep(takeover.steps), finishedAt: takeoverFinishedAt(takeover.steps) });
  }
  return result;
}

// La page de reprise terminée : ce qui reste à compléter, contrats non signés compris, avec le même
// calcul que la fiche (les points restants seulement).
export async function remainingTakeoverPoints(organizationId: string, eventId: string): Promise<ChecklistPoint[]> {
  const facts = await eventChecklistFacts(organizationId, eventId);
  return facts ? pendingPoints(pointsOf(facts)) : [];
}
