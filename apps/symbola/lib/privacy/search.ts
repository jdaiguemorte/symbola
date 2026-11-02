// RGPD-01 — recherche transverse d'une personne (ADR 0023) : le hub
// interroge chaque module souscrit par son contrat privacy/v1, puis rassemble
// les données rattachées aux événements de la personne (tâches, budget,
// devis…). Un module en erreur ou trop lent rend le résultat incomplet,
// jamais « aucune donnée ». Orchestration entre modules, comme lib/import.
import { createAppConnection } from "@symbola/db/client";
import { hasTerms, prepareTerms, type PersonTerms, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { budgetPrivacy } from "@/modules/budget/service";
import { eventsPrivacy } from "@/modules/events/service";
import { helloPrivacy } from "@/modules/hello/service";
import { hubPrivacy, isModuleEnabled, type ModuleKey } from "@/modules/hub/service";
import { quotesPrivacy } from "@/modules/quotes/service";

// Modules interrogés, et la clé de souscription de chacun (le hub l'est toujours).
const PARTICIPANTS: { contract: PrivacyContractV1; moduleKey: ModuleKey | null }[] = [
  { contract: hubPrivacy, moduleKey: null },
  { contract: eventsPrivacy, moduleKey: "events" },
  { contract: budgetPrivacy, moduleKey: "budget" },
  { contract: quotesPrivacy, moduleKey: "quotes" },
  { contract: helloPrivacy, moduleKey: "hello" },
];

// Délai de réponse d'un module, au-delà duquel le résultat est déclaré incomplet.
const MODULE_TIMEOUT_MS = 10_000;

export type SearchRecord = PrivacyRecord & {
  // Trouvée par un champ personnel (true), ou rattachée à un événement de la personne.
  direct: boolean;
};

export type ModuleOutcome = { module: string; status: "ok" | "failed" };

export type PersonSearchResult = {
  records: SearchRecord[];
  outcomes: ModuleOutcome[];
  complete: boolean;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("délai dépassé")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function subscribedParticipants(organizationId: string, participants: typeof PARTICIPANTS) {
  const { sql, db } = createAppConnection();
  try {
    const result: PrivacyContractV1[] = [];
    for (const participant of participants) {
      if (participant.moduleKey === null || (await isModuleEnabled(db, organizationId, participant.moduleKey))) result.push(participant.contract);
    }
    return result;
  } finally {
    await sql.end();
  }
}

function recordKey(record: PrivacyRecord): string {
  return `${record.module}:${record.kind}:${record.recordId}`;
}

export async function searchPerson(
  input: { organizationId: string; terms: PersonTerms },
  options: { participants?: typeof PARTICIPANTS; timeoutMs?: number } = {},
): Promise<PersonSearchResult | null> {
  if (!hasTerms(prepareTerms(input.terms))) return null;
  const contracts = await subscribedParticipants(input.organizationId, options.participants ?? PARTICIPANTS);
  const timeoutMs = options.timeoutMs ?? MODULE_TIMEOUT_MS;
  const failed = new Set<string>();
  const records = new Map<string, SearchRecord>();

  const found = await Promise.all(
    contracts.map(async (contract) => {
      try {
        return await withTimeout(contract.find({ organizationId: input.organizationId, terms: input.terms }), timeoutMs);
      } catch (error) {
        // Journalisé sans les termes cherchés (données personnelles, CLAUDE.md §5).
        console.error("recherche RGPD : module en échec", { module: contract.module, error: error instanceof Error ? error.message : "inconnue" });
        failed.add(contract.module);
        return [];
      }
    }),
  );
  for (const record of found.flat()) records.set(recordKey(record), { ...record, direct: true });

  // Données rattachées aux événements où la personne apparaît.
  const eventIds = [...new Set(found.flat().map((record) => record.eventId).filter((id): id is string => id !== null))];
  if (eventIds.length > 0) {
    const related = await Promise.all(
      contracts.map(async (contract) => {
        try {
          return await withTimeout(contract.related({ organizationId: input.organizationId, eventIds }), timeoutMs);
        } catch (error) {
          console.error("recherche RGPD : module en échec (données liées)", { module: contract.module, error: error instanceof Error ? error.message : "inconnue" });
          failed.add(contract.module);
          return [];
        }
      }),
    );
    for (const record of related.flat()) {
      if (!records.has(recordKey(record))) records.set(recordKey(record), { ...record, direct: false });
    }
  }

  return {
    records: [...records.values()],
    outcomes: contracts.map((contract) => ({ module: contract.module, status: failed.has(contract.module) ? "failed" : "ok" })),
    complete: failed.size === 0,
  };
}
