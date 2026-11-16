// Lot 38b (HUB-21 ; D10 ; ADR 0072) — modèles de messages de la planner, contre un vrai PostgreSQL
// (RLS), par la porte d'entrée du hub. Tests d'abus (CLAUDE.md § 2.11) : le modèle d'une
// organisation ne se lit, ne se modifie, ne se restaure ni ne se supprime depuis une autre.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { starterMessageTemplates } from "@symbola/starter-templates";
import {
  addStarterMessageTemplates,
  createMessageTemplate,
  deleteMessageTemplate,
  duplicateMessageTemplate,
  getMessageTemplate,
  listMessageTemplates,
  MessageTemplateInvalidError,
  MessageTemplateNotFoundError,
  messageTemplatesForEventType,
  renderMessageForTemplate,
  restoreMessageTemplateVersion,
  saveMessageTemplate,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function organization(): Promise<string> {
  return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
}

const MEETING = { name: "Proposer un rendez-vous", eventTypeId: null, subject: "Rendez-vous pour {{évènement}}", body: "Bonjour {{prénom}},\n\nJe vous propose le … à …\n\n{{organisation}}" };

describe("HUB-21 — Modèles par type d'évènement, duplicables et versionnés (messages, lot 38b)", () => {
  it("chaque enregistrement d'un texte changé fait une version ; les précédentes restent telles quelles ; un texte inchangé n'en fait pas", async () => {
    const organizationId = await organization();
    const created = await createMessageTemplate({ organizationId, locale: "fr", ...MEETING });
    expect(created).toMatchObject({ version: 1, subject: MEETING.subject, versions: [{ version: 1 }] });

    const second = await saveMessageTemplate({ organizationId, templateId: created.id, ...MEETING, body: "Bonjour {{prénom}},\n\nÀ l'atelier le … à …" });
    expect(second.version).toBe(2);
    expect(second.versions.map((version) => [version.version, version.body])).toEqual([
      [2, "Bonjour {{prénom}},\n\nÀ l'atelier le … à …"],
      [1, MEETING.body],
    ]);
    const renamed = await saveMessageTemplate({ organizationId, templateId: created.id, ...MEETING, name: "Rendez-vous", body: "Bonjour {{prénom}},\n\nÀ l'atelier le … à …" });
    expect(renamed).toMatchObject({ name: "Rendez-vous", version: 2 });
    expect(renamed.versions).toHaveLength(2);
  });

  it("restaurer une version en fait une nouvelle, avec son texte ; l'historique ne se réécrit pas", async () => {
    const organizationId = await organization();
    const created = await createMessageTemplate({ organizationId, locale: "fr", ...MEETING });
    await saveMessageTemplate({ organizationId, templateId: created.id, ...MEETING, subject: "Autre objet" });
    const restored = await restoreMessageTemplateVersion({ organizationId, templateId: created.id, version: 1 });
    expect(restored).toMatchObject({ version: 3, subject: MEETING.subject });
    expect(restored.versions.map((version) => version.subject)).toEqual([MEETING.subject, "Autre objet", MEETING.subject]);
    await expect(restoreMessageTemplateVersion({ organizationId, templateId: created.id, version: 9 })).rejects.toBeInstanceOf(MessageTemplateNotFoundError);
  });

  it("dupliquer fait un modèle nouveau, en version 1, avec le texte en cours ; modifier la copie ne change pas l'original", async () => {
    const organizationId = await organization();
    const created = await createMessageTemplate({ organizationId, locale: "en", ...MEETING });
    await saveMessageTemplate({ organizationId, templateId: created.id, ...MEETING, subject: "Objet v2" });
    const copy = await duplicateMessageTemplate({ organizationId, templateId: created.id, name: "Copie de Proposer un rendez-vous" });
    expect(copy).toMatchObject({ name: "Copie de Proposer un rendez-vous", version: 1, locale: "en", subject: "Objet v2" });
    await saveMessageTemplate({ organizationId, templateId: copy.id, ...MEETING, name: copy.name, subject: "Objet de la copie" });
    expect((await getMessageTemplate(organizationId, created.id))!.subject).toBe("Objet v2");
  });

  it("le modèle du type de l'évènement passe avant celui de tous ; jamais celui d'un autre type", async () => {
    const organizationId = await organization();
    const [wedding, seminar] = [randomUUID(), randomUUID()];
    await createMessageTemplate({ organizationId, locale: "fr", ...MEETING, name: "A — pour tous" });
    await createMessageTemplate({ organizationId, locale: "fr", ...MEETING, name: "B — mariage", eventTypeId: wedding });
    await createMessageTemplate({ organizationId, locale: "fr", ...MEETING, name: "C — séminaire", eventTypeId: seminar });
    expect((await messageTemplatesForEventType(organizationId, wedding)).map((template) => template.name)).toEqual(["B — mariage", "A — pour tous"]);
    expect((await messageTemplatesForEventType(organizationId, null)).map((template) => template.name)).toEqual(["A — pour tous"]);
  });

  it("une variable inconnue est refusée ; le nom, l'objet et le texte sont obligatoires", async () => {
    const organizationId = await organization();
    expect(await createMessageTemplate({ organizationId, locale: "fr", ...MEETING, body: "Voici votre {{lien}}" }).catch((error: unknown) => error)).toMatchObject({ problems: { unknown: ["lien"] } });
    const empty = await createMessageTemplate({ organizationId, locale: "fr", ...MEETING, name: " ", subject: "" }).catch((error: unknown) => error);
    expect(empty).toBeInstanceOf(MessageTemplateInvalidError);
    expect(empty).toMatchObject({ problems: { empty: ["name", "subject"] } });
    expect(await listMessageTemplates(organizationId)).toEqual([]);
  });

  it("les deux modèles de départ s'ajoutent une fois ; le rendu remplit les variables et nomme celles qui manquent", async () => {
    const organizationId = await organization();
    expect(await addStarterMessageTemplates(organizationId, "fr")).toBe(2);
    expect(await addStarterMessageTemplates(organizationId, "fr")).toBe(0);
    const templates = await listMessageTemplates(organizationId);
    expect(templates.map((template) => template.name).sort()).toEqual(starterMessageTemplates("fr").map((starter) => starter.name).sort());
    const meeting = templates.find((template) => template.name === "Proposer un rendez-vous")!;
    const rendered = await renderMessageForTemplate(organizationId, meeting.id, { first_name: "Léa & Maxime", event: "votre mariage", organization: "Atelier Camille R." });
    expect(rendered).toMatchObject({ subject: "Rendez-vous pour votre mariage", missing: [] });
    expect(rendered!.body.startsWith("Bonjour Léa & Maxime,\n\n")).toBe(true);
    expect((await renderMessageForTemplate(organizationId, meeting.id, { first_name: "Léa" }))!.missing).toEqual(["event", "organization"]);
  });

  it("isolation : le modèle de A ne se lit, ne se modifie, ne se restaure ni ne se supprime depuis B", async () => {
    const a = await organization();
    const b = await organization();
    const created = await createMessageTemplate({ organizationId: a, locale: "fr", ...MEETING });
    expect(await getMessageTemplate(b, created.id)).toBeNull();
    expect(await listMessageTemplates(b)).toEqual([]);
    expect(await renderMessageForTemplate(b, created.id, {})).toBeNull();
    await expect(saveMessageTemplate({ organizationId: b, templateId: created.id, ...MEETING, subject: "falsifié" })).rejects.toBeInstanceOf(MessageTemplateNotFoundError);
    await expect(restoreMessageTemplateVersion({ organizationId: b, templateId: created.id, version: 1 })).rejects.toBeInstanceOf(MessageTemplateNotFoundError);
    await expect(duplicateMessageTemplate({ organizationId: b, templateId: created.id, name: "Copie" })).rejects.toBeInstanceOf(MessageTemplateNotFoundError);
    await expect(deleteMessageTemplate(b, created.id)).rejects.toBeInstanceOf(MessageTemplateNotFoundError);
    expect((await getMessageTemplate(a, created.id))!.subject).toBe(MEETING.subject);
    await deleteMessageTemplate(a, created.id);
    expect(await getMessageTemplate(a, created.id)).toBeNull();
  });
});
