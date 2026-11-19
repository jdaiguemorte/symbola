// Lot 35c (RGP-11 ; D8, Q35 ; ADR 0100) — journal des effacements, pour l'Exploitation (Julien, sur le
// VPS ; docs/runbooks/restauration.md, § Rejeu des effacements) :
//   pnpm --filter @symbola/app closures:export -- --out <fichier>   avant une restauration ;
//   pnpm --filter @symbola/app closures:replay -- [--traces <fichier>]   juste après.
// Le rejeu efface de nouveau chaque espace que la trace dit supprimé et qui existe de nouveau : il le
// referme d'abord à ses dates d'origine, avec le rôle d'administration (le rôle applicatif ne peut
// pas antidater une fermeture), puis l'efface comme au 30e jour, fichiers compris. Rien de personnel
// n'est affiché : des identifiants et des nombres.
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { closeAppDatabase } from "@symbola/db/client";
import { appDatabase } from "@symbola/db/client";
import { listOrganizationClosureTraces } from "@/modules/hub/service";
import { mergeClosureTraces, parseClosureTraces, serializeClosureTraces, type ClosureTraceLine } from "@/lib/closure/closure-traces";
import { replayOrganizationErasures } from "@/lib/closure/organization-closure-jobs";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function databaseTraces(): Promise<ClosureTraceLine[]> {
  return (await listOrganizationClosureTraces(appDatabase())).map((trace) => ({ organizationId: trace.organizationId, closedAt: trace.closedAt, deletionDueAt: trace.deletionDueAt, erasedAt: trace.erasedAt }));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2).filter((argument) => argument !== "--");
  if (command === "export") {
    const out = option(rest, "--out");
    if (!out) throw new Error("--out <fichier> manquant");
    const traces = await databaseTraces();
    writeFileSync(out, serializeClosureTraces(traces), { mode: 0o600 });
    console.log(`journal des effacements exporté : ${traces.length} fermeture(s)`);
    return;
  }
  if (command === "replay") {
    const file = option(rest, "--traces");
    const traces = mergeClosureTraces(await databaseTraces(), file ? parseClosureTraces(readFileSync(file, "utf8")) : []);
    const admin = postgres({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB ?? "symbola",
      username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
      password: process.env.POSTGRES_ADMIN_PASSWORD ?? "",
      max: 1,
      onnotice: () => {},
    });
    try {
      const result = await replayOrganizationErasures({
        traces,
        restoreClosure: async (trace) => {
          await admin`update hub.organizations set closed_at = ${trace.closedAt}, deletion_due_at = ${trace.deletionDueAt} where id = ${trace.organizationId}`;
          await admin`insert into hub.organization_closures (organization_id, closed_at, deletion_due_at)
            select ${trace.organizationId}, ${trace.closedAt}, ${trace.deletionDueAt}
            where not exists (select 1 from hub.organization_closures where organization_id = ${trace.organizationId} and closed_at = ${trace.closedAt})`;
          await admin`update hub.organization_closures set erased_at = coalesce(erased_at, now()) where organization_id = ${trace.organizationId} and closed_at = ${trace.closedAt}`;
        },
      });
      console.log(`rejeu des effacements : ${result.replayed.length} espace(s) effacé(s) de nouveau, ${traces.length} trace(s) lue(s)`);
    } finally {
      await admin.end();
    }
    return;
  }
  throw new Error("commande attendue : export ou replay");
}

main()
  .then(() => closeAppDatabase())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await closeAppDatabase();
    process.exitCode = 1;
  });
