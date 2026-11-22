// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) — la signature et la marque des e-mails, contre un vrai
// PostgreSQL (RLS) et un vrai Mailpit, par la porte d'entrée du hub. Tests d'abus (CLAUDE.md § 2.11) :
// une organisation ne lit ni ne modifie la marque ou les signatures d'une autre ; un membre ne modifie
// que sa signature ; la signature part avec l'accès du membre.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { createAppConnection } from "@symbola/db/client";
import { memberSignatures } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import {
  composeOrganizationEmail,
  composePreparedEmailText,
  EmailBrandingInvalidError,
  eraseMemberSignature,
  getEmailBranding,
  getEmailTemplate,
  getMemberSignature,
  memberSignatureText,
  MemberSignatureInvalidError,
  previewEmailTemplate,
  saveDocumentDetails,
  saveEmailBranding,
  saveEmailTemplate,
  saveMemberSignature,
  sendOrganizationEmail,
  setRelationMailSender,
  uploadSignaturePhoto,
} from "./service";
import { upsertOrganizationProfileFields } from "./repository";

const { sql, db } = createAppConnection();
const MAILPIT_API = "http://localhost:8025/api/v1";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const LINK = "https://symbola.test/lien#exemple";

afterAll(async () => {
  await sql.end();
});

type MailpitMessage = { Subject: string; Text: string; HTML: string; From: { Name: string; Address: string }; Inline: { FileName: string; ContentID: string }[] | null };

