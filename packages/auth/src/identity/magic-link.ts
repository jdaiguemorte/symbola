// Lot 33 (SEC-07, ADR 0067) — lien magique envoyé par Symbola. Le lien porte, scellés (AES-256-GCM
// de secret-box.ts, données associées propres aux liens), l'adresse et le jeton à usage unique du
// fournisseur : aucune donnée lisible dans l'adresse ni dans les journaux. Le fournisseur reste
// seul juge du jeton (usage unique, quinze minutes) ; l'échéance scellée évite seulement un
// aller-retour inutile. Un lien altéré, scellé avec une autre clé, non scellé ou échu ne s'ouvre pas.
import { z } from "zod";
import { isSealedTotpSecret, openTotpSecret, sealTotpSecret } from "../secret-box";

const CONTEXT = "lien-magique";

const payloadSchema = z.object({ email: z.string().email(), token: z.string().min(1), expiresAt: z.number() });

export type MagicLinkPayload = z.infer<typeof payloadSchema>;

export function sealMagicLink(payload: MagicLinkPayload, key: Buffer): string {
  return Buffer.from(sealTotpSecret(JSON.stringify(payload), CONTEXT, key), "utf8").toString("base64url");
}

export function openMagicLink(value: string, key: Buffer, now: number = Date.now()): MagicLinkPayload | null {
  try {
    const sealed = Buffer.from(value, "base64url").toString("utf8");
    if (!isSealedTotpSecret(sealed)) return null;
    const parsed = payloadSchema.safeParse(JSON.parse(openTotpSecret(sealed, CONTEXT, key)));
    if (!parsed.success || parsed.data.expiresAt <= now) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
