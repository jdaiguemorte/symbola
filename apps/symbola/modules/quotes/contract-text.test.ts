import { describe, expect, it } from "vitest";
import { starterContractRules, starterContractTemplates } from "@symbola/starter-templates";
import {
  advanceClauseProblem,
  contractRegime,
  CONTRACT_VARIABLES,
  isContractTextComplete,
  missingRoles,
  resolveContractText,
  variablesIn,
  withdrawalPeriod,
  type ContractVariableValues,
} from "./contract-text";

const rules = starterContractRules();
const markers = rules.placeholderMarkers;

function values(overrides: Partial<ContractVariableValues> = {}): ContractVariableValues {
  const base = Object.fromEntries(CONTRACT_VARIABLES.map((name) => [name, `<${name}>`])) as ContractVariableValues;
  return { ...base, ...overrides };
}

describe("FAC-04 / DOC-02 — Contrat généré depuis un modèle à variables (lot 31b, D7)", () => {
  it("résout chaque variable connue, dans le titre comme dans le texte", () => {
    const check = resolveContractText(
      [{ title: "Objet — {devis.numero}", body: "Mariage de {client.noms} le {evenement.date}, {evenement.lieu}.", role: null }],
      values({ "client.noms": "Léa Martin et Maxime Durand", "evenement.date": "12 juin 2027", "evenement.lieu": "Domaine des Tilleuls, Senlis", "devis.numero": "D-2027-0001" }),
      markers,
    );
    expect(check.clauses[0]).toEqual({ title: "Objet — D-2027-0001", body: "Mariage de Léa Martin et Maxime Durand le 12 juin 2027, Domaine des Tilleuls, Senlis.", role: null });
    expect(isContractTextComplete(check)).toBe(true);
  });

  it("liste les variables manquantes avant la génération (une seule fois chacune, dans l'ordre)", () => {
    const check = resolveContractText(
      [
        { title: "Objet", body: "Le {evenement.date}, {evenement.lieu}.", role: null },
        { title: "Assurance", body: "{organisation.assurance} ; lieu : {evenement.lieu}", role: null },
      ],
      values({ "evenement.lieu": null, "organisation.assurance": "  " }),
      markers,
    );
    expect(check.missing).toEqual(["evenement.lieu", "organisation.assurance"]);
    expect(check.clauses[0]!.body).toBe("Le <evenement.date>, {evenement.lieu}.");
    expect(isContractTextComplete(check)).toBe(false);
  });

  it("signale une variable inconnue (faute de frappe) et une clause encore à rédiger", () => {
    const check = resolveContractText(
      [
        { title: "Objet", body: "Pour {client.nom}.", role: null },
        { title: "Annulation", body: "[À rédiger avec votre conseil : clause d'annulation]", role: null },
        { title: "Cancellation", body: "[To be drafted with your adviser: cancellation]", role: null },
      ],
      values(),
      markers,
    );
    expect(check.unknown).toEqual(["client.nom"]);
    expect(check.unwritten).toEqual(["Annulation", "Cancellation"]);
    expect(isContractTextComplete(check)).toBe(false);
  });

  it("le modèle de départ cite seulement des variables de la liste documentée", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const clause of starterContractTemplates(locale)[0]!.clauses) {
        for (const name of variablesIn(`${clause.title} ${clause.body}`)) expect(CONTRACT_VARIABLES).toContain(name);
      }
    }
  });
});

