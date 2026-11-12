// Lot 24a — DAT-10 (décision D7) : le jeu fictif se charge en une commande, par
// les services des modules ; jamais en production, jamais deux fois dans la
// même base ; chaque organisation du jeu ne voit que ses données. PostgreSQL
// réel ; le jeu est chargé sous d'autres identifiants pour pouvoir rejouer.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getEventProgram, listEventPlaces, listEvents, listEventTasks, listVendorCandidates } from "@/modules/events/service";
import { findVendors } from "@/modules/vendors/service";
import { addMinutes, loadRecette, percentages, recetteEmail, RecetteRefusedError } from "./load";

const dataset: unknown = JSON.parse(readFileSync(new URL("../../../../docs/recette/symbola-synthetic-users.json", import.meta.url), "utf8"));

function freshIds() {
  return { "ORG-01": randomUUID(), "ORG-02": randomUUID() };
}

describe("DAT-10 — Jeu fictif chargeable en une commande", { timeout: 120_000 }, () => {
  it("charge les deux organisations, leurs comptes, leurs événements, catalogue, devis, budget et prestataires", async () => {
    const ids = freshIds();
    const result = await loadRecette(dataset, { nodeEnv: "test", organizationIds: ids, emailTag: randomUUID().slice(0, 8) });

    expect(result.organizations.map((organization) => [organization.key, organization.name, organization.events])).toEqual([
      ["ORG-01", "[Recette] Atelier Camille R.", 4],
      ["ORG-02", "[Recette] Maison Belkacem Évènements", 65],
    ]);
    const roles = result.accounts.map((account) => `${account.organisation}:${account.role}:${account.nom}`);
    expect(roles).toEqual(
      expect.arrayContaining([
        "ORG-01:owner:Camille Roussel",
        "ORG-02:owner:Nadia Belkacem",
        "ORG-02:member:Hugo Lemaire",
      ]),
    );
    expect(result.accounts.every((account) => account.email.endsWith("@exemple.test") && account.password.length >= 20)).toBe(true);
    // Lot 26a (UX-11, POR-01) : les clients et le payeur n'ont pas de compte, mais un lien personnel.
    expect(result.accounts.some((account) => account.nom === "Léa Martin")).toBe(false);
    expect(result.links.map((link) => `${link.organisation}:${link.profil}:${link.nom}`)).toEqual(
      expect.arrayContaining(["ORG-01:Marié(e):Léa Martin", "ORG-01:Marié(e):Maxime Dubois", "ORG-01:Payeur:Bernard Martin", "ORG-01:Prestataire:Karim Haddad"]),
    );
    expect(result.links.every((link) => /\/lien#[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(link.url))).toBe(true);

    const eventsOf01 = await listEvents({ organizationId: ids["ORG-01"] });
    expect(eventsOf01).toHaveLength(4);
    // Lot 27a (POR-02) : les tâches faites du jeu le sont dans l'app (31 sur 42 pour EV-REF-01).
    const wedding = eventsOf01.find((event) => event.clients.some((client) => client.firstName === "Léa"))!;
    const tasks = await listEventTasks(ids["ORG-01"], wedding.id);
    expect([tasks.filter((task) => task.done).length, tasks.length]).toEqual([31, 42]);
    // Lot 27b (POR-03) : les fleuristes consultés sont rattachés à leur poste, au statut du jeu.
    const florists = (await listVendorCandidates(ids["ORG-01"], wedding.id)).filter((candidate) => ["Élodie Perrin Fleurs", "Atelier Verveine", "Les Fleurs du Causse"].includes(candidate.vendorName));
    expect(florists.map((candidate) => candidate.status).sort()).toEqual(["dismissed", "quote_received", "quote_received"]);
    expect((await findVendors({ organizationId: ids["ORG-01"] })).map((vendor) => vendor.name)).toContain("Domaine des Tilleuls");
    // Lot 29a (rejeu de SC-08) : le déroulé du 12 juin devient le programme (24 séquences ;
    // le brunch du lendemain n'en est pas), avec le lieu, l'e-mail des mariés et les
    // prestataires consultés rattachés à leur fiche (coordonnées du jour J).
    const program = await getEventProgram(ids["ORG-01"], wedding.id);
    expect(program.items).toHaveLength(24);
    expect(program.items.find((item) => item.label === "Cérémonie laïque")).toMatchObject({ startTime: "15:30" });
    expect((await listEventPlaces(ids["ORG-01"], wedding.id)).map((place) => place.label)).toEqual(["Domaine des Tilleuls"]);
    expect(wedding.clients.map((client) => client.email)).toEqual([expect.stringMatching(/^lea\.martin\+.+@exemple\.test$/), expect.stringMatching(/^maxime\.dubois\+.+@exemple\.test$/)]);
    const caterer = (await listVendorCandidates(ids["ORG-01"], wedding.id)).find((candidate) => candidate.vendorName === "Maison Haddad")!;
    expect(caterer.vendorId).not.toBeNull();
    // Cloisonnement : rien de l'une chez l'autre.
    const eventIdsOf02 = new Set((await listEvents({ organizationId: ids["ORG-02"] })).map((event) => event.id));
    expect(eventsOf01.filter((event) => eventIdsOf02.has(event.id))).toEqual([]);
    expect((await findVendors({ organizationId: ids["ORG-02"] })).map((vendor) => vendor.name)).not.toContain("Domaine des Tilleuls");
  });

  it("refuse de tourner en production, et sur une base où le jeu est déjà chargé", async () => {
    await expect(loadRecette(dataset, { nodeEnv: "production", organizationIds: freshIds() })).rejects.toThrow(RecetteRefusedError);
    const ids = freshIds();
    await loadRecette(dataset, { nodeEnv: "test", organizationIds: ids, emailTag: randomUUID().slice(0, 8) });
    await expect(loadRecette(dataset, { nodeEnv: "test", organizationIds: ids, emailTag: randomUUID().slice(0, 8) })).rejects.toMatchObject({ reason: "already_loaded" });
  });

  it("lot 29a — une durée s'ajoute à l'heure de début, après minuit compris", () => {
    expect(addMinutes("15:30", 45)).toBe("16:15");
    expect(addMinutes("23:30", 90)).toBe("01:00");
  });

  it("dérive des adresses du domaine réservé à la fiction, et une répartition exacte du budget", () => {
    expect(recetteEmail("Élodie Perrin")).toBe("elodie.perrin@exemple.test");
    expect(recetteEmail("Membre fictif 3", "t1")).toBe("membre.fictif.3+t1@exemple.test");
    expect(percentages([1, 1, 1])).toEqual([3333, 3333, 3334]);
  });
});
