// Lot 70e (EVT-01, D8) — créer un évènement par « Nouvel évènement », la seule forme : la réponse à « Où en
// est-il ? », le nom, et facultativement la date et le client. Partagé par les parcours qui partent d'un
// évènement créé par l'écran.
import { expect, type Page } from "@playwright/test";

export type NewEventInput = {
  name: string;
  // « enquiry » : Une demande en cours (Option) ; « signed » : Signé, en préparation (Confirmé).
  standing?: "enquiry" | "signed";
  date?: string;
  clientFirstName?: string;
  clientLastName?: string;
};

export async function createEventByForm(page: Page, input: NewEventInput): Promise<string> {
  await page.goto("/events/new");
  await page.getByRole("radio", { name: input.standing === "signed" ? /^Signé, en préparation/ : /^Une demande en cours/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill(input.name);
  if (input.date) await page.getByLabel(/^Date/).fill(input.date);
  if (input.clientFirstName) await page.getByLabel(/^Prénom du premier marié/).fill(input.clientFirstName);
  if (input.clientLastName) await page.getByLabel("Nom du premier marié", { exact: true }).fill(input.clientLastName);
  await submitNewEvent(page);
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/);
  return /\/events\/([0-9a-f-]{36})/.exec(page.url())![1]!;
}

// Lot 74b (B7) : pour « Signé, en préparation » avec une date, « Continuer » ouvre l'étape des échéances déjà
// passées quand le rétroplanning en a ; sans réponse, elles sont créées « à dater » (jamais en retard).
export async function submitNewEvent(page: Page): Promise<void> {
  const submit = page.getByRole("button", { name: /^(Créer l'évènement|Continuer)$/ });
  const label = (await submit.textContent())?.trim();
  await submit.click();
  if (label === "Continuer") {
    await expect(page.getByRole("heading", { level: 2, name: /avant aujourd'hui$/ })).toBeVisible();
    await page.getByRole("button", { name: "Créer l'évènement" }).click();
  }
}
