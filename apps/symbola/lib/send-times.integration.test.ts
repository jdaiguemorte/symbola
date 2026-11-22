// Lot 66a (HUB-28, CHR-05 ; D1 ; ADR 0112) — l'heure d'envoi des automatismes, contre un vrai
// PostgreSQL (RLS) et une horloge simulée : l'heure par défaut et celle d'un automatisme ; la tâche
// passe à l'heure (à cinq minutes près), puis au plus une fois par heure pendant le rattrapage ; un
// réglage s'applique au passage suivant ; le fuseau d'un évènement à l'étranger ; une heure hors du
// quart d'heure est refusée. Tests d'abus : une organisation ne lit ni ne change l'heure d'une autre.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { sendingSettings } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createProspect, createProspectSource, setEventTimeZone } from "@/modules/events/service";
import { AutomationInputError, getAutomationGate, getDefaultSendTime, setAutomationSendTime, setDefaultSendTime } from "@/modules/hub/service";
import { automationHooks, defaultSendTimeCheck, forgetSendTimes, sendTimeDue } from "./automation-gates";

const db = appDatabase();

async function organization(): Promise<string> {
  return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
}

// Paris en hiver (UTC+1) : « 09:00 » à Paris = 08:00Z.
const at = (iso: string) => new Date(iso);

beforeEach(() => forgetSendTimes());

describe("HUB-28 — L'heure d'envoi des automatismes (66a, D1)", { timeout: 60_000 }, () => {
  it("sans réglage, 9 h à Paris ; la tâche passe à l'heure, puis au plus une fois par heure pendant le rattrapage", async () => {
    const organizationId = await organization();
    expect(await getDefaultSendTime(organizationId)).toBe("09:00");
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T07:55:00Z"))).toBe(false);
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T08:00:00Z"))).toBe(true);
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T08:05:00Z"))).toBe(false);
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T09:00:00Z"))).toBe(true);
    // Après le rattrapage (six heures), plus rien jusqu'au lendemain 9 h.
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T14:30:00Z"))).toBe(false);
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-13T08:00:00Z"))).toBe(true);
  });

  it("l'heure propre d'un automatisme prime sur l'heure par défaut ; un réglage s'applique au passage suivant ; vide, l'heure par défaut revient", async () => {
    const organizationId = await organization();
    await setDefaultSendTime(organizationId, "08:30");
    await setAutomationSendTime(organizationId, "invoice_reminder", "10:30");
    expect((await getAutomationGate(organizationId, "invoice_reminder")).sendTime).toBe("10:30");
    expect(await sendTimeDue(organizationId, "invoice_reminder", at("2027-01-12T07:30:00Z"))).toBe(false); // 8 h 30
    expect(await sendTimeDue(organizationId, "payment_due_reminder", at("2027-01-12T07:30:00Z"))).toBe(true); // l'heure par défaut
    expect(await sendTimeDue(organizationId, "invoice_reminder", at("2027-01-12T09:30:00Z"))).toBe(true); // 10 h 30
    // La relance du brief et le RIB du 8e jour suivent l'heure par défaut.
    expect(await defaultSendTimeCheck(organizationId, at("2027-01-12T07:15:00Z"))).toBeNull();
    expect(await defaultSendTimeCheck(organizationId, at("2027-01-12T07:30:00Z"))).not.toBeNull();
    await setAutomationSendTime(organizationId, "invoice_reminder", null);
    forgetSendTimes(organizationId);
    expect((await getAutomationGate(organizationId, "invoice_reminder")).sendTime).toBeNull();
    expect(await sendTimeDue(organizationId, "invoice_reminder", at("2027-01-13T07:30:00Z"))).toBe(true);
    const hooks = await automationHooks(organizationId, "invoice_reminder", at("2027-01-13T07:30:00Z"));
    expect(hooks?.isSendTime?.(at("2027-01-13T07:29:00Z"))).toBe(false);
    expect(hooks?.isSendTime?.(at("2027-01-13T07:30:00Z"))).toBe(true);
  });

  it("l'heure s'entend dans le fuseau d'un évènement à venir : 9 h à La Réunion ouvre le passage, et l'envoi de cet évènement seulement", async () => {
    const organizationId = await organization();
    const owner = await createUser(db, { organizationId, email: `planner-66a-${randomUUID()}@symbola.test`, role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-06-12" });
    await setEventTimeZone(organizationId, event.id, "Indian/Reunion");
    const reunionNine = at("2027-01-12T05:00:00Z"); // 9 h à La Réunion, 6 h à Paris
    expect(await sendTimeDue(organizationId, "vendor_roadmap", reunionNine)).toBe(true);
    const hooks = await automationHooks(organizationId, "vendor_roadmap", reunionNine);
    expect(hooks?.isSendTime?.(reunionNine, "Indian/Reunion")).toBe(true);
    expect(hooks?.isSendTime?.(reunionNine, "Europe/Paris")).toBe(false);
  });

  it("une heure hors du quart d'heure, ou un automatisme sans heure fixe, est refusé", async () => {
    const organizationId = await organization();
    await expect(setDefaultSendTime(organizationId, "09:10")).rejects.toBeInstanceOf(AutomationInputError);
    await expect(setAutomationSendTime(organizationId, "payment_due_reminder", "25:00")).rejects.toBeInstanceOf(AutomationInputError);
    await expect(setAutomationSendTime(organizationId, "risk_radar", "07:00")).rejects.toBeInstanceOf(AutomationInputError);
    expect(await getDefaultSendTime(organizationId)).toBe("09:00");
  });
});

describe("HUB-28 — Isolation de l'heure d'envoi entre organisations (66a)", { timeout: 60_000 }, () => {
  it("une organisation ne lit ni ne change l'heure d'une autre", async () => {
    const a = await organization();
    const b = await organization();
    await setDefaultSendTime(a, "07:00");
    expect(await getDefaultSendTime(b)).toBe("09:00");
    const seenByB = await withOrganization(db, b, (tx) => tx.select().from(sendingSettings));
    expect(seenByB.every((row) => row.organizationId === b)).toBe(true);
    await expect(withOrganization(db, b, (tx) => tx.insert(sendingSettings).values({ organizationId: a, defaultSendTime: "06:00" }))).rejects.toThrow();
    expect(await getDefaultSendTime(a)).toBe("07:00");
  });
});
