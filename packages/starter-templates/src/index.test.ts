import { describe, expect, it } from "vitest";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";
import programFile from "./program.json";
import {
  starterDietaryOptions,
  starterMealTypes,
  starterFloorplanElements,
  starterFloorplanElementLabel,
  starterFloorplanFixtures,
  floorplanAmpChoices,
  floorplanEditorRules,
  floorplanSeatingRules,
  starterMealTypeLabel,
  starterSeatingRules,
  starterDietConsent,
  starterGuestPrivacyNotice,
  starterGuestRules,
  BUDGET_LINE_ICONS,
  MENTION_FIELDS,
  ONBOARDING_CHECKLIST_KEYS,
  isOnboardingTool,
  isOnboardingVolume,
  onboardingChecklistOrder,
  onboardingDefaultEventTypes,
  starterOnboarding,
  starterExampleEvent,
  starterAllocation,
  starterBudgetLines,
  starterClientTaskReminders,
  starterDemoEvent,
  starterDemoQuote,
  starterDocumentStyle,
  starterEmergencyNumbers,
  starterErasureResponse,
  starterEventTypes,
  starterTaskCategories,
  taskCategoryPalette,
  paymentsCalendarColor,
  starterFollowUpDelays,
  starterInvoiceMentions,
  starterLatePenalty,
  isPreviousStarterInvoiceMentions,
  starterProfessionalPaymentTerms,
  starterLinkExpiry,
  starterEventDocumentFolders,
  starterLinkPrivacyNotice,
  starterLinkProfiles,
  starterLossReasons,
  starterPaymentMethodKinds,
  starterPaymentMethods,
  starterPrivacySettings,
  starterProgram,
  starterProspectSources,
  starterEmailTemplate,
  starterContactFormNotice,
  starterContactForm,
  starterPipelineStages,
  starterProspectSourceLabels,
  starterQuoteTemplates,
  starterContractTemplates,
  starterContractRules,
  starterPaymentReminders,
  starterProposalTemplate,
  contractTemplateWarning,
  starterQuoteTerms,
  starterRequestResponse,
  starterRequiredMentions,
  starterRetroplanning,
  starterVendorCatalog,
  starterVendorSlots,
  starterVendorTags,
  starterVendorTypes,
  starterVendorTypeSynonymGroups, starterCombinedVendorTypes, starterProspectFollowUps, starterQuestionnaires, questionnaireSensitiveWords, starterMessageTemplates } from "./index";

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
      // Lot 31b (réponse 3 de l'avocat, D16) : contrat électronique et dossier de preuve, dix ans.
      signedQuoteRetentionMonths: 120,
      // RGPD-09 : preuve d'une demande close gardée 5 ans (décision de Julien du 09/11/2026).
      requestProofRetentionMonths: 60,
      // Lot 49 (RGP-08, D9 ; réponses 2 et 3 de la DPO) : invités, en jours après l'évènement.
      guestRetentionDays: 30,
      guestDietRetentionDays: 7,
      guestPurgeMaxPostponeDays: 90,
    });
  });
});

