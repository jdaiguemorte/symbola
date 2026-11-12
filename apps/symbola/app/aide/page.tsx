// AIDE-03 — « L'aide est consultable et cherchable depuis le hub. »
// Lot 13 (AIDE-12, ADR 0033) — centre d'aide par écran : une vignette par
// écran (capture réelle, titre, résumé, état des repères), groupée par
// rubrique, et une recherche dans l'aide (pas dans les données). L'équipe y
// voit aussi sa progression ; l'Admin et les mariés n'y voient que leurs
// écrans.
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled, type HelpProgressEntry } from "@/modules/hub/service";
import { requireSignedIn } from "@/lib/guards";
import { TUTORIALS, type HelpModule } from "@/lib/help/catalog";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { HELP_GROUP_ORDER, helpScreenHref, screensFor, tileImage, type HelpAudience } from "@/lib/help/screens";
import { AideSearch, type HelpTileGroup } from "./aide-search";
import { AutoToursToggle } from "./auto-tours-toggle";

type Faq = { q: string; a: string }[];

export default async function AidePage() {
  const auth = await requireSignedIn();

  const t = await getTranslations("Aide");
  const tCenter = await getTranslations("HelpCenter");
  const tHelp = await getTranslations("Help");

  const organizationId = auth.user.organizationId;
  const isTeam = Boolean(organizationId) && (auth.user.role === "owner" || auth.user.role === "member");
  const audience: HelpAudience = isTeam ? "team" : "admin";
  let modules: Record<HelpModule, boolean> = { hub: true, events: false, budget: false, quotes: false, vendors: false };
  let progress: HelpProgressEntry[] = [];
  if (isTeam && organizationId) {
    const db = appDatabase();
    const [events, budget, quotes, vendors] = await Promise.all([
      isModuleEnabled(db, organizationId, "events"),
      isModuleEnabled(db, organizationId, "budget"),
      isModuleEnabled(db, organizationId, "quotes"),
      isModuleEnabled(db, organizationId, "vendors"),
    ]);
    modules = { hub: true, events, budget, quotes, vendors };
    progress = await getHelpProgress(db, auth.user.id);
  }
  const seen = (tour: string) => progress.some((entry) => entry.itemKey === `tour:${tour}`);
  const tutorials = TUTORIALS.filter((tutorial) => modules[tutorial.module]);
  const completed = tutorials.filter((tutorial) => progress.some((entry) => entry.itemKey === `tutorial:${tutorial.key}` && entry.status === "completed")).length;
  const autoTours = (await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0";

  const screens = screensFor({ audience, isOwner: auth.user.role === "owner", modules });
  const groups: HelpTileGroup[] = HELP_GROUP_ORDER.map((group) => ({
    key: group,
    title: tCenter(`groups.${group}`),
    tiles: screens
      .filter((screen) => screen.group === group)
      .map((screen) => {
        const faq = (tHelp.has(`${screen.key}.faq`) ? tHelp.raw(`${screen.key}.faq`) : []) as Faq;
        return {
          key: screen.key,
          title: tHelp(`${screen.key}.title`),
          body: tHelp(`${screen.key}.body`),
          searchText: faq.map((item) => `${item.q} ${item.a}`).join(" "),
          href: helpScreenHref(screen.key),
          image: tileImage(screen),
          badge: screen.tour ? (seen(screen.tour) ? tCenter("stateSeen") : tCenter("stateNew")) : null,
          badgeSeen: screen.tour ? seen(screen.tour) : false,
        };
      }),
  })).filter((group) => group.tiles.length > 0);

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{tCenter("intro")}</p>
      {isTeam ? (
        <section className="card help-progress" aria-labelledby="help-progress-title">
          <h2 id="help-progress-title">{tCenter("progressTitle", { completed, total: tutorials.length })}</h2>
          <progress aria-labelledby="help-progress-title" value={completed} max={Math.max(tutorials.length, 1)} />
          {/* Lot 13 (AIDE-10) : les tutoriels ont leur page, en parcours. */}
          <Link href="/tutoriels" className="button-link button-link-primary">
            {tCenter("openTutorials")}
          </Link>
          <AutoToursToggle initial={autoTours} label={tCenter("autoTours")} />
        </section>
      ) : null}
      <AideSearch groups={groups} searchLabel={t("search")} noResults={t("noResults")} resultsLabel={tCenter.raw("results") as string} />
    </main>
  );
}
