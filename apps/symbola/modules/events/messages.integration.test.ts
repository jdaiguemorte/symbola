// Lot 55 (MSG-03, POR-06, POR-11 ; D3 ; ADR 0101) — fils de discussion par sujet, contre un vrai
// PostgreSQL (RLS), le stockage privé et l'antivirus (pièces jointes, ADR 0027), un double de l'envoi
// des e-mails et un faux envoyeur Web Push. Tests d'abus (CLAUDE.md § 2.11) : un message interne
// n'atteint jamais un client ni un prestataire, même par une requête forgée ; un lien n'ouvre que les
// sujets de son évènement et ses droits ; une organisation ne lit rien d'une autre.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { messages } from "@symbola/db/schema/events";
import { notifications } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { configureMailTransport, memoryTransport, type MemoryMailTransport } from "@symbola/mail";
import type { EventLinkRights, PushMessage } from "@symbola/contracts";
import { setPushSender, type PushTarget } from "@/modules/hub/service";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createMessageTopic,
  createProspect,
  createProspectSource,
  getLinkMessageAttachmentFile,
  getLinkMessageThread,
  getMessageAttachmentFile,
  getMessageThread,
  LinkAccessDeniedError,
  listLinkMessageTopics,
  listMessageTopics,
  MessageInputError,
  MessageNotFoundError,
  messageRecipientsDigest,
  postInternalNote,
  postLinkMessage,
  postSharedMessage,
  publishEventProgram,
  requestDecision,
  revokeEventLink,
  saveLinkPushSubscription,
  setMessageTopicVendors,
  startLinkMessageTopic,
} from "./service";

const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const MESSAGES: EventLinkRights = { rubrics: ["messages", "program"], budgetScope: "all", sharedSlotIds: [] };
const NO_MESSAGES: EventLinkRights = { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] };
const KEY = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

let mail: MemoryMailTransport;
let pushes: { target: PushTarget; message: PushMessage }[];

beforeEach(() => {
  mail = memoryTransport();
  configureMailTransport(mail);
  pushes = [];
  setPushSender({ send: async (target, message) => (pushes.push({ target, message }), "sent") });
});

afterEach(() => {
  configureMailTransport(null);
  setPushSender(null);
});