describe("Lot 49 — Données de départ du module Invités", () => {
  it("INV-07, D6 : quatorze allergènes INCO, des régimes courants, aucun régime religieux, en français et en anglais", () => {
    const fr = starterDietaryOptions("fr");
    const en = starterDietaryOptions("en");
    expect(fr.filter((option) => option.kind === "allergen")).toHaveLength(14);
    expect(en.map((option) => option.key)).toEqual(fr.map((option) => option.key));
    expect(fr.map((option) => option.label.toLowerCase()).join(" ")).not.toMatch(/halal|casher|kasher|porc/);
  });

  it("D8 à D13 : clôture 30 jours avant, relances J-21 et J-7, préavis 7 jours, seuil « moins de 3 »", () => {
    expect(starterGuestRules()).toMatchObject({ closingDaysBeforeFirstMoment: 30, reminderDaysBeforeClosing: [21, 7], maxReminders: 3, purgeNoticeDays: 7, aggregateThreshold: 3 });
  });

  it("RGP-03, RGP-06 : mention d'information et accord versionné, dans les deux langues", () => {
    for (const locale of ["fr", "en"] as const) {
      expect(starterGuestPrivacyNotice(locale)).toContain("{organization}");
      const consent = starterDietConsent(locale);
      expect(consent.version).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(consent.guardian).toContain("{name}");
    }
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
      expect.arrayContaining(["Coiffure", "Maquillage", "Robe de mariée", "Tenue du marié", "Bijoux"]),
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

  it("PRE-01 (lot 63e) — « Coiffure » et « Maquillage » sont deux métiers ; « Coiffure et maquillage » n'est plus un type mais une combinaison", () => {
    const groups = starterVendorTypeSynonymGroups();
    expect(groups.find((labels) => labels.includes("Coiffeur(se)"))).toEqual(expect.arrayContaining(["Coiffure"]));
    expect(groups.find((labels) => labels.includes("Maquilleuse"))).toEqual(expect.arrayContaining(["Maquillage"]));
    expect(groups.some((labels) => labels.includes("Coiffure et maquillage"))).toBe(false);
    expect(starterCombinedVendorTypes().items.find((item) => item.fr.includes("Coiffure et maquillage"))!.parts).toEqual(["hair_makeup", "makeup"]);
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
    expect(starterLinkExpiry()).toEqual({ daysAfterEvent: { client: 30, vendor: 7, guest: 30, day_helper: 1 }, daysWithoutEventDate: 180, dayHelperDaysBefore: 1 });
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

describe("FAC-04 / HUB-26 / JUR-20 — Modèle de contrat de départ « à adapter » (lot 31b, D10)", () => {
  it("un squelette : titres, variables, et un emplacement « à rédiger » à la place de chaque texte juridique", () => {
    const [template] = starterContractTemplates("fr");
    expect(template?.name).toMatch(/à adapter/);
    expect(template?.eventTypeKey).toBe("wedding");
    expect(template!.clauses.map((clause) => clause.title)).toContain("Annulation et report");
    expect(template!.clauses.find((clause) => clause.title === "Annulation et report")?.body).toMatch(/^\[À rédiger avec votre conseil/);
    expect(template!.clauses.find((clause) => clause.title === "Objet")?.body).toContain("{evenement.date}");
    expect(starterContractTemplates("en")[0]?.clauses.find((clause) => clause.role === "early_execution")?.body).toMatch(/^\[To be drafted/);
    expect(starterContractTemplates("fr", "event_agency")).toEqual([]);
  });

  it("chaque élément exigé par un régime, et chaque clause des sommes versées d'avance, a sa clause ; l'avertissement de relecture est fourni", () => {
    const [template] = starterContractTemplates("fr");
    const rules = starterContractRules();
    const roles = new Set(template!.clauses.map((clause) => clause.role));
    for (const role of [...rules.requiredRoles.withdrawal, ...rules.requiredRoles.noWithdrawal, rules.advanceRoles.deposit, rules.advanceRoles.earnest]) expect(roles).toContain(role);
    expect(contractTemplateWarning("fr")).toBe("Base à adapter, à faire relire par un professionnel du droit.");
    expect(contractTemplateWarning("en")).toMatch(/legal professional/);
  });
});

describe("JUR-07 / JUR-14 — Règles des contrats (lot 31b, réponses de l'avocat, D11 à D15)", () => {
  it("quatorze jours reportés au lundi ; rétractation à distance et hors établissement ; foire ou salon refusé ; sept jours sans paiement hors établissement", () => {
    const rules = starterContractRules();
    expect(rules.withdrawal).toEqual({ periodDays: 14, extendWeekendToMonday: true });
    expect(rules.regime.withdrawalChannels).toEqual(["distance", "off_premises"]);
    expect(rules.regime.blockedChannels).toEqual(["fair"]);
    expect(rules.regime.consumerCategories).toEqual(["individual"]);
    expect(rules.regime.orderChannels).toEqual(["distance"]);
    expect(rules.regime.noPaymentDays).toEqual({ off_premises: 7 });
    expect(rules.signature).toEqual({ advancedThresholdCents: 1000000, availableLevel: "simple" });
    expect(rules.retention.signedContractMinimumMonths).toBe(120);
    expect(rules.placeholderMarkers).toContain("[À rédiger");
  });
});

describe("FAC-07 / JUR-01 — Conditions de paiement selon le client (lot 31c, expert-comptable, D18)", () => {
  it("deux textes de départ, en français et en anglais : particuliers et non-professionnels, puis professionnels", () => {
    for (const locale of ["fr", "en"] as const) {
      expect(starterInvoiceMentions(locale)).toBeTruthy();
      expect(starterProfessionalPaymentTerms(locale)).toBeTruthy();
      expect(starterProfessionalPaymentTerms(locale)).not.toBe(starterInvoiceMentions(locale));
    }
    expect(starterInvoiceMentions("fr")).toContain("escompte");
    // Le taux légal, sous le plancher face à un professionnel, n'est plus dans le texte de départ.
    expect(starterInvoiceMentions("fr")).not.toContain("taux d'intérêt légal");
    expect(starterProfessionalPaymentTerms("fr")).toContain("scompte");
    expect(starterProfessionalPaymentTerms("en")).toMatch(/discount/i);
  });

  it("l'ancien texte de départ (pénalités au taux légal) est reconnu, en français et en anglais", () => {
    expect(isPreviousStarterInvoiceMentions("Conditions de paiement : à réception de la facture, par virement bancaire. Aucun escompte pour paiement anticipé. En cas de retard de paiement, des pénalités au taux d'intérêt légal peuvent être appliquées.")).toBe(true);
    expect(isPreviousStarterInvoiceMentions("  Payment terms: upon receipt of the invoice, by bank transfer. No discount for early payment. In the event of late payment, penalties at the statutory interest rate may apply.\n")).toBe(true);
    expect(isPreviousStarterInvoiceMentions(starterInvoiceMentions("fr"))).toBe(false);
    expect(isPreviousStarterInvoiceMentions(null)).toBe(false);
  });

  it("le taux des pénalités se choisit dans une liste de deux, sans valeur par défaut ; l'indemnité forfaitaire est de 40 €", () => {
    const penalty = starterLatePenalty();
    expect(penalty.rates.map((rate) => rate.key)).toEqual(["ecb_plus_10", "three_times_legal"]);
    expect(penalty.rates.find((rate) => rate.key === "ecb_plus_10")?.label.fr).toBe("Taux de la BCE majoré de 10 points");
    expect(penalty.rates.find((rate) => rate.key === "three_times_legal")?.label.fr).toBe("Trois fois le taux d'intérêt légal");
    expect(penalty.recoveryIndemnityCents).toBe(4000);
    for (const locale of ["fr", "en"] as const) {
      expect(penalty.sentence[locale]).toContain("{taux}");
      expect(penalty.sentence[locale]).toContain("{indemnite}");
    }
  });

  it("mentions exigées : texte professionnel et taux pour un client professionnel, sur le devis et les factures ; son texte pour les autres", () => {
    const rules = starterRequiredMentions();
    expect(MENTION_FIELDS).toContain("professionalPaymentTerms");
    expect(MENTION_FIELDS).toContain("latePenaltyRate");
    for (const field of ["professionalPaymentTerms", "latePenaltyRate"] as const) {
      const rule = rules.find((candidate) => candidate.field === field);
      expect(rule?.documents).toEqual(["quote", "deposit_invoice", "balance_invoice"]);
      expect(rule?.clientKinds).toEqual(["professional"]);
    }
    const individual = rules.find((rule) => rule.field === "paymentTerms");
    expect(individual?.documents).toEqual(["deposit_invoice", "balance_invoice"]);
    expect(individual?.clientKinds).toEqual(["individual", "non_professional"]);
  });
});

describe("HUB-09 — Questionnaire d'accueil : réponses de départ (lot 33b, D9, D11)", () => {
  it("chaque question a sa valeur par défaut, et les volumes et outils proposés existent en français et en anglais", () => {
    for (const locale of ["fr", "en"] as const) {
      const questionnaire = starterOnboarding(locale);
      expect(questionnaire.defaults).toEqual({ metier: "wedding_planner", vatRegime: "franchise", volume: "11_to_25", tools: [] });
      expect(questionnaire.volumes.map((volume) => volume.key)).toContain(questionnaire.defaults.volume);
      expect(questionnaire.tools.length).toBeGreaterThan(2);
      for (const entry of [...questionnaire.volumes, ...questionnaire.tools]) expect(entry.label.length).toBeGreaterThan(0);
    }
    expect(starterOnboarding("en").tools[0]!.label).toBe("A spreadsheet (Excel, Google Sheets…)");
  });

  it("les types d'évènements cochés d'avance existent parmi les types de départ de chaque métier", () => {
    expect(onboardingDefaultEventTypes("wedding_planner")).toEqual(["wedding"]);
    expect(onboardingDefaultEventTypes("event_agency")).toEqual(["seminar", "corporate_party", "product_launch"]);
    expect(onboardingDefaultEventTypes("autre")).toEqual(["other"]);
  });

  // Lot 63a (HUB-11 ; recette du 21/11/2026) : deux actions seulement ; le devis, l'import des
  // contacts et l'invitation du client sont des tutoriels. L'essentiel vient toujours d'abord.
  it("l'indispensable seulement : l'essentiel, puis un premier prestataire, quels que soient les outils remplacés", () => {
    expect(onboardingChecklistOrder([])).toEqual(["essentials", "first_vendor"]);
    expect(onboardingChecklistOrder(["spreadsheet"])).toEqual(["essentials", "first_vendor"]);
    expect(onboardingChecklistOrder(["email_calendar", "word_processor"])).toEqual(["essentials", "first_vendor"]);
    expect(onboardingChecklistOrder(["inconnu"])).toEqual(onboardingChecklistOrder([]));
    expect(ONBOARDING_CHECKLIST_KEYS).toHaveLength(2);
  });

  it("reconnaît les clés de volume et d'outil, et refuse les autres", () => {
    expect(isOnboardingVolume("11_to_25")).toBe(true);
    expect(isOnboardingVolume("1000")).toBe(false);
    expect(isOnboardingTool("spreadsheet")).toBe(true);
    expect(isOnboardingTool("fax")).toBe(false);
  });
});

describe("HUB-10 — L'exemple du démarrage (lot 33b, D10)", () => {
  it("le mariage de référence est fictif et dit qu'il l'est, en français et en anglais", () => {
    expect(starterExampleEvent("fr").clients.map((client) => client.firstName)).toEqual(["Léa", "Maxime"]);
    expect(starterExampleEvent("fr").clients.every((client) => client.lastName.includes("(exemple)"))).toBe(true);
    expect(starterExampleEvent("en").clients.every((client) => client.lastName.includes("(example)"))).toBe(true);
    expect(starterExampleEvent("fr").venueName).toContain("fictif");
    expect(starterExampleEvent("fr").daysFromToday).toBeGreaterThan(180);
  });
});

describe("Lot 50 — Données de départ du plan de table et de la synthèse pour le traiteur", () => {
  it("INV-06, D5 : quatre types de repas (adulte, enfant, bébé sans repas, prestataire), en français et en anglais", () => {
    const fr = starterMealTypes("fr");
    const en = starterMealTypes("en");
    expect(fr.map((type) => type.key)).toEqual(["adult", "child", "baby", "vendor"]);
    expect(en.map((type) => type.key)).toEqual(fr.map((type) => type.key));
    expect(fr.every((type) => type.label.length > 0)).toBe(true);
    expect(starterMealTypeLabel("baby", "en")).toBeTruthy();
    expect(starterMealTypeLabel("inconnu", "fr")).toBeNull();
  });

  it("INV-05, D2 : la forme donne la capacité proposée ; ajout en série et plan bornés", () => {
    const rules = starterSeatingRules();
    expect(Object.keys(rules.defaultCapacity).sort()).toEqual(["head", "rectangular", "round"]);
    for (const capacity of Object.values(rules.defaultCapacity)) expect(capacity).toBeGreaterThan(0);
    expect(rules.maxTablesPerSeries).toBeGreaterThanOrEqual(12);
    expect(rules.maxTablesPerPlan).toBeGreaterThanOrEqual(rules.maxTablesPerSeries);
    expect(rules.maxCapacity).toBeGreaterThanOrEqual(rules.defaultCapacity.round);
  });
});

describe("CRM-01 / CRM-02 — Données de départ du formulaire de contact et du pipeline (lot 44)", () => {
  it("quatre étapes de départ, en français et en anglais", () => {
    expect(starterPipelineStages("fr")).toEqual(["Nouvelle demande", "Premier échange", "Rendez-vous", "Devis envoyé"]);
    expect(starterPipelineStages("en")).toHaveLength(4);
  });

  it("la source « Formulaire de contact » existe dans les deux listes de départ et se retrouve par sa clé", () => {
    const labels = starterProspectSourceLabels(starterContactForm().defaultSourceKey);
    expect(labels).toEqual({ fr: "Formulaire de contact", en: "Contact form" });
    expect(starterProspectSources("fr")).toContain(labels!.fr);
    expect(starterProspectSources("en", "event_agency")).toContain(labels!.en);
  });

  it("seuils de l'anti-spam (D4) et garde des demandes « à vérifier » (30 jours) en données", () => {
    expect(starterContactForm()).toEqual({ defaultSourceKey: "contact_form", minimumFillSeconds: 3, maxLinksBeforeReview: 2, toReviewRetentionDays: 30 });
  });

  it("RGP-03 — la mention d'information nomme le responsable, la durée, les droits et la politique, dans les deux langues", () => {
    for (const locale of ["fr", "en"] as const) {
      const notice = starterContactFormNotice(locale);
      for (const variable of ["{organization}", "{address}", "{months}", "{contact}", "{policy}"]) expect(notice).toContain(variable);
      expect(notice).toContain("CNIL");
    }
  });

  it("D7 — modèle de départ de l'e-mail « Nouvelle demande de contact », sans coordonnées du prospect", () => {
    for (const locale of ["fr", "en"] as const) {
      const template = starterEmailTemplate("prospect_form_received", locale);
      expect(template.body).toMatch(locale === "fr" ? /\{\{lien\}\}/ : /\{\{link\}\}/);
      expect(template.body).not.toMatch(/prénom|first_name|e-mail du|téléphone/);
    }
  });
});

describe("FAC-09 / FAC-15 / FAC-02 / GC-01 — Données de départ de la proposition et du règlement (lot 43)", () => {
  it("relances de départ : J-3 avant l'expiration, puis J+3, J+10 et J+20 après l'échéance ; aucune pénalité d'un particulier par défaut", () => {
    const reminders = starterPaymentReminders();
    expect(reminders.expiryReminderDays).toBe(3);
    expect(reminders.paymentReminderDays).toEqual([3, 10, 20]);
    expect(reminders.consumerClauseSentence.fr).toContain("{taux}");
    expect(reminders.noPenaltySentence.en.length).toBeGreaterThan(0);
  });

  it("le modèle de proposition de départ place le devis, et chaque bloc une seule fois, en français et en anglais", () => {
    for (const locale of ["fr", "en"] as const) {
      const template = starterProposalTemplate(locale);
      expect(template.blocks).toContain("quote");
      expect(new Set(template.blocks).size).toBe(template.blocks.length);
      expect(template.greeting.length).toBeGreaterThan(20);
    }
  });

  it("les textes de l'écran de règlement viennent des règles du contrat, avec le délai et la date en variables", () => {
    const { settlement, withdrawal, regime } = starterContractRules();
    expect(regime.noPaymentDays.off_premises).toBe(7);
    expect(withdrawal.periodDays).toBe(14);
    for (const locale of ["fr", "en"] as const) {
      expect(settlement.distance[locale]).toContain("{jours}");
      expect(settlement.offPremisesOpen[locale]).toContain("{jours}");
      expect(settlement.offPremisesWaiting[locale]).toContain("{date}");
    }
  });

  it("les quatre e-mails de départ existent dans les deux langues, sans lien ni donnée de carte", () => {
    for (const kind of ["proposal_sent", "proposal_expiry_reminder", "payment_details", "invoice_reminder"]) {
      for (const locale of ["fr", "en"] as const) {
        const template = starterEmailTemplate(kind, locale);
        expect(template.subject.length).toBeGreaterThan(0);
        expect(template.body).not.toMatch(/\{\{(lien|link)\}\}|carte|card/i);
      }
    }
    expect(starterEmailTemplate("payment_details", "fr").body).toContain("{{référence}}");
    expect(starterEmailTemplate("invoice_reminder", "en").body).toContain("{{penalties}}");
  });
});

describe("CRM-05, CRM-06, POR-07 (lot 45) — Données de départ des relances et des questionnaires", () => {
  it("CRM-06 : deux relances à J+3 et J+7, envoi automatique désactivé (D2), lien de brochure de 30 jours", () => {
    expect(starterProspectFollowUps()).toEqual({ steps: [{ days: 3 }, { days: 7 }], autoSend: false, brochureLinkDays: 30, brochureMaxSizeBytes: 20 * 1024 * 1024 });
  });

  it("CRM-05 : les modèles de messages de départ comptent la brochure (avec son lien) et le rendez-vous (avec la page de réservation), en français et en anglais", () => {
    for (const locale of ["fr", "en"] as const) {
      const templates = starterMessageTemplates(locale);
      expect(templates.map((template) => template.key)).toEqual(["first_request", "meeting", "brochure"]);
      expect(templates.find((template) => template.key === "brochure")!.body).toContain("{{brochure}}");
      expect(templates.find((template) => template.key === "meeting")!.body).toContain(locale === "fr" ? "{{lien_rendez_vous}}" : "{{booking_link}}");
    }
  });

  it("POR-07 : quatre questionnaires de départ (découverte, cérémonie, musiques, détails pratiques), mêmes questions dans les deux langues", () => {
    const fr = starterQuestionnaires("fr");
    const en = starterQuestionnaires("en");
    expect(fr.map((template) => template.key)).toEqual(["discovery", "ceremony", "music", "practical"]);
    expect(en.map((template) => template.questions.map((question) => question.key))).toEqual(fr.map((template) => template.questions.map((question) => question.key)));
    const discovery = fr[0]!;
    expect(discovery.questions.filter((question) => question.eventField).map((question) => question.eventField)).toEqual(["event_date", "city", "venue", "guests", "budget", "style"]);
  });

  it("DPO : aucune question de départ ne touche à la santé, à la religion ou aux opinions", () => {
    for (const locale of ["fr", "en"] as const) {
      const words = questionnaireSensitiveWords(locale).map((word) => word.toLowerCase());
      for (const template of starterQuestionnaires(locale)) {
        for (const question of template.questions) {
          const text = `${question.label} ${question.help ?? ""} ${question.choices.join(" ")}`.toLowerCase();
          expect(words.filter((word) => text.includes(word)), `${template.key}/${question.key}`).toEqual([]);
        }
      }
    }
  });
});

describe("L60-PLA-01 — Bibliothèque de départ des plans de salle (floorplan-elements.json)", () => {
  it("tables de toutes formes et installations de soirée, traduites en français et en anglais", () => {
    const fr = starterFloorplanElements("fr");
    const en = starterFloorplanElements("en");
    expect(en.map((element) => element.key)).toEqual(fr.map((element) => element.key));
    expect(new Set(fr.map((element) => element.key)).size).toBe(fr.length);
    expect(fr.filter((element) => element.category === "table").map((element) => element.shape)).toEqual(expect.arrayContaining(["circle", "rect", "ellipse"]));
    for (const key of ["round_table", "rect_table", "oval_table", "square_table", "imperial_table", "head_table", "cocktail_table", "dance_floor", "dj", "bar", "buffet", "photobooth", "ceremony"]) {
      expect(fr.some((element) => element.key === key), key).toBe(true);
    }
    expect(starterFloorplanElementLabel("dj", "en")).toBe("DJ");
    expect(starterFloorplanElementLabel("inconnu", "fr")).toBeNull();
  });

  it("L60-PLA-03 : besoins électriques proposés (DJ : 2 prises 16 A), installations fixes de chaque nature", () => {
    const dj = starterFloorplanElements("fr").find((element) => element.key === "dj")!;
    expect([dj.powerOutlets, dj.powerAmps]).toEqual([2, 16]);
    expect(starterFloorplanFixtures().map((fixture) => fixture.kind).sort()).toEqual(["delivery", "door", "emergency_exit", "outlet", "pillar", "stage", "water"]);
    expect(floorplanAmpChoices()).toContain(16);
  });

  it("L60-PLA-02 : grille de 50 cm, pas de 10 cm et 1 m, rotation de 15°", () => {
    expect(floorplanEditorRules()).toMatchObject({ gridCm: 50, nudgeCm: 10, nudgeLargeCm: 100, rotationStepDeg: 15 });
    expect(floorplanSeatingRules().seatWidthCm).toBeGreaterThan(0);
  });
});

describe("PRE-01, PRE-11 (lot 63e, ADR 0105) — types combinés en données", () => {
  it("chaque combinaison désigne au moins deux types de départ distincts, connus du catalogue", () => {
    const keys = new Set(starterVendorCatalog("fr").flatMap((family) => family.types.map((type) => type.key)));
    for (const item of starterCombinedVendorTypes().items) {
      expect(new Set(item.parts).size, item.fr[0]).toBe(item.parts.length);
      for (const part of item.parts) expect(keys.has(part), part).toBe(true);
    }
  });

  it("aucun libellé combiné n'est aussi le synonyme d'un seul type, et « Photographe & Vidéaste » donne deux métiers", () => {
    const single = new Set(starterVendorTypeSynonymGroups().flat().map((label) => label.toLocaleLowerCase("fr")));
    for (const item of starterCombinedVendorTypes().items) for (const label of [...item.fr, ...item.en]) expect(single.has(label.toLocaleLowerCase("fr")), label).toBe(false);
    expect(starterCombinedVendorTypes().items.find((item) => item.fr.includes("Photographe & Vidéaste"))!.parts).toEqual(["photographer", "videographer"]);
  });

  it("les séparateurs reconnus sont écrits avec leurs espaces (« Baby-sitter » n'est pas coupé)", () => {
    for (const separator of starterCombinedVendorTypes().separators) expect(separator.endsWith(" "), separator).toBe(true);
  });
});

describe("DOC-01, BUD-04 — Dossiers proposés à chaque évènement (lot 63c, M8)", () => {
  it("trois dossiers typés, traduits, chacun avec la nature de pièce qui s'y range", () => {
    expect(starterEventDocumentFolders("fr")).toEqual([
      { key: "vendor_quotes", kind: "quote", name: "Devis des prestataires" },
      { key: "vendor_invoices", kind: "invoice", name: "Factures des prestataires" },
      { key: "contracts", kind: "contract", name: "Contrats" },
    ]);
    expect(starterEventDocumentFolders("en").map((folder) => folder.name)).toEqual(["Vendor quotes", "Vendor invoices", "Contracts"]);
  });
});

describe("CHR-03, HUB-20 — Catégories de départ des tâches (lot 63d)", () => {
  it("Client, Prestataires, Administratif, Jour J, traduites, chacune de sa couleur", () => {
    expect(starterTaskCategories("fr").map((category) => category.label)).toEqual(["Client", "Prestataires", "Administratif", "Jour J"]);
    expect(starterTaskCategories("en").map((category) => category.label)).toEqual(["Client", "Vendors", "Admin", "Big day"]);
    const colors = starterTaskCategories("fr").map((category) => category.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("la palette est nommée dans chaque langue et la couleur des paiements en fait partie, distincte des catégories de départ", () => {
    const palette = taskCategoryPalette("fr");
    expect(new Set(palette.map((entry) => entry.color)).size).toBe(palette.length);
    expect(taskCategoryPalette("en").every((entry) => entry.label.length > 0)).toBe(true);
    for (const category of starterTaskCategories("fr")) expect(palette.map((entry) => entry.color)).toContain(category.color);
    expect(palette.map((entry) => entry.color)).toContain(paymentsCalendarColor());
    expect(starterTaskCategories("fr").map((category) => category.color)).not.toContain(paymentsCalendarColor());
  });
});
