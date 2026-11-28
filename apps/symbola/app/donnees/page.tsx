// Lot 74g (G5, L74-D7 ; page 29 des maquettes du lot 68) — « Vos données » : ce qui n'est pas un réglage.
// La copie de toutes les données, la reprise d'une copie, la corbeille, les historiques, les demandes sur
// les données personnelles (avec le repère des demandes en alerte), le stockage et la comptabilité ; puis
// « Reprendre et importer », hors des Paramètres ; « Fermer l'espace » seul, en bas. Chaque ligne garde son
// écran et ses droits d'aujourd'hui : un membre de l'équipe ne voit que ce qui lui était ouvert.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { listOrganizations } from "@symbola/auth";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { CLOSURE_PATH, IMPORT_PATH, showsClosure, showsImport, yourDataLines } from "../settings-menu";
import { loadPrivacyAlerts, loadSettingsFlags } from "../settings-flags";

export default async function YourDataPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const tSearch = await getTranslations("SettingsSearch");
  const flags = await loadSettingsFlags(organizationId, auth.user.role);
  const alerts = await loadPrivacyAlerts(organizationId, flags.isOwner);
  const lines = yourDataLines(flags);
  // Le nom de l'organisation ouverte, comme dans le menu du compte.
  const organization = showsClosure(flags) ? ((await listOrganizations(appDatabase(), auth.user.id)).find((candidate) => candidate.organizationId === organizationId)?.name ?? "") : "";

  return (
    <main>
      <h1>{t("yourData")}</h1>
      <ScreenHelp title={tHelp("yourData.title")} body={tHelp("yourData.body")} />
      <p>{t("yourDataIntro")}</p>
      <ul className="your-data-lines card">
        {lines.map((line) => (
          <li key={line.key} className="your-data-line">
            <div>
              <strong>
                {t(line.label)}
                {line.key === "privacy" && alerts > 0 ? (
                  <span className="nav-count nav-count-alert" title={t("privacyAlerts", { count: alerts })}>
                    <span aria-hidden="true">{alerts}</span>
                    <span className="sr-only">{t("privacyAlerts", { count: alerts })}</span>
                  </span>
                ) : null}
              </strong>
              <span className="meta">
                {t(line.hint)}
                {line.owner ? ` · ${tSearch("ownerTag")}` : ""}
              </span>
              {line.secondary.length > 0 ? (
                <span className="your-data-secondary">
                  {line.secondary.map((other) => (
                    <Link key={other.href} href={other.href}>
                      {t(other.label)}
                    </Link>
                  ))}
                </span>
              ) : null}
            </div>
            <Link href={line.href} className="button-link" aria-label={t("openNamed", { name: t(line.label) })}>
              {t("open")}
            </Link>
          </li>
        ))}
      </ul>
      {showsImport(flags) ? (
        <section className="card" aria-labelledby="donnees-import">
          <h2 id="donnees-import">{t("importTitle")}</h2>
          <p>{t("importBody")}</p>
          <p>
            <Link href={IMPORT_PATH}>{t("importLink")}</Link>
          </p>
        </section>
      ) : null}
      {showsClosure(flags) ? (
        <section className="card your-data-closure" aria-labelledby="donnees-fermeture">
          <h2 id="donnees-fermeture">{t("closureTitle")}</h2>
          <p>{t("closureBody", { organization })}</p>
          <Link href={CLOSURE_PATH} className="button-link button-link-danger">
            {t("closureLink")}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
