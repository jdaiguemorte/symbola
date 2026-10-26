// Effet de bord volontaire (SOC-03) : valider process.env dès l'import de
// ce fichier précis, pour un échec rapide au démarrage du serveur. Importé
// uniquement par apps/symbola/instrumentation.ts — jamais par
// "@symbola/env" lui-même (voir index.ts), pour ne pas forcer cette
// validation sur du code qui n'a besoin que de parseEnv/du type Env.
import { parseEnv } from "./parse";
import type { Env } from "./schema";

export const env: Env = parseEnv(process.env);
