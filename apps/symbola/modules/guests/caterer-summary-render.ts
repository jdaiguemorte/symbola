// Lot 50 (INV-06 ; D6 à D8) — la synthèse pour le traiteur mise en fichier, à la demande : tableur CSV
// (marque d'ordre des octets, séparateur « ; », cellules = + - @ neutralisées : toCsv) ou PDF A4 (noir
// et blanc). Textes dans la langue de l'organisation. Le fichier part vers le navigateur et n'est
// rangé nulle part dans Symbola (D8). Exposé seulement par service.ts (ADR 0011).
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { toCsv } from "@symbola/privacy";
import type { CatererSummary, CatererSummaryFormat, GuestLocale, SeatingShape } from "@symbola/contracts";
import { pdfSafe } from "@/lib/pdf-text";
import { catererCsvTable } from "./caterer-summary";
import { CatererSummaryPdf, type CatererPdfLabels } from "./caterer-summary-pdf";

export type CatererSummaryFile = { body: Uint8Array; contentType: string; filename: string };

function translator(locale: GuestLocale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Guests.caterer" });
}

// Nom de fichier sans nom de personne : le temps fort et sa date, en caractères sûrs.
function fileStem(summary: CatererSummary, prefix: string): string {
  const moment = summary.keyMoment.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return [prefix, moment || "temps-fort", summary.keyMoment.date].join("-");
}

export async function renderCatererSummary(summary: CatererSummary, format: CatererSummaryFormat, locale: GuestLocale): Promise<CatererSummaryFile> {
  const t = translator(locale);
  const stem = fileStem(summary, t(summary.version === "nominative" ? "fileNominative" : "fileAggregate"));
  if (format === "csv") {
    const rows = catererCsvTable(summary, {
      table: t("csv.table"),
      name: t("csv.name"),
      mealType: t("csv.mealType"),
      diets: t("csv.diets"),
      count: t("csv.count"),
      response: t("csv.response"),
      covers: t("csv.covers"),
      unplaced: t("unplaced"),
      total: t("csv.total"),
      vendorMeals: t("vendorMeals"),
      pending: t("pendingTitle"),
      present: t("csv.present"),
    });
    return { body: new TextEncoder().encode(toCsv(rows)), contentType: "text/csv; charset=utf-8", filename: `${stem}.csv` };
  }
  const shapeLabel = (shape: SeatingShape | null) => (shape ? t(`shape.${shape}`) : "");
  const labels: CatererPdfLabels = {
    title: t("title"),
    heading: t("heading", { moment: summary.keyMoment.name, date: formatCalendarDate(summary.keyMoment.date, locale as Locale) }),
    generatedAt: t("generatedAt", { date: formatDateTime(new Date(summary.generatedAt), locale as Locale) }),
    version: t(summary.version === "nominative" ? "versionNominative" : "versionAggregate"),
    noPlan: summary.planComposed ? null : t("noPlan"),
    dietsPurged: summary.dietsPurged ? t("dietsPurged") : null,
    totalsTitle: t("totalsTitle"),
    coversLabel: t("coversLabel"),
    covers: (count) => t("covers", { count }),
    mealsTitle: t("mealsTitle"),
    dietsTitle: t("dietsTitle"),
    noDiets: t("noDiets"),
    vendorMeals: t("vendorMeals"),
    pendingTitle: t("pendingTitle"),
    pendingNone: t("pendingNone"),
    tablesTitle: t("tablesTitle"),
    unplaced: t("unplaced"),
    tableLine: (table) => t("tableLine", { name: table.name, shape: shapeLabel(table.shape), capacity: table.capacity ?? 0 }),
    personLine: (person) => (person.diets.length > 0 ? t("personWithDiets", { name: person.name, meal: person.mealType, diets: person.diets.join(", ") }) : t("person", { name: person.name, meal: person.mealType })),
    footer: t(summary.version === "nominative" ? "footerNominative" : "footerAggregate"),
    page: (page, total) => t("page", { page, total }),
  };
  const element = createElement(CatererSummaryPdf, { summary: pdfSafe(summary), labels: pdfSafe(labels), language: locale }) as unknown as ReactElement<DocumentProps>;
  return { body: new Uint8Array(await renderToBuffer(element)), contentType: "application/pdf", filename: `${stem}.pdf` };
}
