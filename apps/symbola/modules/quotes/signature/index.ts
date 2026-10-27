// DEV-02, ADR 0021 — choix du fournisseur de signature. Un devis d'essai
// (ADR 0008) utilise toujours le faux fournisseur : aucun e-mail ni aucune
// soumission chez un tiers pour des données fictives.
import { randomBytes } from "node:crypto";
import { parseEnv, signatureProviderOf } from "@symbola/env";
import { DocusealSignatureProvider } from "./docuseal";
import { FakeSignatureProvider } from "./fake";
import type { SignatureProvider } from "./provider";

const HOLDER = Symbol.for("symbola.signatureProviders");
type Holder = { fake?: FakeSignatureProvider; override?: SignatureProvider | null | undefined };
function holder(): Holder {
  const root = globalThis as unknown as Record<symbol, Holder | undefined>;
  root[HOLDER] ??= {};
  return root[HOLDER]!;
}

export function fakeSignatureProvider(): FakeSignatureProvider {
  const state = holder();
  if (!state.fake) {
    const env = parseEnv(process.env);
    // Secret propre au processus : le faux fournisseur n'est piloté que de
    // l'intérieur (page de signature fictive, tests), jamais par un appel
    // HTTP extérieur.
    state.fake = new FakeSignatureProvider({ signingBaseUrl: env.APP_PUBLIC_URL, webhookSecret: randomBytes(32).toString("hex") });
  }
  return state.fake;
}

// Fournisseur des devis réels : null quand la signature n'est pas
// configurée (production sans DocuSeal) — l'écran l'affiche
// « indisponible », sans erreur (CLAUDE.md §2.3).
export function realSignatureProvider(): SignatureProvider | null {
  const state = holder();
  if (state.override !== undefined) return state.override;
  const env = parseEnv(process.env);
  const kind = signatureProviderOf(env);
  if (kind === "none") return null;
  if (kind === "fake") return fakeSignatureProvider();
  return new DocusealSignatureProvider({
    apiUrl: env.DOCUSEAL_API_URL,
    apiKey: env.DOCUSEAL_API_KEY,
    publicUrl: env.DOCUSEAL_PUBLIC_URL,
    webhookHeader: env.SIGNATURE_WEBHOOK_HEADER,
    webhookSecret: env.SIGNATURE_WEBHOOK_SECRET,
  });
}

export function signatureProviderFor(isDemo: boolean): SignatureProvider | null {
  return isDemo ? fakeSignatureProvider() : realSignatureProvider();
}

// Tests uniquement : impose le fournisseur des devis réels (null =
// indisponible) ; undefined revient à la configuration.
export function setSignatureProviderForTests(provider: SignatureProvider | null | undefined): void {
  holder().override = provider;
}
