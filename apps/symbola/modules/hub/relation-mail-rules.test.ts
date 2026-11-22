// Lot 65d (MSG-01, HUB-20 ; ADR 0110) — la liste fermée de qui envoie chaque modèle.
import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_KINDS } from "@symbola/contracts";
import { isRelationEmailKind, preparedMailto, RELATION_EMAIL_KINDS, TECHNICAL_EMAIL_KINDS } from "./relation-mail-rules";

describe("MSG-01 — Qui envoie les messages de la relation (lot 65d, ADR 0110)", () => {
  it("chaque modèle est dans une liste et une seule : technique (Symbola l'envoie toujours) ou de la relation", () => {
    expect([...TECHNICAL_EMAIL_KINDS, ...RELATION_EMAIL_KINDS].sort()).toEqual([...EMAIL_TEMPLATE_KINDS].sort());
    expect(TECHNICAL_EMAIL_KINDS.filter((kind) => RELATION_EMAIL_KINDS.includes(kind))).toEqual([]);
  });

  it("la liste des modèles techniques est fermée : accès, signature et preuve, rendez-vous en ligne, sécurité et compte, avis à l'équipe", () => {
    expect([...TECHNICAL_EMAIL_KINDS].sort()).toEqual(
      [
        "client_link",
        "client_link_renewed",
        "vendor_link",
        "vendor_link_renewed",
        "day_helper_link",
        "guest_invitation",
        "guest_reminder",
        "quote_signature",
        "contract_signature",
        "signed_copy",
        "appointment_confirmed",
        "appointment_reminder",
        "appointment_rescheduled",
        "appointment_cancelled",
        "new_device_login",
        "identity_changed",
        "ownership_transfer",
        "daily_digest",
        "notification_alert",
        "new_message",
        "prospect_form_received",
      ].sort(),
    );
  });

  it("les messages de la relation, avec le rappel des tâches du client (décision 2 du 22/11), sont préparés pour la planner", () => {
    expect([...RELATION_EMAIL_KINDS].sort()).toEqual(
      ["prospect_reply", "prospect_follow_up", "questionnaire_sent", "proposal_sent", "order_first", "proposal_expiry_reminder", "payment_details", "invoice_reminder", "payment_due_reminder", "vendor_brief", "vendor_brief_reminder", "vendor_roadmap", "program_published", "task_reminder"].sort(),
    );
    expect(isRelationEmailKind("task_reminder")).toBe(true);
    expect(isRelationEmailKind("client_link")).toBe(false);
    expect(isRelationEmailKind("inconnu")).toBe(false);
  });

  it("« Ouvrir dans ma messagerie » : destinataire, objet et texte encodés, espaces en %20 et retours à la ligne gardés", () => {
    const href = preparedMailto("léa+mariage@example.com", "Votre proposition D-2026-0001", "Bonjour Léa,\n\nÀ bientôt & merci");
    expect(href.startsWith("mailto:l%C3%A9a%2Bmariage%40example.com?")).toBe(true);
    expect(href).toContain("subject=Votre%20proposition%20D-2026-0001");
    expect(href).toContain("body=Bonjour%20L%C3%A9a%2C%0A%0A%C3%80%20bient%C3%B4t%20%26%20merci");
    expect(href).not.toContain("+");
  });
});
