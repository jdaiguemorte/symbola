// Lot 38a (MSG-01, MSG-02, HUB-18 ; décisions D3 à D9 ; ADR 0072) — les e-mails à l'image de
// l'organisation : Paramètres › Modèles d'e-mails (variable inconnue refusée, enregistrement, aperçu à
// ses couleurs, essai envoyé à soi-même, retour au texte de départ, l'autre langue) ; « Prévenir par
// e-mail » une version diffusée du programme, par l'écran du garde-fou ; le rappel arrêté par une
// variable vide, signalé dans « Aujourd'hui ». En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { SYSTEM_ACTOR } from "@symbola/db/actor";
import { recordAudit } from "@symbola/db/audit";
import { createAppConnection } from "@symbola/db/client";
import { addEventVendorSlot, addProgramItem, addVendorCandidate, createEventLink, createProspect, createProspectSource, publishEventProgram } from "../modules/events/service";
import { openSettingsTab, readyOrganization, signIn } from "./helpers";
import { setRelationMailSender } from "../modules/hub/service";

const MAILPIT = "http://localhost:8025/api/v1";
const PROGRAM_ONLY = { rubrics: ["program" as const], budgetScope: "all" as const, sharedSlotIds: [] };

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

type Mail = { Subject: string; Text: string; From: { Name: string }; Attachments: { FileName: string }[] | null };

async function mailTo(to: string, subject: RegExp): Promise<Mail> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string; Subject: string }[] };
    const found = messages.find((message) => subject.test(message.Subject));
    if (found) return (await (await fetch(`${MAILPIT}/message/${found.ID}`)).json()) as Mail;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("e-mail non reçu");
}