// Le mariage de Léa et Maxime : deux clients (Léa avec la rubrique « Messages », Maxime sans), un
// traiteur consulté avec son lien.
async function wedding() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  const owner = await createUser(db, { organizationId, email: `proprietaire-${randomUUID()}@example.test`, role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({
    organizationId,
    createdByUserId: owner.id,
    prospectSourceId: source.id,
    clients: [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Maxime", lastName: "Durand" },
    ],
    eventDate: "2027-06-12",
  });
  const create = async (personName: string, rights: EventLinkRights) =>
    (await createEventLink({ organizationId, eventId, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName, email: `client-${randomUUID()}@example.test`, rights } })).link;
  const lea = await create("Léa", MESSAGES);
  const maxime = await create("Maxime", NO_MESSAGES);
  const slot = await addEventVendorSlot(organizationId, eventId, "Traiteur");
  const karim = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: "Traiteur Karim" });
  const vendor = (
    await createEventLink({ organizationId, eventId, createdByUserId: owner.id, audience: "vendor", vendorCandidateId: karim.id, locale: "fr", link: { personName: "Karim", email: `karim-${randomUUID()}@example.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } } })
  ).link;
  mail.sent.length = 0;
  return { organizationId, ownerId: owner.id, eventId, lea, maxime, vendor };
}

async function sharedTo(w: Awaited<ReturnType<typeof wedding>>, topicId: string, body: string, files: { label: string; content: Uint8Array }[] = []) {
  const thread = await getMessageThread(w.organizationId, topicId, w.eventId);
  return postSharedMessage({ organizationId: w.organizationId, eventId: w.eventId, topicId, userId: w.ownerId, body, files, recipientsDigest: messageRecipientsDigest(thread.recipients) });
}

describe("MSG-03 — Fil de discussion par évènement et par sujet ; messages internes et partagés distincts", () => {
  it("un sujet par thème ; l'équipe lit tout, messages internes compris, chacun avec sa visibilité", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "  Traiteur  " });
    expect(topic.name).toBe("Traiteur");
    await postInternalNote({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Karim est en retard sur le devis." });
    await sharedTo(w, topic.id, "Le menu est prêt, qu'en pensez-vous ?");
    const thread = await getMessageThread(w.organizationId, topic.id, w.eventId);
    expect(thread.messages.map((message) => [message.visibility, message.body])).toEqual([
      ["internal", "Karim est en retard sur le devis."],
      ["shared", "Le menu est prêt, qu'en pensez-vous ?"],
    ]);
    expect((await listMessageTopics(w.organizationId, w.eventId))[0]).toMatchObject({ id: topic.id, messageCount: 2 });
    await expect(createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "   " })).rejects.toBeInstanceOf(MessageInputError);
  });

  it("le bouton nomme ses destinataires : les clients dont le lien ouvre « Messages » et les prestataires du sujet, rien d'autre", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Cérémonie" });
    expect((await getMessageThread(w.organizationId, topic.id, w.eventId)).recipients.map((recipient) => recipient.name)).toEqual(["Léa"]);
    await setMessageTopicVendors({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, vendorLinkIds: [w.vendor.id] });
    expect((await getMessageThread(w.organizationId, topic.id, w.eventId)).recipients.map((recipient) => [recipient.audience, recipient.name])).toEqual([
      ["client", "Léa"],
      ["vendor", "Karim"],
    ]);
    // Un lien de client n'est pas un prestataire du sujet.
    await expect(setMessageTopicVendors({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, vendorLinkIds: [w.lea.id] })).rejects.toBeInstanceOf(MessageNotFoundError);
  });

  it("un message partagé part aux destinataires nommés ; s'ils ont changé entre l'affichage et l'envoi, il est refusé", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Paiements" });
    const shown = messageRecipientsDigest((await getMessageThread(w.organizationId, topic.id, w.eventId)).recipients);
    await setMessageTopicVendors({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, vendorLinkIds: [w.vendor.id] });
    await expect(postSharedMessage({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Bonjour", recipientsDigest: shown })).rejects.toMatchObject({ reason: "recipients_changed" });
    expect((await getMessageThread(w.organizationId, topic.id, w.eventId)).messages).toEqual([]);
    const { notified } = await sharedTo(w, topic.id, "Bonjour à tous");
    expect(notified).toBe(2);
    expect(mail.sent.map((sent) => sent.to).sort()).toEqual([w.lea.email, w.vendor.email].sort());
  });

  it("sans destinataire, le message partagé est refusé (la planner ouvre d'abord la rubrique)", async () => {
    const w = await wedding();
    await revokeEventLink(w.organizationId, w.lea.id);
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Lieu" });
    await expect(postSharedMessage({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Bonjour", recipientsDigest: messageRecipientsDigest([]) })).rejects.toMatchObject({ reason: "no_recipients" });
  });

  it("critère : une note interne ne part jamais (ni e-mail, ni push) et n'est jamais lue par un lien, pièce jointe comprise", async () => {
    const w = await wedding();
    await saveLinkPushSubscription(w.organizationId, w.lea.id, { endpoint: `https://push.example.test/${randomUUID()}`, keys: KEY });
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
    await setMessageTopicVendors({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, vendorLinkIds: [w.vendor.id] });
    const note = await postInternalNote({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, userId: w.ownerId, body: "Marge de 12 % sur ce traiteur.", files: [{ label: "Calcul de marge", content: TINY_PDF }] });
    expect(mail.sent).toEqual([]);
    expect(pushes).toEqual([]);
    // Un sujet de notes internes seulement reste invisible, son nom compris.
    expect(await listLinkMessageTopics(w.organizationId, w.lea.id)).toEqual([]);
    expect(await listLinkMessageTopics(w.organizationId, w.vendor.id)).toEqual([]);
    await expect(getLinkMessageThread(w.organizationId, w.lea.id, topic.id)).rejects.toBeInstanceOf(MessageNotFoundError);
    // Une fois le sujet partagé, le lien lit le message partagé, jamais la note.
    await sharedTo(w, topic.id, "Voici le menu.");
    for (const linkId of [w.lea.id, w.vendor.id]) {
      const thread = await getLinkMessageThread(w.organizationId, linkId, topic.id);
      expect(thread.messages.map((message) => message.body)).toEqual(["Voici le menu."]);
      expect(thread.messages.every((message) => message.visibility === "shared")).toBe(true);
      // Requête forgée : l'identifiant de la pièce de la note interne, demandé par le lien.
      await expect(getLinkMessageAttachmentFile(w.organizationId, linkId, note.attachments[0]!.id)).rejects.toBeInstanceOf(MessageNotFoundError);
    }
    // Les e-mails partis n'annoncent que le message partagé, et jamais le texte de la note.
    expect(mail.sent.every((sent) => !sent.text.includes("Marge") && !(sent.html ?? "").includes("Marge"))).toBe(true);
    // L'équipe ouvre la pièce de la note.
    expect((await getMessageAttachmentFile(w.organizationId, note.attachments[0]!.id, w.eventId)).contentType).toBe("application/pdf");
  });

  it("abus : une requête forgée par un lien qui demande « interne » écrit un message partagé ; la base refuse un message interne d'un lien", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Déco" });
    await sharedTo(w, topic.id, "Des idées de fleurs ?");
    const forged = { organizationId: w.organizationId, linkId: w.lea.id, topicId: topic.id, body: "Pivoines", visibility: "internal" } as Parameters<typeof postLinkMessage>[0];
    const written = await postLinkMessage(forged);
    expect(written.visibility).toBe("shared");
    await expect(
      withOrganization(appDatabase(), w.organizationId, (tx) =>
        tx.insert(messages).values({ organizationId: w.organizationId, eventId: w.eventId, topicId: topic.id, visibility: "internal", authorKind: "link", authorLinkId: w.lea.id, authorName: "Léa", body: "Note forgée" }),
      ),
    ).rejects.toThrow();
    // Le rôle applicatif ne peut pas changer la visibilité d'un message (pas de droit UPDATE).
    await expect(withOrganization(appDatabase(), w.organizationId, (tx) => tx.update(messages).set({ visibility: "shared" }).where(eq(messages.id, written.id)))).rejects.toThrow();
  });

  it("abus : un sujet d'un autre évènement ne s'ouvre ni par l'équipe sur ce fil, ni par un lien", async () => {
    const w = await wedding();
    const other = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
    await sharedTo(w, topic.id, "Bonjour");
    await expect(getMessageThread(w.organizationId, topic.id, randomUUID())).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(postInternalNote({ organizationId: w.organizationId, eventId: randomUUID(), topicId: topic.id, userId: w.ownerId, body: "x" })).rejects.toBeInstanceOf(MessageNotFoundError);
    // Le lien de l'autre organisation, et un identifiant forgé.
    await expect(getLinkMessageThread(other.organizationId, other.lea.id, topic.id)).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(postLinkMessage({ organizationId: other.organizationId, linkId: other.lea.id, topicId: topic.id, body: "Intrusion" })).rejects.toBeInstanceOf(MessageNotFoundError);
  });
});

