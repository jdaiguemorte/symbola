// Lot 10 (AIDE-08) — recherche globale de l'équipe, prête à afficher : données
// de l'organisation (via le hub et les services des modules) puis aide et
// écrans (textes traduits). Partagée par la page /recherche et la réponse JSON
// de la recherche instantanée.
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { foldSearchText, searchWords } from "@symbola/db/search";
import { globalSearch, isModuleEnabled } from "@/modules/hub/service";
import { TUTORIALS, tutorialHref } from "@/lib/help/catalog";
import { articleHref } from "@/lib/help/articles";
import { searchHelpCenter } from "@/lib/help/help-center";
import { SCREENS } from "./screens";
import { STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { dayDistance, dayPhrase } from "./search-day";
import type { EventStatus } from "@/modules/events/service";

const QUOTE_STATUS_KEYS: Record<string, string> = {
  draft: "statusDraft",
  sent: "statusSent",
  signed: "statusSigned",
  declined: "statusDeclined",
  expired: "statusExpired",
};

// Lot 70e (HUB-12 ; M9) : l'ordre des groupes, chacun compté à l'écran : tâches, évènements, contacts,
// prestataires, devis et factures, aide.
export type SearchGroupKey = "tasks" | "events" | "contacts" | "vendors" | "documents" | "help";
export type SearchItem = { title: string; detail: string; href: string };
export type SearchGroup = { key: SearchGroupKey; label: string; items: SearchItem[] };

// Lot 52 (EVT-06, D2) : scope, les évènements visibles de la personne (null : tous) ; un résultat
// rattaché à un évènement hors de vue n'est pas montré.
export async function runSearch(input: { organizationId: string; role: string; term: string; scope?: Set<string> | null }): Promise<SearchGroup[]> {
  const words = searchWords(input.term);
  if (words.length === 0) return [];
  const t = await getTranslations("Search");
  const tHome = await getTranslations("Home");
  const tHelp = await getTranslations("Help");
  const tHelpCenter = await getTranslations("HelpCenter");
  const tEvents = await getTranslations("Events");
  const tQuotes = await getTranslations("Quotes");
  const locale = (await getLocale()) as Locale;

  const db = appDatabase();
  const [events, budget, quotes, vendors, appointments] = await Promise.all([
    isModuleEnabled(db, input.organizationId, "events"),
    isModuleEnabled(db, input.organizationId, "budget"),
    isModuleEnabled(db, input.organizationId, "quotes"),
    isModuleEnabled(db, input.organizationId, "vendors"),
    isModuleEnabled(db, input.organizationId, "appointments"),
  ]);
  const modules = { events, budget, quotes, vendors, appointments };
  const raw = await globalSearch({ organizationId: input.organizationId, term: input.term, modules: { events: modules.events, quotes: modules.quotes, vendors: modules.vendors } });
  const visible = (eventId: string | null | undefined) => !input.scope || !eventId || input.scope.has(eventId);
  const found = {
    ...raw,
    events: raw.events.filter((event) => visible(event.id)),
    quotes: raw.quotes.filter((quote) => visible(quote.eventId)),
    invoices: raw.invoices.filter((invoice) => visible(invoice.eventId)),
    tasks: raw.tasks.filter((task) => visible(task.eventId)),
    vendors: raw.vendors.filter((vendor) => visible(vendor.eventId)),
  };
  const names = (eventId: string) => found.eventNames[eventId] || t("noClientName");

  const today = parisToday();
  // « dans 6 jours », « demain », « il y a 3 jours » : où l'on en est, pour dire où mène un résultat.
  const when = (date: string): string => {
    const phrase = dayPhrase(dayDistance(today, date));
    if (phrase.kind === "today") return t("dayToday");
    if (phrase.kind === "tomorrow") return t("dayTomorrow");
    if (phrase.kind === "yesterday") return t("dayYesterday");
    return phrase.kind === "future" ? t("dayFuture", { days: phrase.days }) : t("dayPast", { days: phrase.days });
  };

  const groups: SearchGroup[] = [
    {
      key: "tasks",
      label: t("groupTasks"),
      items: found.tasks.map((task) => ({
        title: task.label,
        detail: [task.eventNames || t("noClientName"), t("taskDue", { when: when(task.dueDate) })].join(" · "),
        href: `/events/${task.eventId}?onglet=taches&tache=${task.id}`,
      })),
    },
    {
      key: "events",
      label: t("groupEvents"),
      items: found.events.map((event) => ({
        title: event.names || t("noClientName"),
        detail: [event.eventDate ? when(event.eventDate) : t("noDate"), event.venueName, tEvents(STATUS_LABEL_KEYS[event.status as EventStatus] ?? "statusOption")]
          .filter(Boolean)
          .join(" · "),
        href: `/events/${event.id}`,
      })),
    },
    // Lot 36a (CRM-03) : les contacts de l'organisation, après leurs évènements (un nom de client
    // ouvre d'abord l'évènement, AIDE-08).
    {
      key: "contacts",
      label: t("groupContacts"),
      items: found.contacts.map((contact) => ({ title: contact.displayName, detail: [contact.email, contact.city].filter(Boolean).join(" · "), href: `/contacts/${contact.id}` })),
    },
    // Lot 70e : les prestataires du carnet, puis les postes de budget de chaque évènement (un prestataire
    // consulté ou retenu), ne se mêlent plus aux tâches.
    {
      key: "vendors",
      label: t("groupVendors"),
      items: [
        ...found.book.map((vendor) => ({
          title: vendor.name,
          detail: [t("vendorBookDetail"), vendor.typeLabel, vendor.city].filter(Boolean).join(" · "),
          href: `/prestataires/${vendor.id}`,
        })),
        ...found.vendors.map((vendor) => ({
          title: vendor.vendorName ? t("vendorTitle", { vendor: vendor.vendorName, slot: vendor.label }) : vendor.label,
          detail: vendor.eventNames || t("noClientName"),
          href: `/events/${vendor.eventId}?onglet=budget&poste=${vendor.id}`,
        })),
      ],
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
  ];

  // Aide et écrans : tutoriels puis écrans (avec leur article d'aide).
  const available = (module: string) => module === "hub" || modules[module as keyof typeof modules];
  const matches = (text: string) => {
    const folded = foldSearchText(text);
    return words.every((word) => folded.includes(word));
  };
  const help: SearchItem[] = [];
  // Lot 74f (HUB-12 ; § 6.6) : d'abord les articles de l'aide, par le moteur du centre d'aide (une phrase
  // comprise, les mots voisins), pour les modules et le rôle de la personne ; puis tutoriels et écrans.
  const answer = await searchHelpCenter(
    { audience: "team", isOwner: input.role === "owner", modules: { hub: true, ...modules, guests: false, floorplans: false } },
    input.term,
  );
  for (const article of [answer.best, ...answer.others]) {
    if (article) help.push({ title: article.title, detail: t("articleDetail"), href: articleHref(article) });
  }
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
