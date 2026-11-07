// Lot 13 (HUB-18, ADR 0033) — hub.backup_runs : seul le script de
// sauvegarde écrit (rôle d'administration) ; le rôle applicatif ne fait que
// lire, pour la console d'Administration. Prérequis : socle + bootstrap + migrate.
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";

const env = parseAdminEnv(process.env);
let admin: postgres.Sql;
let app: postgres.Sql;
const ids: string[] = [];

beforeAll(() => {
  const base = { host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database: env.POSTGRES_DB, max: 1 };
  admin = postgres({ ...base, username: env.POSTGRES_ADMIN_USER, password: env.POSTGRES_ADMIN_PASSWORD });
  app = postgres({ ...base, username: env.POSTGRES_APP_USER, password: env.POSTGRES_APP_PASSWORD });
});

afterAll(async () => {
  if (ids.length > 0) await admin`delete from hub.backup_runs where id in ${admin(ids)}`;
  await admin.end();
  await app.end();
});

describe("HUB-18 — Dernière sauvegarde signalée (droits sur hub.backup_runs)", () => {
  it("le rôle d'administration (script de sauvegarde) enregistre le début puis la fin d'une exécution", async () => {
    const [run] = await admin<[{ id: string }]>`insert into hub.backup_runs default values returning id`;
    ids.push(run.id);
    await admin`update hub.backup_runs set finished_at = now(), status = 'succeeded', size_bytes = 1024 where id = ${run.id}`;
    const [row] = await app<[{ status: string; size_bytes: string }]>`select status, size_bytes from hub.backup_runs where id = ${run.id}`;
    expect(row.status).toBe("succeeded");
    expect(Number(row.size_bytes)).toBe(1024);
  });

  it("le rôle applicatif ne peut ni écrire, ni modifier, ni supprimer une exécution", async () => {
    await expect(app`insert into hub.backup_runs default values`).rejects.toThrow(/permission denied/);
    await expect(app`update hub.backup_runs set status = 'failed'`).rejects.toThrow(/permission denied/);
    await expect(app`delete from hub.backup_runs`).rejects.toThrow(/permission denied/);
  });
});
