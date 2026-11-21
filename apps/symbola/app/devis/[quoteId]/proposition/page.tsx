import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { requirePlanner } from "@/lib/guards";
import { getEventProposal, getQuote, QuoteNotFoundError } from "@/modules/quotes/service";
import { isQuotesModuleEnabled, isValidId } from "../../module-access";
import { ProposalContent } from "@/app/portail/proposition/proposal-content";

// Lot 43 (FAC-02, UX-17 ; SC-02 étape 4) — l'aperçu « vu par le client » de la proposition : la page
// exacte de la version envoyée, sans rien enregistrer (actions inactives, aucune trace côté client).
export default async function ProposalPreviewPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { quoteId } = await params;
  if (!isValidId(quoteId) || !(await isQuotesModuleEnabled(organizationId))) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("QuoteProposal");
  let proposal;
  try {
    const quote = await getQuote(organizationId, quoteId);
    if (!quote.current.sentAt) notFound();
    proposal = await getEventProposal(organizationId, { eventId: quote.eventId, versionId: quote.current.id });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) notFound();
    throw error;
  }
  const banner = (
    <p role="note" className="preview-banner">
      {t("previewBanner")} <a href={`/devis/${quoteId}?rubrique=proposition`}>{t("previewBack")}</a>
    </p>
  );
  return <ProposalContent proposal={proposal} flow={null} locale={locale} preview basePath={`/devis/${quoteId}/proposition`} banner={banner} />;
}
