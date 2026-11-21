// Lot 63f (HUB-09, HUB-18, HUB-23, UX-04 ; ADR 0103 ; maquette M1) — assistant « L'essentiel » :
// six étapes, une question par écran, après le questionnaire d'accueil. Les étapes se parcourent
// librement (rien n'est bloquant, SC-01) ; une étape faite porte une coche. Les réponses vont dans
// les mêmes réglages que les Paramètres, qui ne servent plus qu'à modifier ensuite.
import Link from "next/link";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile, getSellerDetails } from "@/modules/hub/service";
import { getDocumentSettings, getQuoteSettings } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { ESSENTIALS_HREF, essentialSteps, loadEssentials, nextEssentialStep, stepDone } from "@/lib/onboarding/essentials";
import { ScreenHelp } from "@/app/screen-help";
import { EssentialStepForm, FinishLaterButton, type EssentialStepProps } from "./essentials-forms";

// Environ quatre minutes pour les six étapes (maquette M1).
const MINUTES = 4;

export default async function EssentialsPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Essentials");
  const snapshot = await loadEssentials(organizationId, auth.user.id);
  const steps = essentialSteps(snapshot.quotesEnabled);
  const asked = Number((await searchParams).etape);
  const number = Number.isInteger(asked) && asked >= 1 && asked <= steps.length ? asked : nextEssentialStep(snapshot);
  const step = steps[number - 1]!;
  const props = await stepProps();

  return (
    <main className="setup essentials">
      <div className="essentials-head">
        <p className="muted">{t("saved")}</p>
        <FinishLaterButton label={t("later")} />
      </div>
      <h1>
        {t("title")} <span className="muted essentials-duration">· {t("duration", { minutes: MINUTES })}</span>
      </h1>
      <ScreenHelp title={t("helpTitle")} body={t("helpBody")} />
      <div className="essentials-layout">
        <nav aria-label={t("stepsLabel")} className="essentials-steps">
          <ol>
            {steps.map((candidate, index) => {
              const current = index + 1 === number;
              const done = stepDone(candidate, snapshot);
              return (
                <li key={candidate} aria-current={current ? "step" : undefined} data-state={current ? "current" : done ? "done" : "todo"}>
                  <Link href={`${ESSENTIALS_HREF}?etape=${index + 1}`}>
                    <span className="essentials-mark" aria-hidden="true">
                      {done && !current ? <Check size={14} /> : index + 1}
                    </span>
                    {t(`steps.${candidate}`)}
                    {done ? <span className="sr-only"> {t("stepDone")}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        <section className="card essentials-question" aria-labelledby="essentials-question-title">
          <p className="muted">{t("stepOf", { number, total: steps.length })}</p>
          <h2 id="essentials-question-title">{t(`questions.${step}.title`)}</h2>
          <p>{t(`questions.${step}.hint`)}</p>
          <EssentialStepForm key={step} {...props} previous={number > 1 ? `${ESSENTIALS_HREF}?etape=${number - 1}` : null} last={number === steps.length} />
        </section>
      </div>
    </main>
  );

  async function stepProps(): Promise<EssentialStepProps> {
    const db = appDatabase();
    switch (step) {
      case "company": {
        const [details, profile] = await Promise.all([getSellerDetails(db, organizationId), getOrganizationProfile(db, organizationId)]);
        return { step, organizationName: details.organizationName, legalForm: profile.legalForm ?? "", siret: details.siret ?? "" };
      }
      case "address": {
        const profile = await getOrganizationProfile(db, organizationId);
        return { step, address: profile.address ?? "", postalCode: profile.postalCode ?? "", city: profile.city ?? "", contactEmail: profile.contactEmail ?? "", contactPhone: profile.contactPhone ?? "" };
      }
      case "logo":
        return { step, logoVersion: snapshot.logoKey?.split("/").pop() ?? null };
      case "vat": {
        const profile = await getOrganizationProfile(db, organizationId);
        return { step, vatRegime: profile.vatRegime, vatNumber: profile.vatNumber ?? "" };
      }
      case "bank": {
        const documents = await getDocumentSettings(organizationId);
        return { step, iban: documents.iban ?? "", bic: documents.bic ?? "" };
      }
      case "numbering": {
        const settings = await getQuoteSettings(organizationId);
        return { step, quotePrefix: settings.quotePrefix, invoicePrefix: settings.invoicePrefix, year: Number(parisToday().slice(0, 4)) };
      }
    }
  }
}
