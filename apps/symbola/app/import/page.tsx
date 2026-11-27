import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getImportLimits, getTakeover, listImports, type ImportEntityType, type ImportLimits, type ImportSummary } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { taskListViewer } from "@/lib/event-visibility";
import { getImportWizard } from "@/lib/import/wizard";
import { importEventNames } from "@/lib/takeover/flow";
import { takeoverKindOfEntity } from "@/lib/takeover/page-rules";
import { availableImportEntityTypes } from "./access";
import { NewImportForm } from "./new-import-form";
import { eventNames, getEvent } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

// Lot 5 — import de données (PRD §7) : point d'entrée et journal des imports.
// Lot 71b (HUB-14 ; décisions I6 et R18 ; maquette 06) : « Reprendre et importer ». L'écran garde ce qui
// n'est pas un mariage (contacts, carnet, listes de l'espace) et renvoie la reprise d'un mariage vers
// sa page ; un import laissé en plan est rappelé en tête ; trois boutons de même rang ; le journal a
// ses colonnes Fichier, Pour, Date, État, et un lien par ligne (« Continuer », « Voir le bilan »).
// Ouvert depuis une ligne de reprise (`?reprise=`), l'import y est rattaché et le dit en tête.
const MAIN_CHOICES = ["contacts", "vendors"] as const;
const OTHER = "autre";
// Lot 63b (HUB-14) : le bouton d'un écran ouvre l'import réglé sur son type ; l'écran des évènements
// propose les fiches PDF et le tableur.
const SCREEN_GROUPS: Record<string, readonly ImportEntityType[]> = { evenements: ["event_sheets", "events"] };
const HOW: readonly string[] = ["contacts", "vendors", "event_sheets"];

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ type?: string; evenement?: string; reprise?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Import");
  const tTakeover = await getTranslations("Takeover");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();

  const available = await availableImportEntityTypes(organizationId);
  const main = MAIN_CHOICES.filter((type) => available.includes(type));
  const others = available.filter((type) => !(MAIN_CHOICES as readonly string[]).includes(type));
  const query = await searchParams;
  const requested = query.type;

  // Lot 71b : l'import d'une ligne de reprise (de l'organisation, visible de la personne), de la sorte
  // de sa ligne ; sinon la même réponse qu'une reprise inexistante (SEC-13).
  const takeoverId = query.reprise === undefined ? null : isValidId(query.reprise) ? query.reprise : notFound();
  const takeover = takeoverId ? await getTakeover(db, organizationId, takeoverId, await taskListViewer(auth)) : null;
  if (takeoverId && !takeover) notFound();
  const takeoverKind = takeover && requested ? takeoverKindOfEntity(requested) : null;
  if (takeover && (!takeoverKind || !available.includes(requested as ImportEntityType))) notFound();
  const takeoverEvent = takeover?.eventId ? await getEvent(organizationId, takeover.eventId) : null;
  const takeoverNames = takeoverEvent ? eventNames(takeoverEvent.clients, takeoverEvent.name) : null;

  const group = requested && Object.hasOwn(SCREEN_GROUPS, requested) ? SCREEN_GROUPS[requested]!.filter((type) => available.includes(type)) : [];
  const direct = available.find((type) => type === requested) ?? null;
  const chosen: string | null = requested === OTHER && others.length > 0 ? OTHER : group.length > 0 ? requested! : direct;
  const formTypes: ImportEntityType[] = chosen === OTHER ? others : group.length > 0 ? group : direct ? [direct] : [];
  const formTitle = takeoverKind
    ? tTakeover(`step.${takeoverKind}.title`)
    : chosen === OTHER || (chosen !== null && (MAIN_CHOICES as readonly string[]).includes(chosen))
      ? t(`choice.${chosen}.title`)
      : group.length > 0
        ? t(`screenGroup.${chosen}`)
        : direct
          ? t(`entityType.${direct}`)
          : "";
  // Lot 65g (HUB-14, BUD-04) : lancé depuis un évènement, l'import de tâches ou de lignes de budget va
  // dans cet évènement ; un évènement d'une autre organisation n'est pas reconnu (SEC-13). Depuis une
  // reprise, c'est son mariage.
  const fromEvent =
    !takeover && (direct === "budget_lines" || direct === "tasks") && query.evenement && isValidId(query.evenement) ? await getEvent(organizationId, query.evenement).catch(() => null) : null;
  const target = takeover && (direct === "budget_lines" || direct === "tasks") ? takeoverEvent : fromEvent;
  const [journal, limits]: [ImportSummary[], ImportLimits] = await Promise.all([listImports(db, organizationId), getImportLimits(db)]);
  const eventsEnabled = await isEventsModuleEnabled(organizationId);
  const forEvent = await importEventNames(organizationId, journal);

  // L'import laissé en plan, en tête (C-59) : le plus récent, encore ouvert.
  const now = new Date();
  const draft = journal.find((entry) => entry.status === "draft" && entry.expiresAt > now) ?? null;
  const draftStep = draft ? ((await getImportWizard(organizationId, draft.id))?.next ?? null) : null;
  const draftHref = draft ? `/import/${draft.id}` : null;

  const choices = [
    ...main.map((type) => ({ key: type as string, title: t(`choice.${type}.title`), body: t(`choice.${type}.body`) })),
    ...(others.length > 0 ? [{ key: OTHER, title: t("choice.autre.title"), body: t("choice.autre.body") }] : []),
  ];
  // Le carnet et les contacts servent à toute l'agence, même déposés depuis une reprise.
  const forLabel = (entry: ImportSummary) => ((MAIN_CHOICES as readonly string[]).includes(entry.entityType) ? null : forEvent.get(entry.id)) ?? t(`forKind.${entry.entityType}`);

  return (
    <main>
      {takeover ? (
        <p className="takeover-back">
          <Link href={`/reprise/${takeover.id}`}>‹ {takeoverNames ? tTakeover("backTo", { event: takeoverNames }) : tTakeover("backToNew")}</Link>
        </p>
      ) : null}
      <h1>{t("title")}</h1>
      <p className="meta">{t("intro")}</p>
      <ScreenHelp title={tHelp("importFile.title")} body={tHelp("importFile.body")} />

      {!takeover && eventsEnabled ? (
        <section className="notice import-wedding" aria-labelledby="import-wedding-title">
          <h2 id="import-wedding-title">{t("weddingTitle")}</h2>
          <p>
            {t("weddingBody")} <Link href="/reprise">{t("weddingLink")}</Link>
          </p>
        </section>
      ) : null}

      {!takeover && draft && draftStep ? (
        <p className="notice notice-attention import-draft" role="status">
          {forEvent.get(draft.id) && !(MAIN_CHOICES as readonly string[]).includes(draft.entityType)
            ? t("draftFor", { file: draft.fileName, event: forEvent.get(draft.id)!, step: t(`wizardStep.${draftStep}`) })
            : t("draftAlone", { file: draft.fileName, step: t(`wizardStep.${draftStep}`) })}{" "}
          <Link href={draftHref!} aria-label={t("draftContinueFor", { file: draft.fileName })}>
            {t("draftContinue")}
          </Link>
        </p>
      ) : null}

      {available.length === 0 ? (
        <p>{t("noModuleAvailable")}</p>
      ) : takeover ? null : (
        <section aria-labelledby="import-choose-title">
          <h2 id="import-choose-title">{t("chooseTitle")}</h2>
          <nav aria-label={t("chooseTitle")} className="import-choices">
            {choices.map((choice) => (
              <Link key={choice.key} href={`/import?type=${choice.key}#import-form`} className="import-choice" aria-current={chosen === choice.key ? "true" : undefined}>
                <span className="import-choice-title">{choice.title}</span>
                <span className="import-choice-body">{choice.body}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      {chosen ? (
        <section aria-labelledby="import-form-title" className="card">
          <h2 id="import-form-title">{formTitle}</h2>
          {HOW.includes(chosen) ? <p>{t(`how.${chosen}`)}</p> : null}
          {chosen === "event_sheets" || chosen === "evenements" ? (
            <p>
              <a href="/aide/exemples/fiche-evenement-exemple.pdf" download>
                {t("takeoverExampleSheet")}
              </a>
            </p>
          ) : null}
          <NewImportForm
            key={`${chosen}-${takeover?.id ?? ""}`}
            target={target ? { eventId: target.id, names: eventNames(target.clients, target.name) } : null}
            takeover={takeover && takeoverKind ? { takeoverId: takeover.id, kind: takeoverKind } : null}
            entityTypes={formTypes}
            defaultEntityType={formTypes.length === 1 || group.length > 0 ? formTypes[0]! : null}
            maxSizeLabel={formatFileSize(limits.maxBytes, locale)}
            maxSheets={takeover ? 1 : limits.maxSheets}
          />
        </section>
      ) : null}

      {takeover ? null : (
        <section aria-labelledby="import-journal">
          <h2 id="import-journal">{t("journalTitle")}</h2>
          {journal.length === 0 ? (
            <p>{t("journalEmpty")}</p>
          ) : (
            <div className="list-table-wrap" role="region" aria-label={t("journalTable")} tabIndex={0}>
              <table className="list-table">
                <thead>
                  <tr>
                    <th scope="col">{t("journalFile")}</th>
                    <th scope="col">{t("journalFor")}</th>
                    <th scope="col">{t("journalDate")}</th>
                    <th scope="col">{t("journalStatus")}</th>
                    <th scope="col">
                      <span className="sr-only">{t("journalLink")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {journal.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">{entry.fileName}</th>
                      <td>{forLabel(entry)}</td>
                      <td>{formatDateTime(entry.createdAt, locale)}</td>
                      <td>{t(`journalState.${entry.status}`)}</td>
                      <td>
                        {entry.status === "draft" && entry.expiresAt > now ? (
                          <Link href={`/import/${entry.id}`} className="import-journal-link" aria-label={t("draftContinueFor", { file: entry.fileName })}>
                            {t("draftContinue")}
                          </Link>
                        ) : entry.status === "applied" || entry.status === "undone" ? (
                          <Link href={`/import/${entry.id}/journal`} className="import-journal-link" aria-label={t("journalSeeSummaryFor", { file: entry.fileName })}>
                            {t("journalSeeSummary")}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
