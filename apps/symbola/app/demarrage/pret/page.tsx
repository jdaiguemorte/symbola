// Lot 33b (HUB-10, PAR-01 ; D10), revu au lot 71b (I5, R3) puis refait au lot 74a (HUB-09, HUB-10, PAR-01,
// UX-01 ; C-67, C-68, D6, D8, R3, B6, B13 ; page 22 des maquettes du lot 68) — « Votre espace est prêt » : un
// seul premier pas, en bouton plein, choisi par les réponses aux mariages en cours et aux outils (« Créer
// votre premier mariage », « Reprendre un mariage en cours », « Entrer un mariage en cours ») ; dessous, les
// réponses et ce qu'elles ont préparé, chacun avec son lien ; le mariage d'exemple en second. Le premier
// mariage se crée dans « Nouvel évènement » (D8) : le formulaire en ligne et sa case cochée d'avance partent.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { getUserNames } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getActiveEventsTrial, listDefaultVendorSlots, listTaskTemplates } from "@/modules/events/service";
import { ensureEventTypes } from "@/lib/events/event-types";
import { getOrganizationProfile, getSetupState } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { onboardingSuggestsTakeover, starterOnboarding } from "@symbola/starter-templates";
import { readyOutcome, type ReadyOutcome } from "@/lib/onboarding/questionnaire";
import { exploreExampleAction } from "./actions";
import { ScrollToTop } from "./scroll-to-top";

// Où mène le bouton plein de chaque issue. « Entrer un mariage en cours » ouvre « Nouvel évènement » réglé sur
// « Signé, en préparation » (déduit des réponses, pas un fait coché pour elle).
const FIRST_STEP_HREF: Record<ReadyOutcome, string> = { create: "/events/new", takeover: "/reprise", enter: "/events/new?ou=signe" };

