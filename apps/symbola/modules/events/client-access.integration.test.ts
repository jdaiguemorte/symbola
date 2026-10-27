// EVT-06 — accès des mariés, contre un vrai PostgreSQL (RLS, ADR 0012) et
// Mailpit, par la porte d'entrée du module. Tests d'isolation obligatoires
// (CLAUDE.md §6) : un marié n'accède qu'à son événement, jamais aux notes
// internes, à un autre événement ni à une autre organisation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser, login, requireUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  acceptEventClientInvitation,
  addEventTask,
  addProgramItem,
  ClientAccessDeniedError,
  ClientEmailUnavailableError,
  ClientPasswordTooShortError,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getClientEventView,
  inviteEventClient,
  listClientEvents,
  listEventActivity,
  listEventClientAccesses,
  removeEventTask,
  revokeEventClientAccess,
  setClientTaskDone,
} from "./service";

const plannerId = randomUUID();
const PASSWORD = "mot-de-passe-du-marie";

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function setup() {
  const organization = await withDb((db) => createOrganization(db, `Org ${randomUUID()}`));
  const organizationId = organization.id;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
    eventDate: "2027-06-12",
  });
  return { organizationId, eventId: event.id };
}

async function inviteAndAccept(organizationId: string, eventId: string) {
  const email = `marie-${randomUUID()}@example.test`;
  const invitation = await inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" });
  const accepted = await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  if (accepted.outcome !== "success") throw new Error("acceptation attendue");
  const session = await withDb((db) => login(db, email, PASSWORD));
  if (session.outcome !== "success") throw new Error("connexion attendue");
  const auth = await withDb((db) => requireUser(db, session.sessionToken));
  if (auth.status !== "authenticated") throw new Error("session attendue");
  return { email, userId: auth.user.id, user: auth.user, access: invitation.access };
}

