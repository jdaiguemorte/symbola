// Lot 53 (ARC-09 ; D4 ; ADR 0095, ADR 0096) — paire de clés VAPID des notifications push : P-256, clé
// publique en point non compressé (65 octets) et clé privée (32 octets), en base64url, comme les attend
// la norme Web Push. Node seul, sans dépendance : lançable avant « pnpm install » (CI, poste neuf).
// Usage : node apps/symbola/scripts/generate-vapid-keys.mjs >> .env
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
process.stdout.write(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${jwk.d}\n`);
