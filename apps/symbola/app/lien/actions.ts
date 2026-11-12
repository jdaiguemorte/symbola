"use server";

// Lot 26a (UX-11, SEC-14, SEC-15, SEC-17 ; ADR 0053, décisions D2 et D5) —
// ouverture d'un lien personnel et demande d'un nouveau lien. Le jeton arrive
// en POST (il était après « # » dans l'adresse, jamais envoyé au serveur) ; il
// n'est écrit nulle part. Débit limité par adresse IP (SEC-04). Lot 26b
// (POR-01, D6) : un lien peut demander un code à usage unique avant la session.
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { openEventLink, requestLinkRenewal, verifyLinkCode } from "@/modules/events/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { setLinkSessionCookie } from "@/lib/link-session";
import { linkHomePath } from "@/lib/link-cookie";

type Opened = { outcome: "opened"; home: "/portail" | "/prestataire" };
export type OpenLinkOutcome =
  | Opened
  | { outcome: "code_required"; emailHint: string; codeSent: boolean }
  | { outcome: "invalid" }
  | { outcome: "retry"; minutes: number };
export type LinkCodeOutcome = Opened | { outcome: "wrong_code"; attemptsLeft: number } | { outcome: "code_expired" } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };
export type RenewalOutcome = { outcome: "requested" } | { outcome: "retry"; minutes: number };

const tokenSchema = z.string().max(200);
const codeSchema = z.string().max(20);

// L'organisation (partie publique du jeton) sert de second compteur de débit.
function organizationOf(token: string): string | null {
  const organizationId = token.split(".")[0] ?? "";
  return z.uuid().safeParse(organizationId).success ? organizationId : null;
}

function minutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

export async function openLinkAction(token: unknown): Promise<OpenLinkOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("linkOpen", { account: organizationOf(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  const result = await openEventLink(parsed.data, new Date(), (await getLocale()) === "en" ? "en" : "fr");
  if (result.outcome === "code_required") return result;
  if (result.outcome !== "opened") return { outcome: "invalid" };
  await setLinkSessionCookie(result.sessionToken, result.maxAgeSeconds);
  return { outcome: "opened", home: linkHomePath(result.audience) };
}

// Lot 26b (POR-01, D6) : le code reçu par e-mail ouvre la session. Cinq essais
// par code (en base), débit limité en plus par adresse IP et par organisation.
export async function verifyLinkCodeAction(token: unknown, code: unknown): Promise<LinkCodeOutcome> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedToken.success || !parsedCode.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("linkCode", { account: organizationOf(parsedToken.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  const result = await verifyLinkCode(parsedToken.data, parsedCode.data);
  if (result.outcome !== "opened") return result;
  await setLinkSessionCookie(result.sessionToken, result.maxAgeSeconds);
  return { outcome: "opened", home: linkHomePath(result.audience) };
}

// Décision D5 : la même réponse, que le lien existe ou non.
export async function requestLinkRenewalAction(token: unknown): Promise<RenewalOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "requested" };
  const limit = await checkRateLimit("linkRenewal", { account: organizationOf(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  await requestLinkRenewal(parsed.data);
  return { outcome: "requested" };
}
