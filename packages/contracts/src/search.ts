// Lot 10 (AIDE-08) — résultats de recherche renvoyés par chaque module :
// juste de quoi afficher le résultat et l'ouvrir ; jamais les données d'essai.
export type EventSearchResult = { id: string; names: string; eventDate: string | null; venueName: string | null; status: string };
export type TaskSearchResult = { id: string; eventId: string; label: string; dueDate: string; eventNames: string };
export type VendorSearchResult = { id: string; eventId: string; label: string; vendorName: string | null; eventNames: string };
export type EventsSearchResults = { events: EventSearchResult[]; tasks: TaskSearchResult[]; vendors: VendorSearchResult[] };

export type QuoteSearchResult = { id: string; number: string; eventId: string; status: string };
export type InvoiceSearchResult = { id: string; number: string; quoteId: string; eventId: string; kind: string; issuedOn: string };
export type QuotesSearchResults = { quotes: QuoteSearchResult[]; invoices: InvoiceSearchResult[] };
