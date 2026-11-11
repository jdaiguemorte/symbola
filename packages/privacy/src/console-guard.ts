// Lot 24a (SEC-20) — aucune donnée personnelle dans les journaux techniques.
// Fichier de préparation des suites d'intégration (setupFiles) : tout ce que
// le code écrit dans la console est relevé, sans rien masquer ; à la fin de
// chaque fichier de tests, une adresse e-mail ou un numéro de téléphone
// relevé fait échouer le fichier. Corriger le message : des identifiants,
// jamais des noms ni des adresses.
import { format } from "node:util";
import { afterAll, beforeAll } from "vitest";
import { findPersonalData, redactPersonalData } from "./log-redaction";

const METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const GUARDED = Symbol.for("symbola.consoleGuard");

type Method = ((...args: unknown[]) => void) & { [GUARDED]?: true };
type GuardState = { written: string[] };

const globals = globalThis as typeof globalThis & { [GUARDED]?: GuardState };
const state: GuardState = (globals[GUARDED] ??= { written: [] });

for (const name of METHODS) {
  const original = console[name] as Method;
  if (original[GUARDED]) continue;
  const recording: Method = (...args: unknown[]) => {
    state.written.push(format(...args));
    original.apply(console, args);
  };
  recording[GUARDED] = true;
  console[name] = recording;
}

beforeAll(() => {
  state.written.length = 0;
});

afterAll(() => {
  const lines = state.written.filter((line) => findPersonalData(line).length > 0);
  state.written.length = 0;
  if (lines.length === 0) return;
  throw new Error(
    `SEC-20 : ${lines.length} message(s) de la console contiennent une adresse e-mail ou un numéro de téléphone ` +
      `(journaliser des identifiants) :\n${lines.map((line) => `  - ${redactPersonalData(line).slice(0, 300)}`).join("\n")}`,
  );
});
