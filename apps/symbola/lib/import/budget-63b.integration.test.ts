// Lot 63b (BUD-01, BUD-03, HUB-14) — un budget importé est complet, contre un vrai PostgreSQL :
// prévu, réel (devisé) et réglé lus ; l'écart et le reste à payer se calculent ; un acompte et un
// solde datés deviennent les échéances de la ligne ; l'annulation retire les échéances créées.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { listBudgetLines } from "@/modules/budget/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { decideFreeColumns, getImportColumns, saveImportMapping, startImport } from "@/modules/hub/service";
import { confirmImport, undoImport } from "./apply";
import { decideMatches, getImportMatchesView } from "./matching";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function plannerWithWedding() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  const { id: eventId } = await createProspect({
    organizationId: organization.id,
    createdByUserId: user.id,
    prospectSourceId: source.id,
    clients: [{ firstName: "Élodie", lastName: "Durand" }],
    eventDate: "2027-06-12",
    venueName: "Salle des fêtes",
  });
  return { organizationId: organization.id, userId: user.id, eventId };
}

async function importBudget(planner: { organizationId: string; userId: string }, csv: string) {
  const started = await startImport(db, { organizationId: planner.organizationId, userId: planner.userId, entityType: "budget_lines", fileName: "budget.csv", bytes: new TextEncoder().encode(csv) });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  const unknown = view!.columns.filter((column) => !column.proposedFieldKey).map((column) => column.header);
  expect(unknown).toEqual([]);
  await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })),
  });
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
  const matches = await getImportMatchesView(planner.organizationId, started.importId);
  const proposed = matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const }));
  if (proposed.length > 0) await decideMatches(planner.organizationId, started.importId, proposed);
  return started.importId;
}

describe("BUD-01, BUD-03, HUB-14 — Budget importé complet (lot 63b)", () => {
  it("lit Prévu, Réel et Réglé ; l'écart et le reste à payer se calculent", async () => {
    const planner = await plannerWithWedding();
    const importId = await importBudget(
      planner,
      "Date du mariage;Prénom client 1;Nom client 1;Poste;Prestataire;Prévu;Réel;Réglé\n" + "12/06/2027;Élodie;Durand;Photographe;Studio Lumière;2 000;2 300;500\n",
    );
    expect(await confirmImport({ ...planner, importId })).toMatchObject({ status: "applied" });
    const [line] = (await listBudgetLines(planner.organizationId, planner.eventId)).lines;
    expect(line).toMatchObject({ estimatedAmountCents: 200000, quotedAmountCents: 230000, committedAmountCents: 230000, paidAmountCents: 50000, varianceCents: 30000, remainingAmountCents: 180000, paidFromPayments: false });
  });

  it("un acompte et un solde datés deviennent les échéances de la ligne ; le réglé marque l'acompte payé", async () => {
    const planner = await plannerWithWedding();
    const importId = await importBudget(
      planner,
      "Date du mariage;Prénom client 1;Nom client 1;Poste;Prévu;Réel;Réglé;Acompte;Date de l'acompte;Solde;Date du solde\n" +
        "12/06/2027;Élodie;Durand;Traiteur;8 000;9 000;2 700;2 700;15/01/2027;6 300;01/06/2027\n",
    );
    expect(await confirmImport({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
    const [line] = (await listBudgetLines(planner.organizationId, planner.eventId)).lines;
    expect(line).toMatchObject({ committedAmountCents: 900000, paidAmountCents: 270000, remainingAmountCents: 630000, paidFromPayments: true });
    expect(line!.payments.map((payment) => [payment.label, payment.amountCents, payment.dueOn, payment.paidOn])).toEqual([
      ["Acompte", 270000, "2027-01-15", "2027-01-15"],
      ["Solde", 630000, "2027-06-01", null],
    ]);

    // L'annulation retire la ligne et ses échéances, sans les prendre pour un travail fait à la main.
    expect(await undoImport({ ...planner, importId })).toMatchObject({ status: "done", outcomes: { undone: 2, kept_modified: 0, kept_in_use: 0 } });
    expect((await listBudgetLines(planner.organizationId, planner.eventId)).lines).toEqual([]);
  });

  it("sans dates, l'import fait comme avant : le réglé va sur la ligne, aucune échéance n'est inventée", async () => {
    const planner = await plannerWithWedding();
    const importId = await importBudget(planner, "Date du mariage;Prénom client 1;Nom client 1;Poste;Prévu;Réel;Réglé;Acompte;Solde\n" + "12/06/2027;Élodie;Durand;Fleuriste;1 000;1 200;300;300;900\n");
    await confirmImport({ ...planner, importId });
    const [line] = (await listBudgetLines(planner.organizationId, planner.eventId)).lines;
    expect(line).toMatchObject({ paidAmountCents: 30000, paidFromPayments: false, payments: [] });
  });
});
