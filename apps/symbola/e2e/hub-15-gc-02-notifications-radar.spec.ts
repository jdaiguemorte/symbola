// Lot 53 (HUB-15, UX-16, HUB-28, GC-02, CHR-05, CHR-10, HUB-24 ; ADR 0095) — SC-03 « Lundi matin », suite :
// Camille voit dans « Aujourd'hui » sa tâche hors évènement et les risques du radar (lot 72a : des lignes
// « À regarder »), chacun avec sa règle ;
// la cloche l'amène à la notification, qui ouvre l'écran où agir ; la santé du planning s'explique (le
// jalon d'abord) ; le terme réglé pour le type remplace « Mariés » ; elle coupe une sorte par canal et un
// automatisme. En taille ordinateur et en 375 px, axe-core à chaque écran.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { addEventTask, addStandaloneTask, changeEventStatus, createProspect, createProspectSource, setEventTypeClientTerm, setTaskMilestone } from "../modules/events/service";
import { notify, saveOnboardingStep } from "../modules/hub/service";
import { ensureEventTypes } from "../lib/events/event-types";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

function parisDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, role: "owner" });
    const type = (await ensureEventTypes(organizationId, "fr"))[0]!;
    await setEventTypeClientTerm(organizationId, { eventTypeId: type.id, locale: "fr", term: { term: "les invitants", gender: "masculine", number: "plural" } });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: parisDay(40), eventTypeId: type.id });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const milestone = await addEventTask(organizationId, event.id, { label: "Contrat traiteur signé", dueDate: parisDay(-3), responsible: "planner" });
    await setTaskMilestone(organizationId, event.id, milestone.id, true);
    await addStandaloneTask(organizationId, { label: "Déclaration de TVA", dueDate: parisDay(0), recurrence: "monthly" });
    await notify({ organizationId, type: "client_decision", eventId: event.id, objectKey: randomUUID(), params: { title: "Choix du traiteur" }, href: `/events/${event.id}?onglet=maries` });
    return { email, eventId: event.id };
  } finally {
    await sql.end();
  }
}

test("SC-03 / HUB-15 / UX-16 / GC-02 / CHR-05 / CHR-10 / HUB-24 / HUB-28 — notifications, radar, santé expliquée, automatismes", async ({ page }) => {
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);

  // CHR-10 : la tâche hors évènement est dans « Aujourd'hui » ; GC-02 : le radar dit sa règle.
  await expect(page.getByRole("heading", { level: 1, name: "Aujourd'hui" })).toBeVisible();
  await expect(page.getByText("Déclaration de TVA").first()).toBeVisible();
  // Lot 72a (critère 6) : l'alerte du radar est une ligne « À regarder » de la liste.
  // Lot 72b : dans l'anatomie de la ligne allégée, avec « Agir ».
  const risks = page.getByRole("region", { name: /^À traiter en premier/ }).getByRole("listitem").filter({ hasText: "Jalon en retard" }).first();
  await expect(risks.getByRole("link", { name: /^Agir/ })).toBeVisible();
  await expect(risks).toContainText("Jalon en retard");
  await expect(risks).toContainText("Le jalon « Contrat traiteur signé » est en retard de 3 jours ; seuil : 0 jour.");
  await expectNoAxeViolation(page);

  // HUB-15, UX-16 : la cloche compte la notification non lue et mène au centre ; la notification ouvre
  // l'écran où agir et passe en lue.
  await page.getByRole("link", { name: "Notifications, 1 non lue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  const list = page.getByRole("list", { name: "Notifications" });
  await expect(list).toContainText("Décision du client");
  await expect(list).toContainText("Le client a répondu : « Choix du traiteur ».");
  await expectNoAxeViolation(page);
  await list.getByRole("button", { name: "Voir la décision" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${setup.eventId}\\?onglet=maries`));
  await expect(page.getByRole("link", { name: "Notifications, aucune non lue" })).toBeVisible();
  // HUB-24 : le terme réglé pour le type remplace « Mariés ».
  // Lot 72d : les onglets de la fiche sont des onglets (role tab).
  await expect(page.getByRole("tab", { name: /^Les invitants/ })).toBeVisible();

  // CHR-05 : la santé s'explique, le jalon d'abord.
  await page.goto(`/events/${setup.eventId}`);
  const health = page.getByRole("region", { name: "Santé de l'évènement" });
  // Un jalon en retard pèse 3 points : « À surveiller » avec les seuils de départ (1 et 4).
  await expect(health).toContainText("À surveiller");
  await health.getByText("Pourquoi ?").click();
  await expect(health.getByRole("link", { name: "Contrat traiteur signé — 3 jours de retard" })).toBeVisible();
  await expect(health).toContainText("Jalon");
  await expectNoAxeViolation(page);

  // HUB-15 : une sorte se coupe sur un canal.
  await page.goto("/parametres/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Vos notifications" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Devis signé — E-mail" }).uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  await page.goto("/parametres/notifications");
  await expect(page.getByRole("checkbox", { name: "Devis signé — E-mail" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Devis signé — Push" })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Notifications push sur cet appareil" })).toBeVisible();
  await expectNoAxeViolation(page);

  // HUB-28 : couper un automatisme ; l'écran dit que rien n'est rattrapé.
  await page.goto("/parametres/automatisations");
  await expect(page.getByText(/rien de ce qui aurait dû partir entre-temps n'est rattrapé/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Purge des données personnelles" })).toBeVisible();
  await page.getByRole("button", { name: "Couper : Échéance à J-7, puis rappel au payeur" }).click();
  await expect(page.getByRole("button", { name: "Activer : Échéance à J-7, puis rappel au payeur" })).toBeVisible();
  await expectNoAxeViolation(page);

  // GC-02 : les règles du radar et leurs seuils, celles des pièces et des IBAN du carnet comprises (lot 48a).
  await page.goto("/parametres/radar");
  await expect(page.getByRole("heading", { name: "Prestataire retenu sans contrat" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pièce expirée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "IBAN à vérifier" })).toBeVisible();
  await expect(page.getByText(/Indisponible/)).toHaveCount(0);
  await expectNoAxeViolation(page);
});
