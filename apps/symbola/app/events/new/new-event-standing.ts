// Lot 70e (EVT-01, EVT-05, PAR-01 ; D8, M13, A10) — « Où en est-il ? », la question unique de « Nouvel
// évènement ». Deux réponses, aucune choisie d'avance ; la reprise de fichiers n'est plus une réponse
// mais un lien à part (M12). Règles pures, sans base.
export const EVENT_STANDINGS = ["enquiry", "signed"] as const;
export type EventStanding = (typeof EVENT_STANDINGS)[number];

export function parseStanding(value: unknown): EventStanding | null {
  return (EVENT_STANDINGS as readonly unknown[]).includes(value) ? (value as EventStanding) : null;
}

// « Une demande en cours » crée ce que créait « Prospect » (Option) ; « Signé, en préparation » crée
// un évènement Confirmé, comme « Évènement confirmé » avant lui (A10)  (lot 72a : « En préparation » retiré).
export function statusForStanding(standing: EventStanding): "option" | "confirmed" {
  return standing === "signed" ? "confirmed" : "option";
}
