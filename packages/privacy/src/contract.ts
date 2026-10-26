// Contrat privacy/v1 (SOC-07, PRD §8) : chaque module l'implémente sur ses
// propres données pour que le hub puisse orchestrer la recherche
// transverse (RGPD-01), l'export (RGPD-02), l'oubli (RGPD-03) et la purge
// (RGPD-05) — ces écrans arrivent au lot RGPD, pas au lot 0. Ici, seule
// l'interface et une implémentation technique (module hello) existent.
export type PersonQuery = {
  organizationId: string;
  /** Terme de recherche (e-mail, nom…) propre à chaque module. */
  term: string;
};

export type PrivacyFindResult = {
  recordId: string;
  summary: string;
};

export interface PrivacyContractV1 {
  find(query: PersonQuery): Promise<PrivacyFindResult[]>;
  export(query: PersonQuery): Promise<unknown>;
  anonymize(query: PersonQuery): Promise<{ affected: number }>;
  erase(query: PersonQuery): Promise<{ affected: number }>;
}
