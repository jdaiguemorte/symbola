// Lot 44 (CRM-01 ; D1 à D5) — règles pures du formulaire de contact : adresse publique, sites
// autorisés, politique, mention d'information, budget, liens d'un message, validation d'un envoi.
import { describe, expect, it } from "vitest";
import {
  contactFormNotice,
  contactSlugify,
  ContactSubmissionInvalidError,
  countLinks,
  isValidContactSlug,
  normalizeOrigin,
  normalizePrivacyUrl,
  parseBudget,
  parseContactSubmission,
} from "./contact-form-rules";

const TYPE = "11111111-1111-4111-8111-111111111111";
const SOURCE = "22222222-2222-4222-8222-222222222222";
const FORM = { hiddenFields: [], eventTypes: [{ id: TYPE, label: "Mariage" }], sources: [{ id: SOURCE, label: "Instagram" }] };
const LEA = { firstName: " Léa ", lastName: "Martin", email: "Lea@Example.TEST", phone: "", eventDate: "2027-06-12", period: "", place: "Mâcon", budget: "25 000 €", guests: "120", eventTypeId: TYPE, sourceId: SOURCE, message: "Bonjour\r\n" };

describe("CRM-01 (D2) — Adresse publique du formulaire", () => {
  it("proposée depuis le nom, sans accents ni ponctuation ; 3 à 60 caractères", () => {
    expect(contactSlugify("Atelier Camille R.")).toBe("atelier-camille-r");
    expect(contactSlugify("  Éléonore & Fils — Évènements !! ")).toBe("eleonore-fils-evenements");
    expect(contactSlugify("x".repeat(80))).toHaveLength(60);
    expect(isValidContactSlug("atelier-camille")).toBe(true);
    for (const slug of ["ab", "Atelier", "a--b", "-abc", "abc-", "../etc", "x".repeat(61)]) expect(isValidContactSlug(slug)).toBe(false);
  });
});

describe("CRM-01 (D1) — Sites autorisés à encadrer le formulaire", () => {
  it("https seulement, réduits à leur origine ; sans joker, identifiant ni domaine nu", () => {
    expect(normalizeOrigin("https://www.atelier.test/contact?x=1")).toBe("https://www.atelier.test");
    expect(normalizeOrigin("atelier.test")).toBe("https://atelier.test");
    expect(normalizeOrigin("https://atelier.test:8443")).toBe("https://atelier.test:8443");
    for (const value of ["", "  ", "http://atelier.test", "https://user:pass@atelier.test", "https://localhost", "https://*.atelier.test", "javascript:alert(1)", "https://"]) {
      expect(normalizeOrigin(value), value).toBeNull();
    }
  });

  it("l'adresse de la politique de confidentialité est en https, 500 caractères au plus", () => {
    expect(normalizePrivacyUrl("https://atelier.test/confidentialite")).toBe("https://atelier.test/confidentialite");
    expect(normalizePrivacyUrl(null)).toBeNull();
    expect(normalizePrivacyUrl("  ")).toBeNull();
    expect(normalizePrivacyUrl("http://atelier.test/c")).toBeNull();
    expect(normalizePrivacyUrl("pas une adresse")).toBeNull();
    expect(normalizePrivacyUrl(`https://atelier.test/${"a".repeat(500)}`)).toBeNull();
  });
});

describe("RGP-03 — Mention d'information du formulaire", () => {
  it("nomme l'organisation et son adresse, la durée, le contact et la politique ; sans variable restante", () => {
    const notice = contactFormNotice({ locale: "fr", organizationName: "Atelier Camille R.", address: "12 rue des Tilleuls, 24200 Sarlat", months: 36, contact: "camille@atelier.test", policyUrl: "https://atelier.test/c" });
    expect(notice).toContain("Atelier Camille R. (12 rue des Tilleuls, 24200 Sarlat), responsable");
    expect(notice).toContain("36 mois");
    expect(notice).toContain("camille@atelier.test");
    expect(notice).toContain("https://atelier.test/c");
    expect(notice).not.toMatch(/\{[a-z]+\}/);
    expect(contactFormNotice({ locale: "en", organizationName: "Atelier", address: null, months: 12, contact: "a@b.test", policyUrl: "https://b.test" })).toContain("Atelier, who is responsible");
  });
});

