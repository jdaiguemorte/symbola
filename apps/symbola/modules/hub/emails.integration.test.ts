// Lot 38a (MSG-01, HUB-18 ; D2 à D7 ; ADR 0072) — les e-mails à l'image de l'organisation, contre un
// vrai PostgreSQL (RLS) et un vrai Mailpit, par la porte d'entrée du hub. Tests d'abus (CLAUDE.md
// § 2.11) : le modèle d'une organisation ne sert jamais à une autre ; l'essai ne part qu'à la
// personne connectée de l'organisation.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { organizationMailQuota } from "@symbola/mail";
import { starterDocumentStyle, starterEmailTemplate } from "@symbola/starter-templates";
import { documentAppearance } from "@/lib/documents/appearance";
import { updateDocumentSettings } from "@/modules/quotes/service";
import {
  EmailTemplateInvalidError,
  EmailVariableMissingError,
  getEmailTemplate,
  listEmailTemplates,
  resetEmailTemplate,
  saveDocumentDetails,
  saveEmailTemplate,
  saveOnboardingStep,
  sendOrganizationEmail,
  sendTestEmail,
  uploadOrganizationLogo,
} from "./service";

const { sql, db } = createAppConnection();
const MAILPIT_API = "http://localhost:8025/api/v1";
// Image PNG 1 × 1 : le plus petit logo valide.
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const LINK = "https://symbola.test/lien#exemple";

afterAll(async () => {
  await sql.end();
});

type MailpitMessage = {
  Subject: string;
  Text: string;
  HTML: string;
  From: { Name: string; Address: string };
  ReplyTo: { Address: string }[];
  Inline: { FileName: string; ContentID: string }[] | null;
  Attachments: { FileName: string; ContentType: string }[] | null;
};

