// Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; ADR 0085) — SC-05 « Trois fleuristes, un choix » :
// la planner envoie un brief à trois fleuristes (écran de contrôle, un e-mail chacun) ; Élodie ouvre
// le bouton « Je suis disponible » de son e-mail, confirme d'un toucher et joint la photo de son
// devis, en moins de deux minutes, sans compte ; elle ne voit aucun autre fleuriste. Le comparatif
// et deux scénarios côte à côte ; puis Léa donne son avis et choisit sur son portail, ce qui engage,
// et la planner annule. En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventVendorSlot,
  addVendorCandidate,
  answerVendorBrief,
  createEventLink,
  createProspect,
  createProspectSource,
  createVendorScenario,
  listEventLinks,
  listVendorCandidates,
  requestDecision,
  setVendorScenarioChoice,
  updateVendorCandidate,
} from "../modules/events/service";
import { setRelationMailSender } from "../modules/hub/service";
import { readyOrganization, signIn } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Le bouton « Je suis disponible » de l'e-mail du brief.
async function availableButtonSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const message = (await (await fetch(`${MAILPIT_API}/message/${messages[0].ID}`)).json()) as { Text: string };
      const url = /(https?:\/\/\S+\/lien\?reponse=oui#\S+)/.exec(message.Text)?.[1];
      if (url) return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("aucun brief reçu");
}

