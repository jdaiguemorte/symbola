import { parseEnv } from "./parse";
import type { Env } from "./schema";

export type { Env };
export { parseEnv };

// Effet de bord volontaire : valider au premier import (SOC-03), donc au
// démarrage du serveur via instrumentation.ts. Les tests important
// `parseEnv` depuis "./parse" évitent ce singleton.
export const env: Env = parseEnv(process.env);
