import { describe, expect, it } from "vitest";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";
import programFile from "./program.json";
import { starterDemoEvent, starterDemoQuote, starterErasureResponse, starterPrivacySettings, starterInvoiceMentions, starterLossReasons, starterPaymentMethods, starterProgram, starterProspectSources, starterRetroplanning, starterVendorSlots, starterVendorTypes, starterBudgetLines, starterAllocation, starterFollowUpDelays, starterVendorTypeSynonymGroups, starterVendorCatalog, starterEventTypes, BUDGET_LINE_ICONS } from "./index";

describe("EVT-03 — Modèle de départ des postes prestataires", () => {
  it("existe en français et en anglais, avec le même nombre de postes", () => {
    const fr = starterVendorSlots("fr");
    const en = starterVendorSlots("en");
    expect(fr.length).toBeGreaterThan(0);
    expect(en).toHaveLength(fr.length);
    expect(fr).toContain("Traiteur");
    expect(en).toContain("Caterer");
  });

  it("n'a ni clé ni libellé en double", () => {
    const keys = vendorSlotsFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of ["fr", "en"] as const) {
      const labels = starterVendorSlots(locale);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("EVT-07 — Listes de départ des sources de prospect et des motifs de perte", () => {
  it("existent en français et en anglais, avec le même nombre d'entrées, sans doublon", () => {
    for (const list of [starterProspectSources, (locale: "fr" | "en") => starterLossReasons(locale).map((reason) => reason.label)]) {
      const [fr, en] = [list("fr"), list("en")];
      expect(fr.length).toBeGreaterThan(0);
      expect(en).toHaveLength(fr.length);
      expect(new Set(fr).size).toBe(fr.length);
      expect(new Set(en).size).toBe(en.length);
    }
  });

  it("un seul motif « Autre », qui demande une précision", () => {
    const freeText = starterLossReasons("fr").filter((reason) => reason.isFreeText);
    expect(freeText.map((reason) => reason.label)).toEqual(["Autre"]);
  });
});

describe("EVT-04 — Modèle de départ du rétroplanning", () => {
  it("existe en français et en anglais, avec les mêmes tâches et décalages", () => {
    const fr = starterRetroplanning("fr");
    const en = starterRetroplanning("en");
    expect(fr.name).not.toBe(en.name);
    expect(en.items).toHaveLength(fr.items.length);
    expect(en.items.map((item) => item.offsetDays)).toEqual(fr.items.map((item) => item.offsetDays));
    expect(fr.items.some((item) => item.responsible === "clients")).toBe(true);
  });

  it("a des clés uniques et des tâches triées de la plus lointaine à la plus proche", () => {
    const keys = retroplanningFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    const offsets = retroplanningFile.items.map((item) => item.offsetDays);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});

describe("EVT-05 — Modèle de départ du programme du jour J", () => {
  it("existe en français et en anglais, avec les mêmes lignes et heures", () => {
    const fr = starterProgram("fr");
    const en = starterProgram("en");
    expect(fr.items.length).toBeGreaterThan(0);
    expect(en.items.map((item) => [item.startTime, item.endTime])).toEqual(
      fr.items.map((item) => [item.startTime, item.endTime]),
    );
    expect(fr.items.map((item) => item.label)).toContain("Cérémonie");
    expect(en.items.map((item) => item.label)).toContain("Ceremony");
  });

  it("ses intervenants sont des postes du modèle de départ, dans la même langue", () => {
    const fr = starterProgram("fr");
    const slots = new Set(starterVendorSlots("fr"));
    for (const item of fr.items) for (const label of item.participantLabels) expect(slots).toContain(label);
    expect(fr.items.find((item) => item.label === "Cérémonie")?.participantLabels).toContain("Photographe");
  });

  it("n'a pas de clé en double", () => {
    const keys = programFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("AIDE-02 — Données fictives de l'essai guidé des événements", () => {
  it("existent en français et en anglais, et se signalent comme fictives", () => {
    const fr = starterDemoEvent("fr");
    const en = starterDemoEvent("en");
    expect(fr.clients).toHaveLength(en.clients.length);
    expect(fr.daysFromToday).toBeGreaterThan(0);
    expect(fr.clients.every((client) => client.lastName.includes("démo"))).toBe(true);
    expect(en.clients.every((client) => client.lastName.includes("demo"))).toBe(true);
    expect(fr.venueName).toContain("fictif");
  });
});

describe("DEV-03 — Modèle de départ des modes de paiement", () => {
  it("existe en français et en anglais, avec le même nombre de modes", () => {
    const fr = starterPaymentMethods("fr");
    const en = starterPaymentMethods("en");
    expect(fr).toContain("Virement bancaire");
    expect(en).toContain("Bank transfer");
    expect(en).toHaveLength(fr.length);
  });
});

describe("DEV-04 — Mentions de facturation de départ", () => {
  it("existent en français et en anglais", () => {
    expect(starterInvoiceMentions("fr")).toContain("Conditions de paiement");
    expect(starterInvoiceMentions("en")).toContain("Payment terms");
  });
});

describe("AIDE-02 — Devis fictif de l'essai guidé", () => {
  it("existe en français et en anglais, avec des lignes et un échéancier qui ne dépasse pas le total", () => {
    const fr = starterDemoQuote("fr");
    const en = starterDemoQuote("en");
    expect(fr.lines[0]?.label).toBe("Coordination du jour J");
    expect(en.lines[0]?.label).toBe("Wedding day coordination");
    expect(en.lines).toHaveLength(fr.lines.length);
    expect(fr.schedule.reduce((sum, item) => sum + item.percentageBasisPoints, 0)).toBeLessThanOrEqual(10000);
  });
});

describe("RGPD-04/05 — Réglages RGPD de départ", () => {
  it("valeurs du cahier des charges : alerte à 7 jours, prospect et client 3 ans, pièces comptables 10 ans, compte inactif 2 ans", () => {
    expect(starterPrivacySettings()).toEqual({
      requestAlertDays: 7,
      prospectRetentionMonths: 36,
      clientRetentionMonths: 36,
      accountingRetentionMonths: 120,
      inactiveAccountMonths: 24,
      signedQuoteRetentionMonths: 60,
    });
  });
});

describe("RGPD-03 — Modèle de réponse à une demande d'effacement", () => {
  it("existe en français et en anglais, avec toutes les variables attendues", () => {
    for (const locale of ["fr", "en"] as const) {
      const { subject, body } = starterErasureResponse(locale);
      expect(subject).not.toBe("");
      for (const variable of ["{person}", "{receivedOn}", "{completedOn}", "{organization}", "{kept}"]) expect(body).toContain(variable);
    }
  });
});

describe("AIDE-06 — exemples des tutoriels", () => {
  it("varient les types d'événements et existent en FR et EN", async () => {
    const { starterTutorialEvent, starterTutorialTaskTemplate, starterTutorialCatalogItem } = await import("./index");
    const kinds = ["event-page", "retroplanning-template", "budget-simulation"].map((key) => starterTutorialEvent(key, "fr")!.kind);
    expect(new Set(kinds).size).toBe(3);
    expect(starterTutorialEvent("event-page", "en")!.venueName).toContain("fictional");
    expect(starterTutorialEvent("inconnu", "fr")).toBeNull();
    expect(starterTutorialTaskTemplate("fr").items.length).toBeGreaterThan(2);
    expect(starterTutorialCatalogItem("en").label).toContain("example");
  });

  it("lot 11 — types de prestataires de départ, traduits, champs valides", () => {
    const fr = starterVendorTypes("fr");
    const en = starterVendorTypes("en");
    expect(fr.map((type) => type.label)).toContain("Hôtel / hébergement");
    expect(en.map((type) => type.label)).toContain("Hotel / lodging");
    expect(fr).toHaveLength(en.length);
    for (const type of fr) {
      for (const field of type.fields) if (field.kind === "choice") expect(field.choices?.length).toBeGreaterThan(0);
    }
  });

  it("lot 12 — modèles de départ par métier : lignes du budget avec icône, sources, rétroplanning, programme, répartition à 100 %", () => {
    for (const metier of ["wedding_planner", "event_agency", "autre"] as const) {
      for (const locale of ["fr", "en"] as const) {
        const lines = starterBudgetLines(locale, metier);
        expect(lines.length).toBeGreaterThan(5);
        expect(lines.every((line) => line.icon.length > 0)).toBe(true);
        expect(starterProspectSources(locale, metier).length).toBeGreaterThan(3);
        expect(starterRetroplanning(locale, metier).items.length).toBeGreaterThan(5);
        const labels = new Set(lines.map((line) => line.label));
        for (const item of starterProgram(locale, metier).items) for (const participant of item.participantLabels) expect(labels.has(participant)).toBe(true);
        const split = starterAllocation(locale, metier);
        expect(split.items.reduce((sum, item) => sum + item.basisPoints, 0)).toBe(10000);
        for (const item of split.items) expect(labels.has(item.label)).toBe(true);
      }
    }
    expect(starterBudgetLines("fr", "wedding_planner").map((line) => line.label)).toContain("Photographe");
    expect(starterBudgetLines("fr", "event_agency").map((line) => line.label)).toContain("Technique son et lumière");
    expect(starterBudgetLines("fr", "autre")).toEqual(starterBudgetLines("fr", "event_agency"));
  });
});

describe("HUB-15 — délais de relance de départ", () => {
  it("lit les délais de départ du fichier de données", () => {
    expect(starterFollowUpDelays()).toEqual({ quoteFollowUpDays: 7, prospectFollowUpDays: 14 });
  });
});

describe("IMP-07 — synonymes des types de prestataires (décision N)", () => {
  it("chaque type de départ, en français et en anglais, appartient à un groupe de synonymes", () => {
    const groups = starterVendorTypeSynonymGroups();
    for (const locale of ["fr", "en"] as const) {
      for (const type of starterVendorTypes(locale)) expect(groups.some((group) => group.includes(type.label))).toBe(true);
    }
  });
});

describe("PRE-14 — Familles et types de départ, communs à tous les métiers (lot 16, ADR 0045)", () => {
  it("un seul catalogue, d'une dizaine de familles, en FR et en EN", () => {
    const fr = starterVendorCatalog("fr");
    const en = starterVendorCatalog("en");
    expect(fr.length).toBeGreaterThanOrEqual(9);
    expect(fr.length).toBeLessThanOrEqual(12);
    const types = fr.flatMap((family) => family.types);
    expect(types.length).toBeGreaterThanOrEqual(30);
    expect(types.length).toBeLessThanOrEqual(40);
    expect(en.map((family) => family.key)).toEqual(fr.map((family) => family.key));
    // Mariages et autres événements : les deux mondes dans le même catalogue.
    expect(fr.map((family) => family.label)).toEqual(expect.arrayContaining(["Beauté et tenues", "Accueil et sécurité", "Technique et scène"]));
    expect(fr.find((family) => family.label === "Beauté et tenues")!.types.map((type) => type.label)).toEqual(
      expect.arrayContaining(["Coiffure et maquillage", "Robe de mariée", "Tenue du marié", "Bijoux"]),
    );
  });

  it("sans mariage, les types propres au mariage disparaissent, et seulement eux", () => {
    const all = starterVendorCatalog("fr").flatMap((family) => family.types.map((type) => type.key));
    const without = starterVendorCatalog("fr", { weddings: false }).flatMap((family) => family.types.map((type) => type.key));
    expect(all.filter((key) => !without.includes(key)).sort()).toEqual(["bridal_wear", "groom_wear", "officiant", "wedding_car", "worship_place"]);
    expect(starterVendorCatalog("fr", { weddings: false }).map((family) => family.label)).toContain("Beauté et tenues");
  });

  it("chaque type n'appartient qu'à une famille, ses synonymes contiennent son libellé, et un libellé ne désigne qu'un type", () => {
    for (const locale of ["fr", "en"] as const) {
      const families = starterVendorCatalog(locale);
      const keys = families.flatMap((family) => family.types.map((type) => type.key));
      expect(new Set(keys).size).toBe(keys.length);
      for (const type of families.flatMap((family) => family.types)) expect(type.synonyms).toContain(type.label);
    }
    const owner = new Map<string, number>();
    starterVendorTypeSynonymGroups().forEach((group, index) => {
      for (const label of group) {
        const folded = label.toLocaleLowerCase("fr");
        expect(owner.get(folded) ?? index, label).toBe(index);
        owner.set(folded, index);
      }
    });
  });

  it("« Coiffeur(se) » et « Maquillage » désignent le même type, « Coiffure et maquillage »", () => {
    const group = starterVendorTypeSynonymGroups().find((labels) => labels.includes("Coiffure et maquillage"))!;
    expect(group).toEqual(expect.arrayContaining(["Coiffeur(se)", "Maquillage"]));
  });

  it("icônes connues de l'app, couleurs et icônes distinctes", () => {
    const families = starterVendorCatalog("fr");
    for (const family of families) expect(BUDGET_LINE_ICONS).toContain(family.icon);
    expect(new Set(families.map((family) => family.color)).size).toBe(families.length);
    expect(new Set(families.map((family) => family.icon)).size).toBe(families.length);
  });
});

describe("lot 16 (ADR 0045) — Types d'événement de départ", () => {
  it("la même liste pour tous les métiers, dans l'ordre du métier, traduite", () => {
    const wedding = starterEventTypes("fr", "wedding_planner");
    const agency = starterEventTypes("fr", "event_agency");
    expect(wedding.map((type) => type.label)).toEqual(["Mariage", "Anniversaire", "Baptême", "Séminaire", "Soirée d'entreprise", "Lancement de produit", "Autre"]);
    expect(agency[0]?.label).toBe("Séminaire");
    expect(new Set(agency.map((type) => type.key))).toEqual(new Set(wedding.map((type) => type.key)));
    expect(starterEventTypes("en", "autre").map((type) => type.key)).toEqual(agency.map((type) => type.key));
    expect(starterEventTypes("en")[0]?.label).toBe("Wedding");
  });

  it("seul le mariage parle des mariés ; les autres types parlent du client", () => {
    const audiences = Object.fromEntries(starterEventTypes("fr").map((type) => [type.key, type.audience]));
    expect(audiences).toMatchObject({ wedding: "couple", birthday: "clients", seminar: "clients", other: "clients" });
    expect(Object.values(audiences).filter((audience) => audience === "couple")).toHaveLength(1);
  });
});
