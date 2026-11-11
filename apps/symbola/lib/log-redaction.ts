// Lot 24a (SEC-20) — filet de sécurité des journaux du serveur : tout ce qui
// est écrit dans la console passe par redactPersonalData, y compris les
// erreurs que Next.js affiche lui-même (une erreur de base peut citer une
// valeur : « Key (email)=(…) already exists »). Un message sans donnée
// personnelle est écrit tel quel, avec sa mise en forme d'origine. Installé une
// fois au démarrage (instrumentation.ts).
import { format } from "node:util";
import { redactPersonalData } from "@symbola/privacy";

const METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const INSTALLED = Symbol.for("symbola.logRedaction");

type Method = ((...args: unknown[]) => void) & { [INSTALLED]?: true };

export function installLogRedaction(target: Pick<Console, (typeof METHODS)[number]> = console): void {
  for (const name of METHODS) {
    const original = target[name] as Method;
    if (original[INSTALLED]) continue;
    const redacting: Method = (...args: unknown[]) => {
      const text = format(...args);
      const redacted = redactPersonalData(text);
      if (redacted === text) original.apply(target, args);
      else original.call(target, redacted);
    };
    redacting[INSTALLED] = true;
    target[name] = redacting;
  }
}
