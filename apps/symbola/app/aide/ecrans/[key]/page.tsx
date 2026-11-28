// Lot 13 (AIDE-12, ADR 0033), revu au lot 63f (ADR 0104) — l'article d'aide d'un écran (lot 74f : « article ») : la capture
// réelle (visite guidée ouverte), ce qu'on y fait, les étapes de sa visite, puis les questions
// fréquentes. Un écran que la personne ne peut pas ouvrir (autre
// public, module non souscrit) n'a pas d'article pour elle (ARC-06, SEC-13).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { starterTour } from "@symbola/starter-templates";
import { requireSignedIn } from "@/lib/guards";
import { loadHelpViewer } from "@/lib/help/help-center";
import { captureSrc, screensFor, type HelpScreen } from "@/lib/help/screens";

type Faq = { q: string; a: string }[];

// D'où s'ouvre un écran propre à un élément (sans adresse fixe).
function originKey(screen: HelpScreen): string | null {
  if (screen.path) return null;
  if (screen.key === "eventsDetail") return "fromEvent";
  if (screen.key === "quotesDetail") return "fromQuote";
  if (screen.key === "budgetDetail") return "fromBudget";
  if (screen.key.startsWith("import")) return "fromImport";
  return null;
}

export default async function HelpScreenPage({ params }: { params: Promise<{ key: string }> }) {
  const auth = await requireSignedIn();
  const { key } = await params;

  // Lot 74f : le même lecteur que la page « Aide » et sa recherche (public, rôle, modules souscrits).
  const viewer = await loadHelpViewer(auth.user);
  const screen = screensFor(viewer).find((candidate) => candidate.key === key);
  if (!screen) notFound();

  const t = await getTranslations("HelpCenter");
  const tHelp = await getTranslations("Help");
  const title = tHelp(`${screen.key}.title`);
  const faq = (tHelp.has(`${screen.key}.faq`) ? tHelp.raw(`${screen.key}.faq`) : []) as Faq;
  const tourSteps = screen.tour ? starterTour((await getLocale()) === "en" ? "en" : "fr", screen.tour) : [];
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
            alt={tourSteps.length > 0 ? t("captureAlt", { title }) : t("captureAltPlain", { title })}
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
            {t("replayTour")}
          </Link>
        ) : null}
      </p>
      {origin ? <p className="notice">{t(origin)}</p> : null}
      {tourSteps.length > 0 ? (
        <section aria-labelledby="help-tour-title">
          <h2 id="help-tour-title">{t("tourTitle")}</h2>
          <ol className="help-tour-steps">
            {tourSteps.map((step, index) => (
              <li key={step.title}>
                <span className="help-tour-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>{step.title}</strong> {step.body}
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
