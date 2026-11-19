// Lot 12 (ONB-03) — démarrage pré-rempli selon le métier, contre un vrai
// PostgreSQL : listes et modèles de départ chargés d'office, jamais par-dessus
// ce que l'organisation a déjà ; état de l'assistant reprenable.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  addProspectSources,
  createProspect,
  listDefaultVendorSlots,
  listEventVendorSlots,
  listLossReasons,
  listProgramTemplates,
  listProspectSources,
  listTaskTemplates,
} from "@/modules/events/service";
import { listAllocationModels } from "@/modules/budget/service";
import { listVendorTagGroups, listVendorTypes } from "@/modules/vendors/service";
import { completeSetup, getSetupState, saveSetupStep, setModuleEnabled } from "@/modules/hub/service";
import { listQuoteTemplates } from "@/modules/quotes/service";
import { organizationProfiles } from "@symbola/db/schema/hub";
import { eq } from "drizzle-orm";
import { loadStarterKit, loadStarterQuoteTemplates } from "./starter-kit";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

describe("ONB-03 — Assistant de démarrage pré-rempli", { timeout: 30_000 }, () => {
  it("wedding planner : lignes du budget d'un mariage avec icônes, sources, motifs, rétroplanning, programme, répartition et types de prestataires", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);

    const result = await loadStarterKit(organization.id, "wedding_planner", "fr");

    const lines = await listDefaultVendorSlots(organization.id);
    expect(lines.map((line) => line.label)).toContain("Photographe");
    expect(lines.find((line) => line.label === "Photographe")?.icon).toBe("camera");
    expect(result.budgetLines).toBe(lines.length);
    expect((await listProspectSources(organization.id)).map((source) => source.label)).toContain("Salon du mariage");
    expect((await listLossReasons(organization.id)).length).toBeGreaterThan(2);
    expect((await listTaskTemplates(organization.id))[0]?.name).toContain("mariage");
    expect((await listProgramTemplates(organization.id)).length).toBe(1);
    const [split] = await listAllocationModels(organization.id);
    expect(split?.items.reduce((sum, item) => sum + item.percentageBasisPoints, 0)).toBe(10000);
    expect((await listVendorTypes(organization.id)).length).toBeGreaterThan(3);
    // Lot 21 (L21-PRE-18) : étiquettes de départ, rangées par famille.
    expect(result.vendorTags).toBeGreaterThan(20);
    expect((await listVendorTagGroups(organization.id)).find((group) => group.label === "Capacité")?.exclusive).toBe(true);
    // Lot 31b (HUB-26, D10) : le modèle de contrat de départ « à adapter » ; lot 48b : le mandat et les
    // conditions générales aussi.
    expect(result.contractTemplates).toBe(3);
    // Lot 31c (D18) : les deux textes de départ des conditions de paiement, jamais le taux.
    expect(result.paymentTerms).toBe(true);
  });

  it("agence événementielle : lignes adaptées ; un nouvel événement reçoit ses lignes du budget avec leur icône", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await loadStarterKit(organization.id, "event_agency", "fr");
    const lines = await listDefaultVendorSlots(organization.id);
    expect(lines.map((line) => line.label)).toContain("Technique son et lumière");
    expect(lines.map((line) => line.label)).not.toContain("Officiant de cérémonie laïque");

    const [source] = await listProspectSources(organization.id);
    const event = await createProspect({ organizationId: organization.id, createdByUserId: randomUUID(), prospectSourceId: source!.id, clients: [{ firstName: "Société", lastName: null }] });
    const eventLines = await listEventVendorSlots(organization.id, event.id);
    expect(eventLines.find((line) => line.label === "Traiteur")?.icon).toBe("catering");
  });

  it("une liste déjà remplie n'est pas touchée, et recharger ne duplique rien", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await addProspectSources(organization.id, ["Mon réseau"]);

    await loadStarterKit(organization.id, "wedding_planner", "fr");
    const again = await loadStarterKit(organization.id, "wedding_planner", "fr");

    expect((await listProspectSources(organization.id)).map((source) => source.label)).toEqual(["Mon réseau"]);
    expect(again).toMatchObject({ budgetLines: 0, sources: 0, lossReasons: 0, taskTemplate: false, programTemplate: false, allocation: false, vendorTypes: 0, vendorTags: 0, contractTemplates: 0, paymentTerms: false });
    expect((await listTaskTemplates(organization.id)).length).toBe(1);
  });

  it("HUB-09 — à la fin du questionnaire, le modèle de devis de départ du métier se charge une fois, jamais sans le module Devis", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await loadStarterKit(organization.id, "wedding_planner", "fr");
    expect(await loadStarterQuoteTemplates(organization.id, "fr")).toBeGreaterThan(0);
    const templates = await listQuoteTemplates(organization.id);
    expect(templates.length).toBeGreaterThan(0);
    expect(await loadStarterQuoteTemplates(organization.id, "fr")).toBe(0);
    expect((await listQuoteTemplates(organization.id)).length).toBe(templates.length);
    const withoutQuotes = await createOrganization(db, `Org ${randomUUID()}`);
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: withoutQuotes.id, moduleKey: "quotes", enabled: false });
    expect(await loadStarterQuoteTemplates(withoutQuotes.id, "fr")).toBe(0);
  });

  it("HUB-09 — le questionnaire se reprend à sa question et se termine une fois", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    expect(await getSetupState(db, organization.id)).toEqual({ step: 1, completed: false, metier: null });
    await saveSetupStep(db, organization.id, 4);
    expect((await getSetupState(db, organization.id)).step).toBe(4);
    await saveSetupStep(db, organization.id, 99);
    // Lot 33b (D9) : cinq questions ; une organisation arrêtée plus loin dans l'ancien assistant
    // (sept étapes) reprend à la dernière question.
    expect((await getSetupState(db, organization.id)).step).toBe(5);
    await db.update(organizationProfiles).set({ setupStep: 7 }).where(eq(organizationProfiles.organizationId, organization.id));
    expect((await getSetupState(db, organization.id)).step).toBe(5);
    await completeSetup(db, organization.id);
    expect((await getSetupState(db, organization.id)).completed).toBe(true);
  });
});
