// Lot 10 (AIDE-06) — tutoriels « en faisant », contre un vrai PostgreSQL : un
// exemple fictif est créé, chaque étape « faire » n'est validée que quand
// l'action est vraiment faite (vérifiée par le service du module), et la fin
// supprime l'exemple — ou garde ce que l'utilisateur choisit de garder.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  applyTaskTemplate,
  changeEventStatus,
  getEvent,
  listEventVendorSlots,
  listTaskTemplates,
  updateEventVendorSlot,
} from "@/modules/events/service";
import { createCatalogItem, listCatalogItems } from "@/modules/quotes/service";
import { TUTORIAL_SCRIPTS, type TutorialEnv } from "./tutorials";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function env(): Promise<TutorialEnv> {
  const organization = await createOrganization(db, `Org tutoriel ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `tutoriel-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id, locale: "fr", context: {} };
}

// Plusieurs services par test (exemple, vérifications, nettoyage) : 30 s.
describe("AIDE-06 — Tutoriels en faisant", { timeout: 30_000 }, () => {
  it("fiche d'un événement : exemple fictif d'un autre type que le mariage, étapes vérifiées, exemple supprimé à la fin", async () => {
    const base = await env();
    const script = TUTORIAL_SCRIPTS["event-page"];
    const context = await script.setup!(base);
    const current = { ...base, context };
    const event = await getEvent(base.organizationId, context.eventId!);
    expect(event).toMatchObject({ isDemo: true });
    expect(event!.clients.map((client) => client.firstName)).toEqual(["Camille"]);

    const [, , confirm, book] = script.steps;
    expect(await confirm!.check!(current)).toBe(false);
    await changeEventStatus({ organizationId: base.organizationId, eventId: context.eventId!, toStatus: "confirmed", changedByUserId: base.userId });
    expect(await confirm!.check!(current)).toBe(true);

    expect(await book!.check!(current)).toBe(false);
    const [slot] = await listEventVendorSlots(base.organizationId, context.eventId!);
    await updateEventVendorSlot({ organizationId: base.organizationId, vendorSlotId: slot!.id, changedByUserId: base.userId, status: "booked", vendorName: "Traiteur fictif" });
    expect(await book!.check!(current)).toBe(true);

    await script.cleanup(current, false);
    expect(await getEvent(base.organizationId, context.eventId!)).toBeNull();
  });

  it("modèle de rétroplanning : appliqué puis date déplacée ; le modèle peut être gardé, l'événement fictif disparaît", async () => {
    const base = await env();
    const script = TUTORIAL_SCRIPTS["retroplanning-template"];
    const context = await script.setup!(base);
    const current = { ...base, context };
    const apply = script.steps[3]!;
    expect(await apply.check!(current)).toBe(false);
    await applyTaskTemplate(base.organizationId, context.eventId!, context.templateId!);
    expect(await apply.check!(current)).toBe(true);

    await script.cleanup(current, true);
    expect(await getEvent(base.organizationId, context.eventId!)).toBeNull();
    expect((await listTaskTemplates(base.organizationId)).map((template) => template.id)).toContain(context.templateId);
  });

  it("catalogue : seule la prestation ajoutée pendant le tutoriel est retirée si l'on ne la garde pas", async () => {
    const base = await env();
    const before = await createCatalogItem(base.organizationId, { label: "Prestation existante", unit: "forfait", unitPriceCents: 1000, vatRateBasisPoints: 2000 });
    const script = TUTORIAL_SCRIPTS.catalog;
    const context = await script.setup!(base);
    const current = { ...base, context };
    const add = script.steps[2]!;
    expect(await add.check!(current)).toBe(false);
    await createCatalogItem(base.organizationId, { label: "Coordination du jour J (exemple)", unit: "forfait", unitPriceCents: 120000, vatRateBasisPoints: 2000 });
    expect(await add.check!(current)).toBe(true);

    await script.cleanup(current, false);
    expect((await listCatalogItems(base.organizationId)).map((item) => item.id)).toEqual([before.id]);
  });
});
