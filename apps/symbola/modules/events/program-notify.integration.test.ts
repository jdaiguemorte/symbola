// Lot 38a (CHR-07, MSG-02 ; D8, D9 ; ADR 0072) — « Prévenir par e-mail » après une diffusion du
// programme, contre un vrai PostgreSQL (RLS) et un vrai Mailpit, par la porte d'entrée du module.
// Seuls les liens actifs concernés reçoivent l'e-mail, chacun avec son PDF ; ni note interne ni
// séquence détaillée d'un autre prestataire. Tests d'abus (CLAUDE.md § 2.11) : une autre
// organisation ne prévient personne ; un essai n'envoie rien ; une version ne part qu'une fois.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { EventLinkRights, ProgramRecipientDocument } from "@symbola/contracts";
import { recipientsDigest, RecipientsNotConfirmedError } from "@/modules/hub/service";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  DemoEventRestrictionError,
  EventNotFoundError,
  getEventProgramPublication,
  listProgramRecipients,
  notifyProgramVersion,
  ProgramNotifyError,
  publishEventProgram,
  revokeEventLink,
  startEventsTrial,
} from "./service";

const plannerId = randomUUID();
const MAILPIT_API = "http://localhost:8025/api/v1";
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"));
const PROGRAM: EventLinkRights = { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] };
const TASKS_ONLY: EventLinkRights = { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] };

type MailpitMessage = { Subject: string; Text: string; From: { Name: string }; Attachments: { FileName: string; ContentType: string }[] | null };

async function organization(): Promise<{ organizationId: string; name: string }> {
  const { sql, db } = createAppConnection();
  try {
    const name = `Atelier ${randomUUID().slice(0, 8)}`;
    return { organizationId: (await createOrganization(db, name)).id, name };
  } finally {
    await sql.end();
  }
}

async function programMailsTo(to: string, wait = true): Promise<MailpitMessage[]> {
  for (let attempt = 0; attempt < (wait ? 30 : 1); attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
    const program = messages.filter((message) => /^(Programme|Schedule)/.test(message.Subject));
    if (program.length > 0) return Promise.all(program.map(async (message) => (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as MailpitMessage));
    if (wait) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

// Mariage de Léa et Maxime : Karim (traiteur) et le photographe ; une note interne sur la cérémonie.
// Liens : Léa (rubrique Programme), Maxime (tâches seulement), Karim (en anglais), et un lien retiré.
async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const photographer = await addEventVendorSlot(organizationId, event.id, "Photographe");
  const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
  await addProgramItem(organizationId, event.id, { startTime: "15:00", endTime: "16:30", label: "Cérémonie", location: "Jardin des Tilleuls", internalNote: "Alliances chez le témoin", vendorSlotIds: [photographer.id], freeParticipants: [] });
  await addProgramItem(organizationId, event.id, { startTime: "20:00", label: "Dîner", location: "Orangerie", vendorSlotIds: [caterer.id], freeParticipants: [] });
  const link = async (input: { audience: "client" | "vendor"; personName: string; rights: EventLinkRights; vendorCandidateId?: string; locale?: "fr" | "en" }) => {
    const email = `${input.personName.split(" ")[0]!.normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase()}-${randomUUID()}@example.test`;
    const created = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: plannerId,
      audience: input.audience,
      ...(input.vendorCandidateId ? { vendorCandidateId: input.vendorCandidateId } : {}),
      locale: input.locale ?? "fr",
      link: { personName: input.personName, email, rights: input.rights },
    });
    return { id: created.link.id, email };
  };
  const lea = await link({ audience: "client", personName: "Léa Martin", rights: PROGRAM });
  const maxime = await link({ audience: "client", personName: "Maxime Durand", rights: TASKS_ONLY });
  const karimLink = await link({ audience: "vendor", personName: "Karim", rights: PROGRAM, vendorCandidateId: karim.id, locale: "en" });
  const gone = await link({ audience: "client", personName: "Ancien Lien", rights: PROGRAM });
  await revokeEventLink(organizationId, gone.id);
  return { eventId: event.id, lea, maxime, karim: karimLink, gone, link };
}

function recorder() {
  const documents: ProgramRecipientDocument[] = [];
  return {
    documents,
    render: async (document: ProgramRecipientDocument) => {
      documents.push(document);
      return { filename: `programme-v${document.version.number}.pdf`, content: PDF };
    },
  };
}

