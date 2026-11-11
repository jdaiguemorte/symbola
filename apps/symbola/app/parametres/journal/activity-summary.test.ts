// Lot 23 (HUB-16, ADR 0060) — chaque action du catalogue et chaque table dont
// les suppressions vont au journal a son libellé, en français et en anglais
// (aucun texte affiché en dur, CLAUDE.md §2.10).
import { getTableConfig } from "drizzle-orm/pg-core";
import { AUDIT_ACTIONS } from "@symbola/contracts";
import { DELETION_NOT_JOURNALED, TECHNICAL_TABLES } from "@symbola/db/row-stamps";
import * as budget from "@symbola/db/schema/budget";
import * as events from "@symbola/db/schema/events";
import * as hub from "@symbola/db/schema/hub";
import * as quotes from "@symbola/db/schema/quotes";
import * as vendors from "@symbola/db/schema/vendors";
import en from "@symbola/i18n/messages/en.json";
import fr from "@symbola/i18n/messages/fr.json";
import { describe, expect, it } from "vitest";
import { actionLabel, actorLabel, activityDetail, objectHref } from "./activity-summary";

function journaledTables(): string[] {
  const names = new Set<string>();
  for (const schema of [budget, events, hub, quotes, vendors]) {
    for (const value of Object.values(schema)) {
      try {
        const config = getTableConfig(value as never);
        if (config.schema && config.name) names.add(`${config.schema}.${config.name}`);
      } catch {
        // pas une table (type énuméré, constante)
      }
    }
  }
  return [...names].filter((name) => !(name in TECHNICAL_TABLES) && !(name in DELETION_NOT_JOURNALED)).sort();
}

describe("HUB-16 — Libellés du journal d'activité", () => {
  it("chaque action du catalogue a son libellé en français et en anglais", () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      const key = action.replaceAll(".", "_");
      expect(fr.ActivityLog.actions, action).toHaveProperty(key);
      expect(en.ActivityLog.actions, action).toHaveProperty(key);
    }
  });

  it("chaque table dont les suppressions vont au journal a son libellé en français et en anglais", () => {
    const tables = journaledTables();
    expect(tables.length).toBeGreaterThan(50);
    for (const table of tables) {
      const key = table.replace(".", "_");
      expect(fr.ActivityLog.tables, table).toHaveProperty(key);
      expect(en.ActivityLog.tables, table).toHaveProperty(key);
    }
  });

  it("une suppression se lit avec son objet ; un geste de plateforme avec son auteur, jamais une adresse", () => {
    const t = (key: string, values?: Record<string, string | number>) => `${key}${values ? JSON.stringify(values) : ""}`;
    expect(actionLabel({ action: "events.prospect_sources.deleted" }, t, () => true)).toBe('deleted{"object":"tables.events_prospect_sources"}');
    expect(actionLabel({ action: "inconnue.table.deleted" }, t, () => false)).toBe('deleted{"object":"objectGeneric"}');
    expect(actorLabel({ actorKind: "operator", actorLabel: null, action: "ops.database.opened" }, t)).toBe("actorOperator");
    expect(actorLabel({ actorKind: "system", actorLabel: null, action: "hub.session.failed" }, t)).toBe("actorAttempt");
    expect(actorLabel({ actorKind: "member", actorLabel: null, action: "quotes.quote.sent" }, t)).toBe("actorUnknown");
    expect(activityDetail({ action: "ops.database.opened", details: {}, reason: "contrôle" }, t, "fr")).toBe('reasonLabel{"reason":"contrôle"}');
    expect(objectHref({ action: "quotes.quote.sent", objectType: "quote", objectId: "q" })).toEqual({ href: "/devis/q", kind: "quote" });
    expect(objectHref({ action: "quotes.quotes.deleted", objectType: "quotes.quotes", objectId: "q" })).toBeNull();
  });
});
