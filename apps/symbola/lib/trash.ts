// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille de 30 jours et « Annuler », tous modules
// confondus. Chaque module marque, rend et purge ses propres lignes ; les modules ne se connaissent
// que par leur service.ts (ADR 0011) : l'orchestration vit ici, comme lib/demo-purge.ts.
import { ELEMENT_PURGE_MINUTES, FORM_DRAFT_RETENTION_DAYS, TRASH_RETENTION_DAYS, type TrashedObject, type TrashKind, type UndoKind } from "@symbola/contracts";
import { includingDeleted } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { purgeBudgetElements, removeEventBudgetData, restoreBudgetLine, restoreEventBudget, trashEventBudget } from "@/modules/budget/service";
import {
  isContactUsedByAnEvent,
  isEventObjectTrashed,
  listTrashedEventIdsBefore,
  listTrashedEventObjects,
  purgeEventElements,
  purgeTrashedEventObjects,
  purgeTaskChangeSnapshots,
  purgeTrashedEvents,
  restoreEvent,
  restoreEventDocument,
  restoreEventPlace,
  restoreEventTask,
  restoreEventTasksDeletedWith,
  restoreProgramItem,
  restoreProgramTemplate,
  restoreTaskComment,
  restoreTaskTemplate,
  trashEvent,
} from "@/modules/events/service";
import {
  isHubObjectTrashed,
  isModuleEnabled,
  eraseEventImports,
  listOrganizations,
  listTrashedHubRows,
  purgeFormDrafts,
  purgeHubElements,
  purgeTrashedHubObjects,
  restoreContact,
  restoreContactNote,
  restoreMessageTemplate,
  trashContact,
} from "@/modules/hub/service";
import {
  findRetainedDocuments,
  isQuotesObjectTrashed,
  listTrashedQuotesRows,
  purgeQuotesElements,
  purgeTrashedQuotesObjects,
  removeEventQuotesData,
  restoreContractTemplate,
  restoreEventQuotes,
  restoreQuoteLine,
  restoreQuoteTemplate,
  trashEventQuotes,
  type RetainedDocuments,
} from "@/modules/quotes/service";
import { unarchiveVendor } from "@/modules/vendors/service";
import { removeEventGuestsData } from "@/modules/guests/service";
import { removeEventFloorplansData } from "@/modules/floorplans/service";
import { isAppointmentsObjectTrashed, listTrashedAppointmentsRows, purgeTrashedAppointmentsObjects, restoreAppointment, restoreAppointmentType } from "@/modules/appointments/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures
const DAY_MS = 24 * 60 * 60 * 1000;

// L'objet n'est pas (ou plus) à la corbeille, ou n'appartient pas à l'organisation : même réponse.
export class TrashItemNotFoundError extends Error {
  constructor() {
    super("objet introuvable dans la corbeille");
    this.name = "TrashItemNotFoundError";
  }
}

// D4 : l'évènement porte une pièce à conserver ; il s'annule, il ne se supprime pas.
export class EventDeletionRefusedError extends Error {
  constructor(readonly retained: RetainedDocuments) {
    super("évènement portant des pièces à conserver");
    this.name = "EventDeletionRefusedError";
  }
}

// Le contact est client d'un évènement (ou titulaire d'un lien personnel).
export class ContactDeletionRefusedError extends Error {
  constructor() {
    super("contact utilisé par un évènement");
    this.name = "ContactDeletionRefusedError";
  }
}

// —— Supprimer ————————————————————————————————————————————————————————————————————————————

// L'évènement va à la corbeille avec tout son contenu ; ses devis et les paiements de son budget le
// suivent, à la même date (ce sont les seules lignes lues hors de l'évènement).
export async function deleteEvent(organizationId: string, eventId: string): Promise<void> {
  const retained = await findRetainedDocuments(organizationId, eventId);
  if (Object.values(retained).some((count) => count > 0)) throw new EventDeletionRefusedError(retained);
  const at = new Date();
  await trashEventQuotes(organizationId, eventId, at);
  await trashEventBudget(organizationId, eventId, at);
  if (!(await trashEvent(organizationId, eventId, at))) {
    await restoreEventQuotes(organizationId, eventId, at);
    await restoreEventBudget(organizationId, eventId, at);
    throw new TrashItemNotFoundError();
  }
}

export async function deleteContact(organizationId: string, contactId: string): Promise<void> {
  if (await isContactUsedByAnEvent(organizationId, contactId)) throw new ContactDeletionRefusedError();
  if (!(await trashContact(organizationId, contactId))) throw new TrashItemNotFoundError();
}

