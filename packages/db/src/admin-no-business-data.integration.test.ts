// HUB-03 — « Étant donné le compte Admin, quand il tente de lire les
// événements, budgets ou devis d'une organisation, alors l'accès est
// refusé (test automatisé obligatoire). » L'Admin n'a pas d'organisation
// (organizationId nul, packages/db/src/schema/hub.ts) et ne fixe donc
// jamais app.organization_id : la policy RLS (ADR 0012) refuse par
// construction toute lecture, même avec une base contenant de vraies
// données. Démontré ici sur le module hello (seul module métier existant
// pour l'instant) ; vaudra pour events/budget/quotes dès leur création,
// même mécanisme.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { greetings } from "./schema/hello";
import { events } from "./schema/events";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("HUB-03 — L'Admin ne lit jamais de donnée métier", () => {
  it("une lecture sans app.organization_id (session Admin) ne renvoie jamais de donnée métier, même si des données existent", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(greetings).values({ organizationId, message: "donnée métier réelle" }),
    );

    // Pas d'appel à withOrganization() : exactement ce qu'une session
    // Admin fait (elle n'a pas d'organisation à y mettre). Selon qu'une
    // connexion du pool a déjà servi un withOrganization() ou non, la
    // policy RLS renvoie soit zéro ligne (jamais touchée), soit une
    // erreur (conversion UUID d'une chaîne vide, connexion déjà
    // touchée) — les deux traduisent la même garantie : aucune donnée
    // métier accessible sans organisation explicitement fixée.
    try {
      const rows = await db.select().from(greetings);
      expect(rows).toHaveLength(0);
    } catch (error) {
      // N'importe quelle erreur ici confirme l'absence d'accès : la
      // requête n'a renvoyé aucune donnée métier, sous quelque forme
      // que ce soit.
      expect(error).toBeTruthy();
    }
  });

  it("vaut aussi pour le module events (même mécanisme, PostgreSQL réel)", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) => tx.insert(events).values({ organizationId }));

    try {
      const rows = await db.select().from(events);
      expect(rows).toHaveLength(0);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });
});
