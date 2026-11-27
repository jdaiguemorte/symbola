// Lot 71a (HUB-14, PAR-01, UX-02 ; spécification du lot 71, § 4.1, § 4.6 et § 5.1 ; ADR 0119) — la
// reprise d'un mariage en cours, exposée par service.ts. Une reprise regroupe les imports d'un mariage
// (six lignes, dans l'ordre où déposer les fichiers) ; elle peut commencer avant que le mariage existe
// (ligne 2). Le mariage visé est contrôlé par le service des évènements : de la même organisation, pas
// un essai, visible de la personne (lot 52) ; sinon, la même réponse qu'un objet inexistant (SEC-13).
// Tout se lit et s'écrit sous RLS, dans l'organisation.
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import {
  isStepSettled,
  TAKEOVER_STEP_IMPORT_KINDS,
  TAKEOVER_STEP_KINDS,
  takeoverProgress,
  type TakeoverStepKind,
  type TakeoverStepState,
  type TakeoverStepView,
  type TakeoverView,
} from "@symbola/contracts";
import type { AppDatabase } from "@symbola/db/client";
import { importItems, imports, takeovers, takeoverSteps } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED } from "@symbola/privacy";
import { canViewEvent, getEvent } from "@/modules/events/service";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type StepRow = typeof takeoverSteps.$inferSelect;
type TakeoverRow = typeof takeovers.$inferSelect;

// La personne qui regarde (lot 52) : la Propriétaire voit tout ; une Planner voit tout, sauf si le
// réglage de l'organisation la limite aux évènements de son équipe.
export type TakeoverViewer = { userId: string; role: "owner" | "member"; allPlannersSeeAll: boolean };

// Une reprise, un évènement ou un import d'une autre organisation, hors de vue ou inexistant : même
// réponse (SEC-13).
export class TakeoverNotFoundError extends Error {
  constructor() {
    super("reprise introuvable");
    this.name = "TakeoverNotFoundError";
  }
}

// Le mariage visé est un essai guidé : il ne peut pas être repris (§ 4.6).
export class TakeoverDemoEventError extends Error {
  constructor() {
    super("un essai ne se reprend pas");
    this.name = "TakeoverDemoEventError";
  }
}

// Le mariage a déjà sa page de reprise (R1 : une page par mariage).
export class TakeoverEventTakenError extends Error {
  constructor(readonly takeoverId: string) {
    super("ce mariage a déjà sa reprise");
    this.name = "TakeoverEventTakenError";
  }
}

// L'import ne peut pas remplir cette ligne (une autre sorte de fichier, ou déjà rattaché ailleurs).
export class TakeoverImportMismatchError extends Error {
  constructor() {
    super("import sans rapport avec la ligne");
    this.name = "TakeoverImportMismatchError";
  }
}

// État d'une ligne remplie par un import : celui de l'import (en cours, appliqué, abandonné ou retiré).
function stateFromImport(status: string): TakeoverStepState {
  if (status === "draft") return "in_progress";
  if (status === "applied") return "done";
  return "todo";
}

function toStepView(row: StepRow, importStatus: string | undefined): TakeoverStepView {
  // Une ligne remplie par un import suit l'état de l'import ; « avec le budget » et « pas de fichier »
  // restent ce que la planner a choisi.
  const state = row.importId && importStatus && row.state !== "covered" && row.state !== "no_file" ? stateFromImport(importStatus) : row.state;
  return { id: row.id, kind: row.kind, state, importId: state === "todo" ? null : row.importId, coveredByStepId: row.coveredByStepId, decidedAt: row.decidedAt };
}

function orderSteps(steps: TakeoverStepView[]): TakeoverStepView[] {
  return [...steps].sort((a, b) => TAKEOVER_STEP_KINDS.indexOf(a.kind) - TAKEOVER_STEP_KINDS.indexOf(b.kind));
}

async function readView(tx: Tx, row: TakeoverRow): Promise<TakeoverView> {
  const steps = await tx.select().from(takeoverSteps).where(eq(takeoverSteps.takeoverId, row.id));
  const importIds = steps.map((step) => step.importId).filter((id): id is string => id !== null);
  const statuses = importIds.length > 0 ? new Map((await tx.select({ id: imports.id, status: imports.status }).from(imports).where(inArray(imports.id, importIds))).map((entry) => [entry.id, entry.status] as const)) : new Map<string, string>();
  const views = orderSteps(steps.map((step) => toStepView(step, step.importId ? statuses.get(step.importId) : undefined)));
  return {
    id: row.id,
    eventId: row.eventId,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    checklistClosedAt: row.checklistClosedAt,
    steps: views,
    progress: takeoverProgress(views),
  };
}