describe("EVT-06 — Accès des mariés", () => {
  it("quand la planner invite un marié par e-mail, il crée son propre compte, sans double authentification imposée", async () => {
    const { organizationId, eventId } = await setup();
    const email = `marie-${randomUUID()}@example.test`;

    const invitation = await inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" });
    expect(invitation.access).toMatchObject({ email, status: "invited" });
    expect(invitation.invitationToken).toBeTruthy();

    await expect(acceptEventClientInvitation(invitation.invitationToken!, "court")).rejects.toBeInstanceOf(
      ClientPasswordTooShortError,
    );
    expect(await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD)).toEqual({ outcome: "success", email });
    expect(await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD)).toEqual({ outcome: "already_accepted" });

    const session = await withDb((db) => login(db, email, PASSWORD));
    expect(session).toMatchObject({ outcome: "success", requiresMfa: false });
    if (session.outcome !== "success") return;
    const auth = await withDb((db) => requireUser(db, session.sessionToken));
    expect(auth).toMatchObject({ status: "authenticated", user: { role: "client", organizationId } });

    expect((await listEventClientAccesses(organizationId, eventId)).map((access) => [access.email, access.status])).toEqual([
      [email, "active"],
    ]);
  });

  it("un jeton inconnu, falsifié ou expiré ne crée aucun compte", async () => {
    const { organizationId } = await setup();
    expect(await acceptEventClientInvitation("pas-un-jeton", PASSWORD)).toEqual({ outcome: "invalid_or_expired" });
    expect(await acceptEventClientInvitation(`${organizationId}.inconnu`, PASSWORD)).toEqual({ outcome: "invalid_or_expired" });
  });

  it("un compte par personne : l'e-mail d'un compte professionnel ou d'une autre organisation est refusé", async () => {
    const { organizationId, eventId } = await setup();
    const other = await setup();
    const proEmail = `planner-${randomUUID()}@example.test`;
    await withDb((db) => createUser(db, { organizationId, email: proEmail, password: PASSWORD, role: "owner" }));
    const foreign = await inviteAndAccept(other.organizationId, other.eventId);

    for (const email of [proEmail, foreign.email]) {
      await expect(
        inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" }),
      ).rejects.toBeInstanceOf(ClientEmailUnavailableError);
    }
  });

  it("un marié déjà inscrit dans l'organisation reçoit l'accès à un second événement sans nouveau compte", async () => {
    const { organizationId, eventId } = await setup();
    const marie = await inviteAndAccept(organizationId, eventId);
    const source = await createProspectSource(organizationId, "Salon 2");
    const second = await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: source.id,
      clients: [{ firstName: "Inès", lastName: null }],
    });

    const invitation = await inviteEventClient({
      organizationId,
      eventId: second.id,
      email: marie.email.toUpperCase(),
      invitedByUserId: plannerId,
      locale: "en",
    });
    expect(invitation).toMatchObject({ invitationToken: null, access: { status: "active" } });
    expect((await listClientEvents(organizationId, marie.userId)).map((event) => event.id).sort()).toEqual(
      [eventId, second.id].sort(),
    );
  });

  it("le marié voit le rétroplanning, coche ses tâches et voit le programme sans notes internes", async () => {
    const { organizationId, eventId } = await setup();
    const coupleTask = await addEventTask(organizationId, eventId, {
      label: "Choisir les alliances",
      dueDate: "2027-03-10",
      responsible: "clients",
    });
    const plannerTask = await addEventTask(organizationId, eventId, {
      label: "Confirmer le traiteur",
      dueDate: "2027-05-01",
      responsible: "planner",
    });
    await addProgramItem(organizationId, eventId, {
      startTime: "15:00",
      label: "Cérémonie",
      internalNote: "Le témoin oublie toujours les alliances",
      vendorSlotIds: [],
      freeParticipants: ["Officiant"],
    });
    const marie = await inviteAndAccept(organizationId, eventId);

    const view = await getClientEventView(organizationId, marie.userId, eventId);
    expect(view.tasks.map((task) => [task.label, task.responsible])).toEqual([
      ["Choisir les alliances", "clients"],
      ["Confirmer le traiteur", "planner"],
    ]);
    expect(view.program.items).toMatchObject([{ label: "Cérémonie", internalNote: null, participants: [{ label: "Officiant" }] }]);
    expect(JSON.stringify(view)).not.toContain("oublie toujours");

    await setClientTaskDone(organizationId, marie.userId, coupleTask.id, true);
    expect((await getClientEventView(organizationId, marie.userId, eventId)).tasks[0]?.done).toBe(true);
    // Une tâche de la planner n'est pas cochable par le marié.
    await expect(setClientTaskDone(organizationId, marie.userId, plannerTask.id, true)).rejects.toBeInstanceOf(
      ClientAccessDeniedError,
    );
  });

  it("quand un marié coche une tâche, la planner le voit dans le fil d'activité de l'événement", async () => {
    const { organizationId, eventId } = await setup();
    const task = await addEventTask(organizationId, eventId, {
      label: "Envoyer les faire-part",
      dueDate: "2027-02-12",
      responsible: "clients",
    });
    const marie = await inviteAndAccept(organizationId, eventId);

    await setClientTaskDone(organizationId, marie.userId, task.id, true);
    await setClientTaskDone(organizationId, marie.userId, task.id, false);

    const activity = await listEventActivity(organizationId, eventId);
    expect(activity.map((entry) => [entry.kind, entry.taskLabel, entry.actorEmail])).toEqual([
      ["task_undone", "Envoyer les faire-part", marie.email],
      ["task_done", "Envoyer les faire-part", marie.email],
    ]);

    // Le fil reste lisible si la tâche est supprimée ensuite.
    await removeEventTask(organizationId, task.id);
    expect((await listEventActivity(organizationId, eventId)).map((entry) => entry.taskLabel)).toEqual([
      "Envoyer les faire-part",
      "Envoyer les faire-part",
    ]);
  });

  it("la planner peut retirer un accès à tout moment : le marié ne voit plus rien de l'événement", async () => {
    const { organizationId, eventId } = await setup();
    const task = await addEventTask(organizationId, eventId, { label: "Essayage", dueDate: "2027-04-01", responsible: "clients" });
    const marie = await inviteAndAccept(organizationId, eventId);

    await revokeEventClientAccess(organizationId, marie.access.id);
    expect((await listEventClientAccesses(organizationId, eventId))[0]?.status).toBe("revoked");
    await expect(getClientEventView(organizationId, marie.userId, eventId)).rejects.toBeInstanceOf(ClientAccessDeniedError);
    await expect(setClientTaskDone(organizationId, marie.userId, task.id, true)).rejects.toBeInstanceOf(ClientAccessDeniedError);
    expect(await listClientEvents(organizationId, marie.userId)).toEqual([]);
  });

  it("une invitation retirée avant d'être acceptée ne crée pas de compte", async () => {
    const { organizationId, eventId } = await setup();
    const email = `marie-${randomUUID()}@example.test`;
    const invitation = await inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" });
    await revokeEventClientAccess(organizationId, invitation.access.id);
    expect(await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD)).toEqual({ outcome: "invalid_or_expired" });
  });
});

