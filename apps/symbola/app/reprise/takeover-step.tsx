// Lot 71b (HUB-14, UX-08 ; maquette 06, R2 à R4) — une ligne de la page de reprise : son numéro, son nom
// et sa phrase, son état en mots et par une forme (rond plein et coche, rond tracé, pointillés, tiret ;
// jamais par la seule couleur), et ses boutons. La ligne suivante a le trait d'encre et le seul bouton
// plein ; une ligne qui attend le mariage dit « Après le mariage », sans bouton grisé.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { doneMoment } from "@/lib/tasks/task-lines";
import type { TakeoverRowAction } from "@/lib/takeover/page-rules";
import type { TakeoverPageModel, TakeoverRowModel } from "@/lib/takeover/flow";
import { abandonTakeoverImportAction, takeoverStepAction } from "./actions";

const SHAPE_MARK: Record<TakeoverRowModel["shape"], string> = { done: "✓", running: "", todo: "", none: "–" };

// « à 9 h 52 » le jour même, « le 24 nov. » avant (maquette 06, règle des heures).
function when(at: Date, locale: Locale): { today: boolean; time: string; date: string } {
  const moment = doneMoment(at.toISOString(), locale);
  return { today: moment.day === parisToday(), time: moment.time, date: moment.date };
}

