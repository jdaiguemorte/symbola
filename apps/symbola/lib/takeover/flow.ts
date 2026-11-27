// Lot 71b (HUB-14, PAR-01, UX-02 ; spécification du lot 71, § 5.2 ; maquette 06) — la page « Reprendre un
// mariage en cours » : ce qu'elle montre et ce que font ses boutons. Orchestration de l'app, par les
// services des modules : la reprise et ses imports chez le hub, le mariage chez les évènements, ce qui
// reste à compléter chez les évènements et le budget. Session, organisation et rôle sont contrôlés par
// l'appelant ; la reprise, le mariage et les imports le sont ici, sous RLS, avec ce que voit la personne
// (lot 52) : une reprise hors de vue répond comme une reprise inexistante (SEC-13).
import type { TakeoverStepKind, TakeoverView } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { getUnallocatedTotals } from "@/modules/budget/service";
import {
  createProspect,
  createTypedDocumentFolders,
  eventNames,
  getEvent,
  getEventProgram,
  listEventLinks,
  listEventTasks,
  makeCreatorLead,
} from "@/modules/events/service";
import type { EventClientInput } from "@symbola/contracts";
import {
  attachImportToTakeoverStep,
  attachTakeoverEvent,
  cancelImport,
  countImportVendorNames,
  createTakeover,
  getEventTakeover,
  getImportLimits,
  getImportTakeoverId,
  getTakeover,
  listImportSummaries,
  listTakeovers,
  markTakeoverStepImported,
  previewTakeover,
  settleTakeoverStep,
  TakeoverDemoEventError,
  TakeoverNotFoundError,
  type ImportEntityType,
  type ImportSummary,
  type TakeoverViewer,
} from "@/modules/hub/service";
import { getImportWizard, type ImportStepKey } from "@/lib/import/wizard";
import {
  importFigureKey,
  takeoverImportEntityType,
  takeoverPageState,
  takeoverRows,
  toCompletePoints,
  withdrawDeadline,
  type TakeoverRow,
  type ToCompletePoint,
} from "./page-rules";

export type TakeoverActor = { organizationId: string; userId: string; viewer: TakeoverViewer };

export type TakeoverRowModel = TakeoverRow & {
  // Le fichier de la ligne, et son heure : déposé (en cours), repris (fait).
  fileName: string | null;
  at: Date | null;
  // Le nombre de son bilan (« 7 fiches », « 14 lignes »).
  figure: { key: string; count: number } | null;
  // L'étape où l'import s'est arrêté (« Arrêté à « Colonnes » »).
  stoppedAt: ImportStepKey | null;
  // « Votre budget nomme 7 prestataires » (ligne couverte par le budget).
  coveredVendorCount: number | null;
};

export type TakeoverPageModel = {
  id: string | null;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  createdAt: Date;
  state: "open" | "done";
  progress: { settled: number; total: number };
  rows: TakeoverRowModel[];
  // « Chaque import se retire depuis son bilan jusqu'au … » ; le délai réglé par l'Admin.
  withdrawUntil: Date | null;
  undoRetentionDays: number;
  // La page terminée : ce qui reste à compléter à la main (jamais « tout est à jour »).
  toComplete: ToCompletePoint[];
  // La page neuve : les reprises de l'agence restées en plan, pour ne pas les perdre.
  openTakeovers: { id: string; eventName: string | null; progress: { settled: number; total: number } }[];
};

const db = () => appDatabase();

async function eventFacts(organizationId: string, eventId: string | null): Promise<{ name: string | null; date: string | null }> {
  if (!eventId) return { name: null, date: null };
  const event = await getEvent(organizationId, eventId);
  return event ? { name: eventNames(event.clients, event.name), date: event.eventDate } : { name: null, date: null };
}

// Les points qui restent à compléter, lus dans les modules (provisoire : le paquet 71f les calcule dans
// le hub pour la fiche, avec les contrats non signés).
async function remainingPoints(organizationId: string, eventId: string): Promise<ToCompletePoint[]> {
  const [event, totals, tasks, program, links] = await Promise.all([
    getEvent(organizationId, eventId),
    getUnallocatedTotals(organizationId, eventId).catch(() => null),
    listEventTasks(organizationId, eventId),
    getEventProgram(organizationId, eventId).catch(() => null),
    listEventLinks(organizationId, eventId),
  ]);
  return toCompletePoints({
    remainingCents: totals?.remainingCents ?? null,
    taskCount: tasks.length,
    missingEndTimes: program ? program.items.filter((item) => item.endTime === null).length : 0,
    hasClientLink: links.some((link) => link.audience === "client" && link.status === "active"),
    guestsKnown: event?.guestsEstimated !== null && event?.guestsEstimated !== undefined,
  });
}