describe("EVT-06 — Isolation d'un compte marié", () => {
  it("étant donné un compte marié, l'accès à un autre événement de la même organisation est refusé", async () => {
    const { organizationId, eventId } = await setup();
    const source = await createProspectSource(organizationId, "Salon 2");
    const otherEvent = await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: source.id,
      clients: [{ firstName: "Lou", lastName: null }],
    });
    const otherTask = await addEventTask(organizationId, otherEvent.id, {
      label: "Tâche d'un autre couple",
      dueDate: "2027-01-01",
      responsible: "clients",
    });
    const marie = await inviteAndAccept(organizationId, eventId);

    await expect(getClientEventView(organizationId, marie.userId, otherEvent.id)).rejects.toBeInstanceOf(ClientAccessDeniedError);
    await expect(setClientTaskDone(organizationId, marie.userId, otherTask.id, true)).rejects.toBeInstanceOf(
      ClientAccessDeniedError,
    );
    expect((await listClientEvents(organizationId, marie.userId)).map((event) => event.id)).toEqual([eventId]);
  });

  it("étant donné un compte marié, l'accès à une autre organisation est refusé", async () => {
    const own = await setup();
    const other = await setup();
    const otherTask = await addEventTask(other.organizationId, other.eventId, {
      label: "Tâche d'une autre organisation",
      dueDate: "2027-01-01",
      responsible: "clients",
    });
    const marie = await inviteAndAccept(own.organizationId, own.eventId);

    // Même en passant l'organisation visée, l'accès du marié n'y existe pas.
    await expect(getClientEventView(other.organizationId, marie.userId, other.eventId)).rejects.toBeInstanceOf(
      ClientAccessDeniedError,
    );
    await expect(setClientTaskDone(other.organizationId, marie.userId, otherTask.id, true)).rejects.toBeInstanceOf(
      ClientAccessDeniedError,
    );
    // Et depuis sa propre organisation, l'événement d'une autre est invisible (RLS).
    await expect(getClientEventView(own.organizationId, marie.userId, other.eventId)).rejects.toBeInstanceOf(
      ClientAccessDeniedError,
    );
  });

  it("la planner d'une autre organisation ne peut ni inviter sur l'événement, ni retirer son accès", async () => {
    const { organizationId, eventId } = await setup();
    const other = await setup();
    const marie = await inviteAndAccept(organizationId, eventId);

    await expect(
      inviteEventClient({
        organizationId: other.organizationId,
        eventId,
        email: `intrus-${randomUUID()}@example.test`,
        invitedByUserId: plannerId,
        locale: "fr",
      }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
    await revokeEventClientAccess(other.organizationId, marie.access.id);
    expect((await listEventClientAccesses(organizationId, eventId))[0]?.status).toBe("active");
    expect(await listEventActivity(other.organizationId, eventId)).toEqual([]);
  });
});
