// Lot 24a — SEC-13 et SC-S1 : connectée à l'organisation A, la titulaire
// remplace, dans l'adresse, l'identifiant d'un de ses objets par celui d'un
// objet de B, sur chaque page et route qui en prend un. La réponse est la même
// que pour un identifiant qui n'existe nulle part : même statut, même texte,
// rien qui distingue l'un de l'autre. La tentative va au journal de A
// (décision D4). En taille ordinateur et en 375 px, axe-core sur la page
// introuvable et sur le journal.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { createQuote } from "../modules/quotes/service";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Une organisation prête, sa titulaire, et un événement, un devis et un
// prestataire créés par les services des modules.
async function organizationWithObjects(label: string) {
  const email = `owner-sec13-${label}-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-e2e-de-test";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let userId: string;
  try {
    const organization = await readyOrganization(db, `Org ${label} ${randomUUID()}`);
    organizationId = organization.id;
    userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-06-12" });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: userId });
  const { vendor } = await createVendor(organizationId, { name: `Maison ${label}`, typeId: null, city: "Lille" });
  return { email, password, eventId: event.id, quoteId: quote.id, vendorId: vendor.id };
}

type Objects = Awaited<ReturnType<typeof organizationWithObjects>>;

// Adresses qui prennent un identifiant ; « page » : écran rendu, « route » :
// fichier servi (PDF, CSV…).
const ADDRESSES: { kind: "page" | "route"; path: (objects: Objects) => string }[] = [
  { kind: "page", path: (o) => `/events/${o.eventId}` },
  { kind: "page", path: (o) => `/budget/${o.eventId}` },
  { kind: "page", path: (o) => `/devis/${o.quoteId}` },
  { kind: "page", path: (o) => `/prestataires/${o.vendorId}` },
  { kind: "route", path: (o) => `/events/${o.eventId}/programme/pdf?variant=couple` },
  // Lot 28c (BUD-10) : exports du budget.
  { kind: "route", path: (o) => `/budget/${o.eventId}/export?format=xlsx` },
  { kind: "route", path: (o) => `/budget/${o.eventId}/export?format=pdf` },
  { kind: "route", path: (o) => `/devis/${o.quoteId}/pdf?version=1` },
  { kind: "route", path: (o) => `/devis/${o.quoteId}/signature/signed` },
  { kind: "route", path: (o) => `/prestataires/${o.vendorId}/fichiers/${randomUUID()}` },
];

function nowhere(): Objects {
  return { email: "", password: "", eventId: randomUUID(), quoteId: randomUUID(), vendorId: randomUUID() };
}

async function answer(page: Page, kind: "page" | "route", path: string): Promise<{ status: number; text: string }> {
  if (kind === "route") {
    const response = await page.request.get(path);
    return { status: response.status(), text: (await response.body()).toString("base64") };
  }
  const response = await page.goto(path);
  return { status: response!.status(), text: await page.locator("main").innerText() };
}

test("SEC-13 / SC-S1 — un objet d'une autre organisation répond comme un objet inexistant, et la tentative est journalisée", async ({ page }) => {
  test.setTimeout(120_000);
  const organizationA = await organizationWithObjects("A");
  const organizationB = await organizationWithObjects("B");
  await loginAndSetupMfa(page, organizationA.email, organizationA.password);

  // Ses propres objets s'ouvrent (la comparaison a un sens).
  for (const address of ADDRESSES.filter((candidate) => candidate.kind === "page")) {
    const own = await answer(page, address.kind, address.path(organizationA));
    expect(own.status, address.path(organizationA)).toBe(200);
  }

  for (const address of ADDRESSES) {
    const ofB = await answer(page, address.kind, address.path(organizationB));
    const missing = await answer(page, address.kind, address.path(nowhere()));
    expect(ofB.status, address.path(organizationB)).toBe(404);
    expect(ofB, address.path(organizationB)).toEqual(missing);
  }

  await page.goto(`/events/${organizationB.eventId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  await expect(page.locator("main")).not.toContainText(`Maison B`);
  await expectNoAxeViolation(page);

  // La tentative est au journal de A, sans rien de B.
  await page.goto("/parametres/journal");
  const refusals = page.getByRole("row").filter({ hasText: "Accès refusé : objet introuvable" });
  await expect(refusals.filter({ hasText: "Adresse demandée : /events/[id]" }).first()).toBeVisible();
  await expect(refusals.filter({ hasText: "Adresse demandée : /devis/[id]/pdf" }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("owner-sec13-B");
  await expectNoAxeViolation(page);
});
