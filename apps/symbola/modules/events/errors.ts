// Erreurs du module events partagées entre service.ts et ses fichiers internes (lot 47 : les
// prestataires par lien les lèvent aussi). Réexportées par service.ts, seule porte d'entrée.

// Identifiant inconnu ou appartenant à une autre organisation (masqué
// par la RLS) : l'appelant affiche « introuvable » plutôt qu'une erreur.
export class EventNotFoundError extends Error {
  constructor() {
    super("événement introuvable");
    this.name = "EventNotFoundError";
  }
}

// Action impossible sur un événement d'essai (ex. inviter un marié : jamais
// d'e-mail à un tiers depuis un essai).
export class DemoEventRestrictionError extends Error {
  constructor() {
    super("action indisponible pendant l'essai");
    this.name = "DemoEventRestrictionError";
  }
}

// Lien absent, retiré ou expiré, rubrique fermée, objet d'un autre événement :
// même réponse dans tous les cas, sans dire ce qui existe (SEC-13).
export class LinkAccessDeniedError extends Error {
  constructor() {
    super("accès refusé");
    this.name = "LinkAccessDeniedError";
  }
}
