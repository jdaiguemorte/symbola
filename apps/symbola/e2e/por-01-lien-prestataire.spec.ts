// Lot 26b (UX-11, POR-01, SEC-14 ; ADR 0053, décisions D6 et D9) — la planner
// crée le lien d'un prestataire retenu, prérempli depuis sa fiche du carnet, et
// demande un code à l'ouverture. Le prestataire ouvre le lien : un code part à
// son e-mail ; un mauvais code est refusé (essais restants), le bon ouvre son
// espace (date, lieux, ses horaires, contact de l'organisation). En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import {
  addEventPlace,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  selectVendorCandidate,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { openEventTab, readyOrganization } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";
const PASSWORD = "mot-de-passe-por01-e2e";

async function loginAndSetupMfa(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Le code est dans l'objet de l'e-mail.
async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    const code = messages.map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("aucun code reçu");
}

// Mariage d'Inès : un traiteur retenu (fiche du carnet), un lieu, une ligne du
// programme pour le traiteur, une pour le photographe.
async function plannerWithRetainedCaterer() {
  const email = `planner-por01-${randomUUID()}@symbola.test`;
  const vendorEmail = `traiteur-por01-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-06-12" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const photographer = await addEventVendorSlot(organizationId, event.id, "Photographe");
    const { vendor } = await createVendor(organizationId, { name: "Saveurs de Karim", typeId: null, contactName: "Karim Benali", email: vendorEmail });
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: vendor.name, vendorId: vendor.id });
    await selectVendorCandidate({ organizationId, candidateId: candidate.id, changedByUserId: user.id });
    await addEventPlace(organizationId, event.id, { label: "Domaine des Tilleuls", address: "1 allée des Tilleuls, Lyon" });
    await addProgramItem(organizationId, event.id, { startTime: "18:00", endTime: "19:30", label: "Cocktail", internalNote: "Prévoir vingt bouteilles de plus", vendorSlotIds: [caterer.id], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "16:00", label: "Photos de groupe", vendorSlotIds: [photographer.id], freeParticipants: [] });
    return { email, vendorEmail, eventId: event.id, organizationName: organization.name };
  } finally {
    await sql.end();
  }
}

test("UX-11 / POR-01 — lien d'un prestataire retenu avec code à l'ouverture : mauvais code refusé, le bon ouvre son seul espace", async ({ page: planner, browser }) => {
  test.setTimeout(120_000);
  const setup = await plannerWithRetainedCaterer();
  await loginAndSetupMfa(planner, setup.email);
  await planner.goto(`/events/${setup.eventId}`);
  await openEventTab(planner, "Mariés");

  // Le formulaire du prestataire est prérempli depuis sa fiche du carnet.
  const form = planner.locator("form").filter({ has: planner.getByRole("heading", { name: "Créer le lien d'un prestataire" }) });
  await expect(form.getByLabel("Prestataire retenu")).toHaveValue(/[0-9a-f-]{36}/);
  await expect(form.getByLabel("Nom de la personne")).toHaveValue("Karim Benali");
  await expect(form.getByLabel("E-mail de la personne")).toHaveValue(setup.vendorEmail);
  await form.getByLabel("Demander un code à l'ouverture").check();
  await form.getByRole("button", { name: "Créer le lien du prestataire et l'envoyer" }).click();
  await expect(planner.getByText(`Lien envoyé à ${setup.vendorEmail}.`)).toBeVisible();
  const url = await planner.getByLabel("Lien personnel de Karim Benali").inputValue();
  const links = planner.getByRole("list", { name: "Liens personnels" });
  await expect(links).toContainText(`Karim Benali — ${setup.vendorEmail} — actif`);
  await expect(links).toContainText("Prestataire Saveurs de Karim — Traiteur : voit la date, les lieux et ses horaires");
  await expect(links).toContainText("code demandé à l'ouverture");
  await expectNoAxeViolation(planner);

  // Le prestataire ouvre son lien : un code part à son e-mail, la session attend.
  const vendorContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const vendor = await vendorContext.newPage();
  await vendor.goto(url);
  await expect(vendor.getByRole("heading", { level: 1 })).toHaveText("Votre code d'accès");
  await expect(vendor.locator("main").getByRole("status")).toContainText("vient de partir à t•••@symbola.test");
  expect(await vendor.evaluate(() => window.location.hash)).toBe("");
  await expectNoAxeViolation(vendor);
  expect((await vendor.request.get("/prestataire", { maxRedirects: 0 })).status()).toBe(307);

  const code = await codeSentTo(setup.vendorEmail);
  await vendor.getByLabel("Code reçu par e-mail").fill(code === "000000" ? "111111" : "000000");
  await vendor.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(vendor.locator("main").getByRole("alert")).toHaveText("Ce code ne correspond pas. Il vous reste 4 essais.");
  await expectNoAxeViolation(vendor);
  await vendor.getByLabel("Code reçu par e-mail").fill(code);
  await vendor.getByRole("button", { name: "Ouvrir mon espace" }).click();

  // Son espace : la date, le lieu, sa ligne du programme sans note interne, le contact.
  await expect(vendor).toHaveURL(/\/prestataire$/);
  await expect(vendor.getByText("Bonjour Karim Benali")).toBeVisible();
  await expect(vendor.getByRole("heading", { level: 1 })).toHaveText("Inès");
  await expect(vendor.getByText("Saveurs de Karim — Traiteur")).toBeVisible();
  await expect(vendor.getByRole("list", { name: "Les lieux" })).toContainText("Domaine des Tilleuls — 1 allée des Tilleuls, Lyon");
  await expect(vendor.getByRole("list", { name: "Vos horaires" })).toContainText("18:00 – 19:30 — Cocktail");
  await expect(vendor.locator("main")).not.toContainText("Photos de groupe");
  await expect(vendor.locator("main")).not.toContainText("bouteilles");
  await expect(vendor.getByRole("region", { name: "Votre contact" })).toContainText(setup.email);
  await expect(vendor.getByRole("region", { name: "Vos données personnelles" })).toContainText(setup.organizationName);
  const headers = (await vendor.request.get("/prestataire")).headers();
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["cache-control"]).toContain("no-store");
  await expectNoAxeViolation(vendor);

  // Fermer l'accès : il faut rouvrir le lien, et un nouveau code.
  await vendor.getByRole("button", { name: "Fermer l'accès sur cet appareil" }).click();
  await expect(vendor.getByRole("heading", { level: 1 })).toHaveText("Accès fermé sur cet appareil");
  await vendor.goto("/prestataire");
  await expect(vendor).toHaveURL(/\/lien$/);
  await vendorContext.close();
});
