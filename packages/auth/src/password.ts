// Hachage des mots de passe (SOC-04, ADR 0013) : argon2id, paramètres
// durcis. Jamais de mot de passe en clair en dehors de cette fonction.
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB — recommandation OWASP pour argon2id
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2Hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  return argon2Verify(passwordHash, plainPassword);
}
