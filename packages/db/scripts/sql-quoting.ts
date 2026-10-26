// Échappement minimal pour les identifiants/valeurs injectés dans du SQL
// construit dynamiquement (bootstrap-roles.ts) — PostgreSQL ne permet pas
// de paramétrer CREATE ROLE / ALTER ROLE via le protocole étendu.
export function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
