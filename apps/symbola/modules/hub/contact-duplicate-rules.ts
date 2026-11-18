// Lot 45 (CRM-07 ; D4 ; ADR 0090) — règles pures des doublons de contacts. Deux fiches se
// ressemblent quand elles ont la même adresse e-mail (casse et espaces ignorés) ou le même téléphone
// (format international : « 06 12 34 56 78 », « +33 6 12 34 56 78 » et « 0033612345678 » sont le même
// numéro). Une fiche fictive (essai guidé) n'est jamais appariée. La fusion est choisie champ par
// champ par la planner : par défaut, la fiche gardée garde ses valeurs et prend celles de l'autre là
// où elle n'en a pas.
import type { Contact, ContactKind } from "@symbola/contracts";

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase().replace(/\s+/g, "");
  return value ? value : null;
}

// Indicatif par défaut : la France (les fiches sans indicatif sont françaises dans le pilote).
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const compact = phone.trim().replace(/[\s.\-()/]/g, "");
  let international: string;
  if (compact.startsWith("+")) international = `+${compact.slice(1).replace(/\D/g, "")}`;
  else if (compact.startsWith("00")) international = `+${compact.slice(2).replace(/\D/g, "")}`;
  else {
    const digits = compact.replace(/\D/g, "");
    international = digits.length === 10 && digits.startsWith("0") ? `+33${digits.slice(1)}` : `+${digits}`;
  }
  // Un numéro français écrit « +33 0 6… » garde un zéro de trop.
  if (international.startsWith("+330") && international.length === 13) international = `+33${international.slice(4)}`;
  return international.replace(/\D/g, "").length >= 8 ? international : null;
}

export type DuplicateCandidate = { id: string; email: string | null; phone: string | null; isDemo: boolean };
export type DuplicatePair = { firstContactId: string; secondContactId: string; reason: "email" | "phone" };

function ordered(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Les paires de ressemblance entre une fiche et les autres (ou entre toutes, sans fiche désignée) ;
// une paire n'apparaît qu'une fois, l'e-mail avant le téléphone.
export function findDuplicatePairs(candidates: DuplicateCandidate[], focusId?: string): DuplicatePair[] {
  const real = candidates.filter((candidate) => !candidate.isDemo);
  const pairs = new Map<string, DuplicatePair>();
  for (const reason of ["email", "phone"] as const) {
    const groups = new Map<string, string[]>();
    for (const candidate of real) {
      const key = reason === "email" ? normalizeEmail(candidate.email) : normalizePhone(candidate.phone);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), candidate.id]);
    }
    for (const ids of groups.values()) {
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          if (focusId && ids[i] !== focusId && ids[j] !== focusId) continue;
          const [first, second] = ordered(ids[i]!, ids[j]!);
          const key = `${first}:${second}`;
          if (!pairs.has(key)) pairs.set(key, { firstContactId: first, secondContactId: second, reason });
        }
      }
    }
  }
  return [...pairs.values()].sort((a, b) => a.firstContactId.localeCompare(b.firstContactId) || a.secondContactId.localeCompare(b.secondContactId));
}

// —— Fusion (D4) ———————————————————————————————————————————————————————————————————————

export const MERGEABLE_FIELDS = ["firstName", "lastName", "name", "email", "phone", "addressLine", "postalCode", "city", "country", "billingAddress", "companyIdNumber", "vatNumber"] as const;
export type MergeableField = (typeof MERGEABLE_FIELDS)[number];
export type MergeChoices = Partial<Record<MergeableField, "kept" | "absorbed">>;
export type MergeableValues = Pick<Contact, MergeableField> & { kind: ContactKind; isDemo: boolean };

export class ContactMergeRefusedError extends Error {
  constructor(readonly reason: "same" | "demo" | "kind" | "not_found" | "anonymized") {
    super(`fusion refusée : ${reason}`);
    this.name = "ContactMergeRefusedError";
  }
}

function filled(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}

// Les valeurs de la fiche réunie et les champs repris de la fiche absorbée.
export function mergeContactValues(kept: MergeableValues, absorbed: MergeableValues, choices: MergeChoices): { values: Pick<Contact, MergeableField>; fromAbsorbed: MergeableField[] } {
  if (kept.isDemo || absorbed.isDemo) throw new ContactMergeRefusedError("demo");
  if (kept.kind !== absorbed.kind) throw new ContactMergeRefusedError("kind");
  const values = {} as Pick<Contact, MergeableField>;
  const fromAbsorbed: MergeableField[] = [];
  for (const field of MERGEABLE_FIELDS) {
    const choice = choices[field] ?? (filled(kept[field]) ? "kept" : "absorbed");
    const takeAbsorbed = choice === "absorbed" && filled(absorbed[field]) && absorbed[field] !== kept[field];
    values[field] = takeAbsorbed ? absorbed[field] : kept[field];
    if (takeAbsorbed) fromAbsorbed.push(field);
  }
  return { values, fromAbsorbed };
}