async function buildModel(actor: TakeoverActor, view: Omit<TakeoverView, "id"> & { id: string | null }): Promise<TakeoverPageModel> {
  const importIds = view.steps.map((step) => step.importId).filter((id): id is string => id !== null);
  const [summaries, limits, event] = await Promise.all([listImportSummaries(db(), actor.organizationId, importIds), getImportLimits(db()), eventFacts(actor.organizationId, view.eventId)]);
  const byId = new Map<string, ImportSummary>(summaries.map((summary) => [summary.id, summary]));
  const rows = takeoverRows(view.steps, { eventExists: view.eventId !== null });
  const budgetImport = view.steps.find((step) => step.kind === "budget")?.importId ?? null;
  const models: TakeoverRowModel[] = [];
  for (const row of rows) {
    const summary = row.importId ? byId.get(row.importId) : undefined;
    const stoppedAt = row.state === "in_progress" && row.importId ? ((await getImportWizard(actor.organizationId, row.importId))?.next ?? null) : null;
    models.push({
      ...row,
      fileName: summary?.fileName ?? null,
      at: summary ? (row.state === "done" ? (summary.appliedAt ?? summary.createdAt) : summary.createdAt) : row.state === "done" ? row.decidedAt : null,
      figure: summary && row.state === "done" && summary.result ? { key: importFigureKey(summary.entityType), count: summary.result.created + summary.result.updated } : null,
      stoppedAt,
      coveredVendorCount: row.state === "covered" && budgetImport ? await countImportVendorNames(db(), actor.organizationId, budgetImport) : null,
    });
  }
  const state = takeoverPageState(view.steps);
  const applied = summaries.filter((summary) => summary.status === "applied" && summary.appliedAt && summary.takeoverId === view.id).map((summary) => summary.appliedAt!);
  return {
    id: view.id,
    eventId: view.eventId,
    eventName: event.name,
    eventDate: event.date,
    createdAt: view.createdAt,
    state,
    progress: view.progress,
    rows: models,
    withdrawUntil: withdrawDeadline(applied, limits.undoRetentionDays),
    undoRetentionDays: limits.undoRetentionDays,
    toComplete: state === "done" && view.eventId ? await remainingPoints(actor.organizationId, view.eventId) : [],
    openTakeovers: [],
  };
}

export async function loadTakeoverPage(actor: TakeoverActor, takeoverId: string): Promise<TakeoverPageModel | null> {
  const view = await getTakeover(db(), actor.organizationId, takeoverId, actor.viewer);
  return view ? buildModel(actor, view) : null;
}

export type NewTakeoverPage = { kind: "page"; model: TakeoverPageModel } | { kind: "redirect"; href: string } | { kind: "not_found" };

