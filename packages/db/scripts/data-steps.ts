// Lot 48a (DAT-08 ; D5, ADR 0093) — étapes de données des migrations. Une migration SQL ne sait pas
// chiffrer au niveau du champ (AES-256-GCM de field-box, clé DATA_ENCRYPTION_KEY que la base ne
// connaît pas) : l'étape qui suit sa migration le fait en TypeScript, avec le rôle admin.
// - migrate.ts lance l'étape « aller » de chaque migration appliquée, après les migrations : elle est
//   rejouable (elle ne traite que ce qui reste en clair) ;
// - rollback-migration.ts lance l'étape « retour » dans la transaction de l'annulation, avant le
//   script SQL : tout ou rien.
// La clé n'est demandée que s'il y a une valeur à traiter ; aucune valeur n'est jamais écrite dans
// la console ni dans une erreur.
//
// field-box est repris de packages/auth par son chemin : @symbola/auth dépend de @symbola/db, pas
// l'inverse, et le fichier n'utilise que la bibliothèque standard de Node.
import type postgres from "postgres";
import { openField, readDataEncryptionKey, sealField, type FieldPlace } from "../../auth/src/field-box";

type Sql = postgres.Sql | postgres.TransactionSql;
type Env = Record<string, string | undefined>;

export type DataStep = {
  tag: string;
  // Nombre de lignes traitées.
  up: (sql: Sql, env: Env) => Promise<number>;
  down: (sql: Sql, env: Env) => Promise<number>;
};

// Place des valeurs chiffrées de quotes.quote_settings : la même que celle du module quotes
// (apps/symbola/modules/quotes/bank-details.ts).
export function quoteSettingsBankPlace(organizationId: string, settingsId: string, column: "iban_sealed" | "bic_sealed"): FieldPlace {
  return { organizationId, table: "quotes.quote_settings", column, rowId: settingsId };
}

async function hasColumn(sql: Sql, schema: string, table: string, column: string): Promise<boolean> {
  const rows = await sql`select 1 from information_schema.columns where table_schema = ${schema} and table_name = ${table} and column_name = ${column}`;
  return rows.length > 0;
}

export const SEAL_PLANNER_BANK_DETAILS: DataStep = {
  tag: "0176_lot48a_quotes_sealed_bank_details",
  async up(sql, env) {
    if (!(await hasColumn(sql, "quotes", "quote_settings", "iban_sealed"))) return 0;
    const rows = await sql<{ id: string; organization_id: string; iban: string | null; bic: string | null }[]>`
      select id, organization_id, iban, bic from quotes.quote_settings where iban is not null or bic is not null`;
    if (rows.length === 0) return 0;
    const key = readDataEncryptionKey(env);
    for (const row of rows) {
      const ibanSealed = row.iban ? sealField(row.iban, quoteSettingsBankPlace(row.organization_id, row.id, "iban_sealed"), key) : null;
      const bicSealed = row.bic ? sealField(row.bic, quoteSettingsBankPlace(row.organization_id, row.id, "bic_sealed"), key) : null;
      await sql`
        update quotes.quote_settings
        set iban_sealed = coalesce(${ibanSealed}, iban_sealed), bic_sealed = coalesce(${bicSealed}, bic_sealed), iban = null, bic = null
        where id = ${row.id}`;
    }
    return rows.length;
  },
  async down(sql, env) {
    if (!(await hasColumn(sql, "quotes", "quote_settings", "iban_sealed"))) return 0;
    const rows = await sql<{ id: string; organization_id: string; iban_sealed: string | null; bic_sealed: string | null }[]>`
      select id, organization_id, iban_sealed, bic_sealed from quotes.quote_settings where iban_sealed is not null or bic_sealed is not null`;
    if (rows.length === 0) return 0;
    const key = readDataEncryptionKey(env);
    for (const row of rows) {
      const iban = row.iban_sealed ? openField(row.iban_sealed, quoteSettingsBankPlace(row.organization_id, row.id, "iban_sealed"), key) : null;
      const bic = row.bic_sealed ? openField(row.bic_sealed, quoteSettingsBankPlace(row.organization_id, row.id, "bic_sealed"), key) : null;
      await sql`update quotes.quote_settings set iban = ${iban}, bic = ${bic}, iban_sealed = null, bic_sealed = null where id = ${row.id}`;
    }
    return rows.length;
  },
};

export const DATA_STEPS: readonly DataStep[] = [SEAL_PLANNER_BANK_DETAILS];

export function dataStepFor(tag: string): DataStep | undefined {
  return DATA_STEPS.find((step) => step.tag === tag);
}

// Étapes « aller » des migrations appliquées, chacune dans sa transaction.
export async function runDataSteps(sql: postgres.Sql, env: Env, journal: { entries: { tag: string; when: number }[] }): Promise<void> {
  const [table] = await sql<{ name: string | null }[]>`select to_regclass('drizzle.__drizzle_migrations')::text as name`;
  if (!table?.name) return;
  const applied = new Set((await sql<{ created_at: string }[]>`select created_at::text from drizzle.__drizzle_migrations`).map((row) => Number(row.created_at)));
  for (const step of DATA_STEPS) {
    const entry = journal.entries.find((candidate) => candidate.tag === step.tag);
    if (!entry || !applied.has(entry.when)) continue;
    const count = await sql.begin((tx) => step.up(tx, env));
    if (count > 0) console.log(`Étape de données de ${step.tag} : ${count} ligne(s) traitée(s).`);
  }
}
