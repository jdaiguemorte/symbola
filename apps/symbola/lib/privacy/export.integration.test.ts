// RGPD-02 — export des fiches sélectionnées contre de vrais modules
// (PostgreSQL réel) : seules les fiches cochées et réellement trouvées dans
// l'organisation sont exportées ; l'archive ZIP se relit (JSON et un CSV par
// module, plus le PDF) ; un module qui ne répond pas bloque l'export.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { ZipArchive } from "@symbola/import-engine";
import type { PrivacyContractV1 } from "@symbola/privacy";
import { addEventTask, createProspect, createProspectSource, eventsPrivacy } from "@/modules/events/service";
import { buildExportArchive, recordKey, selectRecordsForExport } from "./export";
import { searchPerson } from "./search";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

async function seedWedding(planner: Awaited<ReturnType<typeof createPlanner>>, firstName: string, lastName: string, task: string) {
  const { id: eventId } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients: [{ firstName, lastName }],
    eventDate: "2027-06-12",
  });
  await addEventTask(planner.organizationId, eventId, { label: task, dueDate: "2027-01-15", responsible: "planner" });
  return eventId;
}

describe("RGPD-02 — Export des fiches sélectionnées", () => {
  it("Quand elle lance l'export des fiches sélectionnées, alors l'archive ZIP contient ces fiches seulement (JSON et CSV par module) et le PDF", async () => {
    const planner = await createPlanner();
    const lastName = `Durand${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, "Élodie", lastName, "Réserver le traiteur");
    // Homonyme dans la même organisation : trouvé, mais pas coché.
    await seedWedding(planner, "Élodie", lastName, "Tâche de l'homonyme");
    const terms = { name: `Élodie ${lastName}` };
    const found = await searchPerson({ organizationId: planner.organizationId, terms });
    const clients = found!.records.filter((record) => record.kind === "event_client");
    expect(clients).toHaveLength(2);
    const chosenEvent = clients[0]!.eventId;
    const chosen = found!.records.filter((record) => record.eventId === chosenEvent);

    const selection = await selectRecordsForExport({ organizationId: planner.organizationId, terms, selectedKeys: chosen.map(recordKey) });
    expect(selection.status).toBe("ok");
    if (selection.status !== "ok") return;
    expect(selection.records.map(recordKey).sort()).toEqual(chosen.map(recordKey).sort());
    expect(selection.records.some((record) => record.label === "Tâche de l'homonyme")).toBe(false);
    // La fiche de l'événement, trouvée par le client, porte aussi sa date et son statut.
    expect(selection.records.find((record) => record.kind === "event")?.fields).toMatchObject({ eventDate: "2027-06-12", status: "prospect" });

    const pdf = Buffer.from("%PDF-1.4 test");
    const generatedAt = new Date("2026-11-02T14:00:00Z");
    const archive = new ZipArchive(buildExportArchive({ records: selection.records, pdf, generatedAt, organizationName: "Maison Lilas" }), 10_000_000);
    const json = JSON.parse(archive.readText("donnees.json")!);
    expect(json).toMatchObject({ format: "symbola.privacy-export/v1", generatedAt: "2026-11-02T14:00:00.000Z", organization: "Maison Lilas" });
    expect(Object.keys(json.modules)).toEqual(["events"]);
    expect(json.modules.events).toContainEqual(expect.objectContaining({ kind: "event_client", fields: { firstName: "Élodie", lastName } }));
    const csv = archive.readText("csv/events.csv")!;
    // Marque UTF-8 pour le tableur (le décodeur la retire à la lecture).
    expect([...archive.read("csv/events.csv")!.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.startsWith("kind;id;label;event_id;field;value\r\n")).toBe(true);
    expect(csv).toContain(`;lastName;${lastName}\r\n`);
    expect(csv).toContain("Réserver le traiteur");
    expect(csv).not.toContain("Tâche de l'homonyme");
    expect([...archive.read("export.pdf")!]).toEqual([...pdf]);
  });

  it("une fiche cochée qui n'est pas dans le résultat (autre organisation, autre personne) bloque l'export ; rien de coché non plus", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const lastName = `Martin${randomUUID().slice(0, 6)}`;
    await seedWedding(plannerA, "Chloé", lastName, "Tâche de A");
    await seedWedding(plannerB, "Chloé", lastName, "Tâche de B");
    const terms = { name: `Chloé ${lastName}` };
    const inA = await searchPerson({ organizationId: plannerA.organizationId, terms });
    const inB = await searchPerson({ organizationId: plannerB.organizationId, terms });
    const foreign = inB!.records.find((record) => record.kind === "task")!;

    expect(
      await selectRecordsForExport({ organizationId: plannerA.organizationId, terms, selectedKeys: [...inA!.records.map(recordKey), recordKey(foreign)] }),
    ).toEqual({ status: "changed" });
    // Une fiche de A qui n'appartient pas à la personne cherchée non plus.
    expect(await selectRecordsForExport({ organizationId: plannerA.organizationId, terms: { name: "Quelqu'un d'autre" }, selectedKeys: inA!.records.map(recordKey) })).toEqual({
      status: "changed",
    });
    expect(await selectRecordsForExport({ organizationId: plannerA.organizationId, terms, selectedKeys: [] })).toEqual({ status: "empty" });
  });

  it("Étant donné un module qui ne répond pas, alors l'export est refusé (jamais un export incomplet présenté comme complet)", async () => {
    const planner = await createPlanner();
    const lastName = `Petit${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, "Léa", lastName, "Tâche");
    const terms = { name: `Léa ${lastName}` };
    const found = await searchPerson({ organizationId: planner.organizationId, terms });
    const failing: PrivacyContractV1 = { module: "quotes", find: () => Promise.reject(new Error("indisponible")), related: () => Promise.resolve([]),
      planErasure: () => Promise.resolve([]),
      erase: () => Promise.resolve([]), };
    expect(
      await selectRecordsForExport(
        { organizationId: planner.organizationId, terms, selectedKeys: found!.records.map(recordKey) },
        {
          participants: [
            { contract: eventsPrivacy, moduleKey: "events" },
            { contract: failing, moduleKey: "quotes" },
          ],
        },
      ),
    ).toEqual({ status: "incomplete" });
  });
});
