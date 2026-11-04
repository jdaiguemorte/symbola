// AIDE-03 — « L'aide est consultable et cherchable depuis le hub. »
// Lot 10 (AIDE-07) — centre d'aide de l'équipe : progression de la prise en
// main (les 9 tutoriels), visites et tutoriels par module avec leur état,
// préférence d'ouverture des visites, puis les articles (Help.*). Un marié
// ou l'Admin n'y voit que les articles.
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled, type HelpProgressEntry } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { TOURS, TUTORIALS, tutorialHref, type HelpModule } from "@/lib/help/catalog";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { AideSearch, type HelpTopic } from "./aide-search";
import { AutoToursToggle } from "./auto-tours-toggle";

type ItemState = { label: string; className: string; action: string; href: string | null };

export default async function AidePage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  const t = await getTranslations("Aide");
  const tCenter = await getTranslations("HelpCenter");
  const tTour = await getTranslations("Tour");
  const messages = await getMessages();
  const help = messages.Help as Record<string, unknown>;
  const topics: HelpTopic[] = Object.values(help).filter(
    (entry): entry is HelpTopic => typeof entry === "object" && entry !== null && "title" in entry && "body" in entry,
  );

  const organizationId = auth.user.organizationId;
  const isTeam = Boolean(organizationId) && (auth.user.role === "owner" || auth.user.role === "member");
  let modules: Record<HelpModule, boolean> = { hub: true, events: false, budget: false, quotes: false, vendors: false };
  let progress: HelpProgressEntry[] = [];
  if (isTeam && organizationId) {
    const { sql, db } = createAppConnection();
    try {
      const [events, budget, quotes, vendors] = await Promise.all([
        isModuleEnabled(db, organizationId, "events"),
        isModuleEnabled(db, organizationId, "budget"),
        isModuleEnabled(db, organizationId, "quotes"),
        isModuleEnabled(db, organizationId, "vendors"),
      ]);
      modules = { hub: true, events, budget, quotes, vendors };
      progress = await getHelpProgress(db, auth.user.id);
    } finally {
      await sql.end();
    }
  }
  const entry = (itemKey: string) => progress.find((candidate) => candidate.itemKey === itemKey);
  const tutorials = TUTORIALS.filter((tutorial) => modules[tutorial.module]);
  const tours = TOURS.filter((tour) => modules[tour.module]);
  const completed = tutorials.filter((tutorial) => entry(`tutorial:${tutorial.key}`)?.status === "completed").length;
  const next = tutorials.find((tutorial) => entry(`tutorial:${tutorial.key}`)?.status !== "completed");
  const autoTours = (await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0";

  function tutorialState(key: string): ItemState {
    const current = entry(`tutorial:${key}`);
    const href = tutorialHref(key as (typeof TUTORIALS)[number]["key"]);
    if (current?.status === "completed") return { label: tCenter("stateDone"), className: "badge badge-sauge", action: tCenter("actionReview"), href };
    if (current) return { label: tCenter("stateInProgress", { step: current.step + 1 }), className: "badge badge-terracotta", action: tCenter("actionResume"), href };
    return { label: tCenter("stateNew"), className: "badge", action: tCenter("actionStart"), href };
  }

  function tourState(key: string, path: string | null): ItemState {
    const current = entry(`tour:${key}`);
    if (current?.status === "completed") return { label: tCenter("stateDone"), className: "badge badge-sauge", action: tCenter("actionReview"), href: path ? `${path}?visite=revoir` : null };
    if (current) return { label: tCenter("statePostponed", { step: current.step + 1 }), className: "badge badge-terracotta", action: tCenter("actionResume"), href: path ? `${path}?visite=reprendre` : null };
    return { label: tCenter("stateNew"), className: "badge", action: tCenter("actionStart"), href: path ? `${path}?visite=revoir` : null };
  }

  const moduleOrder: HelpModule[] = ["events", "vendors", "quotes", "budget", "hub"];

  return (
    <main>
      <h1>{t("title")}</h1>
      {isTeam ? (
        <>
          <p>{tCenter("intro")}</p>
          <section className="card help-progress" aria-labelledby="help-progress-title">
            <h2 id="help-progress-title">{tCenter("progressTitle", { completed, total: tutorials.length })}</h2>
            <progress aria-labelledby="help-progress-title" value={completed} max={Math.max(tutorials.length, 1)} />
            {next ? (
              <>
                <p>{tCenter("nextSuggestion", { title: tCenter(`items.${next.key}.title`), minutes: next.minutes })}</p>
                <Link href={tutorialHref(next.key)} className="button-link button-link-primary">
                  {tCenter("continue")}
                </Link>
              </>
            ) : (
              <p role="status">{tCenter("allDone")}</p>
            )}
            <AutoToursToggle initial={autoTours} label={tCenter("autoTours")} />
          </section>

          {moduleOrder
            .filter((module) => modules[module])
            .map((module) => {
              const moduleTours = tours.filter((tour) => tour.module === module);
              const moduleTutorials = tutorials.filter((tutorial) => tutorial.module === module);
              if (moduleTours.length === 0 && moduleTutorials.length === 0) return null;
              return (
                <section key={module} className="card" aria-labelledby={`help-module-${module}`}>
                  <h2 id={`help-module-${module}`}>{tCenter(`modules.${module}`)}</h2>
                  <ul className="item-list help-items">
                    {moduleTours.map((tour) => {
                      const state = tourState(tour.key, tour.path);
                      const title = (tTour.raw(tour.key) as { title: string }[])[0]!.title;
                      return (
                        <li key={`tour-${tour.key}`}>
                          <span>
                            <strong>{tCenter("tourTitle", { title })}</strong>
                            <span>{tour.path ? tCenter("tourKind") : tCenter("tourFromEvent")}</span>
                          </span>
                          <span className="help-item-actions">
                            <span className={state.className}>{state.label}</span>
                            {state.href ? <Link href={state.href}>{state.action}</Link> : null}
                          </span>
                        </li>
                      );
                    })}
                    {moduleTutorials.map((tutorial) => {
                      const state = tutorialState(tutorial.key);
                      return (
                        <li key={`tutorial-${tutorial.key}`}>
                          <span>
                            <strong>{tCenter(`items.${tutorial.key}.title`)}</strong>
                            <span>{tCenter("tutorialKind", { minutes: tutorial.minutes })}</span>
                          </span>
                          <span className="help-item-actions">
                            <span className={state.className}>{state.label}</span>
                            {state.href ? <Link href={state.href}>{state.action}</Link> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
        </>
      ) : null}
      <section aria-labelledby="help-articles-title">
        <h2 id="help-articles-title">{tCenter("articlesTitle")}</h2>
        <AideSearch topics={topics} searchLabel={t("search")} noResults={t("noResults")} />
      </section>
    </main>
  );
}