describe("JUR-07 — Canal de conclusion et régime (lot 31b, réponse 1 de l'avocat, D11 à D13)", () => {
  const regime = (channel: "on_premises" | "distance" | "off_premises" | "fair", category: "individual" | "non_professional" | "professional", smallBusinessConfirmed = false) =>
    contractRegime({ channel, category, smallBusinessConfirmed }, rules);

  it("à distance, un consommateur : rétractation, information complète, bouton de commande", () => {
    expect(regime("distance", "individual")).toEqual({
      blocked: false,
      withdrawalApplies: true,
      requiredRoles: ["precontractual_information", "withdrawal_period", "withdrawal_form", "early_execution", "termination"],
      orderRequired: true,
      noPaymentDays: null,
    });
  });

  it("hors établissement : rétractation, aucun paiement avant sept jours ; aussi pour une petite entreprise confirmée", () => {
    expect(regime("off_premises", "individual")).toMatchObject({ withdrawalApplies: true, orderRequired: false, noPaymentDays: 7 });
    expect(regime("off_premises", "non_professional", true)).toMatchObject({ withdrawalApplies: true, noPaymentDays: 7 });
    expect(regime("off_premises", "non_professional", false)).toMatchObject({ withdrawalApplies: false, requiredRoles: ["precontractual_information", "no_withdrawal"] });
    // La petite entreprise ne vaut pas à distance.
    expect(regime("distance", "professional", true)).toMatchObject({ withdrawalApplies: false, requiredRoles: [] });
  });

  it("dans l'établissement : pas de rétractation, information générale et clause standard ; foire ou salon refusé", () => {
    expect(regime("on_premises", "individual")).toEqual({ blocked: false, withdrawalApplies: false, requiredRoles: ["precontractual_information", "no_withdrawal"], orderRequired: false, noPaymentDays: null });
    expect(regime("fair", "individual")).toMatchObject({ blocked: true, withdrawalApplies: false });
  });

  it("signale chaque élément absent du contrat (bloquant, D12)", () => {
    expect(missingRoles(regime("distance", "individual").requiredRoles, [null, "precontractual_information", "withdrawal_period"])).toEqual(["withdrawal_form", "early_execution", "termination"]);
    expect(missingRoles(regime("on_premises", "individual").requiredRoles, ["precontractual_information", "no_withdrawal"])).toEqual([]);
  });
});

describe("JUR-08 — Sommes versées d'avance : clause concordante (lot 31b, réponse 2 de l'avocat)", () => {
  it("la clause manque, ou ne concorde pas avec le choix du devis", () => {
    expect(advanceClauseProblem("deposit", true, [null, "advance_deposit"], rules)).toBeNull();
    expect(advanceClauseProblem("deposit", true, [null], rules)).toBe("missing");
    expect(advanceClauseProblem("deposit", true, ["advance_earnest"], rules)).toBe("mismatch");
    expect(advanceClauseProblem("earnest", true, ["advance_earnest", "advance_deposit"], rules)).toBe("mismatch");
    // Sans échéancier, la clause n'est pas exigée ; sans choix, aucune clause d'avance ne convient.
    expect(advanceClauseProblem("deposit", false, [null], rules)).toBeNull();
    expect(advanceClauseProblem(null, false, ["advance_deposit"], rules)).toBe("mismatch");
  });
});

describe("FAC-05 / JUR-07 — Fin du délai de rétractation et émission de la facture d'acompte (lot 31b, D6)", () => {
  it("quatorze jours après la signature ; la facture s'émet le lendemain du dernier jour", () => {
    // Signé le lundi 1er mars 2027 : dernier jour le lundi 15, facture le mardi 16.
    expect(withdrawalPeriod("2027-03-01", rules.withdrawal)).toEqual({ lastDay: "2027-03-15", issueOn: "2027-03-16" });
  });

  it("un délai qui finit un samedi ou un dimanche est prolongé au lundi (passage à l'heure d'été compris)", () => {
    // Signé le samedi 20 mars 2027 : le 3 avril est un samedi (après le passage à l'heure d'été du 28 mars).
    expect(withdrawalPeriod("2027-03-20", rules.withdrawal)).toEqual({ lastDay: "2027-04-05", issueOn: "2027-04-06" });
    // Signé le dimanche 21 mars : le 4 avril est un dimanche.
    expect(withdrawalPeriod("2027-03-21", rules.withdrawal)).toEqual({ lastDay: "2027-04-05", issueOn: "2027-04-06" });
    expect(withdrawalPeriod("2027-03-20", { periodDays: 14, extendWeekendToMonday: false })).toEqual({ lastDay: "2027-04-03", issueOn: "2027-04-04" });
  });

  it("fin de mois et d'année", () => {
    expect(withdrawalPeriod("2027-12-20", rules.withdrawal)).toEqual({ lastDay: "2028-01-03", issueOn: "2028-01-04" });
  });
});
