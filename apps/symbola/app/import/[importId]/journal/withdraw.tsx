// Lot 71d (HUB-14, UX-07 ; spécification du lot 71, § 5.4, critères 6 à 8 ; maquette 08, C-66, P-17,
// décision I10) — « Retirer cet import… », danger de niveau 2 (lot 70b) : la question nomme l'import, la
// conséquence suit, « Partent » et « Restent » disent à l'avance ce qui part et ce qui reste ; la case
// retire aussi ce qui a été modifié à la main depuis ; « Garder l'import » renonce. La fiche d'un mariage
// qui a d'autres imports se retire avec toute la reprise (niveau 3, une case « Je comprends »). Passé la
// date limite, rien n'est proposé, et la raison est dite.
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import type { TakeoverRemoval, UndoPreview } from "@/lib/import/apply";
import { undoImportAction, undoTakeoverAction } from "./actions";

export async function ImportWithdraw({
  view,
  eventName,
  removal,
  fromTakeover,
  modifiedNames = [],
}: {
  view: UndoPreview;
  eventName: string | null;
  removal: TakeoverRemoval | null;
  fromTakeover: boolean;
  // Les éléments modifiés à la main depuis, nommés (lot 63b).
  modifiedNames?: string[];
}) {
  const t = await getTranslations("ImportWithdraw");
  const locale = (await getLocale()) as Locale;
  const { leaving, staying } = view.summary;
  const deadline = view.undoDeadline ? formatDateTime(view.undoDeadline, locale) : "";

  if (removal && removal.otherImports.length > 0) {
    if (removal.expired.length > 0) {
      return (
        <section className="card import-withdraw" aria-labelledby="withdraw-title">
          <h2 id="withdraw-title">{t("takeoverTitle")}</h2>
          <p role="note">{t("takeoverExpired", { files: removal.expired.join(t("comma")) })}</p>
        </section>
      );
    }
    const files = removal.otherImports.map((entry) => `« ${entry.fileName} »`).join(t("comma"));
    return (
      <section className="card import-withdraw" aria-labelledby="withdraw-title">
        <h2 id="withdraw-title">{t("takeoverTitle")}</h2>
        <p>{t("takeoverIntro", { date: deadline })}</p>
        <ConfirmDialog
          trigger={t("takeoverTrigger")}
          triggerLabel={t("takeoverTrigger")}
          triggerClassName="button-danger"
          level={3}
          title={t("takeoverDialogTitle", { event: eventName ?? view.fileName })}
          body={t("takeoverLeaving", { files, sheet: view.fileName, event: eventName ?? "" })}
          acknowledgeLabel={t("takeoverAcknowledge")}
          confirmLabel={t("takeoverConfirm")}
          keepLabel={t("takeoverKeep")}
          action={undoTakeoverAction}
          fields={{ importId: view.id }}
        >
          <p>{t("takeoverStaying")}</p>
        </ConfirmDialog>
      </section>
    );
  }

  if (!view.undoable) return view.status === "applied" ? <p role="note">{t("expired", { date: deadline })}</p> : null;

  const leavingParts = [
    leaving.budgetLines > 0 ? t("leaving.budgetLines", { count: leaving.budgetLines }) : null,
    leaving.newSlots.length > 0 ? t("leaving.newSlots", { count: leaving.newSlots.length, slots: leaving.newSlots.map((slot) => `« ${slot} »`).join(t("comma")) }) : null,
    leaving.paidPayments > 0 ? t("leaving.paidPayments", { count: leaving.paidPayments }) : null,
    leaving.duePayments > 0 ? t("leaving.duePayments", { count: leaving.duePayments }) : null,
    leaving.vendors > 0 ? t("leaving.vendors", { count: leaving.vendors }) : null,
    leaving.createdFiches > 0 ? t("leaving.createdFiches", { count: leaving.createdFiches }) : null,
    leaving.tasks > 0 ? t("leaving.tasks", { count: leaving.tasks }) : null,
    leaving.events > 0 ? t("leaving.events", { count: leaving.events, event: eventName ?? "" }) : null,
    leaving.others > 0 ? t("leaving.others", { count: leaving.others }) : null,
  ].filter((part): part is string => part !== null);
  const stayingParts = [
    staying.carnetFiches > 0
      ? staying.carnetSources.length > 0
        ? t("staying.carnetFrom", { count: staying.carnetFiches, files: staying.carnetSources.map((file) => `« ${file} »`).join(t("comma")) })
        : t("staying.carnet", { count: staying.carnetFiches })
      : null,
    staying.restoredSlots.length > 0 ? t("staying.restoredSlots", { count: staying.restoredSlots.length, slots: staying.restoredSlots.map((slot) => `« ${slot} »`).join(t("comma")) }) : null,
    staying.usedElsewhere > 0 ? t("staying.usedElsewhere", { count: staying.usedElsewhere }) : null,
  ].filter((part): part is string => part !== null);
  const when = view.appliedAt ? formatDateTime(view.appliedAt, locale) : "";
  const body =
    view.entityType === "budget_lines" && eventName
      ? t("bodyBudget", { event: eventName, date: when })
      : view.entityType === "event_sheets" || view.entityType === "events"
        ? t("bodySheet", { event: eventName ?? view.fileName })
        : t("bodyOther", { date: when });

  return (
    <section className="card import-withdraw" aria-labelledby="withdraw-title">
      <h2 id="withdraw-title" className="sr-only">
        {t("trigger")}
      </h2>
      <p>{t("deadline", { date: deadline })}</p>
      <ConfirmDialog
        trigger={t("trigger")}
        triggerLabel={t("trigger")}
        triggerClassName="button-danger"
        level={2}
        title={t("title", { file: view.fileName })}
        body={body}
        confirmLabel={t("confirm")}
        keepLabel={t("keep")}
        action={undoImportAction}
        fields={{ importId: view.id }}
      >
        <p>{t("leavingIntro", { parts: leavingParts.join(t("comma")) || t("leaving.nothing") })}</p>
        {stayingParts.length > 0 || staying.modified > 0 ? (
          <p>
            {stayingParts.length > 0 ? t("stayingIntro", { parts: stayingParts.join(t("comma")) }) : null} {staying.modified > 0 ? t("staying.modified", { count: staying.modified }) : null}
          </p>
        ) : null}
        {modifiedNames.length > 0 ? (
          <ul>
            {modifiedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : null}
        {staying.modified > 0 ? (
          <label className="confirm-dialog-acknowledge">
            <input type="checkbox" name="forceModified" />
            <span>{t("forceModified", { count: staying.modified })}</span>
          </label>
        ) : null}
        {fromTakeover ? <p className="meta">{t("redeposit")}</p> : null}
      </ConfirmDialog>
    </section>
  );
}
