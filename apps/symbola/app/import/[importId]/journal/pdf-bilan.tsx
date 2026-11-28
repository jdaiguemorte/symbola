// Lot 71e (HUB-14, PRE-01, CHR-08, UX-07 ; spécification du lot 71, § 5.5, critères 4 et 8 ; maquettes 10
// et 11, C-58, C-66, R14) — le bilan d'un PDF de prestataires retenus ou de programme, au gabarit du bilan
// du budget (lot 71d) : qui, quand ; les nombres de « Vérifier », mot pour mot (gardés au journal) ; ce
// qui n'a pas été repris et où le compléter ; pour le programme, l'annuaire proposé au carnet (les
// mariés et l'agence écartés, et dits). Rendu côté serveur.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ImportFigures } from "@symbola/contracts";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import type { UndoPreview } from "@/lib/import/apply";
import type { DirectoryEntry } from "@/lib/import/pdf-imports";
import { addDirectoryToCarnetAction } from "./directory-actions";

export async function PdfBilan({
  view,
  author,
  back,
  eventId,
  directory,
  unallocatedCents,
  added,
}: {
  view: UndoPreview;
  author: string | null;
  back: { href: string; eventName: string | null } | null;
  eventId: string | null;
  directory: DirectoryEntry[] | null;
  unallocatedCents: number | null;
  added: { phones: number; created: number } | null;
}) {
  const t = await getTranslations("ImportPdf");
  const locale = (await getLocale()) as Locale;
  const figures = view.result!.figures as ImportFigures;
  const applied = view.status === "applied";
  const toAdd = directory?.filter((entry) => entry.fate === "add_phone") ?? [];
  const toCreate = directory?.filter((entry) => entry.fate === "create") ?? [];
  const set = directory?.filter((entry) => entry.fate === "couple" || entry.fate === "agency") ?? [];
  const person = (entry: DirectoryEntry) => [entry.contact, entry.company].filter(Boolean).join(" · ") || entry.role;

  return (
    <section className="card stack import-bilan" aria-labelledby="bilan-title">
      <h2 id="bilan-title" className="sr-only">
        {t("bilan.summaryTitle")}
      </h2>
      <p className="meta">
        {view.appliedAt ? t("bilan.importedBy", { file: view.fileName, date: formatDateTime(view.appliedAt, locale), author: author ?? t("bilan.someone") }) : view.fileName}
      </p>
      {figures.kind === "event_vendors" ? (
        <ul className="import-figures pdf-figures">
          <li>{t("bilan.vendors.found", { count: figures.foundInCarnet })}</li>
          <li>{t("bilan.vendors.created", { count: figures.createdFiches })}</li>
          <li>{t("bilan.vendors.signed", { count: figures.signed })}</li>
          <li>{t("bilan.vendors.unsigned", { count: figures.unsigned })}</li>
          {figures.unknownContracts > 0 ? <li>{t("bilan.vendors.unknown", { count: figures.unknownContracts })}</li> : null}
          <li>{t("bilan.vendors.newSlots", { count: figures.newSlots })}</li>
        </ul>
      ) : figures.kind === "program" ? (
        <ul className="import-figures pdf-figures">
          <li>{t("bilan.program.days", { count: figures.days })}</li>
          <li>{t("bilan.program.moments", { count: figures.moments, markers: figures.markers })}</li>
          <li>{t("bilan.program.endsMissing", { count: figures.endsMissing })}</li>
        </ul>
      ) : null}
      {view.result?.coupleConfirmed ? <p>{t("bilan.coupleConfirmed")}</p> : null}
      {added ? <p role="status">{t("bilan.directory.added", { phones: added.phones, created: added.created })}</p> : null}

      <h3>{t("bilan.notTakenTitle")}</h3>
      {figures.kind === "event_vendors" ? (
        <p>
          {unallocatedCents !== null && unallocatedCents > 0 ? t("bilan.vendors.noAmountsUnallocated", { amount: formatAmount(unallocatedCents, locale) }) : t("bilan.vendors.noAmounts")}
        </p>
      ) : figures.kind === "program" ? (
        directory && applied ? (
          <section aria-labelledby="directory-title" className="stack">
            <h4 id="directory-title">{t("bilan.directory.title", { count: directory.length })}</h4>
            <ul>
              {directory
                .filter((entry) => entry.fate !== "couple" && entry.fate !== "agency")
                .map((entry) => (
                  <li key={entry.index}>
                    <span className="pdf-name">{person(entry)}</span> <span className="meta">{t(`bilan.directory.fate.${entry.fate}`, { phone: entry.phone ?? "" })}</span>
                  </li>
                ))}
            </ul>
            {set.length > 0 ? <p className="meta">{t("bilan.directory.set", { count: set.length })}</p> : null}
            {toAdd.length + toCreate.length > 0 ? (
              <form action={addDirectoryToCarnetAction}>
                <input type="hidden" name="importId" value={view.id} />
                <button type="submit">{toCreate.length === 0 ? t("bilan.directory.addPhones", { count: toAdd.length }) : t("bilan.directory.addAll", { phones: toAdd.length, created: toCreate.length })}</button>
              </form>
            ) : (
              <p className="meta">{t("bilan.directory.nothing")}</p>
            )}
          </section>
        ) : (
          <p>{added ? t("bilan.directory.done") : t("bilan.directory.gone")}</p>
        )
      ) : null}

      {applied ? (
        <>
          <h3>{t("bilan.nextTitle")}</h3>
          <p className="row-actions">
            {eventId ? (
              <Link href={figures.kind === "program" ? `/events/${eventId}?onglet=programme` : `/events/${eventId}?onglet=budget`} className="button-link button-link-primary">
                {figures.kind === "program" ? t("bilan.completeProgram") : t("bilan.seeBudget")}
              </Link>
            ) : null}
            {back ? (
              <Link href={back.href} className="button-link">
                {t("bilan.backToTakeover")}
              </Link>
            ) : null}
          </p>
        </>
      ) : null}
    </section>
  );
}
