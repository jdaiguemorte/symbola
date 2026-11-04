// Lot 10 (AIDE-08) — recherche globale de l'équipe : le hub interroge le
// service.ts de chaque module souscrit (jamais leurs tables), dans le
// contexte RLS de l'organisation. Les données d'essai sont exclues par
// chaque module. Les résultats d'aide et d'écrans sont ajoutés par l'app
// (textes traduits).
import { searchWords } from "@symbola/db/search";
import type { EventsSearchResults, QuotesSearchResults } from "@symbola/contracts";
import { getEventNamesByIds, searchEvents } from "@/modules/events/service";
import { searchQuotes } from "@/modules/quotes/service";

const LIMIT = 6;

export type GlobalSearchResults = EventsSearchResults & QuotesSearchResults & { eventNames: Record<string, string> };

export async function globalSearch(input: {
  organizationId: string;
  term: string;
  modules: { events: boolean; quotes: boolean };
}): Promise<GlobalSearchResults> {
  const words = searchWords(input.term);
  const empty: GlobalSearchResults = { events: [], tasks: [], vendors: [], quotes: [], invoices: [], eventNames: {} };
  if (words.length === 0) return empty;

  const found = input.modules.events ? await searchEvents(input.organizationId, words, LIMIT) : { events: [], tasks: [], vendors: [] };
  const documents = input.modules.quotes
    ? await searchQuotes(input.organizationId, words, found.events.map((event) => event.id), LIMIT)
    : { quotes: [], invoices: [] };

  // Prénoms des clients des devis et factures trouvés par leur numéro.
  const known = Object.fromEntries(found.events.map((event) => [event.id, event.names]));
  const missing = [...new Set([...documents.quotes, ...documents.invoices].map((row) => row.eventId))].filter((id) => !(id in known));
  const eventNames = input.modules.events && missing.length > 0 ? { ...known, ...(await getEventNamesByIds(input.organizationId, missing)) } : known;

  return { ...found, ...documents, eventNames };
}
