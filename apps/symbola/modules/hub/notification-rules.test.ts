import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES, type NotificationSettingsView } from "@symbola/contracts";
import { starterNotifications } from "@symbola/starter-templates";
import { notificationText } from "./notifications";
import { deliveryPlan, digestDue, isQuiet, localClock, quietEndsAt, typeDefaults } from "./notification-rules";

const PARIS = "Europe/Paris";
const settings = (overrides: Partial<NotificationSettingsView> = {}): NotificationSettingsView => ({
  digestEnabled: true,
  digestHour: 7,
  quietEnabled: true,
  quietStartMinute: 21 * 60,
  quietEndMinute: 8 * 60,
  quietSundays: false,
  dayOfOverride: true,
  timeZone: PARIS,
  ...overrides,
});

describe("UX-16 — Notifier utile : récapitulatif, plages de silence et jour J (lot 53, D1, D2)", () => {
  it("chaque sorte du catalogue a ses réglages de départ, en données (notifications.json)", () => {
    const starter = starterNotifications();
    for (const type of NOTIFICATION_TYPES) expect(starter.types[type], type).toBeDefined();
    expect(Object.keys(starter.types).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    expect(starter.settings.digestEnabled).toBe(true);
  });

  it("lit l'heure dans le fuseau de l'organisation, changement d'heure compris", () => {
    // Hiver : UTC+1 ; été : UTC+2 (dernier dimanche de mars 2027 : le 28).
    expect(localClock(new Date("2027-01-15T06:00:00Z"), PARIS)).toMatchObject({ date: "2027-01-15", minute: 7 * 60, weekday: 5 });
    expect(localClock(new Date("2027-03-28T06:00:00Z"), PARIS)).toMatchObject({ date: "2027-03-28", minute: 8 * 60, weekday: 0 });
    expect(localClock(new Date("2027-03-27T23:30:00Z"), PARIS)).toMatchObject({ date: "2027-03-28", minute: 30 });
  });

  it("respecte la plage de silence de la nuit, qui passe minuit, et le dimanche si la personne l'a choisi", () => {
    expect(isQuiet(settings(), new Date("2027-01-15T19:59:00Z"))).toBe(false); // 20:59 à Paris
    expect(isQuiet(settings(), new Date("2027-01-15T20:00:00Z"))).toBe(true); // 21:00
    expect(isQuiet(settings(), new Date("2027-01-16T06:59:00Z"))).toBe(true); // 07:59
    expect(isQuiet(settings(), new Date("2027-01-16T07:00:00Z"))).toBe(false); // 08:00
    expect(isQuiet(settings({ quietEnabled: false }), new Date("2027-01-15T22:00:00Z"))).toBe(false);
    const sunday = new Date("2027-01-17T12:00:00Z");
    expect(isQuiet(settings(), sunday)).toBe(false);
    expect(isQuiet(settings({ quietSundays: true }), sunday)).toBe(true);
  });

  it("ce qui tombe pendant le silence attend sa fin, à l'heure locale même le jour du changement d'heure", () => {
    expect(quietEndsAt(settings(), new Date("2027-01-15T22:00:00Z")).toISOString()).toBe("2027-01-16T07:00:00.000Z");
    // Nuit du 27 au 28 mars 2027 : la fin à 8 h de Paris est 6 h UTC (heure d'été).
    expect(quietEndsAt(settings(), new Date("2027-03-27T22:00:00Z")).toISOString()).toBe("2027-03-28T06:00:00.000Z");
    // Samedi soir avec le dimanche silencieux : la fin est lundi 8 h.
    expect(quietEndsAt(settings({ quietSundays: true }), new Date("2027-01-16T21:00:00Z")).toISOString()).toBe("2027-01-18T07:00:00.000Z");
  });

  it("envoie le récapitulatif une fois par jour, à partir de l'heure réglée dans le fuseau, changement d'heure compris", () => {
    expect(digestDue(settings(), null, new Date("2027-01-15T05:59:00Z"))).toBe(false); // 06:59
    expect(digestDue(settings(), null, new Date("2027-01-15T06:00:00Z"))).toBe(true); // 07:00
    expect(digestDue(settings(), "2027-01-15", new Date("2027-01-15T09:00:00Z"))).toBe(false);
    expect(digestDue(settings(), "2027-01-15", new Date("2027-01-16T06:00:00Z"))).toBe(true);
    // Jour du passage à l'heure d'été : 7 h de Paris = 5 h UTC.
    expect(digestDue(settings(), "2027-03-27", new Date("2027-03-28T04:59:00Z"))).toBe(false);
    expect(digestDue(settings(), "2027-03-27", new Date("2027-03-28T05:00:00Z"))).toBe(true);
    expect(digestDue(settings({ digestEnabled: false }), null, new Date("2027-01-15T09:00:00Z"))).toBe(false);
  });
});

describe("HUB-15 — Chaque sorte se coupe séparément, par canal (lot 53)", () => {
  const now = new Date("2027-01-15T10:00:00Z"); // 11:00 à Paris, hors silence

  it("une sorte non immédiate va dans le récapitulatif ; une sorte immédiate part tout de suite", () => {
    const signed = deliveryPlan({ defaults: typeDefaults("quote_signed"), preferences: [], settings: settings(), now, eventIsToday: false });
    expect(signed).toEqual({ inApp: true, email: { state: "pending", dueAt: now }, push: { state: "pending", dueAt: now } });
    const request = deliveryPlan({ defaults: typeDefaults("prospect_request"), preferences: [], settings: settings(), now, eventIsToday: false });
    expect(request.email).toEqual({ state: "digest", dueAt: null });
  });

  it("une sorte coupée sur un canal ne part plus par ce canal, les autres restent", () => {
    const plan = deliveryPlan({ defaults: typeDefaults("quote_signed"), preferences: [{ channel: "email", enabled: false }], settings: settings(), now, eventIsToday: false });
    expect(plan.email.state).toBe("none");
    expect(plan.push.state).toBe("pending");
    expect(plan.inApp).toBe(true);
    const silent = deliveryPlan({ defaults: typeDefaults("quote_signed"), preferences: [{ channel: "app", enabled: false }, { channel: "email", enabled: false }, { channel: "push", enabled: false }], settings: settings(), now, eventIsToday: false });
    expect(silent).toEqual({ inApp: false, email: { state: "none", dueAt: null }, push: { state: "none", dueAt: null } });
  });

  it("sans récapitulatif, une sorte non immédiate part tout de suite par e-mail", () => {
    const plan = deliveryPlan({ defaults: typeDefaults("prospect_request"), preferences: [], settings: settings({ digestEnabled: false }), now, eventIsToday: false });
    expect(plan.email).toEqual({ state: "pending", dueAt: now });
  });

  it("pendant le silence, push et e-mail immédiat attendent ; l'alerte du jour J passe outre le jour de l'évènement, si la personne le garde", () => {
    const night = new Date("2027-06-12T21:30:00Z"); // 23:30 à Paris
    const end = new Date("2027-06-13T06:00:00Z");
    const signed = deliveryPlan({ defaults: typeDefaults("quote_signed"), preferences: [], settings: settings(), now: night, eventIsToday: true });
    expect(signed.push).toEqual({ state: "pending", dueAt: end });
    expect(signed.email).toEqual({ state: "pending", dueAt: end });
    const dayOf = deliveryPlan({ defaults: typeDefaults("day_of_alert"), preferences: [], settings: settings(), now: night, eventIsToday: true });
    expect(dayOf.push).toEqual({ state: "pending", dueAt: night });
    const notToday = deliveryPlan({ defaults: typeDefaults("day_of_alert"), preferences: [], settings: settings(), now: night, eventIsToday: false });
    expect(notToday.push.dueAt).toEqual(end);
    const noOverride = deliveryPlan({ defaults: typeDefaults("day_of_alert"), preferences: [], settings: settings({ dayOfOverride: false }), now: night, eventIsToday: true });
    expect(noOverride.push.dueAt).toEqual(end);
  });
});

describe("UX-16 — Un texte de notification ne casse jamais (lot 53)", () => {
  it("un paramètre manquant fait retomber le texte sur la sorte ; présent, la phrase complète", () => {
    expect(notificationText({ type: "quote_signed", params: {} }, "fr")).toBe("Devis signé");
    expect(notificationText({ type: "quote_signed", params: { number: "D-1" } }, "fr")).toBe("Le devis D-1 est signé.");
    expect(notificationText({ type: "transfer_declared", params: { amountCents: 120000, number: "D-1" } }, "en")).toContain("€1,200.00");
  });
});
