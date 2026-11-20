// Lot 60 — erreurs du module floorplans. Un objet d'une autre organisation, d'un lieu ou d'un
// évènement inconnu répond comme un objet absent (SEC-13) ; une saisie invalide nomme son motif, sans
// reprendre la valeur.
export class FloorplanNotFoundError extends Error {
  constructor() {
    super("Plan de salle introuvable");
    this.name = "FloorplanNotFoundError";
  }
}

export type FloorplanProblem =
  | "name"
  | "size"
  | "elements"
  | "too_many_elements"
  | "fixtures"
  | "vendor"
  | "fixture_link"
  | "element_type"
  | "calibration"
  | "background_type"
  | "background_size"
  | "background_infected"
  // Lot 54 (DOC-06) : quota de stockage plein, préavis passé.
  | "background_storage_full"
  | "no_tables"
  | "no_source";

export class FloorplanInvalidError extends Error {
  constructor(readonly problem: FloorplanProblem) {
    super(`Plan de salle invalide : ${problem}`);
    this.name = "FloorplanInvalidError";
  }
}

// Le plan a été enregistré ailleurs depuis son ouverture : rien n'est écrasé.
export class FloorplanStaleError extends Error {
  constructor() {
    super("Plan de salle modifié ailleurs");
    this.name = "FloorplanStaleError";
  }
}
