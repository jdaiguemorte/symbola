// Lot 38a (MSG-01, MSG-02 ; D5, D6, D8) — règles pures des modèles d'e-mails : variables connues
// et indispensables, rendu sans variable vide, découpage en paragraphes et en bouton, empreinte des
// destinataires d'un envoi groupé.
import { describe, expect, it } from "vitest";
import { EMAIL_LOCALES, EMAIL_TEMPLATE_KINDS } from "@symbola/contracts";
import { starterEmailTemplate } from "@symbola/starter-templates";
import { EMAIL_TEMPLATE_RULES, emailTemplateVariables, recipientsDigest, renderEmailTemplate, validateEmailTemplate, variableToken } from "./email-template-rules";

describe("MSG-01 — E-mails de service depuis des modèles à variables, avec aperçu et envoi test", () => {
  it("chaque modèle de départ, en français et en anglais, n'emploie que ses variables et contient ses variables indispensables", () => {
    for (const kind of EMAIL_TEMPLATE_KINDS) {
      for (const required of EMAIL_TEMPLATE_RULES[kind].required) expect(EMAIL_TEMPLATE_RULES[kind].variables).toContain(required);
      for (const locale of EMAIL_LOCALES) {
        expect(validateEmailTemplate(kind, starterEmailTemplate(kind, locale)), `${kind} ${locale}`).toEqual({ unknown: [], missingRequired: [], tooLong: [] });
      }
    }
  });

  it("une variable inconnue, ou étrangère à ce modèle, est refusée ; le lien d'un e-mail de lien ne peut pas manquer", () => {
    expect(validateEmailTemplate("client_link", { subject: "Bonjour {{nom}}", body: "{{lien}} {{numéro_devis}}" })).toEqual({ unknown: ["nom", "numéro_devis"], missingRequired: [], tooLong: [] });
    expect(validateEmailTemplate("client_link", { subject: "Votre espace", body: "Bonjour {{prénom}}, à bientôt." })).toEqual({ unknown: [], missingRequired: ["link"], tooLong: [] });
    // Le lien dans l'objet seul ne suffit pas : il doit être dans le texte.
    expect(validateEmailTemplate("quote_signature", { subject: "{{lien}}", body: "Bonjour" }).missingRequired).toEqual(["link"]);
  });

  it("les variables s'écrivent en français ou en anglais, avec ou sans espaces dans les accolades", () => {
    expect(validateEmailTemplate("client_link", { subject: "Hello {{first_name}}", body: "{{ prénom }} : {{link}}" })).toEqual({ unknown: [], missingRequired: [], tooLong: [] });
    expect(emailTemplateVariables("client_link", "fr").map((variable) => variable.token)).toEqual(["{{prénom}}", "{{organisation}}", "{{évènement}}", "{{lien}}", "{{valable_jusqu_au}}"]);
    expect(emailTemplateVariables("client_link", "en").find((variable) => variable.key === "link")).toEqual({ key: "link", token: "{{link}}", required: true });
  });

  it("le rendu remplace chaque variable ; un paragraphe fait du seul lien devient un bouton ; les sauts de ligne restent", () => {
    const rendered = renderEmailTemplate("task_reminder", { subject: "Vos tâches pour {{évènement}}", body: "Bonjour {{prénom}},\n\nVoici :\n{{tâches}}\n\n{{organisation}}" }, {
      first_name: "Léa",
      event: "votre mariage",
      tasks: "- Choisir les alliances\n- Valider le menu",
      organization: "Atelier Camille R.",
    });
    expect(rendered).toEqual({
      subject: "Vos tâches pour votre mariage",
      blocks: [
        { kind: "paragraph", text: "Bonjour Léa," },
        { kind: "paragraph", text: "Voici :\n- Choisir les alliances\n- Valider le menu" },
        { kind: "paragraph", text: "Atelier Camille R." },
      ],
      text: "Bonjour Léa,\n\nVoici :\n- Choisir les alliances\n- Valider le menu\n\nAtelier Camille R.",
      missing: [],
    });
    const link = renderEmailTemplate("client_link", { subject: "Votre espace", body: "Votre lien :\n\n{{ lien }}\n\nÀ bientôt" }, { link: "https://symbola.test/lien#abc" });
    expect(link.blocks).toEqual([
      { kind: "paragraph", text: "Votre lien :" },
      { kind: "button", url: "https://symbola.test/lien#abc" },
      { kind: "paragraph", text: "À bientôt" },
    ]);
    expect(link.text).toBe("Votre lien :\n\nhttps://symbola.test/lien#abc\n\nÀ bientôt");
  });

  it("aucun e-mail avec une variable vide : chaque variable employée sans valeur est nommée", () => {
    const rendered = renderEmailTemplate("program_published", { subject: "Programme : version {{version}}", body: "Bonjour {{prénom}}, le {{date_évènement}}." }, { first_name: "  ", version: "2" });
    expect(rendered.missing).toEqual(["first_name", "event_date"]);
    // Une variable non employée peut rester vide.
    expect(renderEmailTemplate("program_published", { subject: "v{{version}}", body: "Bonjour" }, { version: "2" }).missing).toEqual([]);
  });

  it("la variable sans valeur se nomme telle qu'elle s'écrit dans un modèle de cette langue", () => {
    expect(variableToken("event_date", "fr")).toBe("{{date_évènement}}");
    expect(variableToken("event_date", "en")).toBe("{{event_date}}");
    expect(variableToken("inconnue", "fr")).toBe("{{inconnue}}");
  });

  it("un texte trop long est refusé (objet 200, texte 5 000 caractères)", () => {
    expect(validateEmailTemplate("signed_copy", { subject: "x".repeat(201), body: "y".repeat(5001) }).tooLong).toEqual(["subject", "body"]);
  });
});

describe("MSG-02 — Garde-fou d'envoi groupé : nombre et liste des destinataires, confirmation explicite", () => {
  it("l'empreinte ne dépend ni de l'ordre ni de la casse des adresses, mais change dès qu'une personne change", () => {
    const lea = { name: "Léa Martin", email: "Lea.Martin@exemple.test" };
    const maxime = { name: "Maxime Dubois", email: "maxime@exemple.test" };
    expect(recipientsDigest([lea, maxime])).toBe(recipientsDigest([maxime, { ...lea, email: "lea.martin@exemple.test" }]));
    expect(recipientsDigest([lea, maxime])).not.toBe(recipientsDigest([lea]));
    expect(recipientsDigest([lea, maxime])).not.toBe(recipientsDigest([lea, { ...maxime, email: "max@exemple.test" }]));
    expect(recipientsDigest([lea])).toMatch(/^[0-9a-f]{64}$/);
  });
});
