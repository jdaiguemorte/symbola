// Lot 70a (CHR-02, CHR-04 ; A1 à A4, A7, A19 ; § 3.3 et 3.4) — la personne qui s'en charge, la note
// interne, et l'événement events.task.assigned. Partagé par les chemins d'écriture des tâches du module
// (repository, actions en lot, tâches hors évènement) ; exposé seulement par service.ts (ADR 0011).
//
// - Une tâche « planner » se confie à un membre actif de l'organisation (titulaire ou Planner, pas le
//   Comptable) ; toute autre valeur est refusée comme un objet inexistant (même message), sans dire si
//   le compte existe ailleurs (SEC-13).
// - Sans choix, elle est à la personne qui la crée (A3) ; l'image précédente et les tâches de fond n'ont
//   pas de membre : la tâche n'a alors personne.
// - L'événement part dans la transaction de l'écriture (outbox, ARC-05), seulement si la tâche à faire
//   passe à un autre membre que celui qui agit, hors évènement de démonstration (A19). Aucun libellé.
import { randomUUID } from "node:crypto";
import { listTeam } from "@symbola/auth";
import { EVT_TASK_ASSIGNED, EVT_TASK_ASSIGNED_VERSION, TASK_NOTE_MAX, type TaskAssignedPayload } from "@symbola/contracts";
import { currentActor } from "@symbola/db/actor";
import { emitDomainEvent } from "@symbola/db/events/emit";
import type { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Même message qu'une tâche introuvable (EventTaskNotFoundError) : rien ne dit si le compte existe.
export class TaskAssigneeNotFoundError extends Error {
  constructor() {
    super("tâche introuvable");
    this.name = "TaskAssigneeNotFoundError";
  }
}

export class TaskNoteInvalidError extends Error {
  constructor() {
    super("note de tâche refusée");
    this.name = "TaskNoteInvalidError";
  }
}

// Le membre qui agit (session de la requête, ou withActor), ou null (tâche de fond, script, lien).
export async function actingMemberId(): Promise<string | null> {
  const actor = await currentActor();
  return actor.kind === "member" && actor.id && UUID.test(actor.id) ? actor.id : null;
}

// Un membre actif de l'organisation, à qui l'on peut confier une tâche : la titulaire ou une Planner.
// Revue du 70a : lu dans la transaction de l'écriture (tx), jamais avant elle.
async function isAssignable(tx: Tx, organizationId: string, userId: string): Promise<boolean> {
  if (!UUID.test(userId)) return false;
  const team = await listTeam(tx, organizationId);
  const member = team.find((entry) => entry.id === userId && !entry.disabledAt);
  return member !== undefined && (member.role === "owner" || member.role === "member");
}

export async function assertAssignable(tx: Tx, organizationId: string, userId: string): Promise<void> {
  if (!(await isAssignable(tx, organizationId, userId))) throw new TaskAssigneeNotFoundError();
}

// Revue du 70a (A4) : une personne rendue par « Annuler » ou reprise par la répétition suivante doit être
// encore active ; sinon la tâche reste à confier (null).
export async function stillAssignable(tx: Tx, organizationId: string, userId: string | null): Promise<string | null> {
  return userId !== null && (await isAssignable(tx, organizationId, userId)) ? userId : null;
}

// A7 : note interne, retours à la ligne gardés ; vide : effacée.
export function normalizeTaskNote(note: string | null | undefined): string | null | undefined {
  if (note === undefined) return undefined;
  if (note === null) return null;
  const value = note.replace(/\r\n?/g, "\n").trim();
  if (value === "") return null;
  // Caractères de contrôle refusés, sauf la tabulation et le retour à la ligne (contrainte 0213).
  if (Array.from(value).length > TASK_NOTE_MAX || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) throw new TaskNoteInvalidError();
  return value;
}

export type AssignmentChange = {
  organizationId: string;
  taskId: string;
  eventId: string | null;
  // La personne d'avant et celle d'après.
  before: string | null;
  after: string | null;
  done: boolean;
  isDemo: boolean;
  // Le membre qui agit (null : personne à nommer, rien ne part).
  actorId: string | null;
};

export function announcesAssignment(change: Omit<AssignmentChange, "organizationId" | "taskId" | "eventId">): change is typeof change & { after: string; actorId: string } {
  return change.after !== null && change.after !== change.before && change.actorId !== null && change.after !== change.actorId && !change.done && !change.isDemo;
}

// Publie l'événement de chaque tâche nouvellement confiée ; en lot, chacune porte le même identifiant de
// lot et le nombre de tâches confiées à la même personne (une seule notification par destinataire).
export async function emitTaskAssignments(tx: Tx, changes: AssignmentChange[]): Promise<number> {
  const announced = changes.filter(announcesAssignment);
  if (announced.length === 0) return 0;
  const batches = new Map<string, { id: string; count: number }>();
  if (announced.length > 1) {
    for (const change of announced) {
      const batch = batches.get(change.after!) ?? { id: randomUUID(), count: 0 };
      batch.count += 1;
      batches.set(change.after!, batch);
    }
  }
  for (const change of announced) {
    const batch = batches.get(change.after!);
    const payload: TaskAssignedPayload = {
      taskId: change.taskId,
      eventId: change.eventId,
      assigneeUserId: change.after!,
      assignedByUserId: change.actorId!,
      ...(batch && batch.count > 1 ? { batch } : {}),
    };
    await emitDomainEvent(tx, { organizationId: change.organizationId, name: EVT_TASK_ASSIGNED, version: EVT_TASK_ASSIGNED_VERSION, payload });
  }
  return announced.length;
}
