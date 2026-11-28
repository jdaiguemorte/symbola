// AIDE-03 — « L'aide est consultable et cherchable depuis le hub. »
// Lot 13 (AIDE-12, ADR 0033) — centre d'aide par écran.
// Lot 74f (HUB-11, HUB-12, UX-10 ; spécification du lot 74, § 6.6 ; maquette 27 ; C-07, C-10) : deux écrans
// au plus. La question d'abord (« Chercher », seul bouton plein) ; puis « Pour bien démarrer » (le parcours de
// la personne, là où elle en est), « Pour découvrir » (les visites, le mariage d'exemple, les tutoriels), les
// sujets en lignes avec leur nombre d'articles, l'interrupteur des visites et les raccourcis derrière un lien.
// Les articles ne sont plus en vignettes : ils se trouvent par la recherche ou par sujet. Avec une question
// (`?q=`), la page rend la réponse, calculée côté serveur : l'index ne voyage jamais avec la page.
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getActiveEventsTrial } from "@/modules/events/service";
import { requireSignedIn } from "@/lib/guards";
import { TUTORIALS } from "@/lib/help/catalog";
import { helpTopicHref, topicCounts } from "@/lib/help/articles";
import { loadHelpArticles, loadHelpViewer, searchHelpCenter } from "@/lib/help/help-center";
import { loadJourney } from "@/lib/help/journey-loader";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { screensFor } from "@/lib/help/screens";
import { exploreExampleAction } from "@/app/demarrage/pret/actions";
import { stageHref } from "@/lib/onboarding/first-steps";
import { AutoToursToggle } from "./auto-tours-toggle";
import { HelpAnswers } from "./help-answers";
import { HelpSearchForm } from "./help-search-form";

export default async function AidePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const auth = await requireSignedIn();
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 200).trim() ?? "";

  const t = await getTranslations("HelpHome");
  const tAide = await getTranslations("Aide");
  const tCenter = await getTranslations("HelpCenter");
  const tShortcuts = await getTranslations("Shortcuts");

  const viewer = await loadHelpViewer(auth.user);
  const isTeam = viewer.audience === "team" && Boolean(auth.user.organizationId);
  const articles = await loadHelpArticles(viewer);
  const topics = topicCounts(articles);
  const result = query ? await searchHelpCenter(viewer, query) : null;

  const topicList = (
    <section className="help-topics" aria-labelledby="help-topics-title">
      <h2 id="help-topics-title">{t("topics.title")}</h2>
      <ul className="help-rows">
        {topics.map((topic) => (
          <li key={topic.topic}>
            <Link href={helpTopicHref(topic.topic)} className="help-row">
              <span className="help-row-title">{tCenter(`groups.${topic.topic}`)}</span>
              <span className="meta">{t("topics.count", { count: topic.count })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="help-home">
      <h1>{tAide("title")}</h1>
      {query ? null : <p className="help-home-intro">{t("intro")}</p>}
      <HelpSearchForm
        initial={query}
        labels={{ field: t("search.label"), placeholder: t("search.placeholder"), submit: t("search.submit"), clear: t("search.clear") }}
      />
      {result ? (
        <HelpAnswers query={query} result={result} />
      ) : (
        <>
          {isTeam ? <StartAndDiscover organizationId={auth.user.organizationId!} userId={auth.user.id} viewer={viewer} /> : null}
          {topicList}
          {isTeam ? (
            <section className="help-home-settings" aria-label={t("settingsLabel")}>
              <AutoToursToggle initial={(await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0"} label={t("autoTours")} />
              {/* Lot 39c (UX-13) ; maquette 27 : derrière un lien, sur ordinateur seulement (C-81). */}
              <details className="help-shortcuts">
                <summary>{tShortcuts("title")}</summary>
                <ul>
                  <li>{tShortcuts("search")}</li>
                  <li>{tShortcuts("create")}</li>
                  <li>{tShortcuts("close")}</li>
                  <li>{tShortcuts("help")}</li>
                </ul>
              </details>
            </section>
          ) : null}
        </>
      )}
      {result && !result.best ? topicList : null}
    </main>
  );
}

// « Pour bien démarrer » et « Pour découvrir » : l'équipe seulement (l'Admin n'a ni parcours ni exemple).
async function StartAndDiscover({ organizationId, userId, viewer }: { organizationId: string; userId: string; viewer: Awaited<ReturnType<typeof loadHelpViewer>> }) {
  const t = await getTranslations("HelpHome");
  const tTutorials = await getTranslations("TutorialsPage");
  const tHelp = await getTranslations("Help");
  const journey = await loadJourney({ organizationId, userId, viewer });
  const tours = screensFor(viewer).filter((screen) => screen.tour && screen.path);
  const tutorials = TUTORIALS.filter((tutorial) => viewer.modules[tutorial.module]);
  const minutes = tutorials.map((tutorial) => tutorial.minutes);
  const example = viewer.modules.events ? await getActiveEventsTrial(organizationId) : null;
  const next = journey.next;
  return (
    <>
      <section className="card help-start" aria-labelledby="help-start-title">
        <h2 id="help-start-title">{t("start.title")}</h2>
        <p className="help-start-path">
          {t("start.path", { path: tTutorials(`paths.${journey.choice.path}`), done: journey.done, total: journey.total })}
        </p>
        {next ? (
          <p className="help-start-next">
            <Link href={stageHref(next)}>{t("start.next", { number: next.number, stage: tTutorials(`stages.${journey.choice.path}.${next.key}`) })}</Link>
            {next.minutes > 0 ? <span className="meta">{t("start.minutes", { minutes: next.minutes })}</span> : null}
          </p>
        ) : (
          <p>{t("start.allDone")}</p>
        )}
        <Link href="/tutoriels" className="button-link">
          {t("start.seeAll")}
        </Link>
      </section>
      <section className="help-discover" aria-labelledby="help-discover-title">
        <h2 id="help-discover-title">{t("discover.title")}</h2>
        <ul className="help-rows">
          {tours.length > 0 ? (
            <li>
              {/* Les visites (74d) : une ligne qui s'ouvre sur les écrans qui en ont une. */}
              <details className="help-row help-row-details">
                <summary>
                  <span className="help-row-title">{t("discover.tours")}</span>
                  <span className="meta">{t("discover.toursCount", { count: tours.length })}</span>
                </summary>
                <ul>
                  {tours.map((screen) => (
                    <li key={screen.key}>
                      <Link href={`${screen.path}?visite=revoir`}>{tHelp(`${screen.key}.title`)}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ) : null}
          {viewer.modules.events ? (
            <li>
              {example ? (
                <Link href={`/events/${example.eventId}`} className="help-row">
                  <span className="help-row-title">{t("discover.exampleOpen")}</span>
                  <span className="meta">{t("discover.exampleDays")}</span>
                </Link>
              ) : (
                <form action={exploreExampleAction}>
                  <button type="submit" className="help-row help-row-button">
                    <span className="help-row-title">{t("discover.example")}</span>
                    <span className="meta">{t("discover.exampleDays")}</span>
                  </button>
                </form>
              )}
            </li>
          ) : null}
          <li>
            <Link href="/tutoriels" className="help-row">
              <span className="help-row-title">{t("discover.tutorials")}</span>
              <span className="meta">{t("discover.tutorialsMeta", { count: tutorials.length, min: Math.min(...minutes), max: Math.max(...minutes) })}</span>
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
