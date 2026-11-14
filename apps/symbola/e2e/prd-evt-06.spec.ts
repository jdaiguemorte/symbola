// PRD-EVT-06, lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17, RGP-03 ;
// ADR 0053) — les mariés n'ont plus de compte : la planner crée leur lien
// personnel, ils l'ouvrent sans inscription, voient le rétroplanning et le
// programme sans notes internes, cochent leur tâche (au fil d'activité de la
// planner) ; le jeton quitte l'adresse, les pages ne sont pas indexées, la
// mention d'information est affichée. Le payeur ne voit que ses catégories ;
// un lien expiré propose d'en demander un nouveau. En taille ordinateur et en
// 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots, createEventLink, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { updateBudgetLine } from "../modules/budget/service";
import { openEventTab, readyOrganization, signIn as signInByLink } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";
const PASSWORD = "mot-de-passe-evt06-e2e";

async function loginAndSetupMfa(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function mailTo(to: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const detail = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      return ((await detail.json()) as { Text: string }).Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`aucun e-mail reçu pour ${to}`);
}

async function plannerOrganization() {
  const email = `planner-evt06-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    return { organizationId: organization.id, organizationName: organization.name, userId: user.id, email };
  } finally {
    await sql.end();
  }
}

test("PRD-EVT-06 / UX-11 / SEC-17 — le marié ouvre son lien sans inscription, suit son mariage, coche sa tâche ; la planner retire le lien", async ({
  page: planner,
  browser,
}) => {
  test.setTimeout(120_000);
  const organization = await plannerOrganization();
  await loginAndSetupMfa(planner, organization.email);

  // La planner prépare l'événement : une tâche des mariés, une note interne.
  await planner.goto("/events/parametres/sources");
  await planner.getByLabel("Nouvelle source").fill("Salon");
  await planner.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(planner.getByText("Source ajoutée.")).toBeVisible();
  await planner.goto("/events/new");
  await planner.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await planner.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await planner.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(planner).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const eventId = planner.url().split("/").pop()!;
  await planner.waitForLoadState("networkidle");

  await openEventTab(planner, "Rétroplanning");
  const newTask = planner.getByRole("group", { name: "Nouvelle tâche" });
  await newTask.getByLabel("Intitulé de la tâche").fill("Choisir les alliances");
  await newTask.getByLabel("Échéance").fill("2027-03-10");
  await newTask.getByLabel("Responsable").selectOption("clients");
  await newTask.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(planner.getByText("Tâche ajoutée.")).toBeVisible();

  await openEventTab(planner, "Programme du jour J");
  const newLine = planner.getByRole("group", { name: "Nouvelle ligne du programme" });
  await newLine.getByLabel("Heure de début").fill("15:00");
  await newLine.getByLabel("Intitulé de la ligne").fill("Cérémonie");
  await newLine.getByLabel("Note interne").fill("Le témoin oublie toujours les alliances");
  await newLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(planner.getByText("Ligne ajoutée.")).toBeVisible();

  // Le lien personnel d'Inès, profil « Marié(e) » ; montré une seule fois.
  const coupleEmail = `marie-evt06-${randomUUID()}@symbola.test`;
  await openEventTab(planner, "Mariés");
  await planner.getByLabel("Personne", { exact: true }).selectOption({ label: "Inès" });
  await expect(planner.getByLabel("Nom de la personne")).toHaveValue("Inès");
  await planner.getByLabel("E-mail de la personne").fill(coupleEmail);
  await planner.getByRole("button", { name: "Créer le lien et l'envoyer" }).click();
  await expect(planner.getByText(`Lien envoyé à ${coupleEmail}.`)).toBeVisible();
  const coupleUrl = await planner.getByLabel("Lien personnel de Inès").inputValue();
  const secret = coupleUrl.split(".").pop()!;
  await expect(planner.getByRole("list", { name: "Liens personnels" })).toContainText(`Inès — ${coupleEmail} — actif`);
  await expectNoAxeViolation(planner);
  // L'e-mail porte le lien, sans mot de passe ni compte à créer.
  const mail = await mailTo(coupleEmail);
  expect(mail).toContain(coupleUrl);
  expect(mail).toContain("sans compte ni mot de passe");

  // Inès ouvre son lien : le jeton quitte l'adresse et l'historique de l'onglet.
  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(coupleUrl);
  await expect(couple).toHaveURL(/\/portail$/);
  expect(couple.url()).not.toContain(secret);
  expect(await couple.evaluate(() => window.location.hash)).toBe("");
  await couple.goBack().catch(() => null);
  expect(couple.url()).not.toContain(secret);
  await couple.goto("/portail");

  // SEC-17 : ni indexation, ni référent, ni cache.
  const headers = (await couple.request.get("/portail")).headers();
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["cache-control"]).toContain("no-store");
  await expect(couple.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // Ce qu'elle voit : rétroplanning, programme sans note interne, mention d'information.
  await expect(couple.getByText("Bonjour Inès")).toBeVisible();
  await expect(couple.getByRole("heading", { level: 1 })).toHaveText("Inès");
  // Lot 27a : la tâche figure aussi dans les trois prochaines actions de l'accueil.
  const retroplanning = couple.getByRole("region", { name: "Rétroplanning" });
  await expect(retroplanning.getByRole("listitem").filter({ hasText: "Choisir les alliances" })).toContainText("À faire par vous");
  await expect(couple.getByRole("list", { name: "Programme du jour J" })).toContainText("15:00 — Cérémonie");
  await expect(couple.getByText("oublie toujours")).toHaveCount(0);
  await expect(couple.getByRole("region", { name: "Vos données personnelles" })).toContainText(organization.organizationName);
  await expectNoAxeViolation(couple);
  await retroplanning.getByRole("button", { name: "Cocher la tâche Choisir les alliances" }).click();
  await expect(retroplanning.getByRole("button", { name: "Décocher la tâche Choisir les alliances" })).toBeVisible();
  const pdf = await couple.request.get("/portail/programme/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain("programme-maries.pdf");

  // Les écrans et exports de la planner lui sont fermés : elle n'a pas de compte.
  await couple.goto(`/events/${eventId}`);
  await expect(couple).toHaveURL(/\/login$/);
  expect((await couple.request.get(`/events/${eventId}/programme/pdf?variant=vendors`)).status()).toBe(401);

  // La planner voit la coche au nom d'Inès, puis retire son lien.
  await planner.reload();
  await openEventTab(planner, "Synthèse");
  await expect(planner.getByRole("list", { name: "Fil d'activité" })).toContainText("Inès a coché « Choisir les alliances ».");
  await openEventTab(planner, "Mariés");
  await planner.getByText("Retirer le lien de Inès").click();
  await planner.getByRole("button", { name: "Retirer : Inès perdra aussitôt l'accès" }).click();
  await expect(planner.getByRole("list", { name: "Liens personnels" })).toContainText(`Inès — ${coupleEmail} — retiré`);
  await expectNoAxeViolation(planner);

  await couple.goto("/portail");
  await expect(couple).toHaveURL(/\/lien$/);
  await expect(couple.getByRole("heading", { level: 1 })).toHaveText("Ce lien n'est plus valable");
  await expect(couple.locator("main")).not.toContainText("Choisir les alliances");
  await coupleContext.close();
});

test("POR-01 / POR-10 — le parent payeur ne voit que les catégories qu'on lui a ouvertes, sans total ni rétroplanning", async ({ page }) => {
  const organization = await plannerOrganization();
  await addDefaultVendorSlots(organization.organizationId, ["Lieu de réception", "Traiteur", "Photographe"]);
  const source = await createProspectSource(organization.organizationId, "Salon");
  const event = await createProspect({ organizationId: organization.organizationId, createdByUserId: organization.userId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
  const slots = await listEventVendorSlots(organization.organizationId, event.id);
  for (const [label, amountCents] of [["Lieu de réception", 980000], ["Traiteur", 960000], ["Photographe", 280000]] as const) {
    const slot = slots.find((candidate) => candidate.label === label)!;
    await updateBudgetLine({ organizationId: organization.organizationId, eventId: event.id, eventVendorSlotId: slot.id, field: "estimated", amountCents, changedByUserId: organization.userId });
  }
  const payer = await createEventLink({
    organizationId: organization.organizationId,
    eventId: event.id,
    createdByUserId: organization.userId,
    audience: "client",
    locale: "fr",
    link: {
      personName: "Bernard Martin",
      email: `bernard-${randomUUID()}@symbola.test`,
      rights: { rubrics: ["budget", "quotes"], budgetScope: "selected", sharedSlotIds: slots.filter((slot) => slot.label !== "Photographe").map((slot) => slot.id) },
    },
  });

  await page.goto(payer.url);
  await expect(page).toHaveURL(/\/portail$/);
  await expect(page.getByText("Bonjour Bernard Martin")).toBeVisible();
  const budget = page.getByRole("region", { name: "Budget" });
  await expect(budget).toContainText("Lieu de réception");
  await expect(budget).toContainText("Traiteur");
  await expect(budget).not.toContainText("Photographe");
  await expect(budget.getByRole("row", { name: /^Total/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Rétroplanning" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Programme du jour J" })).toHaveCount(0);
  await expectNoAxeViolation(page);
});

test("SEC-15 — un lien expiré propose d'en demander un nouveau ; la planner le voit à l'accueil et le renouvelle", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const organization = await plannerOrganization();
  const source = await createProspectSource(organization.organizationId, "Salon");
  const event = await createProspect({ organizationId: organization.organizationId, createdByUserId: organization.userId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
  const expired = await createEventLink({
    organizationId: organization.organizationId,
    eventId: event.id,
    createdByUserId: organization.userId,
    audience: "client",
    locale: "fr",
    link: {
      personName: "Léa Martin",
      email: `lea-${randomUUID()}@symbola.test`,
      rights: { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] },
      customExpiresOn: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    },
  });

  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(expired.url);
  await expect(couple.getByRole("heading", { level: 1 })).toHaveText("Ce lien n'est plus valable");
  await expect(couple.locator("main")).not.toContainText("Léa");
  await expect(couple.getByText("Cette page ne garde aucune donnée personnelle")).toBeVisible();
  await expectNoAxeViolation(couple);
  await couple.getByRole("button", { name: "Demander un nouveau lien" }).click();
  await expect(couple.getByRole("status")).toContainText("Votre demande est transmise");

  await loginAndSetupMfa(page, organization.email);
  await expect(page.getByRole("main")).toContainText("Léa Martin demande un nouveau lien");
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Léa Martin demande un nouveau lien", exact: true }).click();
  await expect(page.getByRole("list", { name: "Liens personnels" })).toContainText("Demande un nouveau lien depuis le");
  await page.getByRole("button", { name: "Renouveler le lien de Léa Martin" }).click();
  const renewedUrl = await page.getByLabel("Lien personnel de Léa Martin").inputValue();
  await couple.goto(renewedUrl);
  await expect(couple).toHaveURL(/\/portail$/);
  await coupleContext.close();
});
