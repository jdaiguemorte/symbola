// Point d'entrée volontairement « pur » : l'importer ne doit jamais exiger
// de variables d'environnement, pour que tout code qui a seulement besoin
// de parseEnv/du type Env (tests unitaires compris) reste importable sans
// .env. L'effet de bord de validation au démarrage (SOC-03) vit à part,
// dans "@symbola/env/validate-on-import" — importé uniquement par
// apps/symbola/instrumentation.ts.
import { parseEnv } from "./parse";
import { signatureProviderOf, type Env } from "./schema";

export type { Env };
export { signatureProviderOf };
export { parseEnv };
