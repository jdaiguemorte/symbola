// Lot 58 (PAR-09, EVT-08, FAC-11 ; ADR 0097) — données de départ de la clôture d'un évènement et des
// exports comptables : textes du remerciement et de la demande d'avis (FR et EN), tâche d'un
// questionnaire d'un modèle, plan de comptes, journaux et famille d'export selon la forme juridique.
// Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6) ; le plan de comptes et les codes
// des journaux sont à relire par l'expert-comptable (EC-9).
import { z } from "zod";
import closingFile from "./closing.json";
import accountingFile from "./accounting-exports.json";

const localized = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const text = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) });

const closingSchema = z.object({
  version: z.literal(1),
  thanks: z.object({ fr: text, en: text }),
  thanksWithReview: z.object({ fr: text, en: text }),
  questionnaireTask: localized,
  lessonCount: z.number().int().min(1).max(10),
  maxOwnExpenses: z.number().int().min(1).max(100),
});

export const ACCOUNTING_FAMILIES = ["micro", "real"] as const;
export type AccountingFamily = (typeof ACCOUNTING_FAMILIES)[number];
export const ACCOUNT_KEYS = ["sales", "vatCollected", "clients", "bank", "clientAdvances"] as const;
export type AccountKey = (typeof ACCOUNT_KEYS)[number];
export const JOURNAL_KEYS = ["sales", "bank"] as const;
export type JournalKey = (typeof JOURNAL_KEYS)[number];

const accountNumber = z.string().regex(/^[0-9A-Z]{1,20}$/);
const accountingSchema = z.object({
  version: z.literal(1),
  familyByLegalForm: z.record(z.string(), z.enum(ACCOUNTING_FAMILIES)),
  familyWithoutLegalForm: z.enum(ACCOUNTING_FAMILIES),
  accounts: z.object(Object.fromEntries(ACCOUNT_KEYS.map((key) => [key, z.object({ number: accountNumber, label: localized })])) as Record<AccountKey, z.ZodObject<{ number: typeof accountNumber; label: typeof localized }>>),
  journals: z.object(Object.fromEntries(JOURNAL_KEYS.map((key) => [key, z.object({ code: z.string().regex(/^[A-Z0-9]{1,10}$/), label: localized })])) as Record<JournalKey, z.ZodObject<{ code: z.ZodString; label: typeof localized }>>),
});

const closing = closingSchema.parse(closingFile);
const accounting = accountingSchema.parse(accountingFile);

type Locale = "fr" | "en";

export function starterClosingThanks(locale: Locale, withReview: boolean): { subject: string; body: string } {
  return { ...(withReview ? closing.thanksWithReview : closing.thanks)[locale] };
}

export function starterQuestionnaireTaskLabel(locale: Locale, name: string): string {
  return closing.questionnaireTask[locale].replace("{name}", name);
}

export function starterClosingLimits(): { lessonCount: number; maxOwnExpenses: number } {
  return { lessonCount: closing.lessonCount, maxOwnExpenses: closing.maxOwnExpenses };
}

export function starterAccountingFamily(legalForm: string | null): AccountingFamily {
  if (legalForm === null) return accounting.familyWithoutLegalForm;
  return accounting.familyByLegalForm[legalForm] ?? accounting.familyWithoutLegalForm;
}

export type StarterAccount = { number: string; label: string };
export type StarterAccountingPlan = { accounts: Record<AccountKey, StarterAccount>; journals: Record<JournalKey, { code: string; label: string }> };

export function starterAccountingPlan(locale: Locale): StarterAccountingPlan {
  const accounts = Object.fromEntries(ACCOUNT_KEYS.map((key) => [key, { number: accounting.accounts[key].number, label: accounting.accounts[key].label[locale] }])) as Record<AccountKey, StarterAccount>;
  const journals = Object.fromEntries(JOURNAL_KEYS.map((key) => [key, { code: accounting.journals[key].code, label: accounting.journals[key].label[locale] }])) as Record<JournalKey, { code: string; label: string }>;
  return { accounts, journals };
}
