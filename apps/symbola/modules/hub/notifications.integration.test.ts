// Lot 53 (HUB-15, UX-16, ARC-09 ; D1 à D4 ; ADR 0095, ADR 0096) — notifications de l'équipe contre un vrai
// PostgreSQL (RLS), la file des e-mails (Mailpit) et un faux envoyeur Web Push : une par destinataire et
// par objet, chaque sorte coupée par canal, plages de silence et jour J (horloge simulée, changement
// d'heure), récapitulatif une fois par jour, push sans donnée personnelle, abonnement disparu retiré ;
// isolation entre organisations et entre comptes, abus (adresse extérieure, abonnement en http).
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { notifications, pushSubscriptions } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import type { PushMessage } from "@symbola/contracts";
import {
  countUnreadNotifications,
  deliverDueNotifications,
  getNotificationPreferences,
  jobKeyExists,
  listNotifications,
  listPushDevices,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationInputError,
  notify,
  purgeNotifications,
  removePushDevice,
  saveNotificationSettings,
  savePushSubscription,
  sendDueDigests,
  setNotificationPreference,
  setPushSender,
  type PushTarget,
} from "./service";

const KEY = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const subscription = (name: string) => ({ endpoint: `https://push.example.test/${name}-${randomUUID()}`, keys: KEY });
const HREF = "/devis/11111111-1111-4111-8111-111111111111";

async function team() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  const owner = await createUser(db, { organizationId, email: `proprietaire-${randomUUID()}@example.test`, role: "owner" });
  const member = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, role: "member" });
  return { organizationId, ownerId: owner.id, memberId: member.id };
}

function fakePush(outcome: (target: PushTarget) => "sent" | "gone" | "failed" = () => "sent") {
  const sent: { target: PushTarget; message: PushMessage }[] = [];
  setPushSender({ send: async (target, message) => (sent.push({ target, message }), outcome(target)) });
  return sent;
}

afterEach(() => setPushSender(null));

const quiet = { digestEnabled: true, digestHour: 7, quietEnabled: true, quietStartMinute: 21 * 60, quietEndMinute: 8 * 60, quietSundays: false, dayOfOverride: true };

