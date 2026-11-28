// Lot 10 (AIDE-05 à AIDE-07) — progression d'un compte dans l'aide, contre un
// vrai PostgreSQL : une visite mise de côté garde son étape et ne s'impose
// plus ; un élément terminé le reste, même revu.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { getHelpProgress, InvalidHelpItemError, listTeamHelpProgress, recordHelpProgress, recordTourVenue, tourOffer, tourProgressOf } from "./service";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function teamUser(): Promise<string> {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  return (await createUser(db, { organizationId: organization.id, email: `aide-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" })).id;
}

describe("AIDE-05 — Visite focus mise de côté puis reprise", () => {
  it("« Plus tard » garde l'étape ; la visite ne s'ouvre plus d'elle-même ; terminée, elle le reste", async () => {
    const userId = await teamUser();
    expect(await getHelpProgress(db, userId)).toEqual([]);

    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "postponed", step: 2 });
    expect(await getHelpProgress(db, userId)).toEqual([expect.objectContaining({ itemKey: "tour:event-retroplanning", status: "postponed", step: 2, completedAt: null })]);

    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "completed", step: 3 });
    // Revoir une visite terminée ne la fait pas repasser « en cours ».
    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "started", step: 0 });
    const [entry] = await getHelpProgress(db, userId);
    expect(entry).toMatchObject({ status: "completed", step: 3 });
    expect(entry!.completedAt).not.toBeNull();
  });
});

describe("AIDE-07 — Progression par compte", () => {
  it("chaque compte a sa propre progression ; une clé inconnue est refusée", async () => {
    const first = await teamUser();
    const second = await teamUser();
    await recordHelpProgress(db, { userId: first, itemKey: "tutorial:retroplanning-template", status: "started", step: 1 });
    expect(await getHelpProgress(db, second)).toEqual([]);
    await expect(recordHelpProgress(db, { userId: first, itemKey: "n'importe quoi", status: "started" })).rejects.toBeInstanceOf(InvalidHelpItemError);
  });
});

describe("L10-HUB-11 — Suivi de la prise en main par l'Admin", () => {
  it("donne la progression des comptes d'équipe seulement, sans aucune donnée d'événement", async () => {
    const organization = await createOrganization(db, `Org suivi ${randomUUID()}`);
    const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
    // Lot 26a : un membre de l'équipe, à côté de la titulaire (plus de compte de marié).
    const member = await createUser(db, { organizationId: organization.id, email: `membre-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:catalog", status: "completed", step: 3 });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:retroplanning-template", status: "started", step: 1 });
    await recordHelpProgress(db, { userId: member.id, itemKey: "tour:hub", status: "completed" });

    const row = (await listTeamHelpProgress(db)).find((candidate) => candidate.id === organization.id)!;
    expect(row.modules).toEqual({ events: true, budget: true, quotes: true });
    expect(row.accounts.map((account) => account.userId).sort()).toEqual([owner.id, member.id].sort());
    expect(row.accounts.find((account) => account.userId === owner.id)!.help).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemKey: "tutorial:catalog", status: "completed" }),
        expect.objectContaining({ itemKey: "tutorial:retroplanning-template", status: "started", step: 1 }),
      ]),
    );
  });
});

// Lot 74d (D2, B11 ; L74-D9) — la ligne « Découvrir cet écran » : trois venues, une par jour, par
// personne et par écran ; « Lancer » ou « Fermer » la retirent. Abus : la progression de A n'est ni lue
// ni modifiée pour B, d'une même organisation ou d'une autre.
describe("L74-74d — Compte des venues et fermeture, par personne", () => {
  const offer = async (userId: string, now: Date) => tourOffer({ automatic: false, progress: tourProgressOf(await getHelpProgress(db, userId), "events"), now, preference: true, setupDone: true, empty: false });

  it("trois venues un jour différent, puis plus de ligne ; recharger dans la journée ne compte pas", async () => {
    const userId = await teamUser();
    for (const day of ["2026-11-25T08:00:00Z", "2026-11-25T17:00:00Z", "2026-11-26T08:00:00Z", "2026-11-27T08:00:00Z"]) {
      expect(await offer(userId, new Date(day)), day).toBe("line");
      await recordTourVenue(db, userId, "events", new Date(day));
    }
    expect(tourProgressOf(await getHelpProgress(db, userId), "events")).toMatchObject({ status: "postponed", step: 3 });
    expect(await offer(userId, new Date("2026-11-28T08:00:00Z"))).toBeNull();
  });

  it("« Fermer » retire la ligne ; une venue de plus ne la fait pas revenir", async () => {
    const userId = await teamUser();
    await recordTourVenue(db, userId, "events", new Date("2026-11-25T08:00:00Z"));
    await recordHelpProgress(db, { userId, itemKey: "tour:events", status: "completed", now: new Date("2026-11-25T08:05:00Z") });
    await recordTourVenue(db, userId, "events", new Date("2026-11-26T08:00:00Z"));
    expect(tourProgressOf(await getHelpProgress(db, userId), "events")).toMatchObject({ status: "completed" });
    expect(await offer(userId, new Date("2026-11-26T08:00:00Z"))).toBeNull();
  });

  it("abus — les venues et la fermeture de A ne comptent pas pour B, collègue ou d'une autre organisation", async () => {
    const organization = await createOrganization(db, `Org venues ${randomUUID()}`);
    const first = (await createUser(db, { organizationId: organization.id, email: `a-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" })).id;
    const colleague = (await createUser(db, { organizationId: organization.id, email: `b-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" })).id;
    const stranger = await teamUser();
    for (const day of ["2026-11-25", "2026-11-26", "2026-11-27"]) await recordTourVenue(db, first, "events", new Date(`${day}T08:00:00Z`));
    await recordHelpProgress(db, { userId: first, itemKey: "tour:hub", status: "completed" });
    for (const other of [colleague, stranger]) {
      expect(await getHelpProgress(db, other)).toEqual([]);
      expect(await offer(other, new Date("2026-11-28T08:00:00Z"))).toBe("line");
    }
    // Et B qui compte ses venues ne touche pas à celles de A.
    await recordTourVenue(db, colleague, "events", new Date("2026-11-28T08:00:00Z"));
    expect(tourProgressOf(await getHelpProgress(db, first), "events")).toMatchObject({ step: 3 });
    expect(tourProgressOf(await getHelpProgress(db, colleague), "events")).toMatchObject({ step: 1 });
  });
});
