// Lot 44 (CRM-02 ; D9 à D11 ; ADR 0084) — le pipeline commercial : une colonne par étape de
// l'organisation, plus les deux sorties « Gagné » (confirmer) et « Perdu » (annuler, motif obligatoire).
// Seules les options y sont ; la liste des évènements reste, un lien passe de l'une à l'autre. Les
// demandes « à vérifier » du formulaire de contact (D4) attendent sous le tableau.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, parisToday, type Locale } from "@symbola/i18n";
import { getEventsPipeline, listLossReasons, listProspectRequestsToReview } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "../module-access";
import { EventsHeader } from "../events-header";
import { PipelineBoard, type BoardCard } from "./pipeline-board";
import { acceptRequestAction, discardRequestAction } from "./actions";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export default async function PipelinePage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Pipeline");
  const tEvents = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = ((await getLocale()) === "en" ? "en" : "fr") as Locale;
  const [pipeline, reasons, toReview] = await Promise.all([getEventsPipeline(organizationId, locale), listLossReasons(organizationId), listProspectRequestsToReview(organizationId)]);
  const today = parisToday();
  const cards: BoardCard[] = pipeline.cards.map((card) => {
    const days = Math.max(0, Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${parisToday(new Date(card.stageSince))}T12:00:00Z`).getTime()) / DAY_MS));
    return {
      id: card.eventId,
      label: card.names || t("unnamed"),
      groupId: card.stageId,
      when: card.eventDate ? dateLabel(card.eventDate, locale) : card.period,
      guests: card.guestsEstimated,
      budget: card.wantedBudgetCents !== null ? formatAmount(card.wantedBudgetCents, locale) : card.budgetRange,
      source: card.sourceLabel,
      daysInStage: days,
      dateTaken: card.dateTaken,
      isDemo: card.isDemo,
    };
  });

  return (
    <main className="pipeline-page">
      {/* Lot 63c (EVT-07, CRM-02, UX-13 ; M7) : le même en-tête que la liste et le calendrier. */}
      <EventsHeader view="pipeline" />
      <ScreenHelp title={tHelp("eventsPipeline.title")} body={tHelp("eventsPipeline.body")} />
      {auth.user.role === "owner" ? (
        <nav className="row-wrap" aria-label={t("viewsLabel")}>
          <Link href="/events/parametres/etapes">{t("stagesSettings")}</Link>
          <Link href="/events/parametres/etapes#contact">{t("contactSettings")}</Link>
        </nav>
      ) : null}
      <PipelineBoard stages={pipeline.stages.map((stage) => ({ id: stage.id, label: stage.label }))} cards={cards} lossReasons={reasons.map((reason) => ({ id: reason.id, label: reason.label, isFreeText: reason.isFreeText }))} />

      <section aria-labelledby="to-review-title" className="pipeline-review" id="a-verifier">
        <h2 id="to-review-title">{t("toReviewTitle", { count: toReview.length })}</h2>
        <p className="meta">{t("toReviewIntro")}</p>
        {toReview.length === 0 ? (
          <p>{t("toReviewEmpty")}</p>
        ) : (
          <ul className="pipeline-review-list">
            {toReview.map((request) => (
              <li key={request.id} className="card">
                <p>
                  <strong>{request.name}</strong>
                  {request.eventDate ? ` — ${dateLabel(request.eventDate, locale)}` : request.period ? ` — ${request.period}` : ""}
                </p>
                <p className="meta">{[request.email, request.phone].filter(Boolean).join(" · ")}</p>
                {/* Le message reçu, affiché tel quel (texte, jamais interprété). */}
                {request.message ? <p className="pipeline-message">{request.message}</p> : null}
                <div className="row-wrap">
                  <form action={acceptRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" aria-label={t("acceptRequestLabel", { name: request.name })}>
                      {t("acceptRequest")}
                    </button>
                  </form>
                  <form action={discardRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" className="button-ghost" aria-label={t("discardRequestLabel", { name: request.name })}>
                      {t("discardRequest")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
