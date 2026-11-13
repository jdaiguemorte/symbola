import { describe, expect, it } from "vitest";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";
import programFile from "./program.json";
import {
  BUDGET_LINE_ICONS,
  MENTION_FIELDS,
  starterAllocation,
  starterBudgetLines,
  starterClientTaskReminders,
  starterDemoEvent,
  starterDemoQuote,
  starterDocumentStyle,
  starterEmergencyNumbers,
  starterErasureResponse,
  starterEventTypes,
  starterFollowUpDelays,
  starterInvoiceMentions,
  starterLinkExpiry,
  starterLinkPrivacyNotice,
  starterLinkProfiles,
  starterLossReasons,
  starterPaymentMethodKinds,
  starterPaymentMethods,
  starterPrivacySettings,
  starterProgram,
  starterProspectSources,
  starterQuoteTemplates,
  starterQuoteTerms,
  starterRequestResponse,
  starterRequiredMentions,
  starterRetroplanning,
  starterVendorCatalog,
  starterVendorSlots,
  starterVendorTags,
  starterVendorTypes,
  starterVendorTypeSynonymGroups,
} from "./index";

describe("PRD-EVT-03 — Modèle de départ des postes prestataires", () => {
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

describe("PRD-EVT-07 — Listes de départ des sources de prospect et des motifs de perte", () => {
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

describe("PRD-EVT-04 — Modèle de départ du rétroplanning", () => {
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

describe("PRD-EVT-05 — Modèle de départ du programme du jour J", () => {
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

describe("DEV-09 — Nuances de départ des documents", () => {
  it("existent en français et en anglais, avec une couleur neutre parmi elles", () => {
    const fr = starterDocumentStyle("fr");
    const en = starterDocumentStyle("en");
    expect(fr.swatches.length).toBe(6);
    expect(en.swatches.map((swatch) => swatch.color)).toEqual(fr.swatches.map((swatch) => swatch.color));
    expect(fr.swatches.map((swatch) => swatch.color)).toContain(fr.defaultColor);
  });
});

describe("DEV-10 — Conditions particulières du devis de départ", () => {
  it("existent en français et en anglais", () => {
    expect(starterQuoteTerms("fr")).toContain("devis");
    expect(starterQuoteTerms("en")).toContain("quote");
  });
});

describe("RGPD-07 — Réponses de départ aux demandes", () => {
  it("existent pour l'accès, la portabilité, la rectification et l'opposition, en français et en anglais, avec les variables du dossier", () => {
    for (const type of ["access", "portability", "rectification", "objection"] as const) {
      for (const locale of ["fr", "en"] as const) {
        const response = starterRequestResponse(type, locale);
        expect(response.subject.length).toBeGreaterThan(0);
        for (const variable of ["{person}", "{receivedOn}", "{completedOn}", "{organization}"]) expect(response.body).toContain(variable);
      }
    }
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
      // RGPD-09 : preuve d'une demande close gardée 5 ans (décision de Julien du 09/11/2026).
      requestProofRetentionMonths: 60,
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

describe("L13-HUB-15 — délais de relance de départ", () => {
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

describe("L16-PRE-14 — Familles et types de départ, communs à tous les métiers (lot 16, ADR 0045)", () => {
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

// Lot 21 (L21-PRE-18, ADR 0050) — étiquettes de départ.
const fold = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

describe("L21-PRE-18 — Étiquettes de départ, rangées par famille", () => {
  it("chaque étiquette vise des familles de départ connues ; vide = toutes les familles", () => {
    const families = new Set(starterVendorCatalog("fr").map((family) => family.key));
    for (const metier of ["wedding_planner", "event_agency"] as const) {
      for (const group of starterVendorTags("fr", metier)) {
        for (const tag of group.tags) for (const key of tag.familyKeys) expect(families, `${group.key} › ${tag.label}`).toContain(key);
      }
    }
  });

  it("aucun libellé en double, en français comme en anglais (une étiquette n'est que dans un groupe)", () => {
    for (const locale of ["fr", "en"] as const) {
      const labels = starterVendorTags(locale, "event_agency").flatMap((group) => group.tags.map((tag) => fold(tag.label)));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("les paliers de la capacité et des couchages, réservés aux lieux ; les langues valent pour toutes les familles", () => {
    const groups = starterVendorTags("fr");
    expect(groups.find((group) => group.label === "Capacité")).toMatchObject({ exclusive: true, tags: expect.arrayContaining([expect.objectContaining({ label: "100 à 150 personnes", familyKeys: ["venues"] })]) });
    expect(groups.find((group) => group.label === "Couchages")?.exclusive).toBe(true);
    expect(groups.find((group) => group.label === "Langues parlées")?.tags.every((tag) => tag.familyKeys.length === 0)).toBe(true);
    expect(groups.find((group) => group.label === "Style")?.tags.find((tag) => tag.label === "Champêtre")?.familyKeys).toEqual(["venues", "decor"]);
  });

  it("traduites, avec les deux libellés pour reconnaître une étiquette importée", () => {
    const en = starterVendorTags("en");
    expect(en.find((group) => group.key === "capacity")?.label).toBe("Capacity");
    expect(en.find((group) => group.key === "languages")?.tags[0]).toEqual({ label: "English", aliases: ["Anglais", "English"], familyKeys: [] });
  });

  it("une agence reçoit en plus la capacité en plénière et des équipements de séminaire", () => {
    const wedding = starterVendorTags("fr", "wedding_planner");
    const agency = starterVendorTags("fr", "event_agency");
    expect(wedding.some((group) => group.key === "plenary_capacity")).toBe(false);
    expect(agency.find((group) => group.key === "plenary_capacity")?.exclusive).toBe(true);
    expect(agency.find((group) => group.key === "equipment")?.tags.map((tag) => tag.label)).toContain("Salles de sous-commission");
    expect(wedding.find((group) => group.key === "equipment")?.tags.map((tag) => tag.label)).not.toContain("Salles de sous-commission");
  });
});

describe("DEV-13 — Modes de paiement reconnus", () => {
  it("chaque mode de départ a sa clé et ses libellés français et anglais", () => {
    expect(starterPaymentMethodKinds()).toEqual([
      { key: "bank_transfer", labels: ["Virement bancaire", "Bank transfer"] },
      { key: "card", labels: ["Carte bancaire", "Card"] },
      { key: "cheque", labels: ["Chèque", "Cheque"] },
      { key: "cash", labels: ["Espèces", "Cash"] },
    ]);
  });
});

describe("L26 — Données de départ des liens personnels (POR-01, SEC-15, RGP-03)", () => {
  it("deux profils : « Marié(e) » ouvre tout le portail, « Payeur » le budget limité et les devis", () => {
    expect(starterLinkProfiles("fr").map((profile) => [profile.key, profile.label, profile.rubrics, profile.budgetScope])).toEqual([
      ["couple", "Marié(e)", ["tasks", "program", "vendor_options", "budget", "quotes"], "all"],
      ["payer", "Payeur", ["budget", "quotes"], "selected"],
    ]);
    expect(starterLinkProfiles("en", "clients")[0]!.label).toBe("Client");
  });

  it("expiration de départ : 30 jours (client), 7 jours (prestataire), 180 jours sans date", () => {
    expect(starterLinkExpiry()).toEqual({ daysAfterEvent: { client: 30, vendor: 7, guest: 30 }, daysWithoutEventDate: 180 });
  });

  it("CHR-04, lot 27a — rappels de départ : 7 jours avant, la veille, retard rappelé dans la semaine, de 9 h à 19 h", () => {
    expect(starterClientTaskReminders()).toEqual({ daysBefore: { week: 7, eve: 1 }, overdue: { after: 1, within: 7 }, sendingHours: { from: 9, until: 19 } });
  });

  it("JRJ-03, lot 30a — numéros d'urgence en données, dans les deux langues ; le 114 se joint par SMS", () => {
    const fr = starterEmergencyNumbers("fr");
    expect(fr.map((item) => item.number)).toEqual(["112", "15", "17", "18", "114"]);
    expect(fr.filter((item) => item.sms).map((item) => item.number)).toEqual(["114"]);
    expect(starterEmergencyNumbers("en").map((item) => item.label)).not.toEqual(fr.map((item) => item.label));
  });

  it("mention d'information en français et en anglais, au nom de l'organisation, avec son contact", () => {
    for (const locale of ["fr", "en"] as const) {
      expect(starterLinkPrivacyNotice(locale)).toContain("{organization}");
      expect(starterLinkPrivacyNotice(locale)).toContain("{contact}");
      expect(starterLinkPrivacyNotice(locale)).toContain("CNIL");
    }
  });
});

describe("FAC-07 / JUR-01 — Mentions requises de départ (lot 31a, D4)", () => {
  it("chaque mention connue est requise sur au moins un document ; l'identité du vendeur partout", () => {
    const rules = starterRequiredMentions();
    expect(new Set(rules.map((rule) => rule.field))).toEqual(new Set(MENTION_FIELDS));
    for (const field of ["organizationName", "address", "siren"] as const) {
      expect(rules.find((rule) => rule.field === field)?.documents).toEqual(["quote", "deposit_invoice", "balance_invoice", "credit_note"]);
    }
  });

  it("conditions : numéro de TVA si assujetti, capital pour une société, médiateur pour un particulier", () => {
    const rules = starterRequiredMentions();
    expect(rules.find((rule) => rule.field === "vatNumber")?.vatRegimes).toEqual(["assujetti"]);
    expect(rules.find((rule) => rule.field === "shareCapital")?.legalForms).toContain("sas");
    expect(rules.find((rule) => rule.field === "mediator")?.clientKinds).toEqual(["individual"]);
  });
});

describe("FAC-01 / HUB-26 — Modèle de devis de départ (lot 31a, D3)", () => {
  it("un modèle de mariage « à adapter » : sections, deux options, échéancier sous le total", () => {
    const [template] = starterQuoteTemplates("fr");
    expect(template?.name).toMatch(/à adapter/);
    expect(template?.eventTypeKey).toBe("wedding");
    const sectionKeys = new Set(template!.sections.map((section) => section.key));
    expect(template!.lines.every((line) => line.section === null || sectionKeys.has(line.section))).toBe(true);
    expect(template!.lines.filter((line) => line.isOption)).toHaveLength(2);
    expect(template!.schedule.reduce((sum, entry) => sum + entry.percentageBasisPoints, 0)).toBeLessThan(10000);
    expect(starterQuoteTemplates("en")[0]?.name).toMatch(/to adapt/);
    expect(starterQuoteTemplates("fr", "event_agency")).toEqual([]);
  });
});