export default async function ReadyPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Onboarding");
  const tSetup = await getTranslations("Setup");
  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const state = await getSetupState(db, organizationId);
  if (!state.completed && auth.user.role === "owner") redirect("/demarrage");

  const locale = (await getLocale()) as Locale;
  const eventsEnabled = await isEventsModuleEnabled(organizationId);
  const [profile, names, eventTypes, templates, budgetLines, example] = await Promise.all([
    getOrganizationProfile(db, organizationId),
    getUserNames(db, auth.user.id),
    eventsEnabled ? ensureEventTypes(organizationId, locale) : Promise.resolve([]),
    eventsEnabled ? listTaskTemplates(organizationId) : Promise.resolve([]),
    eventsEnabled ? listDefaultVendorSlots(organizationId) : Promise.resolve([]),
    eventsEnabled ? getActiveEventsTrial(organizationId) : Promise.resolve(null),
  ]);
  const outcome = readyOutcome(profile.hasOngoingEvents, profile.replacedTools);
  const metier = profile.metier ?? "wedding_planner";
  const firstLetterLow = (label: string) => label.charAt(0).toLocaleLowerCase(locale) + label.slice(1);
  const listOf = (labels: string[]) => (labels.length > 1 ? t("ready.toolsAnd", { first: labels.slice(0, -1).join(", "), last: labels.at(-1)! }) : (labels[0] ?? ""));
  const toolLabels = starterOnboarding(locale).tools.filter((tool) => profile.replacedTools.includes(tool.key));
  // Lot 71b (I5) : la carte de la reprise ne nomme que les outils d'où l'on reprend.
  const takeoverTools = listOf(toolLabels.filter((tool) => onboardingSuggestsTakeover([tool.key])).map((tool) => firstLetterLow(tool.label)));
  const template = templates.find((candidate) => candidate.eventTypeId !== null) ?? templates[0] ?? null;
  const title = names.firstName ? t("ready.titleNamed", { name: names.firstName }) : t("ready.title");

  const firstStep = eventsEnabled ? (
    <Link className="button-link button-link-primary" href={FIRST_STEP_HREF[outcome]}>
      {t(`ready.firstStep.${outcome}.action`, { metier })}
    </Link>
  ) : null;
  const exampleStep = eventsEnabled ? (
    example ? (
      <Link className="button-link" href={`/events/${example.eventId}`}>
        {t("ready.exampleOpen")}
      </Link>
    ) : (
      <form action={exploreExampleAction}>
        <button type="submit">{t("ready.exampleSubmit")}</button>
      </form>
    )
  ) : null;

  return (
    <main className="setup onboarding-ready">
      <ScrollToTop />
      <p className="onboarding-progress">{t("ready.progress")}</p>
      <h1>{title}</h1>
      <ScreenHelp title={tHelp("setupReady.title")} body={tHelp("setupReady.body")} />

      {eventsEnabled ? (
        <section className="card" aria-labelledby="ready-first-step">
          <h2 id="ready-first-step">{t(`ready.firstStep.${outcome}.title`, { metier })}</h2>
          <p>{outcome === "takeover" ? t("ready.takeoverIntro", { tools: takeoverTools }) : t(`ready.firstStep.${outcome}.body`, { metier })}</p>
          {outcome === "takeover" ? <p className="meta">{t("ready.takeoverBody")}</p> : null}
          <div className="ready-takeover-actions">
            {firstStep}
            {/* Lot 71b (page 6, reprise telle quelle) : créer reste possible, en second. */}
            {outcome === "takeover" ? (
              <Link className="button-link" href="/events/new">
                {t("ready.takeoverCreate")}
              </Link>
            ) : null}
          </div>
          <div className="ready-example">
            <span className="muted">{t("ready.exampleLead")}</span> {exampleStep}
          </div>
        </section>
      ) : (
        <section className="card">
          <p>{t("ready.noEventsModule")}</p>
          <Link href="/">{t("ready.goHome")}</Link>
        </section>
      )}

      <section className="card" aria-labelledby="ready-answers">
        <h2 id="ready-answers">{t("ready.answersTitle")}</h2>
        <dl className="ready-answer-list">
          <div>
            <dt>{t("ready.answers.metier")}</dt>
            <dd>{[tSetup(`metier.${metier}.title`), ...(eventTypes.length > 0 ? [eventTypes.map((type) => firstLetterLow(type.label)).join(", ")] : [])].join(" · ")}</dd>
          </div>
          <div>
            <dt>{t("ready.answers.ongoing", { metier })}</dt>
            <dd>
              {profile.hasOngoingEvents === "no"
                ? t("ready.answers.ongoingNo")
                : profile.hasOngoingEvents === "yes"
                  ? toolLabels.length > 0
                    ? t("ready.answers.ongoingYesTools", { tools: listOf(toolLabels.map((tool) => firstLetterLow(tool.label))) })
                    : t("ready.answers.ongoingYes")
                  : t("ready.answers.notAnswered")}
            </dd>
          </div>
          <div>
            <dt>{t("ready.answers.vat")}</dt>
            <dd>{profile.vatAnswerPending ? t("ready.answers.vatUnknown") : profile.vatRegime ? t(`ready.answers.vat_${profile.vatRegime}`) : t("ready.answers.notAnswered")}</dd>
          </div>
        </dl>
        {eventsEnabled ? (
          <>
            <h3>{t("ready.preparedTitle")}</h3>
            <ul className="ready-list ready-prepared">
              <li>
                {template ? t("ready.prepared.tasks", { name: template.name, count: template.items.length }) : t("ready.prepared.noTasks")}{" "}
                <Link href="/events/modeles">{t("ready.prepared.tasksLink")}</Link>
              </li>
              <li>
                {t("ready.prepared.budgetLines", { count: budgetLines.length })} <Link href="/events/parametres">{t("ready.prepared.budgetLinesLink")}</Link>
              </li>
              <li>
                {t("ready.prepared.eventTypes", { types: eventTypes.map((type) => type.label).join(", ") })} <Link href="/events/parametres/types">{t("ready.prepared.eventTypesLink")}</Link>
              </li>
            </ul>
          </>
        ) : null}
        <p className="ready-links">
          <Link href="/demarrage?etape=1">{t("ready.editAnswers")}</Link>
          <Link href="/">{t("ready.goHomeShort")}</Link>
        </p>
      </section>
      <p className="muted">{t("ready.footer")}</p>

      {/* Sur téléphone, le premier pas et l'exemple collés en bas, le principal en haut (D4, lot 71b). */}
      {eventsEnabled ? (
        <div className="ready-takeover-bar">
          {firstStep}
          {outcome === "takeover" ? (
            <Link className="button-link" href="/events/new">
              {t("ready.takeoverCreate")}
            </Link>
          ) : (
            exampleStep
          )}
        </div>
      ) : null}
    </main>
  );
}
