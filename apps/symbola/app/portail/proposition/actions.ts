"use server";

// Lot 43 (SEC-16, GC-01 ; D4) — actions de la page de proposition : demander le code avant de signer,
// le saisir. Seulement un lien client qui ouvre la rubrique « Devis », pour un devis de son évènement
// dont il est signataire (portée vérifiée par le module). Jamais de détail sur la raison d'un refus.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { currentLinkAccess } from "@/lib/link-session";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { confirmSigningCode, QuoteNotFoundError, requestSigningCode } from "@/modules/quotes/service";

export type SigningCodeState = { error?: string; emailHint?: string };

async function signerAccess(formData: FormData) {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) return null;
  const quoteId = String(formData.get("quoteId") ?? "");
  return isValidId(quoteId) ? { access, quoteId } : null;
}

export async function requestSigningCodeAction(_prev: SigningCodeState, formData: FormData): Promise<SigningCodeState> {
  const t = await getTranslations("Proposal.flow");
  const found = await signerAccess(formData);
  if (!found) return { error: t("codeError") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    const result = await requestSigningCode(found.access.organizationId, { eventId: found.access.eventId, linkId: found.access.linkId, email: found.access.email, quoteId: found.quoteId, locale });
    return result.sent ? { emailHint: result.emailHint } : { error: t("codeNotSent") };
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return { error: t("codeError") };
    throw error;
  }
}

export async function confirmSigningCodeAction(_prev: SigningCodeState, formData: FormData): Promise<SigningCodeState> {
  const t = await getTranslations("Proposal.flow");
  const found = await signerAccess(formData);
  if (!found) return { error: t("codeError") };
  try {
    const result = await confirmSigningCode(found.access.organizationId, { eventId: found.access.eventId, linkId: found.access.linkId, email: found.access.email, quoteId: found.quoteId, code: String(formData.get("code") ?? "") });
    if (result.outcome === "wrong_code") return { error: t("codeWrong", { attempts: result.attemptsLeft }) };
    if (result.outcome === "code_expired") return { error: t("codeExpired") };
    if (result.outcome === "invalid") return { error: t("codeError") };
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return { error: t("codeError") };
    throw error;
  }
  revalidatePath("/portail", "layout");
  return {};
}