describe("HUB-15 — Notifications dans l'application, par e-mail et en push ; chaque sorte se coupe séparément", () => {
  it("une notification par destinataire et par objet ; sans planner principal, la Propriétaire reçoit tout (D3)", async () => {
    const { organizationId, ownerId, memberId } = await team();
    expect(await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", params: { number: "D-2027-0042" }, href: HREF })).toBe(1);
    expect(await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", params: { number: "D-2027-0042" }, href: HREF })).toBe(0);
    expect(await listNotifications(organizationId, ownerId)).toEqual([expect.objectContaining({ type: "quote_signed", href: HREF, params: { number: "D-2027-0042" }, readAt: null })]);
    expect(await listNotifications(organizationId, memberId)).toEqual([]);
    expect(await countUnreadNotifications(organizationId, ownerId)).toBe(1);
    // Un évènement d'essai ne prévient personne.
    expect(await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q2", href: HREF, isDemo: true })).toBe(0);
  });

  it("coupée sur un canal, la sorte ne part plus par lui ; coupée partout, elle n'existe pas ; les autres sortes restent", async () => {
    const { organizationId, ownerId } = await team();
    await setNotificationPreference(organizationId, ownerId, { type: "quote_signed", channel: "email", enabled: false });
    const preferences = await getNotificationPreferences(organizationId, ownerId);
    expect(preferences.find((preference) => preference.type === "quote_signed" && preference.channel === "email")?.enabled).toBe(false);
    expect(preferences.find((preference) => preference.type === "transfer_declared" && preference.channel === "email")?.enabled).toBe(true);
    await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", href: HREF });
    await notify({ organizationId, type: "transfer_declared", eventId: null, objectKey: "t1", params: { amountCents: 120000, number: "D-1" }, href: HREF });
    const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(notifications).where(eq(notifications.organizationId, organizationId)));
    expect(rows.find((row) => row.type === "quote_signed")).toMatchObject({ emailState: "none", pushState: "pending", inApp: true });
    expect(rows.find((row) => row.type === "transfer_declared")).toMatchObject({ emailState: "pending" });
    for (const channel of ["app", "push"] as const) await setNotificationPreference(organizationId, ownerId, { type: "quote_signed", channel, enabled: false });
    expect(await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q2", href: HREF })).toBe(0);
    await expect(setNotificationPreference(organizationId, ownerId, { type: "inconnue", channel: "email", enabled: true })).rejects.toBeInstanceOf(NotificationInputError);
  });

  it("une sorte immédiate part tout de suite par e-mail (objet sans donnée personnelle) ; lue avant l'envoi, elle ne part plus", async () => {
    const { organizationId, ownerId } = await team();
    fakePush();
    const now = new Date("2027-01-15T10:00:00Z");
    await notify({ organizationId, type: "transfer_declared", eventId: null, objectKey: "t1", params: { amountCents: 120000, number: "D-1" }, href: HREF, now });
    const [created] = await listNotifications(organizationId, ownerId);
    expect(await deliverDueNotifications(organizationId, now)).toMatchObject({ emails: 1 });
    expect(await jobKeyExists(organizationId, `notification:${created!.id}`)).toBe(true);
    expect(await deliverDueNotifications(organizationId, now)).toEqual({ emails: 0, pushes: 0 });
    await notify({ organizationId, type: "transfer_declared", eventId: null, objectKey: "t2", params: { amountCents: 5000, number: "D-2" }, href: HREF, now });
    await markAllNotificationsRead(organizationId, ownerId, now);
    expect(await deliverDueNotifications(organizationId, now)).toEqual({ emails: 0, pushes: 0 });
  });
});

describe("UX-16 — Notifier utile : récapitulatif quotidien, plages de silence, jour J (D1, D2 ; horloge simulée)", () => {
  it("pendant le silence de la nuit, ni push ni e-mail immédiat : ils partent à sa fin", async () => {
    const { organizationId, ownerId } = await team();
    const sent = fakePush();
    await saveNotificationSettings(organizationId, ownerId, quiet);
    await savePushSubscription(organizationId, ownerId, subscription("mac"), "Safari · macOS");
    const night = new Date("2027-01-15T22:30:00Z"); // 23:30 à Paris
    await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", params: { number: "D-1" }, href: HREF, now: night });
    expect(await deliverDueNotifications(organizationId, new Date("2027-01-16T06:59:00Z"))).toEqual({ emails: 0, pushes: 0 });
    expect(await deliverDueNotifications(organizationId, new Date("2027-01-16T07:00:00Z"))).toEqual({ emails: 1, pushes: 1 });
    expect(sent).toHaveLength(1);
  });

  it("le jour d'un évènement, une alerte du jour J passe outre le silence ; la veille, non ; sans le réglage, non plus", async () => {
    const { organizationId, ownerId } = await team();
    const sent = fakePush();
    await saveNotificationSettings(organizationId, ownerId, quiet);
    await savePushSubscription(organizationId, ownerId, subscription("iphone"), "Safari · iOS");
    const saturdayNight = new Date("2027-06-12T21:30:00Z"); // 23:30 à Paris, le jour du mariage
    await notify({ organizationId, type: "day_of_alert", eventId: randomUUID(), objectKey: "i1", href: "/jour-j/22222222-2222-4222-8222-222222222222", eventDate: "2027-06-12", now: saturdayNight });
    await notify({ organizationId, type: "day_of_alert", eventId: randomUUID(), objectKey: "i2", href: "/jour-j/22222222-2222-4222-8222-222222222222", eventDate: "2027-06-13", now: saturdayNight });
    expect((await deliverDueNotifications(organizationId, saturdayNight)).pushes).toBe(1);
    await saveNotificationSettings(organizationId, ownerId, { ...quiet, dayOfOverride: false });
    await notify({ organizationId, type: "day_of_alert", eventId: randomUUID(), objectKey: "i3", href: "/jour-j/22222222-2222-4222-8222-222222222222", eventDate: "2027-06-12", now: saturdayNight });
    expect((await deliverDueNotifications(organizationId, saturdayNight)).pushes).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("le récapitulatif part une fois par jour, à l'heure du fuseau, changement d'heure compris ; il regroupe ce qui est nouveau et ce qui attend", async () => {
    const { organizationId, ownerId } = await team();
    await notify({ organizationId, type: "prospect_request", eventId: null, objectKey: "r1", href: "/events/pipeline", now: new Date("2027-03-27T15:00:00Z") });
    const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(notifications).where(eq(notifications.organizationId, organizationId)));
    expect(rows[0]).toMatchObject({ emailState: "digest" });
    const extras = async () => ["3 tâches à faire aujourd'hui, dont 1 en retard."];
    // Dimanche 28 mars 2027, passage à l'heure d'été : 7 h à Paris = 5 h UTC.
    expect(await sendDueDigests(organizationId, extras, new Date("2027-03-28T04:59:00Z"))).toBe(0);
    expect(await sendDueDigests(organizationId, extras, new Date("2027-03-28T05:00:00Z"))).toBe(1);
    expect(await sendDueDigests(organizationId, extras, new Date("2027-03-28T09:00:00Z"))).toBe(0);
    expect(await jobKeyExists(organizationId, `digest:${ownerId}:2027-03-28`)).toBe(true);
    const after = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(notifications).where(eq(notifications.id, rows[0]!.id)));
    expect(after[0]!.emailState).toBe("sent");
    // Sans récapitulatif : rien le lendemain.
    await saveNotificationSettings(organizationId, ownerId, { ...quiet, digestEnabled: false });
    expect(await sendDueDigests(organizationId, extras, new Date("2027-03-29T06:00:00Z"))).toBe(0);
  });

  it("chaque notification mène à l'écran où agir ; ouverte, elle est lue ; elle s'efface après 90 jours", async () => {
    const { organizationId, ownerId } = await team();
    await notify({ organizationId, type: "task_overdue", eventId: null, objectKey: "t1", params: { label: "Réserver le traiteur" }, href: "/events/33333333-3333-4333-8333-333333333333?onglet=retroplanning", now: new Date("2027-01-01T08:00:00Z") });
    const [notification] = await listNotifications(organizationId, ownerId);
    expect(notification!.href).toMatch(/^\/events\//);
    const read = await markNotificationRead(organizationId, ownerId, notification!.id);
    expect(read?.readAt).not.toBeNull();
    expect(await countUnreadNotifications(organizationId, ownerId)).toBe(0);
    expect(await purgeNotifications(organizationId, new Date("2027-03-15T08:00:00Z"))).toMatchObject({ notifications: 0 });
    expect(await purgeNotifications(organizationId, new Date("2027-04-02T08:00:00Z"))).toMatchObject({ notifications: 1 });
  });
});

describe("ARC-09 — Notifications push (lot 53, D4)", () => {
  it("par appareil : abonnement, envoi chiffré par la bibliothèque (simulée), sans donnée personnelle ; désabonnement", async () => {
    const { organizationId, ownerId } = await team();
    const sent = fakePush();
    const device = await savePushSubscription(organizationId, ownerId, subscription("mac"), "Chrome · macOS");
    expect(await listPushDevices(organizationId, ownerId)).toEqual([expect.objectContaining({ id: device.id, label: "Chrome · macOS" })]);
    const now = new Date("2027-01-15T10:00:00Z");
    await notify({ organizationId, type: "client_decision", eventId: null, objectKey: "d1", params: { title: "Choix du traiteur Léa Martin" }, href: "/events/44444444-4444-4444-8444-444444444444?onglet=maries", now });
    expect((await deliverDueNotifications(organizationId, now)).pushes).toBe(1);
    expect(sent[0]!.message).toEqual({ title: "Décision du client", body: "Voir la décision", url: "/events/44444444-4444-4444-8444-444444444444?onglet=maries", tag: expect.stringMatching(/^client_decision:/) });
    expect(JSON.stringify(sent[0]!.message)).not.toContain("Léa");
    expect(await removePushDevice(organizationId, ownerId, { id: device.id })).toBe(1);
    expect(await listPushDevices(organizationId, ownerId)).toEqual([]);
  });

  it("un abonnement que le service de push dit disparu est retiré", async () => {
    const { organizationId, ownerId } = await team();
    fakePush(() => "gone");
    await savePushSubscription(organizationId, ownerId, subscription("ancien"), "Firefox · Linux");
    const now = new Date("2027-01-15T10:00:00Z");
    await notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", href: HREF, now });
    expect((await deliverDueNotifications(organizationId, now)).pushes).toBe(0);
    expect(await listPushDevices(organizationId, ownerId)).toEqual([]);
  });
});

describe("SEC-36 — Isolation et abus des notifications et des abonnements (lot 53)", () => {
  it("une autre organisation, ou un autre compte, ne voit ni ne lit les notifications ni les abonnements", async () => {
    const a = await team();
    const b = await team();
    await notify({ organizationId: a.organizationId, type: "quote_signed", eventId: null, objectKey: "q1", href: HREF });
    await savePushSubscription(a.organizationId, a.ownerId, subscription("mac"), "Mac");
    const [notification] = await listNotifications(a.organizationId, a.ownerId);
    expect(await listNotifications(b.organizationId, a.ownerId)).toEqual([]);
    expect(await listNotifications(a.organizationId, a.memberId)).toEqual([]);
    expect(await markNotificationRead(b.organizationId, b.ownerId, notification!.id)).toBeNull();
    expect(await markNotificationRead(a.organizationId, a.memberId, notification!.id)).toBeNull();
    expect(await listPushDevices(b.organizationId, a.ownerId)).toEqual([]);
    expect(await removePushDevice(a.organizationId, a.memberId, { id: (await listPushDevices(a.organizationId, a.ownerId))[0]!.id })).toBe(0);
    // La base elle-même (RLS) : dans le contexte de B, aucune ligne de A.
    const leaked = await withOrganization(appDatabase(), b.organizationId, async (tx) => [
      ...(await tx.select().from(notifications).where(eq(notifications.organizationId, a.organizationId))),
      ...(await tx.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId, a.organizationId)))),
    ]);
    expect(leaked).toEqual([]);
  });

  it("abus : une adresse extérieure comme action, un abonnement en http ou mal formé sont refusés", async () => {
    const { organizationId, ownerId } = await team();
    await expect(notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", href: "https://ailleurs.test/piege" })).rejects.toBeInstanceOf(NotificationInputError);
    await expect(notify({ organizationId, type: "quote_signed", eventId: null, objectKey: "q1", href: "//ailleurs.test" })).rejects.toBeInstanceOf(NotificationInputError);
    await expect(savePushSubscription(organizationId, ownerId, { endpoint: "http://push.example.test/1", keys: KEY }, "Mac")).rejects.toBeInstanceOf(NotificationInputError);
    await expect(savePushSubscription(organizationId, ownerId, { endpoint: "https://push.example.test/1", keys: { p256dh: "x", auth: "y" } }, "Mac")).rejects.toBeInstanceOf(NotificationInputError);
    await expect(saveNotificationSettings(organizationId, ownerId, { ...quiet, digestHour: 25 })).rejects.toBeInstanceOf(NotificationInputError);
  });
});