describe("CRM-01 (D3, D4) — Budget et liens", () => {
  it("un montant devient des centimes ; une tranche reste du texte", () => {
    expect(parseBudget("25 000 €")).toEqual({ cents: 2_500_000, range: null });
    expect(parseBudget("25000")).toEqual({ cents: 2_500_000, range: null });
    expect(parseBudget("25k")).toEqual({ cents: 2_500_000, range: null });
    expect(parseBudget("1 234,5 euros")).toEqual({ cents: 123_450, range: null });
    expect(parseBudget("25.000 EUR")).toEqual({ cents: 2_500_000, range: null });
    expect(parseBudget("entre 20 et 30 k€")).toEqual({ cents: null, range: "entre 20 et 30 k€" });
    expect(parseBudget("0")).toEqual({ cents: null, range: "0" });
    expect(parseBudget("")).toEqual({ cents: null, range: null });
  });

  it("compte les liens d'un message (adresses, www, domaines courants)", () => {
    expect(countLinks("Bonjour, rien à voir")).toBe(0);
    expect(countLinks("https://a.test http://b.test www.c.test")).toBe(3);
    expect(countLinks("voyez casino-gagnant.com et promo.xyz")).toBe(2);
  });
});

describe("CRM-01 (D3) — Validation d'un envoi", () => {
  it("garde les valeurs, l'e-mail en minuscules, le message tel quel (sans retour chariot Windows)", () => {
    expect(parseContactSubmission(LEA, FORM)).toEqual({
      firstName: "Léa",
      lastName: "Martin",
      email: "lea@example.test",
      phone: null,
      eventDate: "2027-06-12",
      period: null,
      place: "Mâcon",
      budgetCents: 2_500_000,
      budgetRange: null,
      guests: 120,
      eventTypeId: TYPE,
      sourceId: SOURCE,
      message: "Bonjour",
    });
  });

  it("le nom, et l'e-mail ou le téléphone, sont obligatoires", () => {
    const field = (raw: Record<string, string>) => {
      try {
        parseContactSubmission({ ...LEA, ...raw }, FORM);
        return "accepté";
      } catch (error) {
        return error instanceof ContactSubmissionInvalidError ? error.field : String(error);
      }
    };
    expect(field({ firstName: "" })).toBe("name");
    expect(field({ lastName: " " })).toBe("name");
    expect(field({ email: "", phone: "" })).toBe("contact");
    expect(field({ email: "", phone: "06 12 34 56 78" })).toBe("accepté");
    expect(field({ email: "pas-une-adresse" })).toBe("email");
    expect(field({ phone: "abc" })).toBe("phone");
    expect(field({ eventDate: "2027-13-01" })).toBe("date");
    expect(field({ eventDate: "12/06/2027" })).toBe("date");
    expect(field({ guests: "12.5" })).toBe("guests");
    expect(field({ guests: "100001" })).toBe("guests");
    expect(field({ message: "x".repeat(5001) })).toBe("message");
    expect(field({ period: "x".repeat(101) })).toBe("period");
    expect(field({ place: "x".repeat(201) })).toBe("place");
    expect(field({ firstName: "x".repeat(101) })).toBe("name");
    expect(field({ email: `${"x".repeat(250)}@a.test` })).toBe("email");
    expect(field({ budget: "x".repeat(201) })).toBe("budget");
    expect(field({ guests: "12345678901" })).toBe("guests");
    expect(field({ eventDate: "2027-06-12-01" })).toBe("date");
    expect(field({ eventTypeId: "x".repeat(37) })).toBe("message");
  });

  it("un champ masqué est ignoré ; une valeur hors des listes de l'organisation aussi", () => {
    const parsed = parseContactSubmission({ ...LEA, eventTypeId: "33333333-3333-4333-8333-333333333333", sourceId: "pas-un-id" }, { ...FORM, hiddenFields: ["budget", "guests", "date", "place", "message", "phone"] });
    expect(parsed).toMatchObject({ eventDate: null, period: null, place: null, budgetCents: null, budgetRange: null, guests: null, message: null, phone: null, eventTypeId: null, sourceId: null });
    expect(parseContactSubmission({ ...LEA, eventTypeId: "" }, { ...FORM, hiddenFields: ["eventType", "source"] })).toMatchObject({ eventTypeId: null, sourceId: null });
    expect(parseContactSubmission({ firstName: "Léa", lastName: "M", phone: "+33 6 12 34 56 78" }, FORM)).toMatchObject({ email: null, phone: "+33 6 12 34 56 78", message: null });
  });
});