// Le mariage visé : de l'organisation (RLS du module), pas un essai, visible de la personne.
async function assertTakeoverEvent(organizationId: string, eventId: string, viewer: TakeoverViewer | null): Promise<void> {
  const event = await getEvent(organizationId, eventId);
  if (!event) throw new TakeoverNotFoundError();
  if (viewer && !(await canViewEvent(organizationId, viewer, eventId))) throw new TakeoverNotFoundError();
  if (event.isDemo) throw new TakeoverDemoEventError();
}

async function visible(organizationId: string, row: TakeoverRow, viewer: TakeoverViewer | null): Promise<boolean> {
  if (!viewer || !row.eventId) return true;
  return canViewEvent(organizationId, viewer, row.eventId);
}

// R2 : la ligne du carnet est partagée par l'agence ; elle est faite dès qu'un import de carnet a été
// appliqué dans l'organisation (« déjà faite au deuxième mariage »).
async function appliedVendorBookImport(tx: Tx): Promise<string | null> {
  const [row] = await tx
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.entityType, "vendors"), eq(imports.status, "applied")))
    .orderBy(desc(imports.appliedAt))
    .limit(1);
  return row?.id ?? null;
}

export async function createTakeover(
  db: AppDatabase,
  input: { organizationId: string; userId: string; eventId?: string | null; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  const eventId = input.eventId ?? null;
  if (eventId) await assertTakeoverEvent(input.organizationId, eventId, input.viewer ?? null);
  return withOrganization(db, input.organizationId, async (tx) => {
    if (eventId) {
      const [taken] = await tx.select({ id: takeovers.id }).from(takeovers).where(eq(takeovers.eventId, eventId));
      if (taken) throw new TakeoverEventTakenError(taken.id);
    }
    const [row] = await tx.insert(takeovers).values({ organizationId: input.organizationId, eventId, createdAt: now, updatedAt: now }).returning();
    if (!row) throw new Error("création de la reprise échouée");
    const vendorBook = await appliedVendorBookImport(tx);
    await tx.insert(takeoverSteps).values(
      TAKEOVER_STEP_KINDS.map((kind) => {
        const done = (kind === "vendor_book" && vendorBook !== null) || (kind === "event" && eventId !== null);
        return {
          organizationId: input.organizationId,
          takeoverId: row.id,
          kind,
          state: done ? ("done" as const) : ("todo" as const),
          importId: kind === "vendor_book" ? vendorBook : null,
          decidedAt: done ? now : null,
          decidedBy: done ? input.userId : null,
        };
      }),
    );
    return readView(tx, row);
  });
}

export async function getTakeover(db: AppDatabase, organizationId: string, takeoverId: string, viewer: TakeoverViewer | null = null): Promise<TakeoverView | null> {
  const row = await withOrganization(db, organizationId, async (tx) => (await tx.select().from(takeovers).where(eq(takeovers.id, takeoverId)))[0] ?? null);
  if (!row || !(await visible(organizationId, row, viewer))) return null;
  return withOrganization(db, organizationId, (tx) => readView(tx, row));
}

// La reprise d'un mariage (la fiche « Repris le … », lot 71f), ou null.
export async function getEventTakeover(db: AppDatabase, organizationId: string, eventId: string, viewer: TakeoverViewer | null = null): Promise<TakeoverView | null> {
  const row = await withOrganization(db, organizationId, async (tx) => (await tx.select().from(takeovers).where(eq(takeovers.eventId, eventId)))[0] ?? null);
  if (!row || !(await visible(organizationId, row, viewer))) return null;
  return withOrganization(db, organizationId, (tx) => readView(tx, row));
}

async function requireTakeover(tx: Tx, takeoverId: string): Promise<TakeoverRow> {
  const [row] = await tx.select().from(takeovers).where(eq(takeovers.id, takeoverId));
  if (!row) throw new TakeoverNotFoundError();
  return row;
}

async function requireVisibleTakeover(db: AppDatabase, organizationId: string, takeoverId: string, viewer: TakeoverViewer | null): Promise<TakeoverRow> {
  const row = await withOrganization(db, organizationId, (tx) => requireTakeover(tx, takeoverId));
  if (!(await visible(organizationId, row, viewer))) throw new TakeoverNotFoundError();
  return row;
}

async function requireStep(tx: Tx, takeoverId: string, kind: TakeoverStepKind): Promise<StepRow> {
  const [step] = await tx.select().from(takeoverSteps).where(and(eq(takeoverSteps.takeoverId, takeoverId), eq(takeoverSteps.kind, kind)));
  if (!step) throw new TakeoverNotFoundError();
  return step;
}

// Ligne 2 : le mariage existe (créé par la fiche, ou saisi sur la page) ; la reprise le reçoit.
export async function attachTakeoverEvent(
  db: AppDatabase,
  input: { organizationId: string; userId: string; takeoverId: string; eventId: string; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  const current = await requireVisibleTakeover(db, input.organizationId, input.takeoverId, input.viewer ?? null);
  if (current.eventId && current.eventId !== input.eventId) throw new TakeoverEventTakenError(current.id);
  await assertTakeoverEvent(input.organizationId, input.eventId, input.viewer ?? null);
  return withOrganization(db, input.organizationId, async (tx) => {
    const [taken] = await tx.select({ id: takeovers.id }).from(takeovers).where(eq(takeovers.eventId, input.eventId));
    if (taken && taken.id !== input.takeoverId) throw new TakeoverEventTakenError(taken.id);
    const [row] = await tx.update(takeovers).set({ eventId: input.eventId, updatedAt: now }).where(eq(takeovers.id, input.takeoverId)).returning();
    const step = await requireStep(tx, input.takeoverId, "event");
    if (step.state === "todo") await tx.update(takeoverSteps).set({ state: "done", decidedAt: now, decidedBy: input.userId, updatedAt: now }).where(eq(takeoverSteps.id, step.id));
    return readView(tx, row!);
  });
}

// « Je n'ai pas ce fichier » (no_file), défait par « Déposer un fichier » (todo).
export async function settleTakeoverStep(
  db: AppDatabase,
  input: { organizationId: string; userId: string; takeoverId: string; kind: TakeoverStepKind; state: "no_file" | "todo"; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  await requireVisibleTakeover(db, input.organizationId, input.takeoverId, input.viewer ?? null);
  return withOrganization(db, input.organizationId, async (tx) => {
    const takeover = await requireTakeover(tx, input.takeoverId);
    const step = await requireStep(tx, input.takeoverId, input.kind);
    await tx
      .update(takeoverSteps)
      .set({ state: input.state, importId: null, coveredByStepId: null, decidedAt: input.state === "todo" ? null : now, decidedBy: input.state === "todo" ? null : input.userId, updatedAt: now })
      .where(eq(takeoverSteps.id, step.id));
    return readView(tx, takeover);
  });
}

// « Avec le budget » : un budget qui nomme ses prestataires couvre la ligne des prestataires retenus
// dès qu'il est en cours (critère 4 du paquet 71b).
export async function coverTakeoverStep(
  db: AppDatabase,
  input: { organizationId: string; userId: string; takeoverId: string; kind: TakeoverStepKind; byKind: TakeoverStepKind; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  await requireVisibleTakeover(db, input.organizationId, input.takeoverId, input.viewer ?? null);
  return withOrganization(db, input.organizationId, async (tx) => {
    const takeover = await requireTakeover(tx, input.takeoverId);
    const step = await requireStep(tx, input.takeoverId, input.kind);
    const by = await requireStep(tx, input.takeoverId, input.byKind);
    if (by.id === step.id) throw new TakeoverImportMismatchError();
    await tx.update(takeoverSteps).set({ state: "covered", coveredByStepId: by.id, importId: null, decidedAt: now, decidedBy: input.userId, updatedAt: now }).where(eq(takeoverSteps.id, step.id));
    return readView(tx, takeover);
  });
}

// L'import d'une ligne (en cours ou appliqué) : de l'organisation, de la sorte attendue, et pas déjà
// d'une autre reprise. Un import d'une autre organisation n'existe pas pour celle-ci (RLS, SEC-13).
export async function attachImportToTakeoverStep(
  db: AppDatabase,
  input: { organizationId: string; userId: string; takeoverId: string; kind: TakeoverStepKind; importId: string; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  await requireVisibleTakeover(db, input.organizationId, input.takeoverId, input.viewer ?? null);
  return withOrganization(db, input.organizationId, async (tx) => {
    const takeover = await requireTakeover(tx, input.takeoverId);
    const [found] = await tx.select({ id: imports.id, entityType: imports.entityType, status: imports.status, takeoverId: imports.takeoverId }).from(imports).where(eq(imports.id, input.importId));
    if (!found) throw new TakeoverNotFoundError();
    if (!TAKEOVER_STEP_IMPORT_KINDS[input.kind].includes(found.entityType)) throw new TakeoverImportMismatchError();
    if (found.takeoverId && found.takeoverId !== input.takeoverId) throw new TakeoverImportMismatchError();
    if (found.status !== "draft" && found.status !== "applied") throw new TakeoverImportMismatchError();
    const step = await requireStep(tx, input.takeoverId, input.kind);
    await tx.update(imports).set({ takeoverId: input.takeoverId, updatedAt: now }).where(eq(imports.id, input.importId));
    await tx
      .update(takeoverSteps)
      .set({ state: stateFromImport(found.status), importId: input.importId, coveredByStepId: null, decidedAt: now, decidedBy: input.userId, updatedAt: now })
      .where(eq(takeoverSteps.id, step.id));
    return readView(tx, takeover);
  });
}

// La reprise de cet import, s'il en a une (les règles de fond de l'écriture en dépendent).
export async function getImportTakeoverId(db: AppDatabase, organizationId: string, importId: string): Promise<string | null> {
  return withOrganization(db, organizationId, async (tx) => (await tx.select({ takeoverId: imports.takeoverId }).from(imports).where(eq(imports.id, importId)))[0]?.takeoverId ?? null);
}

// « À compléter » s'est vidé pour la première fois (lot 71f) : la date reste.
export async function markTakeoverCompleted(db: AppDatabase, input: { organizationId: string; takeoverId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await withOrganization(db, input.organizationId, (tx) =>
    tx.update(takeovers).set({ completedAt: now, updatedAt: now }).where(and(eq(takeovers.id, input.takeoverId), isNull(takeovers.completedAt))),
  );
}

export function allStepsSettled(view: Pick<TakeoverView, "steps">): boolean {
  return view.steps.length > 0 && view.steps.every((step) => isStepSettled(step.state));
}

// —— Effacement définitif d'un mariage (corbeille, « Retirer toute la reprise… ») ——————————————

// Lot 71a (RGP-03, décision de Julien du 27/11/2026, § 5.1) : l'effacement définitif d'un évènement
// efface aussi le journal de ses imports. Il ne reste que la trace sans donnée personnelle : la date, la
// sorte de fichier, les nombres du bilan, l'état (« retiré le … »). Les imports de cet évènement : ceux
// qui le visent (target_event_id), ceux de sa reprise, et ceux qui l'ont créé ou modifié. Un import qui
// touchait plusieurs évènements ne perd que les valeurs de ceux qui partent. Sa reprise est effacée.
export async function eraseEventImports(db: AppDatabase, organizationId: string, eventIds: readonly string[]): Promise<number> {
  if (eventIds.length === 0) return 0;
  const ids = [...eventIds];
  return withOrganization(db, organizationId, async (tx) => {
    const ownTakeovers = await tx.select({ id: takeovers.id }).from(takeovers).where(inArray(takeovers.eventId, ids));
    const takeoverIds = ownTakeovers.map((row) => row.id);
    const eventItems = await tx
      .select({ importId: importItems.importId })
      .from(importItems)
      .where(and(eq(importItems.module, "events"), eq(importItems.kind, "event"), inArray(importItems.elementId, ids)));
    const touching = new Set(eventItems.map((row) => row.importId));
    const direct = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(or(inArray(imports.targetEventId, ids), takeoverIds.length > 0 ? inArray(imports.takeoverId, takeoverIds) : undefined));
    for (const row of direct) touching.add(row.id);
    const importIds = [...touching];
    if (importIds.length === 0) {
      if (takeoverIds.length > 0) await tx.delete(takeovers).where(inArray(takeovers.id, takeoverIds));
      return 0;
    }
    // Un import qui ne touchait que des évènements effacés (ou qui visait l'un d'eux) perd tout ; un
    // import de plusieurs évènements ne perd que les valeurs des évènements effacés.
    const erased = new Set(ids);
    const directIds = new Set(direct.map((row) => row.id));
    const shared = new Set<string>();
    const created = await tx
      .select({ importId: importItems.importId, elementId: importItems.elementId })
      .from(importItems)
      .where(and(inArray(importItems.importId, importIds), eq(importItems.module, "events"), eq(importItems.kind, "event")));
    for (const item of created) if (!erased.has(item.elementId)) shared.add(item.importId);
    const whole = importIds.filter((id) => directIds.has(id) || !shared.has(id));
    const partial = importIds.filter((id) => !whole.includes(id));
    if (whole.length > 0) {
      await tx.update(importItems).set({ previous: null, written: null, fields: null }).where(inArray(importItems.importId, whole));
      for (const row of await tx.select({ id: imports.id, headers: imports.headers }).from(imports).where(inArray(imports.id, whole))) {
        await tx
          .update(imports)
          .set({
            fileName: ANONYMIZED,
            headers: row.headers.map((_, index) => `#${index + 1}`),
            rows: null,
            sourceLineNumbers: null,
            leftovers: null,
            mapping: null,
            matching: null,
            updatedAt: new Date(),
          })
          .where(eq(imports.id, row.id));
      }
    }
    if (partial.length > 0) {
      await tx
        .update(importItems)
        .set({ previous: null, written: null, fields: null })
        .where(and(inArray(importItems.importId, partial), eq(importItems.module, "events"), eq(importItems.kind, "event"), inArray(importItems.elementId, ids)));
    }
    if (takeoverIds.length > 0) await tx.delete(takeovers).where(inArray(takeovers.id, takeoverIds));
    return importIds.length;
  });
}

// —— Annuaire d'un programme (leftovers, décision I4) ————————————————————————————————————————

// Passé la durée réglée par l'Admin après l'import (90 jours, I4, à confirmer par le DPO), ce que
// l'import n'avait pas repris est effacé ; un brouillon abandonné ou expiré le perd aussitôt.
export async function clearExpiredImportLeftovers(db: AppDatabase, organizationId: string, appliedBefore: Date): Promise<number> {
  return withOrganization(db, organizationId, async (tx) => {
    const cleared = await tx
      .update(imports)
      .set({ leftovers: null })
      .where(and(isNotNull(imports.leftovers), or(and(isNotNull(imports.appliedAt), lt(imports.appliedAt, appliedBefore)), inArray(imports.status, ["cancelled", "undone"]))))
      .returning({ id: imports.id });
    return cleared.length;
  });
}

// La planner a ajouté l'annuaire au carnet, ou l'a écarté (lot 71e) : il est effacé aussitôt.
export async function discardImportLeftovers(db: AppDatabase, organizationId: string, importId: string): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => (await tx.update(imports).set({ leftovers: null }).where(and(eq(imports.id, importId), isNotNull(imports.leftovers))).returning({ id: imports.id })).length > 0);
}

// Les reprises en cours de l'organisation, les plus récentes d'abord (« Reprises en cours », lot 71f).
export async function listTakeovers(db: AppDatabase, organizationId: string, viewer: TakeoverViewer | null = null): Promise<TakeoverView[]> {
  const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(takeovers).orderBy(desc(takeovers.createdAt), asc(takeovers.id)));
  const views: TakeoverView[] = [];
  for (const row of rows) {
    if (!(await visible(organizationId, row, viewer))) continue;
    views.push(await withOrganization(db, organizationId, (tx) => readView(tx, row)));
  }
  return views;
}

// —— Lot 71b : la page de reprise ————————————————————————————————————————————————————————————

// La page avant sa première action (R1) : rien n'est écrit tant que la planner n'a rien fait. La ligne
// du carnet est déjà faite au deuxième mariage (R2) ; la ligne du mariage, quand la page s'ouvre
// depuis un mariage (l'état vide de « Tâches »). Le mariage est contrôlé comme pour une reprise.
export async function previewTakeover(
  db: AppDatabase,
  input: { organizationId: string; eventId?: string | null; viewer?: TakeoverViewer | null; now?: Date },
): Promise<Omit<TakeoverView, "id"> & { id: null }> {
  const now = input.now ?? new Date();
  const eventId = input.eventId ?? null;
  if (eventId) await assertTakeoverEvent(input.organizationId, eventId, input.viewer ?? null);
  const vendorBook = await withOrganization(db, input.organizationId, (tx) => appliedVendorBookImport(tx));
  const steps: TakeoverStepView[] = TAKEOVER_STEP_KINDS.map((kind) => {
    const done = (kind === "vendor_book" && vendorBook !== null) || (kind === "event" && eventId !== null);
    return { id: kind, kind, state: done ? "done" : "todo", importId: kind === "vendor_book" ? vendorBook : null, coveredByStepId: null, decidedAt: done ? now : null };
  });
  return { id: null, eventId, createdAt: now, completedAt: null, checklistClosedAt: null, steps, progress: takeoverProgress(steps) };
}

// Le champ du budget qui nomme le prestataire d'une ligne (contrat des champs d'import).
export const BUDGET_VENDOR_FIELD = "vendorName";

type BudgetRows = { rows: string[][] | null; mapping: { columnIndex: number; fieldKey: string | null; target: string }[] | null };

// La colonne des prestataires : celle choisie à l'étape « Colonnes », sinon celle proposée (donnée par
// l'appelant, qui lit les propositions).
function vendorColumnOf(row: BudgetRows, proposed: number | null): number | null {
  if (row.mapping) return row.mapping.find((choice) => choice.target === "field" && choice.fieldKey === BUDGET_VENDOR_FIELD)?.columnIndex ?? null;
  return proposed;
}

function distinctVendorNames(row: BudgetRows, proposed: number | null): number {
  const column = vendorColumnOf(row, proposed);
  if (column === null || !row.rows) return 0;
  return new Set(row.rows.map((cells) => (cells[column] ?? "").trim().toLocaleLowerCase("fr")).filter((name) => name !== "")).size;
}

// Critère 4 du paquet 71b : un budget de reprise dont une colonne nomme les prestataires couvre la ligne
// des prestataires retenus dès qu'il est en cours (« Avec le budget ») : à son dépôt, d'après la colonne
// proposée, puis à l'enregistrement des colonnes ; si la planner n'y a rien décidé d'autre. Sans effet
// hors reprise.
export async function coverTakeoverFromBudgetImport(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date(), proposedVendorColumn: number | null = null): Promise<boolean> {
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx
      .select({ takeoverId: imports.takeoverId, entityType: imports.entityType, rows: imports.rows, mapping: imports.mapping, createdByUserId: imports.createdByUserId })
      .from(imports)
      .where(eq(imports.id, importId));
    if (!row?.takeoverId || row.entityType !== "budget_lines" || distinctVendorNames(row, proposedVendorColumn) === 0) return false;
    const steps = await tx.select().from(takeoverSteps).where(eq(takeoverSteps.takeoverId, row.takeoverId));
    const budget = steps.find((step) => step.kind === "budget");
    const vendors = steps.find((step) => step.kind === "event_vendors");
    if (!budget || !vendors || vendors.state !== "todo" || vendors.decidedAt !== null) return false;
    await tx
      .update(takeoverSteps)
      .set({ state: "covered", coveredByStepId: budget.id, importId: null, decidedAt: now, decidedBy: row.createdByUserId, updatedAt: now })
      .where(eq(takeoverSteps.id, vendors.id));
    return true;
  });
}

// « Votre budget nomme 7 prestataires : ils seront retenus avec lui. »
export async function countImportVendorNames(db: AppDatabase, organizationId: string, importId: string, proposedVendorColumn: number | null = null): Promise<number> {
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select({ rows: imports.rows, mapping: imports.mapping }).from(imports).where(eq(imports.id, importId));
    return row ? distinctVendorNames(row, proposedVendorColumn) : 0;
  });
}

// Provisoire jusqu'au paquet 71e : les PDF des prestataires retenus et du programme passent encore par
// leur envoi sur la fiche du mariage, hors du journal commun. Ouverts depuis la page de reprise, ils
// cochent leur ligne une fois écrits, sans bilan.
export async function markTakeoverStepImported(
  db: AppDatabase,
  input: { organizationId: string; userId: string; takeoverId: string; kind: "event_vendors" | "program"; eventId: string; viewer?: TakeoverViewer | null; now?: Date },
): Promise<TakeoverView> {
  const now = input.now ?? new Date();
  const current = await requireVisibleTakeover(db, input.organizationId, input.takeoverId, input.viewer ?? null);
  if (current.eventId !== input.eventId) throw new TakeoverNotFoundError();
  return withOrganization(db, input.organizationId, async (tx) => {
    const takeover = await requireTakeover(tx, input.takeoverId);
    const step = await requireStep(tx, input.takeoverId, input.kind);
    await tx.update(takeoverSteps).set({ state: "done", importId: null, coveredByStepId: null, decidedAt: now, decidedBy: input.userId, updatedAt: now }).where(eq(takeoverSteps.id, step.id));
    return readView(tx, takeover);
  });
}
