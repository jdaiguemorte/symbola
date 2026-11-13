// Lot 31c (FAC-05, FAC-07, JUR-01, JUR-08 ; décisions D18, D21, D22, réponses de l'expert-comptable)
// — conditions de paiement selon le client : deux textes, le taux des pénalités choisi par la
// planner (aucun proposé), l'ancien texte de départ signalé. Devis à arrhes : une seule échéance ;
// à l'encaissement, un reçu non fiscal de sa propre série, téléchargeable. En taille ordinateur
// et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createProspect, createProspectSource } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { addPaymentMethods, addQuoteLine, addScheduleItem, createQuote, getQuoteSettings, setQuoteAdvanceKind, updateQuoteSettings } from "../modules/quotes/service";
import { readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-terrain-e2e";
const OLD_STARTER_TEXT =
  "Conditions de paiement : à réception de la facture, par virement bancaire. Aucun escompte pour paiement anticipé. En cas de retard de paiement, des pénalités au taux d'intérêt légal peuvent être appliquées.";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// À 375 px, rien ne dépasse : sinon, les éléments qui débordent, pour le diagnostic.
async function expectNoOverflow(page: Page) {
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const clipped = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX)) return true;
      }
      return false;
    };
    if (document.documentElement.scrollWidth <= width) return [];
    return [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > width + 0.5 && !clipped(element))
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${[...element.classList].join(".")} « ${(element.textContent ?? "").trim().slice(0, 60)} »`);
  });
  expect(offenders, offenders.join("\n")).toEqual([]);
}

function parisDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Atelier de Camille, prêt (mentions remplies), en franchise ; un mariage, et, si demandé, son devis
// à arrhes (une échéance) en brouillon.
async function atelier(options: { earnestQuote: boolean }) {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const organizationId = organization.id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, siren: "123456789", address: "12 rue des Tilleuls, 24200 Sarlat", metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    if (!options.earnestQuote) return { organizationId, email, quoteId: null };
    await addPaymentMethods(organizationId, ["Virement bancaire"]);
    const source = await createProspectSource(organizationId, "Salon");
    const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: "2027-06-12" });
    const quote = await createQuote({ organizationId, eventId: wedding.id, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 300000 });
    await setQuoteAdvanceKind(organizationId, quote.id, "earnest");
    await addScheduleItem(organizationId, quote.id, { label: "Arrhes à la réservation", amountCents: 50000, dueDate: parisDate(-1) });
    return { organizationId, email, quoteId: quote.id };
  } finally {
    await sql.end();
  }
}

test("JUR-01 / FAC-07 — conditions de paiement selon le client : deux textes, taux des pénalités choisi sans valeur proposée, ancien texte signalé", async ({ page }) => {
  const setup = await atelier({ earnestQuote: false });
  await updateQuoteSettings(setup.organizationId, { ...(await getQuoteSettings(setup.organizationId)), invoiceMentions: OLD_STARTER_TEXT });
  await login(page, setup.email);

  await page.goto("/devis/parametres");
  const individual = page.getByLabel("Conditions de paiement — particuliers et non-professionnels");
  await expect(individual).toHaveValue(OLD_STARTER_TEXT);
  await expect(page.getByRole("note").filter({ hasText: "ancien modèle de départ" })).toBeVisible();
  await expect(page.getByLabel("Conditions de paiement — professionnels")).toHaveValue(/Escompte pour paiement anticipé : néant/);
  const rate = page.getByLabel("Taux des pénalités de retard (clients professionnels)");
  await expect(rate).toHaveValue("");
  await expect(page.getByLabel("Préfixe des reçus d'arrhes")).toHaveValue("R");
  await expectNoAxeViolation(page);

  await rate.selectOption({ label: "Trois fois le taux d'intérêt légal" });
  await individual.fill("Paiement par virement à l'échéance. Aucun escompte.");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  await page.reload();
  await expect(rate).toHaveValue("three_times_legal");
  await expect(page.getByRole("note").filter({ hasText: "ancien modèle de départ" })).toHaveCount(0);
  await expectNoOverflow(page);
});

test("JUR-08 / FAC-05 — devis à arrhes : une seule échéance ; à l'encaissement, un reçu non fiscal de sa propre série", async ({ page }) => {
  const setup = await atelier({ earnestQuote: true });
  await login(page, setup.email);
  const quoteUrl = `/devis/${setup.quoteId}`;
  await page.goto(quoteUrl);
  await page.waitForLoadState("networkidle");

  // D22 : une deuxième échéance est refusée, avec la raison.
  const addItem = page.getByRole("form", { name: "Ajouter l'échéance" });
  await addItem.getByLabel("Intitulé de l'échéance").fill("Deuxième versement");
  await addItem.getByLabel("Date d'échéance").fill(parisDate(30));
  await addItem.getByLabel("Montant ou pourcentage").selectOption("amount");
  await addItem.getByLabel("Valeur").fill("500");
  await addItem.getByRole("button", { name: "Ajouter l'échéance" }).click();
  await expect(addItem.getByRole("alert")).toHaveText(/Des arrhes se versent en une seule fois/);
  await expectNoAxeViolation(page);

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText(/^Envoyé — version/)).toBeVisible();

  // D21 : l'encaissement des arrhes crée un reçu non fiscal, listé avec son PDF.
  await page.getByText("Marquer payée l'échéance « Arrhes à la réservation »").click();
  const pay = page.getByRole("form", { name: "Marquer payée l'échéance « Arrhes à la réservation »" });
  await pay.getByLabel("Mode de paiement").selectOption({ label: "Virement bancaire" });
  await pay.getByRole("button", { name: "Marquer payée" }).click();
  await expect(page.getByText(/^Payée le .* \(Virement bancaire\)$/)).toBeVisible();
  const receipts = page.getByRole("list", { name: "Reçus d'arrhes" });
  await expect(receipts.getByRole("listitem")).toHaveCount(1);
  await expect(receipts.getByRole("listitem")).toContainText(/R-\d{4}-0001/);
  await expect(receipts.getByRole("listitem")).toContainText("Arrhes à la réservation");
  const link = receipts.getByRole("link", { name: /^PDF du reçu R-\d{4}-0001$/ });
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  await expectNoAxeViolation(page);
  await expectNoOverflow(page);
});