async function messagesTo(to: string, expected = 1): Promise<MailpitMessage[]> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length >= expected) {
      return Promise.all(messages.map(async (message) => (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as MailpitMessage));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

async function noMessageTo(to: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
  return ((await response.json()) as { messages: unknown[] }).messages.length === 0;
}

// Atelier Camille R. : adresse, coordonnées de contact et site, sans logo ni couleur au départ.
async function atelier() {
  const tag = randomUUID().slice(0, 8);
  const name = `Atelier Camille R. ${tag}`;
  const organizationId = (await createOrganization(db, name)).id;
  await saveOnboardingStep(db, organizationId, { address: "12 rue des Lilas, 69002 Lyon" });
  const contactEmail = `contact-${tag}@atelier.test`;
  await saveDocumentDetails(db, organizationId, { siret: null, contactEmail, contactPhone: "04 78 00 00 00", website: "https://atelier.test", vatNumber: null, registration: null, shareCapitalCents: null });
  return { organizationId, name, contactEmail, tag };
}

function clientLinkValues() {
  return { first_name: "Léa", event: "votre mariage", link: LINK, valid_until: "19 juin 2027" };
}

describe("MSG-01 — E-mails transactionnels à variables, aux couleurs de l'organisation", () => {
  it("un e-mail de service part du modèle de l'organisation, en HTML et en texte, à son nom, les réponses vers son adresse de contact", async () => {
    const { organizationId, name, contactEmail } = await atelier();
    await saveEmailTemplate({ organizationId, kind: "client_link", locale: "fr", subject: "Votre espace chez {{organisation}}", body: "Bonjour {{prénom}},\n\nVoici votre espace pour {{évènement}} :\n\n{{lien}}\n\nÀ bientôt" });
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "fr", values: clientLinkValues() });

    const [message] = await messagesTo(to);
    expect(message!.Subject).toBe(`Votre espace chez ${name}`);
    expect(message!.From.Name).toBe(name);
    expect(message!.From.Address).not.toBe(contactEmail);
    expect(message!.ReplyTo.map((entry) => entry.Address)).toEqual([contactEmail]);
    expect(message!.Text).toContain("Bonjour Léa,");
    expect(message!.Text).toContain("Voici votre espace pour votre mariage :");
    expect(message!.Text).toContain(LINK);
    expect(message!.HTML).toContain("Ouvrir mon espace");
    expect(message!.HTML).toContain(`href="${LINK}"`);
    for (const line of [name, "12 rue des Lilas, 69002 Lyon", contactEmail, "04 78 00 00 00", "https://atelier.test", "Envoyé avec Symbola"]) expect(message!.HTML).toContain(line);
  });

  it("sans modèle réécrit, l'e-mail part du texte de départ, dans la langue demandée", async () => {
    const { organizationId, name } = await atelier();
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "en", values: { ...clientLinkValues(), event: "your wedding", valid_until: "June 19, 2027" } });
    const [message] = await messagesTo(to);
    expect(message!.Subject).toBe(starterEmailTemplate("client_link", "en").subject.replace("{{event}}", "your wedding").replace("{{organization}}", name));
    expect(message!.HTML).toContain("Open my space");
  });

  it("une variable sans valeur arrête l'envoi avant le plafond d'envois et nomme la variable telle qu'écrite dans le modèle", async () => {
    const { organizationId } = await atelier();
    await saveEmailTemplate({ organizationId, kind: "vendor_link", locale: "fr", subject: "Le {{date_évènement}}", body: "Bonjour {{prénom}},\n\n{{lien}}" });
    const before = (await organizationMailQuota(organizationId)).sent;
    const to = `karim-${randomUUID()}@example.test`;
    const error = await sendOrganizationEmail({ organizationId, to, kind: "vendor_link", locale: "fr", values: { first_name: "Karim", link: LINK, event_date: "  " } }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailVariableMissingError);
    expect(error).toMatchObject({ missing: ["event_date"], tokens: ["{{date_évènement}}"], kind: "vendor_link" });
    expect((await organizationMailQuota(organizationId)).sent).toBe(before);
    expect(await noMessageTo(to)).toBe(true);
  });

  it("à l'enregistrement, une variable inconnue ou étrangère au modèle est refusée, et le lien d'un e-mail de lien ne peut pas manquer", async () => {
    const { organizationId } = await atelier();
    const refused = (body: string) => saveEmailTemplate({ organizationId, kind: "client_link", locale: "fr", subject: "Bonjour", body }).catch((caught: unknown) => caught);
    expect(await refused("Bonjour {{inconnue}}, {{lien}}")).toMatchObject({ problems: { unknown: ["inconnue"] } });
    expect(await refused("Vos {{tâches}} : {{lien}}")).toMatchObject({ problems: { unknown: ["tâches"] } });
    const missingLink = await refused("Bonjour {{prénom}}");
    expect(missingLink).toBeInstanceOf(EmailTemplateInvalidError);
    expect(missingLink).toMatchObject({ problems: { missingRequired: ["link"] } });
    expect((await getEmailTemplate(organizationId, "client_link", "fr")).customized).toBe(false);
  });

  it("« Revenir au texte de départ » efface le modèle réécrit de cette langue seulement", async () => {
    const { organizationId } = await atelier();
    await saveEmailTemplate({ organizationId, kind: "task_reminder", locale: "fr", subject: "Vos tâches", body: "Bonjour,\n\n{{tâches}}" });
    await saveEmailTemplate({ organizationId, kind: "task_reminder", locale: "en", subject: "Your tasks", body: "Hello,\n\n{{tasks}}" });
    expect(await resetEmailTemplate(organizationId, "task_reminder", "fr")).toMatchObject({ customized: false, ...starterEmailTemplate("task_reminder", "fr") });
    expect(await getEmailTemplate(organizationId, "task_reminder", "en")).toMatchObject({ customized: true, subject: "Your tasks" });
  });

  it("l'essai part à la personne connectée seulement, marqué « Essai », avec des données fictives, et compte dans le plafond d'envois", async () => {
    const { organizationId } = await atelier();
    const plannerEmail = `camille-${randomUUID()}@example.test`;
    const planner = await createUser(db, { organizationId, email: plannerEmail, role: "owner" });
    const before = (await organizationMailQuota(organizationId)).sent;
    expect(await sendTestEmail({ organizationId, userId: planner.id, kind: "quote_signature", locale: "fr" })).toEqual({ to: plannerEmail });
    const [message] = await messagesTo(plannerEmail);
    expect(message!.Subject.startsWith("[Essai] ")).toBe(true);
    expect(message!.Text).toContain("Essai");
    expect(message!.Text).toContain("D-2027-0042");
    expect((await organizationMailQuota(organizationId)).sent).toBe(before + 1);
  });

  it("isolation : l'essai ne part pas à un compte d'une autre organisation ; le modèle de A ne sert pas à B", async () => {
    const a = await atelier();
    const b = await atelier();
    const outsider = await createUser(db, { organizationId: b.organizationId, email: `autre-${randomUUID()}@example.test`, role: "owner" });
    await expect(sendTestEmail({ organizationId: a.organizationId, userId: outsider.id, kind: "client_link", locale: "fr" })).rejects.toThrow();
    await saveEmailTemplate({ organizationId: a.organizationId, kind: "client_link", locale: "fr", subject: "Propre à A", body: "{{lien}}" });
    expect((await listEmailTemplates(b.organizationId, "fr")).every((template) => !template.customized)).toBe(true);
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId: b.organizationId, to, kind: "client_link", locale: "fr", values: clientLinkValues() });
    const [message] = await messagesTo(to);
    expect(message!.Subject).not.toContain("Propre à A");
    expect(message!.From.Name).toBe(b.name);
  });
});

describe("HUB-18 — Personnalisation de la marque dans les e-mails", () => {
  it("le logo part joint en ligne et la couleur des documents colore le bandeau et le bouton", async () => {
    const { organizationId, name } = await atelier();
    await uploadOrganizationLogo(db, organizationId, PNG_1PX);
    await updateDocumentSettings(organizationId, { color: "#a8553a", font: "modern", iban: null, bic: null, quoteIntro: null, quoteTerms: null, invoiceIntro: null, invoiceTerms: null, footer: null });
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "fr", values: clientLinkValues() });
    const [message] = await messagesTo(to);
    expect((message!.Inline ?? []).map((part) => part.ContentID)).toEqual(["logo@symbola"]);
    expect(message!.HTML).toContain('src="cid:logo@symbola"');
    expect(message!.HTML).toContain(`alt="${name}"`);
    const accent = documentAppearance("#a8553a", null, starterDocumentStyle("fr").defaultColor).accent;
    expect(message!.HTML).toContain(`border-top:4px solid ${accent}`);
    expect(message!.HTML).toContain(`background:${accent}`);
  });

  it("sans logo, le nom de l'organisation en tête ; sans couleur, le graphite des documents", async () => {
    const { organizationId, name } = await atelier();
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "fr", values: clientLinkValues() });
    const [message] = await messagesTo(to);
    expect(message!.Inline ?? []).toEqual([]);
    expect(message!.HTML).not.toContain("<img");
    const graphite = documentAppearance(null, null, starterDocumentStyle("fr").defaultColor).accent;
    expect(message!.HTML).toContain(`font-weight:600;color:${graphite}">${name}</span>`);
  });
});