describe("POR-06 — Messagerie par sujet dans le portail, avec pièces jointes", () => {
  it("critère : le client lit la réponse dans son espace et répond avec une pièce jointe ; la planner est prévenue", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Faire-part" });
    await sharedTo(w, topic.id, "Voici l'épreuve du faire-part.", [{ label: "Épreuve", content: TINY_PDF }]);
    const [listed] = await listLinkMessageTopics(w.organizationId, w.lea.id);
    expect(listed).toMatchObject({ id: topic.id, name: "Faire-part", messageCount: 1 });
    const thread = await getLinkMessageThread(w.organizationId, w.lea.id, topic.id);
    const attachment = thread.messages[0]!.attachments[0]!;
    expect((await getLinkMessageAttachmentFile(w.organizationId, w.lea.id, attachment.id)).contentType).toBe("application/pdf");
    const reply = await postLinkMessage({ organizationId: w.organizationId, linkId: w.lea.id, topicId: topic.id, body: "Parfait, on valide !", files: [{ label: "Liste des adresses", content: TINY_PDF }] });
    expect(reply).toMatchObject({ visibility: "shared", authorKind: "link", authorName: "Léa" });
    expect(reply.attachments).toHaveLength(1);
    const [notice] = await withOrganization(appDatabase(), w.organizationId, (tx) => tx.select().from(notifications).where(and(eq(notifications.type, "client_message"), eq(notifications.objectKey, reply.id))));
    expect(notice).toMatchObject({ userId: w.ownerId, href: `/events/${w.eventId}/messages/${topic.id}`, params: { name: "Léa", topic: "Faire-part" } });
  });

  it("le client ouvre un sujet ; un prestataire n'en ouvre pas", async () => {
    const w = await wedding();
    const started = await startLinkMessageTopic({ organizationId: w.organizationId, linkId: w.lea.id, name: "Question sur le plan de table", body: "Peut-on ajouter une table ?" });
    expect((await getMessageThread(w.organizationId, started.topicId, w.eventId)).messages.map((message) => message.body)).toEqual(["Peut-on ajouter une table ?"]);
    await expect(startLinkMessageTopic({ organizationId: w.organizationId, linkId: w.vendor.id, name: "Sujet", body: "Bonjour" })).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("fermée par défaut (POR-10) : un lien sans la rubrique, un lien retiré, un prestataire hors du sujet ne lisent rien", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
    await sharedTo(w, topic.id, "Bonjour");
    await expect(listLinkMessageTopics(w.organizationId, w.maxime.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    await expect(getLinkMessageThread(w.organizationId, w.maxime.id, topic.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    expect(await listLinkMessageTopics(w.organizationId, w.vendor.id)).toEqual([]);
    await expect(getLinkMessageThread(w.organizationId, w.vendor.id, topic.id)).rejects.toBeInstanceOf(MessageNotFoundError);
    await revokeEventLink(w.organizationId, w.lea.id);
    await expect(listLinkMessageTopics(w.organizationId, w.lea.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });

  it("l'e-mail « Nouveau message » donne le sujet et le lien vers le fil, jamais le contenu du message", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Cérémonie laïque" });
    await sharedTo(w, topic.id, "Texte confidentiel du discours de Paul.");
    expect(mail.sent).toHaveLength(1);
    const [sent] = mail.sent;
    expect(sent!.subject).toContain("Cérémonie laïque");
    expect(sent!.text).toContain(`/portail/messages/${topic.id}`);
    expect(sent!.text).not.toContain("discours");
    expect(sent!.html ?? "").not.toContain("discours");
  });

  it("un pièce jointe refusée (type) n'enregistre pas le message", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
    await expect(sharedTo(w, topic.id, "Avec un exécutable", [{ label: "virus", content: new Uint8Array(Buffer.from("MZ\x90\x00binaire", "latin1")) }])).rejects.toThrow();
    expect((await getMessageThread(w.organizationId, topic.id, w.eventId)).messages).toEqual([]);
    expect(mail.sent).toEqual([]);
  });
});

describe("POR-11 — Notifications du portail, facultatives", () => {
  it("désactivé par défaut ; activé, le client reçoit un push sans contenu pour un message partagé et une décision demandée", async () => {
    const w = await wedding();
    const topic = await createMessageTopic({ organizationId: w.organizationId, eventId: w.eventId, name: "Traiteur" });
    await sharedTo(w, topic.id, "Premier message");
    expect(pushes).toEqual([]);
    await saveLinkPushSubscription(w.organizationId, w.lea.id, { endpoint: `https://push.example.test/${randomUUID()}`, keys: KEY });
    await sharedTo(w, topic.id, "Deuxième message, avec un détail privé");
    expect(pushes).toHaveLength(1);
    expect(pushes[0]!.message).toMatchObject({ title: "Nouveau message", url: `/portail/messages/${topic.id}` });
    expect(JSON.stringify(pushes[0]!.message)).not.toContain("privé");
    await addProgramItem(w.organizationId, w.eventId, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    await publishEventProgram({ organizationId: w.organizationId, eventId: w.eventId, userId: w.ownerId });
    await requestDecision({ organizationId: w.organizationId, eventId: w.eventId, requestedByUserId: w.ownerId, kind: "program" });
    expect(pushes.map((push) => push.message.title)).toEqual(["Nouveau message", "Décision demandée"]);
    expect(pushes[1]!.message.url).toBe("/portail#decisions");
    // Un abonnement en http, ou d'un prestataire, est refusé.
    await expect(saveLinkPushSubscription(w.organizationId, w.lea.id, { endpoint: "http://push.example.test/x", keys: KEY })).rejects.toBeInstanceOf(MessageInputError);
    await expect(saveLinkPushSubscription(w.organizationId, w.vendor.id, { endpoint: `https://push.example.test/${randomUUID()}`, keys: KEY })).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });
});

describe("SEC-36 — Isolation des fils entre organisations", () => {
  it("une organisation ne liste, ne lit ni n'écrit dans les sujets d'une autre ; leurs pièces jointes restent fermées", async () => {
    const a = await wedding();
    const b = await wedding();
    const topic = await createMessageTopic({ organizationId: a.organizationId, eventId: a.eventId, name: "Traiteur" });
    const { message } = await sharedTo(a, topic.id, "Message de A", [{ label: "Pièce de A", content: TINY_PDF }]);
    expect(await listMessageTopics(b.organizationId, a.eventId)).toEqual([]);
    await expect(getMessageThread(b.organizationId, topic.id, a.eventId)).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(postInternalNote({ organizationId: b.organizationId, eventId: a.eventId, topicId: topic.id, userId: b.ownerId, body: "Intrusion" })).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(getMessageAttachmentFile(b.organizationId, message.attachments[0]!.id, a.eventId)).rejects.toBeInstanceOf(MessageNotFoundError);
    await expect(createMessageTopic({ organizationId: b.organizationId, eventId: a.eventId, name: "Intrusion" })).rejects.toThrow();
    const rows = await withOrganization(appDatabase(), b.organizationId, (tx) => tx.select().from(messages).where(eq(messages.topicId, topic.id)));
    expect(rows).toEqual([]);
  });
});
