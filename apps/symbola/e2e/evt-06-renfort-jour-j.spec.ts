// Lot 52 (EVT-06 ; D3 ; ADR 0094 ; SC-08 étape 7) — Hugo, en renfort, ouvre le jour J par son lien
// personnel, sans compte : code reçu par e-mail, puis le mode Jour J de ce seul évènement, où il voit
// les mêmes informations à jour (le pointage de Camille) et pointe à son tour, nommé « Hugo, renfort ».
// En taille ordinateur et en 375 px, axe-core. Tests d'abus : le budget, les devis, les invités, le
// portail, un autre évènement et une autre organisation répondent comme une page inexistante ; après le
// retrait de son lien, plus rien ne s'ouvre.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { addProgramItem, applyDayAction, changeEventStatus, createDayHelper, createProspect, createProspectSource, revokeDayHelper } from "../modules/events/service";
import { readyOrganization } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    const code = messages.map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("aucun code reçu");
}

async function weddingToday() {
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  let otherOrganizationEvent: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    ownerId = (await createUser(db, { organizationId, email: `camille-${randomUUID()}@symbola.test`, role: "owner" })).id;
    const other = (await readyOrganization(db, `Autre ${randomUUID()}`)).id;
    const otherOwner = (await createUser(db, { organizationId: other, email: `autre-${randomUUID()}@symbola.test`, role: "owner" })).id;
    const otherSource = await createProspectSource(other, "Salon");
    otherOrganizationEvent = (await createProspect({ organizationId: other, createdByUserId: otherOwner, prospectSourceId: otherSource.id, clients: [{ firstName: "Zoé" }], eventDate: parisToday() })).id;
    await changeEventStatus({ organizationId: other, eventId: otherOrganizationEvent, changedByUserId: otherOwner, toStatus: "confirmed" });
  } finally {
    await sql.end();
  }
  const source = await createProspectSource(organizationId, "Salon");
  const create = async (firstName: string) => {
    const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName }, { firstName: "Maxime" }], eventDate: parisToday() });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: ownerId, toStatus: "confirmed" });
    return event.id;
  };
  const eventId = await create("Léa");
  const sibling = await create("Inès");
  const ceremony = await addProgramItem(organizationId, eventId, { startTime: "15:50", endTime: "16:35", label: "Cérémonie laïque", vendorSlotIds: [], freeParticipants: [] });
  const dinner = await addProgramItem(organizationId, eventId, { startTime: "20:00", endTime: "23:30", label: "Dîner", vendorSlotIds: [], freeParticipants: [] });
  // Camille a pointé le début de la cérémonie.
  await applyDayAction({
    organizationId,
    eventId,
    userId: ownerId,
    action: { kind: "checkpoint", actionId: randomUUID(), deviceAt: new Date().toISOString(), itemId: ceremony.id, checkpoint: "started" } as never,
    renderDocument: async () => ({ filename: "programme.pdf", content: new Uint8Array() }),
  });
  const email = `hugo-${randomUUID()}@exemple.test`;
  const { helper, url } = await createDayHelper({ organizationId, eventId, helper: { personName: "Hugo", email, phone: "06 98 76 54 32" }, locale: "fr", byUserId: ownerId });
  return { organizationId, eventId, sibling, otherOrganizationEvent, dinnerId: dinner.id, email, linkId: helper.linkId, token: url.split("#")[1]! };
}

async function openAsHelper(page: Page, token: string, email: string) {
  await page.goto(`/lien#${token}`);
  await expect(page.getByRole("heading", { name: "Votre code d'accès" })).toBeVisible();
  await page.getByLabel("Code reçu par e-mail").fill(await codeSentTo(email));
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await page.waitForURL(/\/jour-j\//);
}

// Ce qu'une adresse renvoie : l'adresse d'arrivée (après les renvois) et le code HTTP.
async function outcome(page: Page, path: string): Promise<{ path: string; status: number | null }> {
  const response = await page.goto(path);
  return { path: new URL(page.url()).pathname, status: response?.status() ?? null };
}

test.describe("EVT-06 (D3) — Renfort du jour J par lien personnel (SC-08 étape 7)", () => {
  test("Hugo ouvre le jour J par son lien et un code, voit le pointage de Camille, pointe à son tour ; rien d'autre ne s'ouvre", async ({ page }) => {
    test.setTimeout(150_000);
    const day = await weddingToday();
    await openAsHelper(page, day.token, day.email);
    await expect(page).toHaveURL(new RegExp(`/jour-j/${day.eventId}$`));
    await expect(page.getByText("Bonjour Hugo : voici le jour J, en renfort.")).toBeVisible();
    // Les mêmes informations à jour : le début de la cérémonie pointé par Camille (sans son adresse).
    await expect(page.getByText(/Commencé à \d{2}:\d{2} \(un membre de l'équipe\)/).first()).toBeVisible();
    await expect(page.getByText("@symbola.test")).toHaveCount(0);
    // Ni remise d'argent, ni choix des documents, ni préparation des listes, ni retour à l'évènement.
    await expect(page.getByText("Choisir les documents embarqués")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Retour à l'évènement" })).toHaveCount(0);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);

    // Hugo pointe le début du dîner : son nom suit, « Hugo, renfort », vu de l'équipe.
    await page.getByRole("button", { name: "Commencé : Dîner" }).first().click();
    await expect(page.getByText(/Commencé à \d{2}:\d{2} \(vous\)/).first()).toBeVisible();

    // Tests d'abus : chaque écran hors du mode Jour J de son évènement répond comme une page inexistante.
    const unknownEvent = randomUUID();
    const pairs: [string, string][] = [
      [`/jour-j/${day.sibling}`, `/jour-j/${unknownEvent}`],
      [`/jour-j/${day.otherOrganizationEvent}`, `/jour-j/${unknownEvent}`],
      [`/events/${day.eventId}?onglet=budget`, `/events/${unknownEvent}?onglet=budget`],
      [`/events/${day.eventId}/invites`, `/events/${unknownEvent}/invites`],
      [`/events/${day.eventId}/equipe`, `/events/${unknownEvent}/equipe`],
      ["/devis", "/devis"],
      ["/portail", "/portail"],
      ["/prestataire", "/prestataire"],
    ];
    for (const [asked, unknown] of pairs) {
      const reached = await outcome(page, asked);
      const reference = await outcome(page, unknown);
      expect({ status: reached.status, path: reached.path.replace(day.eventId, unknownEvent).replace(day.sibling, unknownEvent).replace(day.otherOrganizationEvent, unknownEvent) }, asked).toEqual({ status: reference.status, path: reference.path });
    }
    const portal = await outcome(page, "/portail");
    expect(portal.status).toBe(404);
  });

  test("après le retrait de son lien, le jour J ne s'ouvre plus et répond comme une page inexistante", async ({ page }) => {
    test.setTimeout(90_000);
    const day = await weddingToday();
    await openAsHelper(page, day.token, day.email);
    await revokeDayHelper(day.organizationId, day.eventId, day.linkId);
    const revoked = await outcome(page, `/jour-j/${day.eventId}`);
    const unknown = await outcome(page, `/jour-j/${randomUUID()}`);
    expect(revoked).toEqual({ ...unknown, path: revoked.path });
    expect(revoked.status).toBe(404);
    // L'état partagé le dit à l'appareil : le lien est retiré ou expiré.
    const state = await page.request.get(`/jour-j/${day.eventId}/etat`);
    expect(state.status()).toBe(401);
    expect(await state.json()).toEqual({ error: "link" });
  });
});