export async function TakeoverStep({ row, page }: { row: TakeoverRowModel; page: Pick<TakeoverPageModel, "id" | "eventId" | "eventName" | "eventDate"> }) {
  const t = await getTranslations("Takeover");
  const tImport = await getTranslations("Import");
  const locale = (await getLocale()) as Locale;
  const title = t(`step.${row.kind}.title`);

  const stateLabel = (() => {
    if (row.waiting) return t("state.waiting");
    if (row.state === "done") {
      const at = row.at ? when(row.at, locale) : null;
      const created = row.kind === "event" && !row.importId;
      if (!at) return t("shape.done");
      if (created) return at.today ? t("state.createdAt", { time: at.time }) : t("state.createdOn", { date: at.date });
      return at.today ? t("state.importedAt", { time: at.time }) : t("state.importedOn", { date: at.date });
    }
    return t(`state.${row.state}`);
  })();

  const stateDetail = (() => {
    if (row.waiting) return null;
    if (row.state === "done") {
      if (row.kind === "event" && !row.importId) return t("detail.signed");
      return row.figure ? t(`figure.${row.figure.key}`, { count: row.figure.count }) : row.importId ? null : t("detail.doneByHand");
    }
    if (row.state === "in_progress") return row.stoppedAt ? t("detail.stoppedAt", { step: tImport(`wizardStep.${row.stoppedAt}`) }) : null;
    if (row.state === "no_file") return row.decidedAt ? t("detail.chosenOn", { date: when(row.decidedAt, locale).date }) : null;
    if (row.state === "covered") return t("detail.coveredNoFile");
    return t(`step.${row.kind}.format`);
  })();

  // Ce que dit la ligne sous son nom : sa phrase, ou ce qui l'a remplie.
  const body = (() => {
    if (row.state === "covered") return t("detail.covered", { count: row.coveredVendorCount ?? 0 });
    if (row.kind === "event" && row.state === "done" && !row.importId && page.eventName) {
      return page.eventDate ? t("detail.enteredWithDate", { event: page.eventName, date: formatCalendarDate(page.eventDate, locale) }) : t("detail.entered", { event: page.eventName });
    }
    if (row.fileName && (row.state === "done" || row.state === "in_progress")) {
      if (row.kind === "vendor_book") return t("detail.forAllWeddings", { file: row.fileName });
      if (row.state === "in_progress" && row.at) {
        const at = when(row.at, locale);
        return at.today ? t("detail.droppedAt", { file: row.fileName, time: at.time }) : t("detail.droppedOn", { file: row.fileName, date: at.date });
      }
      return row.fileName;
    }
    return t(`step.${row.kind}.body`);
  })();

  const fields = (intent: string): Record<string, string> => ({
    kind: row.kind,
    intent,
    ...(page.id ? { takeoverId: page.id } : {}),
    ...(page.eventId ? { eventId: page.eventId } : {}),
  });
  const label = (action: TakeoverRowAction) => t("actionFor", { action: t(`action.${action}`), step: title });

  const control = (action: TakeoverRowAction, index: number) => {
    const primary = row.primary === action;
    // Déposer et continuer ont l'allure d'un bouton ; le reste (bilan, fiche, « Je n'ai pas ce fichier »,
    // « Déposer un fichier » après un choix) est un lien de la ligne (maquette 06).
    const main = index === 0 && (action === "drop" || action === "dropSheet" || action === "continue");
    const linkClass = primary ? "button-link button-link-primary" : main ? "button-link" : "takeover-step-link";
    switch (action) {
      case "drop":
      case "dropSheet":
      case "noFile":
      case "dropAgain":
      case "dropAnyway": {
        const intent = action === "dropSheet" ? "drop" : action;
        return (
          <form key={action} action={takeoverStepAction}>
            {Object.entries(fields(intent)).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className={primary ? "button-primary" : main ? undefined : "takeover-step-link"} aria-label={label(action)}>
              {t(`action.${action}`)}
            </button>
          </form>
        );
      }
      case "enterNames":
        return (
          <Link key={action} href={page.id ? `/reprise/mariage?reprise=${page.id}` : "/reprise/mariage"} className={linkClass} aria-label={label(action)}>
            {t(`action.${action}`)}
          </Link>
        );
      case "continue":
        return (
          <Link key={action} href={`/import/${row.importId}`} className={linkClass} aria-label={label(action)}>
            {t(`action.${action}`)}
          </Link>
        );
      case "seeSummary":
        return (
          <Link key={action} href={`/import/${row.importId}/journal`} className={linkClass} aria-label={label(action)}>
            {t(`action.${action}`)}
          </Link>
        );
      case "openEvent":
        return (
          <Link key={action} href={`/events/${page.eventId}`} className={linkClass} aria-label={label(action)}>
            {t(`action.${action}`)}
          </Link>
        );
      case "abandon":
        return (
          <ConfirmDialog
            key={action}
            trigger={t(`action.${action}`)}
            triggerLabel={label(action)}
            triggerClassName="takeover-step-link"
            title={t("abandonTitle", { file: row.fileName ?? title })}
            body={t("abandonBody")}
            confirmLabel={t("abandonConfirm")}
            keepLabel={t("abandonKeep")}
            action={abandonTakeoverImportAction}
            fields={{ takeoverId: page.id ?? "", importId: row.importId ?? "" }}
          />
        );
    }
  };

  const classes = ["takeover-step", `takeover-step-${row.shape}`, row.next ? "takeover-step-next" : null].filter(Boolean).join(" ");
  return (
    <li className={classes} id={`ligne-${row.kind}`} aria-current={row.next ? "step" : undefined}>
      <span className="takeover-step-number" aria-hidden="true">
        {row.number}
      </span>
      <div className="takeover-step-what">
        <h2 className="takeover-step-title">
          <span className="sr-only">{row.number}. </span>
          {title}
        </h2>
        <p className="takeover-step-body">{body}</p>
      </div>
      <p className="takeover-step-state">
        <strong>
          <span className={`takeover-shape takeover-shape-${row.waiting ? "todo" : row.shape}`} aria-hidden="true">
            {SHAPE_MARK[row.waiting ? "todo" : row.shape]}
          </span>
          {stateLabel}
        </strong>
        {stateDetail ? <span>{stateDetail}</span> : null}
      </p>
      {row.actions.length > 0 ? <div className="takeover-step-actions">{row.actions.map(control)}</div> : null}
    </li>
  );
}