// —— La corbeille ———————————————————————————————————————————————————————————————————————————

// Ce que l'organisation a à la corbeille, du plus récent au plus ancien ; un module non souscrit n'y
// montre rien (ARC-06).
export async function listTrash(organizationId: string): Promise<TrashedObject[]> {
  const db = appDatabase();
  const [eventsEnabled, quotesEnabled, appointmentsEnabled] = await Promise.all([isModuleEnabled(db, organizationId, "events"), isModuleEnabled(db, organizationId, "quotes"), isModuleEnabled(db, organizationId, "appointments")]);
  const [eventRows, hubRows, quotesRows, appointmentRows] = await Promise.all([
    eventsEnabled ? listTrashedEventObjects(organizationId) : Promise.resolve([]),
    listTrashedHubRows(organizationId),
    quotesEnabled ? listTrashedQuotesRows(organizationId) : Promise.resolve([]),
    appointmentsEnabled ? listTrashedAppointmentsRows(organizationId) : Promise.resolve([]),
  ]);
  return [...eventRows, ...hubRows.filter((row) => row.kind === "contact" || eventsEnabled), ...quotesRows, ...appointmentRows].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

async function isTrashed(organizationId: string, kind: TrashKind, id: string): Promise<boolean> {
  if (kind === "contact" || kind === "messageTemplate") return isHubObjectTrashed(organizationId, kind, id);
  if (kind === "quoteTemplate" || kind === "contractTemplate") return isQuotesObjectTrashed(organizationId, kind, id);
  if (kind === "appointmentType" || kind === "appointment") return isAppointmentsObjectTrashed(organizationId, kind, id);
  return isEventObjectTrashed(organizationId, kind, id);
}

// Rendre un objet de la corbeille, tel qu'il était (un évènement avec tout son contenu, ses devis et
// ses paiements de la même date).
export async function restoreFromTrash(organizationId: string, kind: TrashKind, id: string): Promise<void> {
  let restored = false;
  switch (kind) {
    case "event": {
      const at = await restoreEvent(organizationId, id);
      if (at) {
        await restoreEventQuotes(organizationId, id, at);
        await restoreEventBudget(organizationId, id, at);
        restored = true;
      }
      break;
    }
    case "contact":
      restored = await restoreContact(organizationId, id);
      break;
    case "document":
      restored = await restoreEventDocument(organizationId, id);
      break;
    case "taskTemplate":
      restored = await restoreTaskTemplate(organizationId, id);
      break;
    // Lot 70a (A5 ; ADR 0117) : la tâche, et celles supprimées du même geste.
    case "task":
      restored = (await restoreEventTasksDeletedWith(organizationId, id)) > 0;
      break;
    case "programTemplate":
      restored = await restoreProgramTemplate(organizationId, id);
      break;
    case "quoteTemplate":
      restored = await restoreQuoteTemplate(organizationId, id);
      break;
    case "contractTemplate":
      restored = await restoreContractTemplate(organizationId, id);
      break;
    case "messageTemplate":
      restored = await restoreMessageTemplate(organizationId, id);
      break;
    case "appointmentType":
      restored = await restoreAppointmentType(organizationId, id);
      break;
    case "appointment":
      restored = await restoreAppointment(organizationId, id);
      break;
  }
  if (!restored) throw new TrashItemNotFoundError();
}

// « Annuler » du bandeau : un élément d'une fiche, ou un objet qui vient d'aller à la corbeille. Un
// commentaire ou une note ne revient que pour son auteur.
export async function undoDeletion(input: { organizationId: string; userId: string; kind: UndoKind; id: string }): Promise<void> {
  const { organizationId, userId, kind, id } = input;
  let restored: boolean;
  switch (kind) {
    case "task":
      restored = await restoreEventTask(organizationId, id);
      break;
    case "taskBatch":
      restored = (await restoreEventTasksDeletedWith(organizationId, id)) > 0;
      break;
    case "programItem":
      restored = await restoreProgramItem(organizationId, id);
      break;
    case "place":
      restored = await restoreEventPlace(organizationId, id);
      break;
    case "taskComment":
      restored = await restoreTaskComment({ organizationId, commentId: id, authorUserId: userId });
      break;
    case "contactNote":
      restored = await restoreContactNote(organizationId, { noteId: id, authorUserId: userId });
      break;
    case "budgetLine":
      restored = (await restoreBudgetLine(organizationId, id)) !== null;
      break;
    case "quoteLine":
      restored = await restoreQuoteLine(organizationId, id).then(
        () => true,
        () => false,
      );
      break;
    case "vendor":
      restored = await unarchiveVendor(organizationId, id);
      break;
    default:
      await restoreFromTrash(organizationId, kind, id);
      return;
  }
  if (!restored) throw new TrashItemNotFoundError();
}

// Supprimer définitivement un objet de la corbeille (la titulaire seule, vérifié par l'action).
export async function deleteForGood(organizationId: string, kind: TrashKind, id: string): Promise<void> {
  if (!(await isTrashed(organizationId, kind, id))) throw new TrashItemNotFoundError();
  if (kind === "event") return purgeEvents(organizationId, [id]);
  if (kind === "contact" || kind === "messageTemplate") await purgeTrashedHubObjects(organizationId, { kind, id });
  else if (kind === "quoteTemplate" || kind === "contractTemplate") await purgeTrashedQuotesObjects(organizationId, { kind, id });
  else if (kind === "appointmentType" || kind === "appointment") await purgeTrashedAppointmentsObjects(organizationId, { kind, id });
  else await purgeTrashedEventObjects(organizationId, { kind, id });
}

// Purge réelle d'évènements à la corbeille : budget et devis d'abord, puis l'évènement (comme la fin
// d'un essai, lib/demo-purge.ts).
async function purgeEvents(organizationId: string, eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await includingDeleted(async () => {
    await removeEventBudgetData(organizationId, eventIds);
    await removeEventQuotesData(organizationId, eventIds);
    // Lot 49 : les invités de l'évènement (foyers, réponses, régimes, preuves) partent avec lui.
    await removeEventGuestsData(organizationId, eventIds);
    // Lot 60 : les plans de salle de l'évènement partent avec lui.
    await removeEventFloorplansData(organizationId, eventIds);
    // Lot 71a (RGP-03 ; décision de Julien du 27/11/2026) : le journal de ses imports ne garde que la
    // trace sans donnée personnelle (date, sorte, nombres) ; sa reprise part avec lui.
    await eraseEventImports(appDatabase(), organizationId, eventIds);
    await purgeTrashedEvents(organizationId, eventIds);
  });
}

// —— Purge planifiée ————————————————————————————————————————————————————————————————————————

// Éléments d'une fiche retirés depuis dix minutes ; objets de la corbeille depuis 30 jours.
export async function purgeOrganizationTrash(organizationId: string, now: Date = new Date()): Promise<{ elements: number; objects: number }> {
  const elementsBefore = new Date(now.getTime() - ELEMENT_PURGE_MINUTES * 60 * 1000);
  const objectsBefore = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
  let elements = 0;
  elements += await purgeEventElements(organizationId, elementsBefore);
  elements += await purgeHubElements(organizationId, elementsBefore);
  elements += await purgeQuotesElements(organizationId, elementsBefore);
  elements += await purgeBudgetElements(organizationId, elementsBefore);
  // Lot 70a (UX-07 ; A18) : les valeurs d'avant d'un changement de date ou de personne, passé dix minutes.
  await purgeTaskChangeSnapshots(organizationId, now);
  const expiredEvents = await listTrashedEventIdsBefore(organizationId, objectsBefore);
  await purgeEvents(organizationId, expiredEvents);
  let objects = expiredEvents.length;
  objects += await purgeTrashedEventObjects(organizationId, { before: objectsBefore });
  objects += await purgeTrashedHubObjects(organizationId, { before: objectsBefore });
  objects += await purgeTrashedQuotesObjects(organizationId, { before: objectsBefore });
  objects += await purgeTrashedAppointmentsObjects(organizationId, { before: objectsBefore });
  // Lot 39b (UX-09, ADR 0074) : brouillons de formulaires laissés en l'état depuis 30 jours.
  await purgeFormDrafts(organizationId, new Date(now.getTime() - FORM_DRAFT_RETENTION_DAYS * DAY_MS));
  return { elements, objects };
}

export async function purgeAllTrash(now: Date = new Date()): Promise<void> {
  const organizations = await listOrganizations(appDatabase());
  for (const organization of organizations) {
    await purgeOrganizationTrash(organization.id, now).catch((error: unknown) => {
      console.error("purge de la corbeille échouée", organization.id, error instanceof Error ? error.name : "inconnue");
    });
  }
}

// Lancé une fois au démarrage du serveur (instrumentation.ts) : un seul processus applicatif par
// environnement (ADR 0011), donc pas de verrou.
export function scheduleTrashPurge(): void {
  const run = () => {
    purgeAllTrash().catch((error: unknown) => {
      console.error("purge de la corbeille échouée", error instanceof Error ? error.name : "inconnue");
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
