// Lot 67b (CHR-10, HUB-08 ; recette du 24/11/2026, R01 et R02) — une tâche hors évènement se modifie
// depuis sa fenêtre, et les compteurs de tâches (en-tête de la page, pastille du menu) la comptent.
// En taille ordinateur et en 375 px (projets Playwright), axe-core sur la fenêtre.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test } from "@playwright/test";
import { addStandaloneTask } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

test("CHR-10 — modifier une tâche hors évènement ; elle compte dans l'en-tête et la pastille « en retard »", async ({ page }) => {
  const { sql, db } = createAppConnection();
  let email: string;
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    email = `taches-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-67b", role: "owner" });
    // Échue depuis longtemps : en retard quel que soit le jour du test.
    await addStandaloneTask(organization.id, { label: "Déclaration de TVA", dueDate: "2026-01-20", recurrence: null });
  } finally {
    await sql.end();
  }
  await signIn(page, email, /\/$/);
  await page.goto("/taches");

  // R01 : la tâche hors évènement compte dans l'en-tête (elle était ignorée).
  await expect(page.getByRole("main")).toContainText("1 tâche à faire · 1 en retard");

  // R02 : « Modifier » ouvre la fenêtre de la tâche.
  const list = page.getByRole("list", { name: "Tâches hors évènement" });
  await list.getByRole("button", { name: "Modifier « Déclaration de TVA »" }).click();
  const dialog = page.getByRole("dialog", { name: "Modifier la tâche" });
  await expect(dialog).toBeVisible();
  const result = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  await dialog.getByLabel(/^Tâche/).fill("Déclaration de TVA du trimestre");
  await dialog.getByLabel(/^Échéance/).fill("2099-01-24");
  await dialog.getByLabel("Répétition").selectOption({ label: "Chaque trimestre" });
  await dialog.getByRole("button", { name: "Enregistrer" }).click();

  await expect(dialog).toBeHidden();
  const item = list.getByRole("listitem").filter({ hasText: "Déclaration de TVA du trimestre" });
  await expect(item).toContainText("24 janvier 2099 · Chaque trimestre");
  // Repoussée, elle n'est plus en retard.
  await expect(page.getByRole("main")).toContainText("1 tâche à faire · 0 en retard");
});
