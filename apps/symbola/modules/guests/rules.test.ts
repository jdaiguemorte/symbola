// Lot 49 — règles pures du module Invités (foyers, RSVP, régimes, relances, purge, import), avec une
// horloge simulée : veille, jour même, passages à l'heure d'été et d'hiver (CLAUDE.md § 6).
import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { starterGuestImportColumns } from "@symbola/starter-templates";
import { aggregateDiets, dietPlace, openDietOptions, sealDietOptions } from "./diets";
import { foldHeader, findDuplicates, mapGuestColumns, phoneKey, readGuestRows } from "./import-rules";
import { isDue, noticeActive, noticeOn, purgeBaseDate, purgeSchedule, validatePostponement } from "./purge-rules";
import { currentReminder, reminderKey, withinSendingHours } from "./reminders";
import {
  addDays,
  defaultDisplayName,
  householdComplete,
  invitedMoments,
  normalizeEmail,
  rsvpOpen,
  rsvpPermissions,
  sanitizeRsvpAnswer,
  suggestedCloseOn,
  validateHousehold,
} from "./rsvp";

describe("INV-01 — Foyers et personnes : seuls le nom et un moyen de contact sont obligatoires", () => {
  it("un foyer d'un adulte avec un nom et un e-mail (ou un téléphone) s'enregistre ; tout le reste est facultatif", () => {
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "Jeanne", email: "Jeanne@Example.test " }] })).toMatchObject({
      ok: true,
      people: [{ kind: "adult", firstName: "Jeanne", lastName: null, email: "jeanne@example.test", phone: null, ageRange: null }],
      respondentIndex: 0,
    });
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "Paul", phone: "06 12 34 56 78" }] }).ok).toBe(true);
  });

  it("refuse un foyer sans moyen de contact, une personne sans nom, un foyer sans adulte", () => {
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "Jeanne" }] })).toEqual({ ok: false, problem: "contact_missing" });
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "  ", email: "a@example.test" }] })).toEqual({ ok: false, problem: "person_name_missing" });
    expect(validateHousehold({ people: [{ kind: "child", firstName: "Léo", ageRange: "3-5" }] })).toEqual({ ok: false, problem: "no_adult" });
    expect(validateHousehold({ people: [] })).toEqual({ ok: false, problem: "no_adult" });
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "Jeanne", email: "pas-une-adresse" }] })).toEqual({ ok: false, problem: "email_invalid" });
  });

  it("un moyen de contact par foyer suffit : un conjoint sans coordonnées est accepté", () => {
    const result = validateHousehold({ people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }, { kind: "adult", firstName: "Paul" }] });
    expect(result.ok).toBe(true);
  });

  it("le répondant est le premier adulte, ou celui désigné ; jamais un enfant", () => {
    const people = [{ kind: "child" as const, firstName: "Léo" }, { kind: "adult" as const, firstName: "Jeanne", email: "j@example.test" }, { kind: "adult" as const, firstName: "Paul" }];
    expect(validateHousehold({ people })).toMatchObject({ ok: true, respondentIndex: 1 });
    expect(validateHousehold({ people, respondentIndex: 2 })).toMatchObject({ ok: true, respondentIndex: 2 });
    expect(validateHousehold({ people, respondentIndex: 0 })).toEqual({ ok: false, problem: "respondent_not_adult" });
  });

  it("nom affiché par défaut : les prénoms des adultes et le nom commun", () => {
    expect(defaultDisplayName([{ kind: "adult", firstName: "Jeanne", lastName: "Durand" }, { kind: "adult", firstName: "Paul", lastName: "Durand" }, { kind: "child", firstName: "Léo", lastName: null }])).toBe("Jeanne & Paul Durand");
    expect(defaultDisplayName([{ kind: "adult", firstName: "Jeanne", lastName: "Durand" }, { kind: "adult", firstName: "Paul", lastName: "Martin" }])).toBe("Jeanne Durand & Paul Martin");
    expect(defaultDisplayName([{ kind: "adult", firstName: "Antoine", lastName: null }])).toBe("Antoine");
  });

  it("adresse e-mail normalisée (casse, espaces) ; vide = absente", () => {
    expect(normalizeEmail("  Lea@Example.TEST ")).toBe("lea@example.test");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("RGP-18 — Enfants invités : prénom, tranche d'âge, aucun contact direct", () => {
  it("un enfant avec un e-mail, un téléphone ou un nom de famille est refusé", () => {
    const adult = { kind: "adult" as const, firstName: "Jeanne", email: "j@example.test" };
    for (const child of [
      { kind: "child" as const, firstName: "Léo", email: "leo@example.test" },
      { kind: "child" as const, firstName: "Léo", phone: "0611111111" },
      { kind: "child" as const, firstName: "Léo", lastName: "Durand" },
    ]) {
      expect(validateHousehold({ people: [adult, child] })).toEqual({ ok: false, problem: "child_contact" });
    }
    expect(validateHousehold({ people: [adult, { kind: "child", firstName: "Léo", ageRange: "6-11" }] })).toMatchObject({ ok: true, people: [{}, { kind: "child", ageRange: "6-11", email: null, phone: null }] });
  });

  it("aucune tranche d'âge pour un adulte", () => {
    expect(validateHousehold({ people: [{ kind: "adult", firstName: "Jeanne", email: "j@example.test", ageRange: "12-17" }] })).toEqual({ ok: false, problem: "adult_age_range" });
  });
});

describe("INV-03 — RSVP : temps forts, clôture, droits de la personne du lien", () => {
  it("clôture proposée 30 jours avant le premier temps fort, sinon avant la date de l'évènement", () => {
    expect(suggestedCloseOn(["2027-06-13", "2027-06-12"], "2027-06-12", 30)).toBe("2027-05-13");
    expect(suggestedCloseOn([], "2027-06-12", 30)).toBe("2027-05-13");
    expect(suggestedCloseOn([], null, 30)).toBeNull();
  });

  it("la page répond jusqu'à la fin du jour de clôture, puis passe en lecture (veille, jour même, lendemain)", () => {
    expect(rsvpOpen("2027-05-13", "2027-05-12")).toBe(true);
    expect(rsvpOpen("2027-05-13", "2027-05-13")).toBe(true);
    expect(rsvpOpen("2027-05-13", "2027-05-14")).toBe(false);
    expect(rsvpOpen(null, "2027-05-01")).toBe(false);
  });

  it("par défaut tout le foyer est invité à tous les temps forts ; une restriction ne garde que des temps forts existants", () => {
    const all = ["ceremonie", "diner", "brunch"];
    expect(invitedMoments(null, all)).toEqual(all);
    expect(invitedMoments(["diner", "ancien"], all)).toEqual(["diner"]);
  });

  it("le répondant répond à la présence de tout le foyer ; un autre adulte, pour lui seul ; le régime : soi et ses enfants", () => {
    const members = [
      { id: "jeanne", kind: "adult" as const },
      { id: "paul", kind: "adult" as const },
      { id: "leo", kind: "child" as const },
    ];
    const asRespondent = rsvpPermissions("jeanne", "jeanne", members);
    expect(asRespondent.get("paul")).toEqual({ presence: true, diet: false });
    expect(asRespondent.get("leo")).toEqual({ presence: true, diet: true });
    expect(asRespondent.get("jeanne")).toEqual({ presence: true, diet: true });
    const asPaul = rsvpPermissions("paul", "jeanne", members);
    expect(asPaul.get("jeanne")).toEqual({ presence: false, diet: false });
    expect(asPaul.get("paul")).toEqual({ presence: true, diet: true });
    expect(asPaul.get("leo")).toEqual({ presence: false, diet: true });
  });

  it("une réponse ne garde que les personnes et temps forts permis, et les questions activées", () => {
    const context = {
      selfId: "jeanne",
      respondentId: "paul",
      members: [
        { id: "jeanne", kind: "adult" as const, invited: ["diner"] },
        { id: "paul", kind: "adult" as const, invited: ["diner", "brunch"] },
      ],
      optionIds: ["vegetarien", "gluten"],
      questions: { diet: true, accommodation: false, transport: true },
    };
    const answer = sanitizeRsvpAnswer(context, {
      presence: [
        { guestId: "jeanne", keyMomentId: "diner", attending: true },
        { guestId: "jeanne", keyMomentId: "brunch", attending: true },
        { guestId: "paul", keyMomentId: "diner", attending: false },
        { guestId: "inconnu", keyMomentId: "diner", attending: true },
      ],
      consent: true,
      dietOptionIds: ["gluten", "inconnue", "gluten"],
      children: [],
      accommodation: true,
      transport: false,
    });
    expect(answer.presence).toEqual([{ guestId: "jeanne", keyMomentId: "diner", attending: true }]);
    expect(answer.ownDiet).toEqual(["gluten"]);
    expect(answer.accommodation).toBeUndefined();
    expect(answer.transport).toBe(false);
  });

  it("un foyer a répondu quand chaque personne a une réponse pour chaque temps fort où elle est invitée", () => {
    const members = [
      { id: "a", invited: ["diner", "brunch"] },
      { id: "b", invited: ["diner"] },
    ];
    expect(householdComplete(members, new Set(["a:diner", "a:brunch", "b:diner"]))).toBe(true);
    expect(householdComplete(members, new Set(["a:diner", "b:diner"]))).toBe(false);
    expect(householdComplete([{ id: "a", invited: [] }], new Set())).toBe(true);
  });
});

describe("RGP-06 — Sans accord, la donnée n'est pas enregistrée", () => {
  const context = {
    selfId: "jeanne",
    respondentId: "jeanne",
    members: [
      { id: "jeanne", kind: "adult" as const, invited: ["diner"] },
      { id: "paul", kind: "adult" as const, invited: ["diner"] },
      { id: "leo", kind: "child" as const, invited: ["diner"] },
    ],
    optionIds: ["vegetarien", "gluten"],
    questions: { diet: true, accommodation: false, transport: false },
  };

  it("sans la case d'accord, les régimes de la requête sont ignorés (et ceux déjà enregistrés seront effacés)", () => {
    const answer = sanitizeRsvpAnswer(context, { presence: [], consent: false, dietOptionIds: ["gluten"], children: [{ guestId: "leo", guardianDeclared: true, dietOptionIds: ["vegetarien"] }] });
    expect(answer.ownDiet).toBeNull();
    expect(answer.children).toEqual([{ guestId: "leo", optionIds: null }]);
  });

  it("un adulte ne donne pas le régime d'un autre adulte ; celui d'un enfant seulement avec la déclaration de représentant légal", () => {
    const answer = sanitizeRsvpAnswer(context, {
      presence: [],
      consent: true,
      dietOptionIds: [],
      children: [
        { guestId: "paul", guardianDeclared: true, dietOptionIds: ["gluten"] },
        { guestId: "leo", guardianDeclared: false, dietOptionIds: ["gluten"] },
      ],
    });
    expect(answer.children).toEqual([{ guestId: "leo", optionIds: null }]);
    const declared = sanitizeRsvpAnswer(context, { presence: [], consent: true, dietOptionIds: [], children: [{ guestId: "leo", guardianDeclared: true, dietOptionIds: ["vegetarien"] }] });
    expect(declared.children).toEqual([{ guestId: "leo", optionIds: ["vegetarien"] }]);
  });

  it("question des régimes désactivée : rien n'est enregistré", () => {
    const answer = sanitizeRsvpAnswer({ ...context, questions: { ...context.questions, diet: false } }, { presence: [], consent: true, dietOptionIds: ["gluten"], children: [] });
    expect(answer.ownDiet).toBeUndefined();
    expect(answer.children).toEqual([]);
  });
});

describe("RGP-07 — Régimes chiffrés au niveau du champ, comptés sans dévoiler une personne", () => {
  const key = randomBytes(32);
  const organizationId = randomUUID();
  const guestId = randomUUID();

  it("la liste cochée est chiffrée, rattachée à sa ligne : recopiée ailleurs, elle ne se lit pas", () => {
    const options = [randomUUID(), randomUUID()];
    const sealed = sealDietOptions(options, dietPlace(organizationId, guestId), key);
    expect(sealed.startsWith("f1:")).toBe(true);
    for (const option of options) expect(sealed).not.toContain(option);
    expect(openDietOptions(sealed, dietPlace(organizationId, guestId), key)).toEqual([...options].sort());
    expect(() => openDietOptions(sealed, dietPlace(organizationId, randomUUID()), key)).toThrow();
  });

  it("un régime porté par une ou deux personnes s'affiche « moins de 3 » ; zéro n'apparaît pas", () => {
    const options = [
      { id: "veg", label: "Végétarien", kind: "diet" as const },
      { id: "gluten", label: "Sans gluten", kind: "diet" as const },
      { id: "arachide", label: "Arachides", kind: "allergen" as const },
      { id: "lait", label: "Lait", kind: "allergen" as const },
    ];
    const counts = aggregateDiets([{ optionIds: ["veg", "gluten"] }, { optionIds: ["veg"] }, { optionIds: ["veg", "arachide"] }, { optionIds: [] }], options, 3);
    expect(counts).toEqual([
      { optionId: "veg", label: "Végétarien", kind: "diet", count: 3, fewerThan: null },
      { optionId: "gluten", label: "Sans gluten", kind: "diet", count: null, fewerThan: 3 },
      { optionId: "arachide", label: "Arachides", kind: "allergen", count: null, fewerThan: 3 },
    ]);
  });
});

describe("INV-04 — Relances automatiques (horloge simulée)", () => {
  it("relance à J-21 puis à J-7 avant la clôture ; la plus récente seulement ; aucune après la clôture", () => {
    const closeOn = "2027-05-13";
    expect(currentReminder(closeOn, [21, 7], "2027-04-21")).toBeNull();
    expect(currentReminder(closeOn, [21, 7], "2027-04-22")).toEqual({ day: 21, date: "2027-04-22" });
    expect(currentReminder(closeOn, [21, 7], "2027-05-05")).toEqual({ day: 21, date: "2027-04-22" });
    expect(currentReminder(closeOn, [7, 21], "2027-05-06")).toEqual({ day: 7, date: "2027-05-06" });
    expect(currentReminder(closeOn, [21, 7], "2027-05-13")).toEqual({ day: 7, date: "2027-05-06" });
    expect(currentReminder(closeOn, [21, 7], "2027-05-14")).toBeNull();
    expect(currentReminder(closeOn, [], "2027-05-10")).toBeNull();
    expect(currentReminder(null, [21, 7], "2027-05-10")).toBeNull();
  });

  it("une clé par foyer et par relance (rejouée, elle ne part qu'une fois), sans donnée personnelle", () => {
    const householdId = randomUUID();
    expect(reminderKey(householdId, 7)).toBe(`guests:reminder:${householdId}:7`);
  });

  it("heures d'envoi à Paris, passages à l'heure d'été et d'hiver compris", () => {
    const hours = { from: 9, until: 20 };
    expect(withinSendingHours(new Date("2027-03-28T07:59:00Z"), hours)).toBe(true); // 9 h 59, heure d'été
    expect(withinSendingHours(new Date("2027-03-27T07:59:00Z"), hours)).toBe(false); // 8 h 59, heure d'hiver
    expect(withinSendingHours(new Date("2027-10-31T18:59:00Z"), hours)).toBe(true); // 19 h 59, heure d'hiver
    expect(withinSendingHours(new Date("2027-10-30T18:30:00Z"), hours)).toBe(false); // 20 h 30, heure d'été
  });
});

describe("RGP-08 — Purge des données d'invités, annoncée sept jours avant, report unique", () => {
  const retention = { dietDays: 7, allDays: 30, maxPostponeDays: 90 };

  it("comptée depuis le dernier jour de l'évènement (le brunch du lendemain compte), ou depuis l'annulation", () => {
    expect(purgeBaseDate({ status: "confirmed", cancelledOn: null, eventDate: "2027-06-12", keyMomentDates: ["2027-06-12", "2027-06-13"] })).toBe("2027-06-13");
    expect(purgeBaseDate({ status: "confirmed", cancelledOn: null, eventDate: "2027-06-12", keyMomentDates: [] })).toBe("2027-06-12");
    expect(purgeBaseDate({ status: "cancelled", cancelledOn: "2027-02-01", eventDate: "2027-06-12", keyMomentDates: ["2027-06-13"] })).toBe("2027-02-01");
    expect(purgeBaseDate({ status: "option", cancelledOn: null, eventDate: null, keyMomentDates: [] })).toBeNull();
  });

  it("régimes à J+7, le reste à J+30 ; préavis à J pour les régimes et à J+23 pour le reste", () => {
    const schedule = purgeSchedule("2027-06-13", retention, null);
    expect(schedule).toEqual({ dietsDueOn: "2027-06-20", allDueOn: "2027-07-13", latestPostponeOn: "2027-10-11" });
    expect(noticeOn(schedule.dietsDueOn, 7)).toBe("2027-06-13");
    expect(noticeOn(schedule.allDueOn, 7)).toBe("2027-07-06");
  });

  it("préavis et échéance : la veille, le jour même, le lendemain", () => {
    expect(noticeActive("2027-07-13", "2027-07-05", 7)).toBe(false);
    expect(noticeActive("2027-07-13", "2027-07-06", 7)).toBe(true);
    expect(noticeActive("2027-07-13", "2027-07-12", 7)).toBe(true);
    expect(noticeActive("2027-07-13", "2027-07-13", 7)).toBe(false);
    expect(isDue("2027-07-13", "2027-07-12")).toBe(false);
    expect(isDue("2027-07-13", "2027-07-13")).toBe(true);
    expect(isDue("2027-07-13", "2027-07-14")).toBe(true);
  });

  it("un report repousse ce qui n'est pas encore purgé, jamais au-delà de la valeur de départ plus un report", () => {
    expect(purgeSchedule("2027-06-13", retention, "2027-09-01")).toEqual({ dietsDueOn: "2027-09-01", allDueOn: "2027-09-01", latestPostponeOn: "2027-10-11" });
    expect(purgeSchedule("2027-06-13", retention, "2027-12-31")).toEqual({ dietsDueOn: "2027-09-18", allDueOn: "2027-10-11", latestPostponeOn: "2027-10-11" });
  });

  it("report : un seul, motivé, après l'échéance en cours, de 90 jours au plus", () => {
    const schedule = purgeSchedule("2027-06-13", retention, null);
    const base = { today: "2027-07-08", schedule, dietsPurged: true, alreadyPostponed: false, purged: false };
    expect(validatePostponement({ ...base, until: "2027-09-01", reason: "Facture du traiteur contestée" })).toBeNull();
    expect(validatePostponement({ ...base, until: "2027-09-01", reason: "  " })).toBe("reason_missing");
    expect(validatePostponement({ ...base, until: "2027-07-13", reason: "Litige" })).toBe("too_early");
    expect(validatePostponement({ ...base, until: "2027-10-12", reason: "Litige" })).toBe("too_late");
    expect(validatePostponement({ ...base, until: "2027-09-01", reason: "Litige", alreadyPostponed: true })).toBe("already_postponed");
    expect(validatePostponement({ ...base, until: "2027-09-01", reason: "Litige", purged: true })).toBe("already_purged");
    // Régimes pas encore purgés : un report peut ne viser qu'eux (avant la purge du reste).
    expect(validatePostponement({ ...base, today: "2027-06-15", dietsPurged: false, until: "2027-07-01", reason: "Allergie à vérifier" })).toBeNull();
    expect(purgeSchedule("2027-06-13", retention, "2027-07-01")).toEqual({ dietsDueOn: "2027-07-01", allDueOn: "2027-07-13", latestPostponeOn: "2027-10-11" });
  });
});

describe("INV-02 — Import d'un tableur : colonnes reconnues, doublons signalés avant d'écrire", () => {
  const columns = starterGuestImportColumns();

  it("reconnaît les colonnes sans accents ni casse ; une colonne de régime est ignorée et signalée", () => {
    expect(foldHeader("  Prénom  invité ")).toBe("prenom invite");
    const mapped = mapGuestColumns(["Foyer", "Prénom", "NOM", "E-mail", "Téléphone", "Enfant", "Régime alimentaire", "Remarque"], columns);
    expect(mapped.mapping).toMatchObject({ household: 0, firstName: 1, lastName: 2, email: 3, phone: 4, kind: 5 });
    expect(mapped.ignoredDiet).toEqual([6]);
    expect(mapped.unknown).toEqual([7]);
  });

  it("lit les personnes : un enfant n'a ni contact ni nom de famille (retirés et signalés), une ligne sans prénom est signalée", () => {
    const mapped = mapGuestColumns(["Foyer", "Prénom", "Nom", "E-mail", "Enfant", "Âge"], columns);
    const read = readGuestRows(
      [
        ["Durand", "Jeanne", "Durand", "jeanne@example.test", "", ""],
        ["Durand", "Léo", "Durand", "leo@example.test", "oui", "4"],
        ["Martin", "", "Martin", "x@example.test", "", ""],
      ],
      [2, 3, 4],
      mapped.mapping,
      columns,
    );
    expect(read.rows).toEqual([
      { line: 2, household: "Durand", kind: "adult", firstName: "Jeanne", lastName: "Durand", email: "jeanne@example.test", phone: null, ageRange: null, side: null, group: null, language: "fr" },
      { line: 3, household: "Durand", kind: "child", firstName: "Léo", lastName: null, email: null, phone: null, ageRange: "3-5", side: null, group: null, language: "fr" },
    ]);
    expect(read.problems).toEqual([
      { line: 3, problem: "child_contact_dropped" },
      { line: 4, problem: "name_missing" },
    ]);
  });

  it("doublon : même nom et même e-mail, ou même nom et même téléphone ; deux « Martin » différents ne le sont pas", () => {
    expect(phoneKey("+33 6 12 34 56 78")).toBe(phoneKey("06.12.34.56.78"));
    const row = (line: number, firstName: string, email: string | null, phone: string | null) => ({ line, household: firstName, kind: "adult" as const, firstName, lastName: "Martin", email, phone, ageRange: null, side: null, group: null, language: "fr" as const });
    const duplicates = findDuplicates(
      [row(2, "Paul", "paul@example.test", null), row(3, "Paul", "PAUL@example.test", null), row(4, "Luc", null, "0612345678"), row(5, "Luc", null, "+33612345678"), row(6, "Anne", "anne@example.test", null)],
      [{ firstName: "Anne", lastName: "Martin", email: null, phone: null }, { firstName: "Luc", lastName: "Martin", email: "luc@example.test", phone: "06 12 34 56 78" }],
    );
    expect(duplicates).toEqual([
      { line: 3, with: { kind: "file", line: 2 } },
      { line: 4, with: { kind: "event", name: "Luc Martin" } },
      { line: 5, with: { kind: "event", name: "Luc Martin" } },
    ]);
  });
});
