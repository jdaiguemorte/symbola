// Lot 55 (MSG-04 révisée, D1 ; ADR 0101) — règles de l'adresse d'expédition d'une organisation :
// « <partie locale>@<domaine d'envoi de Symbola> ». Fonctions pures, testées sans base.
import { SENDER_LOCAL_PART_PATTERN } from "@symbola/contracts";

// Parties locales réservées : celles que les fournisseurs et les normes attendent pour l'exploitation
// du domaine (RFC 2142 : postmaster, abuse…), et celles qui feraient passer une organisation pour
// Symbola. Une règle technique de la plateforme, pas une donnée métier d'une organisation.
const RESERVED = new Set(["postmaster", "abuse", "hostmaster", "webmaster", "security", "noc", "mailer-daemon", "bounce", "bounces", "no-reply", "noreply", "admin", "root", "support", "symbola", "dmarc", "dkim"]);

export const SENDER_LOCAL_PART_MIN = 2;
export const SENDER_LOCAL_PART_MAX = 40;

export type SenderLocalPartProblem = "format" | "reserved";

export function senderLocalPartProblem(value: string): SenderLocalPartProblem | null {
  if (!SENDER_LOCAL_PART_PATTERN.test(value)) return "format";
  if (RESERVED.has(value)) return "reserved";
  return null;
}

// La saisie, mise en forme : minuscules, espaces retirés. Les autres caractères restent, pour que
// l'erreur les signale plutôt que de les effacer en silence.
export function normalizeSenderLocalPart(raw: string): string {
  return raw.trim().toLowerCase();
}

// La proposition depuis le nom de l'organisation : accents retirés, tout autre caractère devenu un
// tiret, 40 caractères au plus. « Atelier Camille R. » → « atelier-camille-r ».
export function proposeSenderLocalPart(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SENDER_LOCAL_PART_MAX)
    .replace(/-+$/g, "");
  const proposal = base.length >= SENDER_LOCAL_PART_MIN ? base : `organisation${base ? `-${base}` : ""}`;
  return RESERVED.has(proposal) ? `${proposal}-wp` : proposal;
}

// Les propositions suivantes quand la première est prise : « atelier-camille-2 », « -3 »…
export function senderLocalPartCandidates(name: string, count = 20): string[] {
  const first = proposeSenderLocalPart(name);
  const candidates = [first];
  for (let index = 2; candidates.length < count; index += 1) {
    const suffix = `-${index}`;
    candidates.push(`${first.slice(0, SENDER_LOCAL_PART_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`);
  }
  return candidates;
}

// Le domaine de l'en-tête Message-ID : le domaine d'envoi en mode « organization », sinon celui de
// SMTP_FROM.
export function messageIdDomain(mode: "shared" | "organization", sendingDomain: string, smtpFrom: string): string {
  if (mode === "organization") return sendingDomain;
  const address = /<([^<>]+)>/.exec(smtpFrom)?.[1]?.trim() ?? smtpFrom.trim();
  return address.split("@")[1] ?? sendingDomain;
}

// Référence d'un envoi (sans donnée personnelle) : organisation et ligne du journal, lisibles par le
// webhook pour retrouver la ligne sans connaître l'organisation à l'avance.
const REFERENCE = /^<?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@[a-z0-9.-]+>?$/i;

export function deliveryReference(organizationId: string, deliveryId: string, domain: string): string {
  return `${organizationId}.${deliveryId}@${domain}`;
}

export function parseDeliveryReference(reference: string): { organizationId: string; deliveryId: string } | null {
  const match = REFERENCE.exec(reference.trim());
  return match ? { organizationId: match[1]!.toLowerCase(), deliveryId: match[2]!.toLowerCase() } : null;
}
