// Lot 44 (CRM-01 ; D4, D6) — anti-spam du formulaire de contact, sans captcha visible, contre un vrai
// PostgreSQL : piège rempli, envoi en moins de trois secondes, horodatage falsifié ou d'un autre
// formulaire, débit dépassé : rien n'est créé et la réponse est identique à celle d'un succès.
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { getEventsPipeline, listProspectRequestsToReview, resolvePublicContactForm, saveContactFormSettings, sealFormOpening } from "@/modules/events/service";
import { handleContactSubmission } from "./submit";

const notify = vi.fn(async () => undefined);
const OPENED = new Date("2027-01-10T09:00:00Z");
const LATER = new Date(OPENED.getTime() + 20_000);

async function setup() {
  const { sql, db } = createAppConnection();
  const organizationId = await createOrganization(db, `Atelier ${randomUUID()}`).then((row) => row.id).finally(() => sql.end());
  const slug = `contact-${randomUUID().slice(0, 8)}`;
  await saveContactFormSettings(organizationId, { active: true, slug, hiddenFields: [], privacyPolicyUrl: "https://atelier.test/confidentialite", allowedOrigins: [], notifyOwner: true, locale: "fr" });
  const form = (await resolvePublicContactForm(slug, "fr"))!;
  return { organizationId, slug, form };
}

function formData(slug: string, opened: string, extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = { slug, opened, firstName: "Léa", lastName: "Martin", email: "lea@example.test", eventDate: "2027-06-12", message: "Bonjour", ...extra };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const headers = (ip: string) => new Headers({ "x-forwarded-for": ip });
let ipCounter = 10;
const freshIp = () => `198.51.100.${ipCounter++}`;

describe("CRM-01 — Anti-spam sans captcha visible (D4)", () => {
  it("un envoi ordinaire crée le prospect et répond « envoyé »", async () => {
    const { organizationId, slug, form } = await setup();
    const state = await handleContactSubmission(formData(slug, sealFormOpening(form, OPENED)), { headers: headers(freshIp()), locale: "fr", now: LATER, submit: { notify } });
    expect(state).toEqual({ step: "sent" });
    expect((await getEventsPipeline(organizationId, "fr")).cards).toHaveLength(1);
  });

  it("piège rempli, envoi en moins de 3 s, horodatage falsifié ou d'un autre formulaire : rien n'est créé, même réponse", async () => {
    const { organizationId, slug, form } = await setup();
    const other = await setup();
    const sealed = sealFormOpening(form, OPENED);
    const attempts = [
      formData(slug, sealed, { [HONEYPOT_FIELD]: "https://spam.test" }),
      formData(slug, sealFormOpening(form, new Date(LATER.getTime() - 2_000))),
      formData(slug, `${sealed.slice(0, -4)}AAAA`),
      formData(slug, OPENED.toISOString()),
      formData(slug, sealFormOpening(other.form, OPENED)),
      formData(slug, ""),
    ];
    for (const attempt of attempts) {
      expect(await handleContactSubmission(attempt, { headers: headers(freshIp()), locale: "fr", now: LATER, submit: { notify } })).toEqual({ step: "sent" });
    }
    expect((await getEventsPipeline(organizationId, "fr")).cards).toEqual([]);
    expect(await listProspectRequestsToReview(organizationId)).toEqual([]);
  });

  it("débit dépassé pour une adresse IP : l'envoi suivant n'est pas enregistré, même réponse", async () => {
    const { organizationId, slug, form } = await setup();
    const ip = freshIp();
    for (let index = 0; index < 6; index += 1) {
      const state = await handleContactSubmission(formData(slug, sealFormOpening(form, OPENED), { email: `lea${index}@example.test` }), { headers: headers(ip), locale: "fr", now: LATER, submit: { notify } });
      expect(state).toEqual({ step: "sent" });
    }
    expect((await getEventsPipeline(organizationId, "fr")).cards).toHaveLength(5);
  });

  it("un champ mal rempli est signalé (la personne corrige) ; une adresse inconnue est « indisponible »", async () => {
    const { slug, form } = await setup();
    const state = await handleContactSubmission(formData(slug, sealFormOpening(form, OPENED), { email: "", phone: "" }), { headers: headers(freshIp()), locale: "fr", now: LATER, submit: { notify } });
    expect(state).toMatchObject({ step: "form", error: "contact", values: { firstName: "Léa" } });
    expect(await handleContactSubmission(formData("inconnue-xyz", ""), { headers: headers(freshIp()), locale: "fr", now: LATER })).toEqual({ step: "unavailable" });
  });

  it("message à trois liens : mis de côté, réponse identique", async () => {
    const { organizationId, slug, form } = await setup();
    const state = await handleContactSubmission(formData(slug, sealFormOpening(form, OPENED), { message: "https://a.test https://b.test https://c.test" }), { headers: headers(freshIp()), locale: "fr", now: LATER, submit: { notify } });
    expect(state).toEqual({ step: "sent" });
    expect(await listProspectRequestsToReview(organizationId)).toHaveLength(1);
    expect((await getEventsPipeline(organizationId, "fr")).cards).toEqual([]);
  });
});
