import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { requireLink } from "@/lib/guards";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { getEventProposal, getSigningFlow, QuoteNotFoundError } from "@/modules/quotes/service";
import { ProposalContent } from "../proposal-content";

// Lot 43 (FAC-02, FAC-15, GC-01 ; D3) — la proposition d'une version envoyée, ouverte par le lien
// personnel du client (rubrique « Devis ») : même accès, mêmes droits ; une version d'un autre
// évènement, ou un lien sans la rubrique, n'existe pas (SEC-13).
export default async function ProposalPage({ params }: { params: Promise<{ versionId: string }> }) {
  const access = await requireLink("client");
  const { versionId } = await params;
  if (!isValidId(versionId) || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) notFound();
  const locale = (await getLocale()) as Locale;
  let proposal;
  try {
    proposal = await getEventProposal(access.organizationId, { eventId: access.eventId, versionId });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) notFound();
    throw error;
  }
  const flow = proposal.status === "superseded" ? null : await getSigningFlow(access.organizationId, { eventId: access.eventId, email: access.email, quoteId: proposal.quoteId });
  return <ProposalContent proposal={proposal} flow={flow} locale={locale} basePath={`/portail/proposition/${versionId}`} />;
}
