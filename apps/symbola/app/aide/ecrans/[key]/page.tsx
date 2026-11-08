// Lot 13 (AIDE-12, ADR 0033) — fiche d'aide d'un écran : la capture réelle
// annotée de ses repères, ce qu'on y fait, la liste des repères, puis les
// questions fréquentes. Un écran que la personne ne peut pas ouvrir (autre
// public, module non souscrit) n'a pas de fiche pour elle.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";
import { requireSignedIn } from "@/lib/guards";
import type { HelpModule } from "@/lib/help/catalog";
import { captureSrc, screensFor, type HelpAudience, type HelpScreen } from "@/lib/help/screens";

type Faq = { q: string; a: string }[];

// D'où s'ouvre un écran propre à un élément (sans adresse fixe).
function originKey(screen: HelpScreen): string | null {
  if (screen.path) return null;
  if (screen.key === "eventsDetail") return "fromEvent";
  if (screen.key === "quotesDetail") return "fromQuote";
  if (screen.key === "budgetDetail") return "fromBudget";
  if (screen.key === "clientEvent") return "fromClientEvent";
  if (screen.key.startsWith("import")) return "fromImport";
  return null;
}

export default async function HelpScreenPage({ params }: { params: Promise<{ key: string }> }) {
  const auth = await requireSignedIn();
  const { key } = await params;

  const organizationId = auth.user.organizationId;
  const isTeam = Boolean(organizationId) && (auth.user.role === "owner" || auth.user.role === "member");
  const audience: HelpAudience = isTeam ? "team" : auth.user.role === "admin" ? "admin" : "client";
  let modules: Record<HelpModule, boolean> = { hub: true, events: false, budget: false, quotes: false, vendors: false };
  if (isTeam && organizationId) {
    const db = appDatabase();
    const [events, budget, quotes, vendors] = await Promise.all([
      isModuleEnabled(db, organizationId, "events"),
      isModuleEnabled(db, organizationId, "budget"),
      isModuleEnabled(db, organizationId, "quotes"),
      isModuleEnabled(db, organizationId, "vendors"),
    ]);
    modules = { hub: true, events, budget, quotes, vendors };
  }
  const screen = screensFor({ audience, isOwner: auth.user.role === "owner", modules }).find((candidate) => candidate.key === key);
  if (!screen) notFound();

  const t = await getTranslations("HelpCenter");
  const tHelp = await getTranslations("Help");
  const tTour = await getTranslations("Tour");
  const title = tHelp(`${screen.key}.title`);
  const faq = (tHelp.has(`${screen.key}.faq`) ? tHelp.raw(`${screen.key}.faq`) : []) as Faq;
  const landmarks = screen.tour ? (tTour.raw(screen.tour) as { title: string; body: string }[]) : [];
  const origin = originKey(screen);

  return (
    <main className="help-screen">
      <p>
        <Link href="/aide">{t("back")}</Link>
      </p>
      <h1>{t("screenTitle", { title })}</h1>
      {screen.capture ? (
        <figure className="help-capture">
          {/* Capture réelle, produite par « pnpm --filter @symbola/app help:captures ». */}
          <img
            src={captureSrc(screen.key)}
            alt={landmarks.length > 0 ? t("captureAlt", { title }) : t("captureAltPlain", { title })}
            width={1280}
            height={800}
          />
        </figure>
      ) : null}
      <p className="help-screen-body">{tHelp(`${screen.key}.body`)}</p>
      <p className="toolbar">
        {screen.path ? (
          <Link href={screen.path} className="button-link">
            {t("openScreen")}
          </Link>
        ) : null}
        {screen.path && screen.tour ? (
          <Link href={`${screen.path}?visite=revoir`} className="button-link button-link-primary">
            {t("showLandmarks")}
          </Link>
        ) : null}
      </p>
      {origin ? <p className="notice">{t(origin)}</p> : null}
      {landmarks.length > 0 ? (
        <section aria-labelledby="help-landmarks-title">
          <h2 id="help-landmarks-title">{t("landmarksTitle")}</h2>
          <ol className="help-landmarks">
            {landmarks.map((landmark, index) => (
              <li key={landmark.title}>
                <span className="landmark-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>{landmark.title}</strong> {landmark.body}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {faq.length > 0 ? (
        <section aria-labelledby="help-faq-title">
          <h2 id="help-faq-title">{t("faqTitle")}</h2>
          <dl className="help-faq">
            {faq.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
