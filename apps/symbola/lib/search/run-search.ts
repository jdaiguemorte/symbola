// Lot 10 (AIDE-08) — recherche globale de l'équipe, prête à afficher : données
// de l'organisation (via le hub et les services des modules) puis aide et
// écrans (textes traduits). Partagée par la page /recherche et la réponse JSON
// de la recherche instantanée.
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import { foldSearchText, searchWords } from "@symbola/db/search";
import { globalSearch, isModuleEnabled } from "@/modules/hub/service";
import { TUTORIALS, tutorialHref } from "@/lib/help/catalog";
import { SCREENS } from "./screens";
import { STATUS_LABEL_KEYS } from "@/app/events/event-status";
import type { EventStatus } from "@/modules/events/service";

const QUOTE_STATUS_KEYS: Record<string, string> = {
  draft: "statusDraft",
  sent: "statusSent",
  signed: "statusSigned",
  declined: "statusDeclined",
  expired: "statusExpired",
};

export type SearchGroupKey = "events" | "documents" | "tasks" | "help";
export type SearchItem = { title: string; detail: string; href: string };
export type SearchGroup = { key: SearchGroupKey; label: string; items: SearchItem[] };

export async function runSearch(input: { organizationId: string; role: string; term: string }): Promise<SearchGroup[]> {
  const words = searchWords(input.term);
  if (words.length === 0) return [];
  const t = await getTranslations("Search");
  const tHome = await getTranslations("Home");
  const tHelp = await getTranslations("Help");
  const tHelpCenter = await getTranslations("HelpCenter");
  const tEvents = await getTranslations("Events");
  const tQuotes = await getTranslations("Quotes");
  const locale = (await getLocale()) as Locale;

  const { sql, db } = createAppConnection();
  let modules;
  try {
    const [events, budget, quotes] = await Promise.all([
      isModuleEnabled(db, input.organizationId, "events"),
      isModuleEnabled(db, input.organizationId, "budget"),
      isModuleEnabled(db, input.organizationId, "quotes"),
    ]);
    modules = { events, budget, quotes };
  } finally {
    await sql.end();
  }
  const found = await globalSearch({ organizationId: input.organizationId, term: input.term, modules: { events: modules.events, quotes: modules.quotes } });
  const names = (eventId: string) => found.eventNames[eventId] || t("noClientName");

  const groups: SearchGroup[] = [
    {
      key: "events",
      label: t("groupEvents"),
      items: found.events.map((event) => ({
        title: event.names || t("noClientName"),
        detail: [event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("noDate"), event.venueName, tEvents(STATUS_LABEL_KEYS[event.status as EventStatus] ?? "statusProspect")]
          .filter(Boolean)
          .join(" · "),
        href: `/events/${event.id}`,
      })),
    },
    {
      key: "documents",
      label: t("groupDocuments"),
      items: [
        ...found.quotes.map((quote) => ({ title: t("quoteTitle", { number: quote.number, names: names(quote.eventId) }), detail: tQuotes(QUOTE_STATUS_KEYS[quote.status] ?? "statusDraft"), href: `/devis/${quote.id}` })),
        ...found.invoices.map((invoice) => ({
          title: t("invoiceTitle", { number: invoice.number, names: names(invoice.eventId) }),
          detail: t("invoiceIssued", { date: formatCalendarDate(invoice.issuedOn, locale) }),
          href: `/devis/factures/${invoice.id}`,
        })),
      ],
    },
    {
      key: "tasks",
      label: t("groupTasks"),
      items: [
        ...found.tasks.map((task) => ({
          title: t("taskTitle", { label: task.label, names: task.eventNames || t("noClientName") }),
          detail: t("taskDue", { date: formatCalendarDate(task.dueDate, locale) }),
          href: `/events/${task.eventId}?onglet=retroplanning&tache=${task.id}`,
        })),
        ...found.vendors.map((vendor) => ({
          title: vendor.vendorName ? t("vendorTitle", { vendor: vendor.vendorName, slot: vendor.label }) : vendor.label,
          detail: vendor.eventNames || t("noClientName"),
          href: `/events/${vendor.eventId}?onglet=prestataires&poste=${vendor.id}`,
        })),
      ],
    },
  ];

  // Aide et écrans : tutoriels puis écrans (avec leur article d'aide).
  const available = (module: string) => module === "hub" || modules[module as keyof typeof modules];
  const matches = (text: string) => {
    const folded = foldSearchText(text);
    return words.every((word) => folded.includes(word));
  };
  const help: SearchItem[] = [];
  for (const tutorial of TUTORIALS) {
    if (!available(tutorial.module)) continue;
    const title = tHelpCenter(`items.${tutorial.key}.title`);
    const description = tHelpCenter(`items.${tutorial.key}.description`);
    if (matches(`${title} ${description}`)) help.push({ title, detail: t("tutorialDetail", { minutes: tutorial.minutes }), href: tutorialHref(tutorial.key) });
  }
  for (const screen of SCREENS) {
    if (!available(screen.module) || (screen.ownerOnly && input.role !== "owner")) continue;
    const label = tHome(screen.label);
    const title = tHelp(`${screen.help}.title`);
    const body = tHelp(`${screen.help}.body`);
    if (matches(`${label} ${title} ${body}`)) help.push({ title: label, detail: t("screenDetail"), href: screen.path });
  }
  groups.push({ key: "help", label: t("groupHelp"), items: help.slice(0, 8) });

  return groups.filter((group) => group.items.length > 0);
}
