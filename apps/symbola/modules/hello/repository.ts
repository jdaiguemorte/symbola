// Accès aux données du module hello — jamais importé hors de modules/hello/
// (ADR 0011). Au lot 0 (SOC-01), stockage en mémoire ; SOC-05 le remplacera
// par une requête PostgreSQL dans le schéma `hello`, sous RLS.

const DEFAULT_GREETING = "Bonjour depuis Symbola";

export function findGreetingText(): string {
  return DEFAULT_GREETING;
}