describe("CHR-07 — E-mail d'une nouvelle version du programme (lot 38a, D9)", () => {
  it("les destinataires sont les liens actifs des clients avec la rubrique Programme et ceux des prestataires", async () => {
    const { organizationId } = await organization();
    const w = await wedding(organizationId);
    const recipients = await listProgramRecipients(organizationId, w.eventId);
    expect(recipients.map((recipient) => [recipient.audience, recipient.name, recipient.email, recipient.locale]).sort()).toEqual(
      [
        ["client", "Léa Martin", w.lea.email, "fr"],
        ["vendor", "Karim", w.karim.email, "en"],
      ].sort(),
    );
  });

  it("chacun reçoit son programme en PDF, dans sa langue, au nom de l'organisation ; la version note la date et le nombre", async () => {
    const { organizationId, name } = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    const recipients = await listProgramRecipients(organizationId, w.eventId);
    const { documents, render } = recorder();
    const now = new Date("2027-06-01T10:00:00Z");
    const result = await notifyProgramVersion({ organizationId, eventId: w.eventId, confirmedRecipients: recipientsDigest(recipients), renderDocument: render, now });
    expect(result).toEqual({ version: 1, sent: 2, notSent: 0 });

    // Le client : la version des clients, sans note interne. Le prestataire : sa séquence en entier, le reste en titres.
    const client = documents.find((document) => document.recipient.audience === "client")!;
    expect(client.view.kind).toBe("client");
    expect(JSON.stringify(client)).not.toContain("Alliances chez le témoin");
    const vendor = documents.find((document) => document.recipient.audience === "vendor")!;
    expect(vendor.view).toMatchObject({ kind: "vendor", slotLabel: "Traiteur" });
    if (vendor.view.kind === "vendor") {
      expect(vendor.view.ownItems.map((item) => item.label)).toEqual(["Dîner"]);
      expect(vendor.view.outline.map((item) => [item.label, item.own])).toEqual([
        ["Cérémonie", false],
        ["Dîner", true],
      ]);
    }
    expect(JSON.stringify(vendor)).not.toContain("Jardin des Tilleuls");
    expect(JSON.stringify(vendor)).not.toContain("Alliances");

    const [toLea] = await programMailsTo(w.lea.email);
    expect(toLea!.Subject).toBe(`Programme, version 1 — ${name}`);
    expect(toLea!.From.Name).toBe(name);
    expect(toLea!.Text).toContain("pour votre mariage");
    expect(toLea!.Attachments!.map((attachment) => [attachment.FileName, attachment.ContentType])).toEqual([["programme-v1.pdf", "application/pdf"]]);
    const [toKarim] = await programMailsTo(w.karim.email);
    expect(toKarim!.Text).toContain("the wedding of Léa & Maxime");
    for (const absent of [w.maxime.email, w.gone.email]) expect(await programMailsTo(absent, false)).toEqual([]);

    const latest = (await getEventProgramPublication(organizationId, w.eventId)).latest!;
    expect(latest).toMatchObject({ number: 1, notifiedAt: now.toISOString(), notifiedCount: 2 });
    await expect(notifyProgramVersion({ organizationId, eventId: w.eventId, confirmedRecipients: recipientsDigest(recipients), renderDocument: render })).rejects.toMatchObject({ reason: "already_notified" });
  });

  it("rien ne part sans version diffusée, ni sans destinataire, ni pendant l'essai", async () => {
    const { organizationId } = await organization();
    const w = await wedding(organizationId);
    const { render } = recorder();
    await expect(notifyProgramVersion({ organizationId, eventId: w.eventId, renderDocument: render })).rejects.toMatchObject({ reason: "no_version" });

    const source = await createProspectSource(organizationId, "Bouche-à-oreille");
    const alone = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-09-04" });
    await addProgramItem(organizationId, alone.id, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    await publishEventProgram({ organizationId, eventId: alone.id, userId: plannerId });
    const empty = await notifyProgramVersion({ organizationId, eventId: alone.id, renderDocument: render }).catch((error: unknown) => error);
    expect(empty).toBeInstanceOf(ProgramNotifyError);
    expect(empty).toMatchObject({ reason: "no_recipients" });

    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr" });
    await expect(notifyProgramVersion({ organizationId, eventId: trial.eventId, renderDocument: render })).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });
});

describe("MSG-02 — Garde-fou d'envoi groupé (programme)", () => {
  it("à plusieurs destinataires, rien ne part sans l'écran ; une liste changée depuis l'écran est refusée", async () => {
    const { organizationId } = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    const { documents, render } = recorder();
    const unconfirmed = await notifyProgramVersion({ organizationId, eventId: w.eventId, renderDocument: render }).catch((error: unknown) => error);
    expect(unconfirmed).toBeInstanceOf(RecipientsNotConfirmedError);
    expect((unconfirmed as RecipientsNotConfirmedError).review.count).toBe(2);

    // Une personne ajoutée entre l'écran et l'envoi : la liste confirmée n'est plus celle du serveur.
    const screen = recipientsDigest(await listProgramRecipients(organizationId, w.eventId));
    const added = await w.link({ audience: "client", personName: "Maxime Durand", rights: PROGRAM });
    await expect(notifyProgramVersion({ organizationId, eventId: w.eventId, confirmedRecipients: screen, renderDocument: render })).rejects.toBeInstanceOf(RecipientsNotConfirmedError);
    expect(documents).toEqual([]);
    expect((await getEventProgramPublication(organizationId, w.eventId)).latest).toMatchObject({ notifiedAt: null, notifiedCount: null });

    // Un seul destinataire restant : pas d'écran.
    await revokeEventLink(organizationId, w.karim.id);
    await revokeEventLink(organizationId, added.id);
    expect(await notifyProgramVersion({ organizationId, eventId: w.eventId, renderDocument: render })).toEqual({ version: 1, sent: 1, notSent: 0 });
  });

  it("isolation : une autre organisation ne prévient pas les destinataires de cet évènement", async () => {
    const a = await organization();
    const b = await organization();
    const w = await wedding(a.organizationId);
    await publishEventProgram({ organizationId: a.organizationId, eventId: w.eventId, userId: plannerId });
    const { render } = recorder();
    await expect(notifyProgramVersion({ organizationId: b.organizationId, eventId: w.eventId, renderDocument: render })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await listProgramRecipients(b.organizationId, w.eventId)).toEqual([]);
  });
});
