import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getUserContact } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getUndoPreview, type UndoPreviewItem } from "@/lib/import/apply";
import { isValidId } from "../../access";
import { undoImportAction } from "./actions";

function count(value: string | undefined): number | null {
  const number = Number(value);
  return value !== undefined && Number.isInteger(number) && number >= 0 ? number : null;
}

// IMP-05 — « Chaque import est journalisé : fichier, auteur, date, résultat »,
// et un import confirmé reste annulable pendant le délai réglé par l'Admin.
export default async function ImportJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ annule?: string; gardes?: string; utilises?: string }>;
}) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const view = await getUndoPreview(organizationId, importId);
  if (!view) notFound();

  const { sql, db } = createAppConnection();
  let author;
  try {
    author = await getUserContact(db, organizationId, view.createdByUserId);
  } finally {
    await sql.end();
  }

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const undone = count(query.annule);

  const itemTitle = (item: UndoPreviewItem): string => {
    const values = (item.written ?? item.previous ?? {}) as Record<string, unknown>;
    if (item.kind === "event") {
      const clients = Array.isArray(values.clients)
        ? (values.clients as { firstName: string; lastName: string | null }[]).map((client) => `${client.firstName} ${client.lastName ?? ""}`.trim()).join(" & ")
        : "";
      const date = typeof values.eventDate === "string" ? formatCalendarDate(values.eventDate, locale) : null;
      return t(`itemKind.${item.kind}`, { title: [clients, date].filter(Boolean).join(", ") || t("rowWithoutLabel") });
    }
    if (item.kind === "budget_line") {
      const planned = typeof values.plannedAmountCents === "number" ? formatAmount(values.plannedAmountCents, locale) : "";
      return t(`itemKind.${item.kind}`, { title: planned });
    }
    return t(`itemKind.${item.kind}`, { title: typeof values.label === "string" ? values.label : t("rowWithoutLabel") });
  };

  const modified = view.pendingItems.filter((item) => item.modified && !item.usedElsewhere);
  const usedElsewhere = view.pendingItems.filter((item) => item.usedElsewhere);

  return (
    <main>
      <h1>{t("journalEntryTitle", { fileName: view.fileName })}</h1>
      <ScreenHelp title={tHelp("importUndo.title")} body={tHelp("importUndo.body")} />
      {undone !== null ? (
        <p role="status">
          {t("undoResult", { undone, kept: count(query.gardes) ?? 0, used: count(query.utilises) ?? 0 })}
        </p>
      ) : null}
      <dl>
        <dt>{t("journalFile")}</dt>
        <dd>{view.fileName}</dd>
        <dt>{t("journalEntityType")}</dt>
        <dd>{t(`entityType.${view.entityType}`)}</dd>
        <dt>{t("journalAuthor")}</dt>
        <dd>{author?.email ?? t("journalAuthorUnknown")}</dd>
        <dt>{t("journalAppliedAt")}</dt>
        <dd>{view.appliedAt ? formatDateTime(view.appliedAt, locale) : "—"}</dd>
        <dt>{t("journalResult")}</dt>
        <dd>
          {view.result
            ? t("journalResultValue", { created: view.result.created, updated: view.result.updated, unchanged: view.result.unchanged, rejected: view.result.rejected })
            : "—"}
        </dd>
        <dt>{t("journalStatus")}</dt>
        <dd>{t(`status.${view.status}`)}</dd>
        {view.undoneAt ? (
          <>
            <dt>{t("journalUndoneAt")}</dt>
            <dd>{formatDateTime(view.undoneAt, locale)}</dd>
          </>
        ) : null}
      </dl>

      {view.undoable ? (
        <section aria-labelledby="undo-import">
          <h2 id="undo-import">{t("undoTitle")}</h2>
          <p>{t("undoIntro", { date: view.undoDeadline ? formatDateTime(view.undoDeadline, locale) : "" })}</p>
          <form action={undoImportAction}>
            <input type="hidden" name="importId" value={view.id} />
            {modified.length > 0 ? (
              <fieldset>
                <legend>{t("undoModifiedLegend", { count: modified.length })}</legend>
                <p>{t("undoModifiedIntro")}</p>
                {modified.map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" name="forceItemId" value={item.id} />
                    {t("undoForce", { title: itemTitle(item) })}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {usedElsewhere.length > 0 ? (
              <div>
                <p>{t("undoUsedElsewhereIntro")}</p>
                <ul>
                  {usedElsewhere.map((item) => (
                    <li key={item.id}>{itemTitle(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button type="submit">{t("undoSubmit")}</button>
          </form>
        </section>
      ) : view.status === "applied" ? (
        <p>{t("undoExpired")}</p>
      ) : null}

      <p>
        <Link href="/import">{t("backToImports")}</Link>
      </p>
    </main>
  );
}