async function wedding() {
  const email = `planner-pre03-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const organizationId = organization.id;
    // Lot 65d (ADR 0110) : ce parcours lit les boutons de l'e-mail du brief, envoyé par Symbola
    // (« Symbola les envoie pour moi ») ; le réglage par défaut est rejoué par lot-65d-preparer-email.spec.ts.
    await setRelationMailSender(organizationId, "symbola");
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: "2027-06-12" });
    const flowers = await addEventVendorSlot(organizationId, event.id, "Fleurs");
    const photo = await addEventVendorSlot(organizationId, event.id, "Photographe");
    const elodie = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: flowers.id, vendorName: "Atelier Élodie" });
    const pivoine = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: flowers.id, vendorName: "Pivoine & Cie" });
    const silence = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: flowers.id, vendorName: "Fleurs du Silence" });
    const studio = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
    return { email, userId: user.id, organizationId, organizationName: organization.name, eventId: event.id, flowersId: flowers.id, photoId: photo.id, elodieId: elodie.id, pivoineId: pivoine.id, silenceId: silence.id, studioId: studio.id };
  } finally {
    await sql.end();
  }
}

test("SC-05 / PRE-03 / PRE-04 — brief à trois fleuristes, Élodie répond « disponible » et joint la photo de son devis en moins de deux minutes, sans voir les autres", async ({ page: planner, browser }) => {
  test.setTimeout(180_000);
  const setup = await wedding();
  const mail = (name: string) => `${name}-${randomUUID()}@symbola.test`;
  const emails = { elodie: mail("elodie"), pivoine: mail("pivoine"), silence: mail("silence") };
  await signIn(planner, setup.email);

  // 1. Le brief du poste, puis les destinataires, l'écran de contrôle et l'envoi.
  await planner.goto(`/events/${setup.eventId}/consultation/${setup.flowersId}`);
  await expect(planner.getByRole("heading", { level: 1 })).toHaveText("Demander des devis : Fleurs");
  await planner.getByLabel("Le besoin").fill("Arche fleurie et douze centres de table, tons pastel.");
  await planner.getByLabel("Nombre d'invités (facultatif)").fill("120");
  await planner.getByRole("button", { name: "Enregistrer le brief" }).click();
  await expect(planner.getByText("Brief enregistré.")).toBeVisible();
  await expectNoAxeViolation(planner);
  await planner.reload();
  await planner.getByLabel("E-mail de Atelier Élodie").fill(emails.elodie);
  await planner.getByLabel("E-mail de Pivoine & Cie").fill(emails.pivoine);
  await planner.getByLabel("E-mail de Fleurs du Silence").fill(emails.silence);
  await planner.getByRole("button", { name: "Vérifier les destinataires" }).click();
  await expect(planner.getByRole("heading", { name: "Le brief part à 3 prestataires" })).toBeVisible();
  await expectNoAxeViolation(planner);
  await planner.getByRole("button", { name: "Envoyer aux 3 prestataires" }).click();
  await expect(planner.getByText("Brief envoyé à 3 prestataires.")).toBeVisible();

  // 2. Élodie, sur son téléphone : le bouton de l'e-mail présélectionne, un toucher confirme.
  const vendorContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const vendor = await vendorContext.newPage();
  const started = Date.now();
  await vendor.goto(await availableButtonSentTo(emails.elodie));
  await expect(vendor).toHaveURL(/\/prestataire\?reponse=oui$/);
  await expect(vendor.getByRole("heading", { level: 1 })).toHaveText("Demande de devis : Fleurs");
  await expect(vendor.getByText("Arche fleurie et douze centres de table, tons pastel.")).toBeVisible();
  await expect(vendor.getByText("Vous avez choisi « disponible » dans l'e-mail : confirmez d'un toucher.")).toBeVisible();
  await expectNoAxeViolation(vendor);
  // Une action principale par écran.
  await expect(vendor.locator("main button.primary")).toHaveCount(1);
  await vendor.getByRole("button", { name: "Confirmer : je suis disponible" }).click();
  await expect(vendor.getByRole("heading", { name: "Votre devis" })).toBeVisible();
  await expectNoAxeViolation(vendor);
  await vendor.getByLabel("Photo ou PDF du devis").setInputFiles({ name: "devis.png", mimeType: "image/png", buffer: PNG });
  await vendor.getByLabel("Montant TTC (facultatif)").fill("2 850");
  await vendor.getByRole("button", { name: "Envoyer mon devis" }).click();
  await expect(vendor.getByText("Merci, votre devis est transmis.")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(120_000);
  // Aucun fleuriste ne voit les autres.
  for (const other of ["Pivoine", "Silence", "Studio"]) await expect(vendor.locator("main")).not.toContainText(other);
  await expectNoAxeViolation(vendor);
  await vendorContext.close();

  // 3. Un fleuriste répond « indisponible » ; la planner lit le comparatif.
  const links = await listEventLinks(setup.organizationId, setup.eventId);
  const pivoineLink = links.find((link) => link.vendorCandidateId === setup.pivoineId)!;
  await answerVendorBrief({ organizationId: setup.organizationId, linkId: pivoineLink.id, availability: "unavailable" });
  await planner.reload();
  const narrow = (planner.viewportSize()?.width ?? 1280) < 640;
  const comparison = narrow ? planner.getByRole("list", { name: "Réponses des prestataires pour Fleurs" }) : planner.getByRole("table", { name: "Réponses des prestataires pour Fleurs" });
  await expect(comparison).toContainText("Atelier Élodie");
  await expect(comparison).toContainText("2 850,00");
  await expect(comparison).toContainText("Indisponible");
  await expectNoAxeViolation(planner);

  // 4. BUD-05 : deux scénarios côte à côte, totaux au centime.
  await updateVendorCandidate({ organizationId: setup.organizationId, candidateId: setup.studioId, quoteAmountCents: 180_050 });
  const generous = await createVendorScenario(setup.organizationId, setup.eventId, "Généreux");
  const sober = await createVendorScenario(setup.organizationId, setup.eventId, "Sobre");
  await setVendorScenarioChoice(setup.organizationId, generous.id, setup.flowersId, setup.elodieId);
  await setVendorScenarioChoice(setup.organizationId, generous.id, setup.photoId, setup.studioId);
  await setVendorScenarioChoice(setup.organizationId, sober.id, setup.flowersId, setup.silenceId);
  await planner.goto(`/events/${setup.eventId}/scenarios`);
  const sideBySide = planner.getByRole("table", { name: "Deux scénarios côte à côte" });
  await expect(sideBySide.getByRole("columnheader")).toHaveText(["Poste", "Généreux", "Sobre"]);
  await expect(sideBySide.getByRole("row", { name: /Total TTC/ })).toContainText("4 650,50");
  await expect(sideBySide.getByRole("row", { name: /Total TTC/ })).toContainText("1 devis à préciser");
  await expectNoAxeViolation(planner);
});

test("PRE-09 / PAR-05 — Léa donne son avis et choisit : le fleuriste est retenu, les autres écartés, les tâches créées ; la planner modifie le retenu", async ({ page: planner, browser }) => {
  test.setTimeout(150_000);
  const setup = await wedding();
  await updateVendorCandidate({ organizationId: setup.organizationId, candidateId: setup.elodieId, quoteAmountCents: 285_000, shownToClients: true });
  await updateVendorCandidate({ organizationId: setup.organizationId, candidateId: setup.pivoineId, quoteAmountCents: 199_000, shownToClients: true });
  await requestDecision({ organizationId: setup.organizationId, eventId: setup.eventId, requestedByUserId: setup.userId, kind: "option", slotId: setup.flowersId });
  const delivery = await createEventLink({
    organizationId: setup.organizationId,
    eventId: setup.eventId,
    createdByUserId: setup.userId,
    audience: "client",
    locale: "fr",
    link: { personName: "Léa", email: `lea-${randomUUID()}@symbola.test`, rights: { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] } },
  });

  // Léa, sur son portail : la sélection seulement, son avis, puis son choix.
  const clientContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const client = await clientContext.newPage();
  await client.goto(delivery.url);
  await expect(client).toHaveURL(/\/portail/);
  await expect(client.locator("main")).not.toContainText("Fleurs du Silence");
  const feedback = client.locator("form").filter({ has: client.getByRole("group", { name: "Votre avis sur Atelier Élodie" }) });
  await feedback.getByLabel("J'aime").check();
  await feedback.getByLabel("Un mot sur Atelier Élodie (facultatif)").fill("Superbe arche");
  await feedback.getByRole("button", { name: "Enregistrer mon avis sur Atelier Élodie" }).click();
  await expect(feedback.getByText("Avis enregistré.")).toBeVisible();
  await expect(client.getByText(`Votre choix est transmis à ${setup.organizationName} ; le contrat se signe directement avec le prestataire.`)).toBeVisible();
  await expectNoAxeViolation(client);
  await client.getByRole("radio", { name: /Atelier Élodie/ }).check();
  await client.locator("form.decision-form button[value=approved]").click();
  await expect(client.getByRole("list", { name: "Vos décisions" })).toContainText("Atelier Élodie");
  await clientContext.close();

  // Le choix engage : retenu, autres écartés.
  const candidates = await listVendorCandidates(setup.organizationId, setup.eventId);
  expect(candidates.find((candidate) => candidate.id === setup.elodieId)!.status).toBe("retained");
  expect(candidates.find((candidate) => candidate.id === setup.pivoineId)!.status).toBe("dismissed");

  // La planner voit le choix, puis modifie le prestataire retenu (à tout moment) : personne.
  await signIn(planner, setup.email);
  await planner.goto(`/events/${setup.eventId}/consultation/${setup.flowersId}`);
  const retained = planner.getByRole("region", { name: "Le prestataire retenu" });
  await expect(retained).toContainText("Léa a choisi Atelier Élodie");
  await expect(retained).toContainText("Retenu : Atelier Élodie");
  await expectNoAxeViolation(planner);
  await retained.getByLabel("Prestataire retenu").selectOption({ label: "Personne" });
  await retained.getByRole("button", { name: "Modifier le prestataire retenu" }).click();
  await expect(retained).toContainText("Aucun prestataire retenu pour ce poste.");
  const after = await listVendorCandidates(setup.organizationId, setup.eventId);
  expect(after.find((candidate) => candidate.id === setup.elodieId)!.status).toBe("quote_received");
  expect(after.find((candidate) => candidate.id === setup.pivoineId)!.status).toBe("quote_received");
});
