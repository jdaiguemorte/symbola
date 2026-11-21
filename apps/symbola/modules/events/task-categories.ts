// Lot 63d (CHR-03, HUB-20 ; recette du 21/11/2026) — catégories des tâches de l'organisation (libellé,
// couleur, rang). Les catégories de départ (Client, Prestataires, Administratif, Jour J) viennent d'un
// fichier de données traduisible ; l'organisation les renomme, les recolore, en ajoute ou en retire.
// Retirée, une catégorie laisse ses tâches sans catégorie. Exposé seulement par service.ts (ADR 0011).
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventTasks, taskCategories } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { StarterTaskCategoryInput, TaskCategory, TaskCategoryInput } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CategoryRow = typeof taskCategories.$inferSelect;

export const TASK_CATEGORY_LABEL_MAX = 60;
// Au-delà, la légende du calendrier et le menu de la tâche deviennent illisibles.
export const TASK_CATEGORY_MAX = 20;
const COLOR = /^#[0-9a-f]{6}$/;

export class TaskCategoryNotFoundError extends Error {
  constructor() {
    super("catégorie de tâche introuvable");
    this.name = "TaskCategoryNotFoundError";
  }
}

// « invalid » : libellé vide ou trop long, couleur mal formée ; « too_many » : plafond atteint ; « last » :
// la dernière catégorie se garde (sinon les catégories de départ reviendraient à la visite suivante).
export class TaskCategoryInvalidError extends Error {
  constructor(readonly reason: "invalid" | "too_many" | "last") {
    super(`catégorie de tâche refusée : ${reason}`);
    this.name = "TaskCategoryInvalidError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

function toCategory(row: CategoryRow): TaskCategory {
  return { id: row.id, label: row.label, color: row.color, position: row.position, starterKey: row.starterKey };
}

export function cleanTaskCategory(input: TaskCategoryInput): TaskCategoryInput {
  const label = input.label.replace(/\s+/g, " ").trim();
  const color = input.color.trim().toLowerCase();
  if (label.length === 0 || label.length > TASK_CATEGORY_LABEL_MAX || !COLOR.test(color)) throw new TaskCategoryInvalidError("invalid");
  return { label, color };
}

const order = [asc(taskCategories.position), asc(taskCategories.createdAt)];

export async function listCategories(organizationId: string): Promise<TaskCategory[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(taskCategories).orderBy(...order));
  return rows.map(toCategory);
}

// Une catégorie visible de l'organisation (la base cache celles des autres) : la seule qu'une tâche peut
// recevoir. La clé étrangère, vérifiée sans RLS, ne suffit pas.
export async function isVisibleCategory(tx: Tx, categoryId: string): Promise<boolean> {
  const [row] = await tx.select({ id: taskCategories.id }).from(taskCategories).where(eq(taskCategories.id, categoryId));
  return Boolean(row);
}

// Les catégories de départ qui manquent, par leur clé ; renvoie le nombre ajouté.
export async function addStarterCategories(organizationId: string, starters: StarterTaskCategoryInput[]): Promise<number> {
  if (starters.length === 0) return 0;
  return inOrganization(organizationId, async (tx) => {
    const inserted = await tx
      .insert(taskCategories)
      .values(starters.map((starter, index) => ({ organizationId, label: starter.label, color: starter.color, starterKey: starter.key, position: index })))
      .onConflictDoNothing({ target: [taskCategories.organizationId, taskCategories.starterKey] })
      .returning({ id: taskCategories.id });
    return inserted.length;
  });
}

export async function createCategory(organizationId: string, input: TaskCategoryInput): Promise<TaskCategory> {
  const clean = cleanTaskCategory(input);
  return inOrganization(organizationId, async (tx) => {
    const [stats] = await tx.select({ total: count(), max: sql<number | null>`max(${taskCategories.position})` }).from(taskCategories);
    if ((stats?.total ?? 0) >= TASK_CATEGORY_MAX) throw new TaskCategoryInvalidError("too_many");
    const position = stats?.max === null || stats?.max === undefined ? 0 : stats.max + 1;
    const [row] = await tx.insert(taskCategories).values({ organizationId, ...clean, position }).returning();
    if (!row) throw new Error("ajout de la catégorie échoué");
    return toCategory(row);
  });
}

export async function updateCategory(organizationId: string, categoryId: string, input: TaskCategoryInput): Promise<void> {
  const clean = cleanTaskCategory(input);
  const rows = await inOrganization(organizationId, (tx) => tx.update(taskCategories).set({ ...clean, updatedAt: new Date() }).where(eq(taskCategories.id, categoryId)).returning({ id: taskCategories.id }));
  if (rows.length === 0) throw new TaskCategoryNotFoundError();
}

// Échange la catégorie avec sa voisine ; les rangs sont renumérotés pour rester distincts.
export async function moveCategory(organizationId: string, categoryId: string, direction: "up" | "down"): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(taskCategories).orderBy(...order);
    const index = rows.findIndex((row) => row.id === categoryId);
    if (index < 0) throw new TaskCategoryNotFoundError();
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    const ordered = [...rows];
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    for (const [position, row] of ordered.entries()) {
      if (row.position !== position) await tx.update(taskCategories).set({ position, updatedAt: new Date() }).where(eq(taskCategories.id, row.id));
    }
  });
}

// Retire la catégorie ; ses tâches (corbeille comprise, par la clé étrangère) restent sans catégorie.
// Renvoie le nombre de tâches qui la portaient.
export async function removeCategory(organizationId: string, categoryId: string): Promise<number> {
  return inOrganization(organizationId, async (tx) => {
    const [exists] = await tx.select({ id: taskCategories.id }).from(taskCategories).where(eq(taskCategories.id, categoryId));
    if (!exists) throw new TaskCategoryNotFoundError();
    const [total] = await tx.select({ value: count() }).from(taskCategories);
    if ((total?.value ?? 0) <= 1) throw new TaskCategoryInvalidError("last");
    const [used] = await tx.select({ value: count() }).from(eventTasks).where(and(eq(eventTasks.categoryId, categoryId), isNull(eventTasks.deletedAt)));
    await tx.delete(taskCategories).where(eq(taskCategories.id, categoryId));
    return used?.value ?? 0;
  });
}

// Tâches en cours (hors corbeille) de chaque catégorie, pour l'écran des réglages.
export async function countByCategory(organizationId: string): Promise<Record<string, number>> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select({ categoryId: eventTasks.categoryId, value: count() }).from(eventTasks).where(isNotNull(eventTasks.categoryId)).groupBy(eventTasks.categoryId),
  );
  return Object.fromEntries(rows.filter((row) => row.categoryId !== null).map((row) => [row.categoryId!, row.value]));
}