// `/reprise` : une page neuve (le carnet déjà fait au deuxième mariage) ; ouverte depuis un mariage
// (`?evenement=`), sa reprise s'il en a une, sinon une page où le mariage est déjà là.
export async function loadNewTakeoverPage(actor: TakeoverActor, eventId: string | null, line: TakeoverStepKind | null = null): Promise<NewTakeoverPage> {
  if (eventId) {
    const existing = await getEventTakeover(db(), actor.organizationId, eventId, actor.viewer);
    if (existing) return { kind: "redirect", href: `/reprise/${existing.id}${line ? `#ligne-${line}` : ""}` };
  }
  let preview;
  try {
    preview = await previewTakeover(db(), { organizationId: actor.organizationId, eventId, viewer: actor.viewer });
  } catch (error) {
    if (error instanceof TakeoverNotFoundError || error instanceof TakeoverDemoEventError) return { kind: "not_found" };
    throw error;
  }
  const model = await buildModel(actor, preview);
  if (!eventId) {
    const open = (await listTakeovers(db(), actor.organizationId, actor.viewer)).filter((takeover) => takeover.progress.settled < takeover.progress.total);
    model.openTakeovers = await Promise.all(open.slice(0, 5).map(async (takeover) => ({ id: takeover.id, eventName: (await eventFacts(actor.organizationId, takeover.eventId)).name, progress: takeover.progress })));
  }
  return { kind: "page", model };
}

// La reprise de la ligne : celle de la page, ou une nouvelle, créée par sa première action (R1).
async function ensureTakeover(actor: TakeoverActor, takeoverId: string | null, eventId: string | null): Promise<TakeoverView> {
  if (takeoverId) {
    const view = await getTakeover(db(), actor.organizationId, takeoverId, actor.viewer);
    if (!view) throw new TakeoverNotFoundError();
    return view;
  }
  if (eventId) {
    const existing = await getEventTakeover(db(), actor.organizationId, eventId, actor.viewer);
    if (existing) return existing;
  }
  return createTakeover(db(), { organizationId: actor.organizationId, userId: actor.userId, eventId, viewer: actor.viewer });
}

// L'import qu'ouvre une ligne. Les PDF des prestataires retenus et du programme s'ouvrent sur la fiche
// du mariage (provisoire, paquet 71e) ; ils reviennent à la page une fois écrits.
export function takeoverImportHref(kind: TakeoverStepKind, takeover: { id: string; eventId: string | null }): string {
  const entityType = takeoverImportEntityType(kind);
  if (entityType) return `/import?type=${entityType}&reprise=${takeover.id}#import-form`;
  if (!takeover.eventId) return `/reprise/${takeover.id}`;
  return kind === "event_vendors"
    ? `/events/${takeover.eventId}?onglet=budget&reprendre=1&reprise=${takeover.id}#reprendre-prestataires`
    : `/events/${takeover.eventId}?onglet=programme&importer=1&reprise=${takeover.id}#importer-programme`;
}

export type TakeoverStepIntent = "drop" | "noFile" | "dropAgain" | "dropAnyway";

export async function startTakeoverStep(
  actor: TakeoverActor,
  input: { takeoverId: string | null; eventId: string | null; kind: TakeoverStepKind; intent: TakeoverStepIntent },
): Promise<{ takeoverId: string; href: string }> {
  const takeover = await ensureTakeover(actor, input.takeoverId, input.eventId);
  const base = { organizationId: actor.organizationId, userId: actor.userId, takeoverId: takeover.id, kind: input.kind, viewer: actor.viewer };
  if (input.intent === "noFile") {
    await settleTakeoverStep(db(), { ...base, state: "no_file" });
    return { takeoverId: takeover.id, href: `/reprise/${takeover.id}` };
  }
  // « Déposer un fichier » défait « Je n'ai pas ce fichier » ; « quand même » défait « Avec le budget ».
  if (input.intent === "dropAgain" || input.intent === "dropAnyway") await settleTakeoverStep(db(), { ...base, state: "todo" });
  return { takeoverId: takeover.id, href: takeoverImportHref(input.kind, takeover) };
}

// « Saisir les noms et la date » : le mariage, Confirmé, d'origine « reprise », sans modèle de
// rétroplanning ; ses postes de budget de départ sont posés (l'étape « Doublons » s'y range).
export async function enterTakeoverEvent(
  actor: TakeoverActor,
  input: { takeoverId: string | null; name: string; eventDate: string | null; clients: EventClientInput[]; eventTypeId?: string | null; locale?: "fr" | "en" },
): Promise<{ takeoverId: string; eventId: string }> {
  // La reprise d'abord : celle d'une autre organisation (ou hors de vue) arrête tout, avant d'écrire.
  const current = input.takeoverId ? await getTakeover(db(), actor.organizationId, input.takeoverId, actor.viewer) : null;
  if (input.takeoverId && !current) throw new TakeoverNotFoundError();
  if (current?.eventId) return { takeoverId: current.id, eventId: current.eventId };
  const { id: eventId } = await createProspect({
    organizationId: actor.organizationId,
    createdByUserId: actor.userId,
    clients: input.clients,
    name: input.name,
    prospectSourceId: null,
    eventTypeId: input.eventTypeId ?? null,
    eventDate: input.eventDate,
    takeover: true,
  });
  await makeCreatorLead(actor.organizationId, eventId, actor.userId);
  await createTypedDocumentFolders(actor.organizationId, eventId, input.locale ?? "fr");
  const takeover = current ?? (await createTakeover(db(), { organizationId: actor.organizationId, userId: actor.userId, viewer: actor.viewer }));
  await attachTakeoverEvent(db(), { organizationId: actor.organizationId, userId: actor.userId, takeoverId: takeover.id, eventId, viewer: actor.viewer });
  return { takeoverId: takeover.id, eventId };
}

// « Abandonner cet import… » : l'import en cours d'une ligne de cette reprise ; la ligne redevient à faire.
export async function abandonTakeoverImport(actor: TakeoverActor, takeoverId: string, importId: string): Promise<boolean> {
  const view = await getTakeover(db(), actor.organizationId, takeoverId, actor.viewer);
  if (!view || !view.steps.some((step) => step.importId === importId && step.state === "in_progress")) return false;
  return cancelImport(db(), actor.organizationId, importId);
}

// La route d'envoi : la reprise d'où vient le fichier, la sorte d'import de sa ligne, le mariage visé,
// et le rattachement de l'import une fois lu. Une reprise d'une autre organisation : null.
export async function takeoverForUpload(
  actor: TakeoverActor,
  takeoverId: string,
  kind: TakeoverStepKind,
): Promise<{ entityType: ImportEntityType; targetEventId: string | null; attach: (importId: string) => Promise<void> } | null> {
  const view = await getTakeover(db(), actor.organizationId, takeoverId, actor.viewer);
  const entityType = takeoverImportEntityType(kind) as ImportEntityType | null;
  if (!view || !entityType) return null;
  if ((entityType === "budget_lines" || entityType === "tasks") && !view.eventId) return null;
  return {
    entityType,
    targetEventId: entityType === "budget_lines" || entityType === "tasks" ? view.eventId : null,
    attach: async (importId) => {
      await attachImportToTakeoverStep(db(), { organizationId: actor.organizationId, userId: actor.userId, takeoverId: view.id, kind, importId, viewer: actor.viewer });
    },
  };
}

// L'import vient d'une reprise : l'en-tête de ses étapes et son bilan ramènent à sa page (« ← Reprendre
// « Juliette & Romain » »), la confirmation y revient. null hors reprise.
export async function takeoverBackLink(organizationId: string, importId: string): Promise<{ takeoverId: string; href: string; eventName: string | null } | null> {
  const takeoverId = await getImportTakeoverId(db(), organizationId, importId);
  if (!takeoverId) return null;
  const view = await getTakeover(db(), organizationId, takeoverId);
  if (!view) return null;
  return { takeoverId, href: `/reprise/${takeoverId}`, eventName: (await eventFacts(organizationId, view.eventId)).name };
}

// « Pour » du journal de « Reprendre et importer » : le mariage visé par un import, s'il y en a un.
export async function importEventNames(organizationId: string, imports: readonly Pick<ImportSummary, "id" | "targetEventId" | "takeoverId">[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const takeoverEvents = new Map<string, string | null>();
  for (const entry of imports) {
    let eventId = entry.targetEventId;
    if (!eventId && entry.takeoverId) {
      if (!takeoverEvents.has(entry.takeoverId)) takeoverEvents.set(entry.takeoverId, (await getTakeover(db(), organizationId, entry.takeoverId))?.eventId ?? null);
      eventId = takeoverEvents.get(entry.takeoverId) ?? null;
    }
    if (!eventId) continue;
    const { name } = await eventFacts(organizationId, eventId);
    if (name) names.set(entry.id, name);
  }
  return names;
}

// Provisoire jusqu'au paquet 71e : un PDF de prestataires retenus ou de programme, ouvert depuis la
// page de reprise et écrit sur la fiche du mariage, coche sa ligne. Une reprise d'une autre
// organisation, hors de vue, ou d'un autre mariage : rien ne change (SEC-13).
export async function markTakeoverPdfStepDone(actor: TakeoverActor, input: { takeoverId: string; kind: "event_vendors" | "program"; eventId: string }): Promise<boolean> {
  try {
    await markTakeoverStepImported(db(), { organizationId: actor.organizationId, userId: actor.userId, takeoverId: input.takeoverId, kind: input.kind, eventId: input.eventId, viewer: actor.viewer });
    return true;
  } catch (error) {
    if (error instanceof TakeoverNotFoundError) return false;
    throw error;
  }
}
