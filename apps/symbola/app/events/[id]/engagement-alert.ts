// Lot 28a (BUD-02, décision D4) — l'alerte précède l'engagement : avant qu'un
// prestataire passe à « Retenu », le dépassement chiffré du seuil d'alerte de
// l'enveloppe s'affiche, à confirmer. Seulement quand le module Budget est
// souscrit (dégradation propre, ARC-06) et qu'un montant est connu.
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { previewEngagement } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";

export async function engagementAlert(input: {
  organizationId: string;
  eventId: string;
  vendorSlotId: string;
  amountCents: number | null;
  confirmed: boolean;
}): Promise<string | null> {
  if (input.confirmed || input.amountCents === null) return null;
  if (!(await isBudgetModuleEnabled(input.organizationId))) return null;
  const preview = await previewEngagement({
    organizationId: input.organizationId,
    eventId: input.eventId,
    eventVendorSlotId: input.vendorSlotId,
    amountCents: input.amountCents,
  });
  if (!preview.exceedsThreshold || !preview.envelope) return null;
  const t = await getTranslations("VendorCandidates");
  const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
  return t("engagementAlert", {
    committed: formatAmount(preview.committedAfterCents, locale),
    over: formatAmount(preview.overThresholdCents, locale),
    percent: preview.envelope.thresholdPercent,
  });
}