async function messageTo(to: string): Promise<MailpitMessage | null> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) return (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as MailpitMessage;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

const member = (id: string) => ({ kind: "member" as const, id });
const values = { first_name: "Léa", event: "votre mariage", link: LINK, valid_until: "19 juin 2027" };

// Atelier Lumière : la titulaire Camille, la collaboratrice Inès, une adresse complète.
async function atelier() {
  const tag = randomUUID().slice(0, 8);
  const name = `Atelier Lumière ${tag}`;
  const organizationId = (await createOrganization(db, name)).id;
  await upsertOrganizationProfileFields(db, organizationId, { address: "12 rue des Lilas", postalCode: "69003", city: "Lyon" });
  await saveDocumentDetails(db, organizationId, { siret: null, contactEmail: `contact-${tag}@atelier.test`, contactPhone: null, website: null, vatNumber: null, registration: null, shareCapitalCents: null });
  const camille = await createUser(db, { organizationId, email: `camille-${tag}@atelier.test`, role: "owner" });
  const ines = await createUser(db, { organizationId, email: `ines-${tag}@atelier.test`, role: "member" });
  const accountant = await createUser(db, { organizationId, email: `compta-${tag}@atelier.test`, role: "accountant" });
  await withActor(member(camille.id), () =>
    saveMemberSignature(organizationId, camille.id, { displayName: "Camille Morel", jobTitle: "Wedding planner", phone: "06 12 34 56 78", website: "atelier-lumiere.fr", links: [{ label: "Instagram", url: "instagram.com/atelierlumiere" }] }),
  );
  await withActor(member(ines.id), () => saveMemberSignature(organizationId, ines.id, { displayName: "Inès Durand", jobTitle: "Coordinatrice", phone: null, website: null, links: [] }));
  return { organizationId, name, camille: camille.id, ines: ines.id, accountant: accountant.id };
}

describe("HUB-18 — Signature de chaque membre (lot 66c, D5)", () => {
  it("un membre enregistre sa signature : site et liens reçoivent « https:// », lignes vides ignorées", async () => {
    const { organizationId, camille } = await atelier();
    expect(await getMemberSignature(organizationId, camille)).toMatchObject({
      displayName: "Camille Morel",
      website: "https://atelier-lumiere.fr",
      links: [{ label: "Instagram", url: "https://instagram.com/atelierlumiere" }],
      hasPhoto: false,
    });
  });

  it("refuse un téléphone mal formé, une adresse qui n'est pas web, un lien sans nom, plus de quatre liens", async () => {
    const { organizationId, camille } = await atelier();
    const refused = (input: Partial<Parameters<typeof saveMemberSignature>[2]>) =>
      withActor(member(camille), () => saveMemberSignature(organizationId, camille, { displayName: "Camille", jobTitle: null, phone: null, website: null, links: [], ...input })).catch((error: unknown) => error);
    expect(await refused({ phone: "appelez-moi" })).toMatchObject({ fields: ["phone"] });
    expect(await refused({ website: "javascript:alert(1)" })).toMatchObject({ fields: ["website"] });
    expect(await refused({ links: [{ label: "", url: "https://pinterest.com/x" }] })).toBeInstanceOf(MemberSignatureInvalidError);
    expect(await refused({ links: Array.from({ length: 5 }, (_, index) => ({ label: `Lien ${index}`, url: "https://example.test" })) })).toMatchObject({ fields: ["links"] });
  });

  it("abus : un membre ne modifie pas la signature d'une autre personne, même en appelant le service à sa place (la base refuse)", async () => {
    const { organizationId, camille, ines } = await atelier();
    await expect(withActor(member(ines), () => saveMemberSignature(organizationId, camille, { displayName: "Usurpée", jobTitle: null, phone: null, website: null, links: [] }))).rejects.toThrow();
    expect((await getMemberSignature(organizationId, camille))?.displayName).toBe("Camille Morel");
  });

  it("isolation : une organisation ne lit ni la marque ni les signatures d'une autre", async () => {
    const a = await atelier();
    const b = await atelier();
    await saveEmailBranding(a.organizationId, { font: "serif", footerLine: "Propre à A", senderName: "Camille — A", signatureElements: ["title"], automaticSignerUserId: null });
    expect(await getEmailBranding(b.organizationId)).toMatchObject({ font: "sans", footerLine: null, senderName: null });
    expect(await getMemberSignature(b.organizationId, a.camille)).toBeNull();
    const rows = await withOrganization(db, b.organizationId, (tx) => tx.select().from(memberSignatures).where(eq(memberSignatures.userId, a.camille)));
    expect(rows).toEqual([]);
  });

  it("RGP-05 : la signature part avec l'accès du membre, photo comprise", async () => {
    const { organizationId, ines } = await atelier();
    await withActor(member(ines), () => uploadSignaturePhoto(organizationId, ines, PNG_1PX));
    expect((await getMemberSignature(organizationId, ines))?.hasPhoto).toBe(true);
    expect(await eraseMemberSignature(organizationId, ines)).toBe(true);
    expect(await getMemberSignature(organizationId, ines)).toBeNull();
  });

  it("la photo est contrôlée comme le logo : une image qui n'est ni PNG ni JPEG est refusée", async () => {
    const { organizationId, ines } = await atelier();
    await expect(withActor(member(ines), () => uploadSignaturePhoto(organizationId, ines, Buffer.from("GIF89a-pas-une-photo")))).rejects.toMatchObject({ reason: "unsupported_type" });
  });

  it("la signature des envois automatiques doit être une Planner active de l'organisation, jamais un Comptable ni une personne d'ailleurs", async () => {
    const a = await atelier();
    const b = await atelier();
    const save = (userId: string) => saveEmailBranding(a.organizationId, { font: "sans", footerLine: null, senderName: null, signatureElements: ["title"], automaticSignerUserId: userId }).catch((error: unknown) => error);
    expect(await save(b.ines)).toBeInstanceOf(EmailBrandingInvalidError);
    expect(await save(a.accountant)).toMatchObject({ fields: ["automaticSigner"] });
    expect(await save(a.ines)).toMatchObject({ automaticSignerUserId: a.ines });
  });
});

describe("MSG-01 — Les e-mails de la planner portent sa marque (lot 66c, D5, D6)", () => {
  it("l'e-mail porte la signature de la personne qui l'envoie ; un envoi automatique, celle de la titulaire", async () => {
    const { organizationId, ines } = await atelier();
    const byInes = await withActor(member(ines), () => composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values }));
    expect(byInes.text).toContain("Inès Durand\nCoordinatrice · Atelier Lumière");
    expect(byInes.text).not.toContain("Camille Morel");
    const automatic = await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values });
    expect(automatic.text).toContain("Camille Morel\nWedding planner · Atelier Lumière");
    expect(automatic.text).toContain("06 12 34 56 78 · atelier-lumiere.fr\nInstagram : https://instagram.com/atelierlumiere");
  });

  it("un envoi automatique porte la signature choisie dans le réglage ; une personne retirée retombe sur la titulaire", async () => {
    const { organizationId, ines } = await atelier();
    await saveEmailBranding(organizationId, { font: "sans", footerLine: null, senderName: null, signatureElements: ["title", "organization", "phone", "website", "links", "photo"], automaticSignerUserId: ines });
    expect((await composeOrganizationEmail({ organizationId, kind: "task_reminder", locale: "fr", values: { first_name: "Léa", event: "votre mariage", event_date: "19 juin 2027", tasks: "- Choisir le traiteur" } })).text).toContain("Inès Durand");
    await sql`update hub.memberships set disabled_at = now() where user_id = ${ines} and organization_id = ${organizationId}`;
    expect((await composeOrganizationEmail({ organizationId, kind: "task_reminder", locale: "fr", values: { first_name: "Léa", event: "votre mariage", event_date: "19 juin 2027", tasks: "- Choisir le traiteur" } })).text).toContain("Camille Morel");
  });

  it("une personne sans signature n'en met aucune, jamais celle d'une autre", async () => {
    const { organizationId, accountant } = await atelier();
    const planner = await createUser(db, { organizationId, email: `nora-${randomUUID()}@atelier.test`, role: "member" });
    const mail = await withActor(member(planner.id), () => composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values }));
    expect(mail.layout.signature).toBeNull();
    expect(mail.text).not.toContain("Camille Morel");
    expect(accountant).toBeTruthy();
  });

  it("l'organisation choisit les éléments affichés de toutes les signatures", async () => {
    const { organizationId } = await atelier();
    await saveEmailBranding(organizationId, { font: "sans", footerLine: null, senderName: null, signatureElements: ["title"], automaticSignerUserId: null });
    const mail = await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values });
    expect(mail.layout.signature).toEqual({ name: "Camille Morel", lines: ["Wedding planner"], links: [], photoCid: null });
  });

  it("D6 : ni « Envoyé avec Symbola » ni « Ouvrir Symbola » dans un e-mail de la planner ; les avis de Symbola à l'équipe gardent sa marque, sans signature", async () => {
    const { organizationId } = await atelier();
    const client = await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values });
    expect(client.html).not.toContain("Envoyé avec Symbola");
    expect(client.html).not.toContain("Ouvrir Symbola");
    const notice = await composeOrganizationEmail({ organizationId, kind: "notification_alert", locale: "fr", values: { alert: "Un devis a été signé.", link: LINK } });
    expect(notice.html).toContain("Envoyé avec Symbola");
    expect(notice.layout.signature).toBeNull();
  });

  it("pied complet (adresse, code postal et ville, ligne libre), police choisie, nom affiché de l'expéditeur réglable", async () => {
    const { organizationId, name } = await atelier();
    expect((await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values })).fromName).toBe(name);
    await saveEmailBranding(organizationId, { font: "elegant", footerLine: "Wedding planner à Lyon depuis 2015", senderName: "Camille — Atelier Lumière", signatureElements: ["title"], automaticSignerUserId: null });
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "fr", values });
    const message = await messageTo(to);
    expect(message!.From.Name).toBe("Camille — Atelier Lumière");
    expect(message!.From.Address).not.toContain("atelier.test");
    expect(message!.HTML).toContain("12 rue des Lilas, 69003 Lyon");
    expect(message!.HTML).toContain("Wedding planner à Lyon depuis 2015");
    expect(message!.HTML).toContain("font-family:'Palatino Linotype', Palatino");
    expect(message!.Text).toContain("Camille Morel");
  });

  it("la photo de la signature part jointe en ligne, à côté du logo", async () => {
    const { organizationId, camille } = await atelier();
    await withActor(member(camille), () => uploadSignaturePhoto(organizationId, camille, PNG_1PX));
    const to = `lea-${randomUUID()}@example.test`;
    await sendOrganizationEmail({ organizationId, to, kind: "client_link", locale: "fr", values });
    const message = await messageTo(to);
    expect((message!.Inline ?? []).map((part) => part.ContentID)).toEqual(["signature@symbola"]);
    expect(message!.HTML).toContain('src="cid:signature@symbola"');
  });

  it("le libellé du bouton se modifie avec le texte du modèle ; vide, il revient à celui de départ", async () => {
    const { organizationId } = await atelier();
    await saveEmailTemplate({ organizationId, kind: "client_link", locale: "fr", subject: "Votre espace", body: "Bonjour {{prénom}},\n\n{{lien}}", buttonLabel: "  Voir   votre espace " });
    expect((await getEmailTemplate(organizationId, "client_link", "fr")).buttonLabel).toBe("Voir votre espace");
    const mail = await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values });
    expect(mail.html).toContain(">Voir votre espace</a>");
    expect(mail.text).toContain("Voir votre espace\nhttps://symbola.test/lien#exemple");
    // Aperçu d'un texte pas encore enregistré, sans libellé : celui du modèle enregistré reste.
    const preview = await previewEmailTemplate({ organizationId, kind: "client_link", locale: "fr", template: { subject: "Votre espace", body: "{{lien}}" } });
    expect(preview.layout.blocks.find((block) => block.kind === "button")).toMatchObject({ label: "Voir votre espace" });
    await saveEmailTemplate({ organizationId, kind: "client_link", locale: "fr", subject: "Votre espace", body: "{{lien}}", buttonLabel: "" });
    expect((await composeOrganizationEmail({ organizationId, kind: "client_link", locale: "fr", values })).html).toContain(">Ouvrir mon espace</a>");
  });

  it("un modèle des invités se modifie et sert à l'invitation", async () => {
    const { organizationId } = await atelier();
    await saveEmailTemplate({ organizationId, kind: "guest_invitation", locale: "fr", subject: "Serez-vous des nôtres, {{prénom}} ?", body: "{{lien}}", buttonLabel: "Je réponds" });
    const mail = await composeOrganizationEmail({ organizationId, kind: "guest_invitation", locale: "fr", values: { first_name: "Paul", link: LINK } });
    expect(mail.subject).toBe("Serez-vous des nôtres, Paul ?");
    expect(mail.html).toContain(">Je réponds</a>");
  });

  it("un message préparé reste sans signature ; « Ajouter ma signature » reprend celle de la personne connectée, en texte", async () => {
    const { organizationId, name, ines } = await atelier();
    await setRelationMailSender(organizationId, "planner");
    const prepared = await withActor(member(ines), () => composePreparedEmailText({ organizationId, kind: "proposal_sent", locale: "fr", values: { first_name: "Léa", quote_number: "D-2027-0042", valid_until: "19 juin 2027" } }));
    expect(prepared.body).not.toContain("Inès Durand");
    expect(await memberSignatureText({ organizationId, organizationName: name, userId: ines, locale: "fr" })).toBe(`Inès Durand\nCoordinatrice · ${name}`);
    expect(await memberSignatureText({ organizationId, organizationName: name, userId: randomUUID(), locale: "fr" })).toBeNull();
  });
});