// Atelier prêt, sa titulaire, et le mariage de Léa et Maxime : un traiteur, deux séquences diffusées,
// le lien de Léa (rubrique Programme) et celui du traiteur.
async function atelier() {
  const email = `planner-msg-${randomUUID()}@symbola.test`;
  const name = `Atelier ${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, name);
    // Lot 65d (ADR 0110) : ce parcours vérifie l'envoi par Symbola (« Symbola les envoie pour moi »).
    await setRelationMailSender(organization.id, "symbola");
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: "2027-06-12" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
    await addProgramItem(organizationId, event.id, { startTime: "15:00", label: "Cérémonie", location: "Jardin", internalNote: "Alliances chez le témoin", vendorSlotIds: [], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "20:00", label: "Dîner", location: "Orangerie", vendorSlotIds: [caterer.id], freeParticipants: [] });
    const leaEmail = `lea-${randomUUID()}@symbola.test`;
    const karimEmail = `karim-${randomUUID()}@symbola.test`;
    await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa", email: leaEmail, rights: PROGRAM_ONLY } });
    await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "vendor", vendorCandidateId: karim.id, locale: "fr", link: { personName: "Karim", email: karimEmail, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } } });
    await publishEventProgram({ organizationId, eventId: event.id, userId: owner.id });
    return { email, name, organizationId, eventId: event.id, leaEmail, karimEmail };
  } finally {
    await sql.end();
  }
}

test("MSG-01 / HUB-18 — Paramètres › Modèles d'e-mails : variable inconnue refusée, enregistrement, aperçu, essai, texte de départ", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await openSettingsTab(page, "E-mails automatiques : ce que Symbola envoie");
  await expect(page.getByRole("heading", { name: "E-mails automatiques : ce que Symbola envoie", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Liens personnels" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Devis et contrats" })).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Lien d'un client", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lien d'un client (Français)", level: 1 })).toBeVisible();
  const preview = page.getByRole("region", { name: "Aperçu de l'e-mail" });
  await expect(preview).toContainText("Objet : Votre espace pour suivre votre mariage");
  await expect(preview).toContainText(`De : ${setup.name}`);
  await expect(preview).toContainText("Ouvrir mon espace");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // Une variable inconnue est refusée ; le texte saisi reste.
  const form = page.getByRole("form", { name: "Modèles d'e-mails" });
  await form.getByLabel("Objet").fill("Bienvenue chez {{organisation}}");
  const body = "Bonjour {{prénom}},\n\nVotre espace pour {{évènement}} :\n\n{{lien}}\n\nÀ très vite, {{signature}}";
  await form.getByLabel("Texte").fill(body);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByRole("alert")).toContainText("Variable inconnue ou étrangère à ce modèle : {{signature}}.");
  await expect(form.getByLabel("Texte")).toHaveValue(body);

  // Enregistré : l'aperçu suit, le modèle est personnalisé.
  await form.getByLabel("Texte").fill(body.replace(", {{signature}}", ""));
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByRole("status")).toContainText("Modèle enregistré");
  await expect(preview).toContainText(`Objet : Bienvenue chez ${setup.name}`);
  await expect(preview).toContainText("Votre espace pour votre mariage :");

  // L'essai part à la titulaire seulement, marqué « Essai ».
  await form.getByRole("button", { name: "M'envoyer un essai" }).click();
  await expect(form.getByRole("status")).toContainText(`Essai envoyé à ${setup.email}.`);
  const trial = await mailTo(setup.email, /^\[Essai\] /);
  expect(trial.Subject).toBe(`[Essai] Bienvenue chez ${setup.name}`);
  expect(trial.From.Name).toBe(setup.name);
  expect(trial.Text).toContain("Essai : cet e-mail montre votre modèle avec des données fictives.");
  await expectNoAxeViolation(page);

  // Retour au texte de départ, confirmé.
  await page.getByRole("button", { name: "Revenir au texte de départ" }).click();
  const dialog = page.getByRole("dialog", { name: "Revenir au texte de départ ?" });
  await dialog.getByRole("button", { name: "Revenir au texte de départ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Texte de départ rétabli." })).toBeVisible();
  await expect(preview).toContainText("Objet : Votre espace pour suivre votre mariage");
  await expect(form.getByLabel("Objet")).toHaveValue("Votre espace pour suivre {{évènement}}");
  await expect(page.getByRole("button", { name: "Revenir au texte de départ" })).toHaveCount(0);

  // L'autre langue : le modèle anglais, avec son aperçu.
  await page.getByRole("link", { name: "Tous les modèles d'e-mails" }).click();
  await page.getByRole("navigation", { name: "Langue des modèles" }).getByRole("link", { name: "Anglais" }).click();
  // La liste anglaise remplace la française avant le choix du modèle.
  await expect(page.getByRole("navigation", { name: "Langue des modèles" }).getByRole("link", { name: "Anglais" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Lien d'un client", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lien d'un client (Anglais)", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Aperçu de l'e-mail" })).toContainText("Objet : Your space to follow your wedding");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
});

test("MSG-02 — « Prévenir par e-mail » une version diffusée : l'écran du garde-fou, puis chacun reçoit son programme", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const publication = page.getByRole("region", { name: "Diffusion aux clients et aux prestataires" });
  const notify = publication.getByRole("form", { name: "Prévenir par e-mail (version 1)" });
  await expect(notify).toContainText("2 destinataires");
  await notify.getByRole("button", { name: "Prévenir par e-mail (version 1)" }).click();

  // Le nombre, la liste (nom et adresse), puis la confirmation explicite.
  await expect(notify.getByRole("heading", { name: "Cet envoi part à 2 personnes" })).toBeVisible();
  await expect(notify.getByRole("listitem")).toHaveCount(2);
  await expect(notify).toContainText(`Léa — ${setup.leaEmail}`);
  await expect(notify).toContainText(`Karim — ${setup.karimEmail}`);
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  await notify.getByRole("button", { name: "Envoyer à 2 personnes" }).click();
  await expect(publication).toContainText(/Version 1 envoyée par e-mail le .+ à 2 personnes\./);

  const toLea = await mailTo(setup.leaEmail, /^Programme, version 1/);
  expect(toLea.From.Name).toBe(setup.name);
  expect(toLea.Text).toContain("pour votre mariage");
  expect((toLea.Attachments ?? []).map((attachment) => attachment.FileName)).toEqual(["programme-v1.pdf"]);
  const toKarim = await mailTo(setup.karimEmail, /^Programme, version 1/);
  expect(toKarim.Text).toContain("pour le mariage de Léa & Maxime");
  await expectNoAxeViolation(page);
});

test("MSG-01 — un rappel arrêté par une variable vide est signalé dans « Aujourd'hui », avec le chemin vers le modèle", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await atelier();
  const { sql, db } = createAppConnection();
  try {
    await recordAudit(db, { organizationId: setup.organizationId, action: "hub.mail.variable_missing", objectId: setup.eventId, details: { kind: "task_reminder", locale: "fr", missing: "event_date" }, actor: SYSTEM_ACTOR });
  } finally {
    await sql.end();
  }
  await signIn(page, setup.email, /\/$/);
  const banner = page.getByRole("alert").filter({ hasText: "Le rappel automatique d'un évènement ne part pas" });
  await expect(banner).toContainText("une variable du modèle « Rappel des tâches du client » n'a pas de valeur.");
  await expectNoAxeViolation(page);
  await banner.getByRole("link", { name: "Corriger le modèle" }).click();
  await expect(page.getByRole("heading", { name: "Rappel des tâches du client (Français)", level: 1 })).toBeVisible();
});
