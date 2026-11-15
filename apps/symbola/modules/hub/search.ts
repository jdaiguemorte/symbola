// Lot 10 (AIDE-08) — recherche globale de l'équipe : le hub interroge le
// service.ts de chaque module souscrit (jamais leurs tables), dans le
// contexte RLS de l'organisation. Les données d'essai sont exclues par
// chaque module. Les résultats d'aide et d'écrans sont ajoutés par l'app
// (textes traduits).
import { searchWords } from "@symbola/db/search";
import type { EventsSearchResults, QuotesSearchResults, VendorBookSearchResult } from "@symbola/contracts";
import { getEventNamesByIds, searchEvents } from "@/modules/events/service";
import { searchQuotes } from "@/modules/quotes/service";
import { searchVendorBook } from "@/modules/vendors/service";
import { getContactsByIds, searchContactIdsByWord } from "./contacts";

const LIMIT = 6;

// Lot 36a (CRM-03) : les contacts, du noyau du hub, toujours cherchés.
export type ContactSearchResult = { id: string; displayName: string; email: string | null; city: string | null };
export type GlobalSearchResults = EventsSearchResults &
  QuotesSearchResults & { book: VendorBookSearchResult[]; eventNames: Record<string, string>; contacts: ContactSearchResult[] };

export async function globalSearch(input: {
  organizationId: string;
  term: string;
  modules: { events: boolean; quotes: boolean; vendors?: boolean };
}): Promise<GlobalSearchResults> {
  const words = searchWords(input.term);
  const empty: GlobalSearchResults = { events: [], tasks: [], vendors: [], quotes: [], invoices: [], book: [], eventNames: {}, contacts: [] };
  if (words.length === 0) return empty;

  const found = input.modules.events ? await searchEvents(input.organizationId, words, LIMIT) : { events: [], tasks: [], vendors: [] };
  const documents = input.modules.quotes
    ? await searchQuotes(input.organizationId, words, found.events.map((event) => event.id), LIMIT)
    : { quotes: [], invoices: [] };

  // Prénoms des clients des devis et factures trouvés par leur numéro.
  const known = Object.fromEntries(found.events.map((event) => [event.id, event.names]));
  const missing = [...new Set([...documents.quotes, ...documents.invoices].map((row) => row.eventId))].filter((id) => !(id in known));
  const eventNames = input.modules.events && missing.length > 0 ? { ...known, ...(await getEventNamesByIds(input.organizationId, missing)) } : known;

  // Lot 11 : fiches du carnet de prestataires (jamais les exemples).
  const book = input.modules.vendors ? await searchVendorBook(input.organizationId, words, LIMIT) : [];

  // Lot 36a : contacts dont le nom, l'adresse ou le téléphone contiennent chaque mot.
  const byWord = await Promise.all(words.map((word) => searchContactIdsByWord(input.organizationId, word)));
  const contactIds = byWord.reduce((kept, ids) => kept.filter((id) => ids.includes(id)));
  const contacts = [...(await getContactsByIds(input.organizationId, contactIds.slice(0, LIMIT))).values()]
    .filter((contact) => !contact.anonymized && !contact.isDemo)
    .map((contact) => ({ id: contact.id, displayName: contact.displayName, email: contact.email, city: contact.city }));

  return { ...found, ...documents, book, eventNames, contacts };
}
