// Lot 65d (MSG-01, HUB-20 ; ADR 0110) — règles pures des messages de la relation, sans base : la liste
// fermée des modèles techniques (toujours envoyés par Symbola) et de ceux de la relation, lue dans les
// données (email-senders.json) ; le lien « Ouvrir dans ma messagerie ».
import { starterEmailSenders } from "@symbola/starter-templates";
import { EMAIL_TEMPLATE_KINDS, type EmailTemplateKind } from "@symbola/contracts";

const SENDERS = starterEmailSenders();
const KNOWN = new Set<string>(EMAIL_TEMPLATE_KINDS);
export const TECHNICAL_EMAIL_KINDS: readonly EmailTemplateKind[] = SENDERS.technical.filter((kind): kind is EmailTemplateKind => KNOWN.has(kind));
export const RELATION_EMAIL_KINDS: readonly EmailTemplateKind[] = SENDERS.relation.filter((kind): kind is EmailTemplateKind => KNOWN.has(kind));
const RELATION = new Set<string>(RELATION_EMAIL_KINDS);

// Un modèle de la relation : préparé pour la messagerie de la planner, sauf si l'organisation a choisi
// « Symbola les envoie pour moi ». Un modèle technique n'en est jamais un.
export function isRelationEmailKind(kind: string): kind is EmailTemplateKind {
  return RELATION.has(kind);
}

// Le lien « Ouvrir dans ma messagerie » : destinataire, objet et texte encodés (espaces en %20, pas en
// « + », que certaines messageries laissent tels quels).
export function preparedMailto(to: string, subject: string, body: string): string {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(to)}?${query}`;
}
