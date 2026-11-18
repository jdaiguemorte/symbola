"use server";

// Lot 49 (INV-03, RGP-06, RGP-08, SEC-04, SEC-14, SEC-17 ; D3, D11, D13) — la page de réponse d'un
// invité. Le jeton arrive en POST (il était après « # » dans l'adresse, jamais envoyé au serveur
// autrement) et n'est écrit nulle part, ni journal ni cookie : la page le garde en mémoire le temps
// de la réponse. Débit limité par adresse IP et par organisation. Sans accord, aucun régime n'est
// gardé, quoi que contienne la requête (contrôle du service).
import { createHash } from "node:crypto";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import type { RsvpAnswerInput, RsvpView } from "@symbola/contracts";
import { checkRateLimit } from "@/lib/rate-limit";
import { answerRsvp, openRsvp, opposeAsGuest } from "@/modules/guests/service";

export type RsvpOpenOutcome = { outcome: "open" | "closed"; view: RsvpView } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };
export type RsvpSaveOutcome = { outcome: "saved"; view: RsvpView } | { outcome: "closed" } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };

const tokenSchema = z.string().max(200);
const id = z.uuid();
const answerSchema = z.object({
  presence: z.array(z.object({ guestId: id, keyMomentId: id, attending: z.boolean() })).max(400),
  consent: z.boolean(),
  dietOptionIds: z.array(id).max(60),
  children: z.array(z.object({ guestId: id, guardianDeclared: z.boolean(), dietOptionIds: z.array(id).max(60) })).max(20),
  accommodation: z.boolean().nullable().optional(),
  transport: z.boolean().nullable().optional(),
});

// Compteur par lien : l'empreinte du jeton (jamais le jeton lui-même), pas l'organisation.
function linkKey(token: string): string {
  return `rsvp:${createHash("sha256").update(token).digest("hex")}`;
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

async function locale(): Promise<"fr" | "en"> {
  return (await getLocale()) === "en" ? "en" : "fr";
}

export async function openRsvpAction(token: unknown): Promise<RsvpOpenOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("rsvpOpen", { account: linkKey(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  return openRsvp(parsed.data, await locale());
}

export async function answerRsvpAction(token: unknown, answer: unknown): Promise<RsvpSaveOutcome> {
  const parsedToken = tokenSchema.safeParse(token);
  const parsedAnswer = answerSchema.safeParse(answer);
  if (!parsedToken.success || !parsedAnswer.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("rsvpAnswer", { account: linkKey(parsedToken.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  return answerRsvp(parsedToken.data, parsedAnswer.data as RsvpAnswerInput, await locale());
}

// RGP-08 (partie F) : « Je ne souhaite pas que mes données soient conservées ».
export async function opposeRsvpAction(token: unknown): Promise<{ outcome: "done" | "invalid" } | { outcome: "retry"; minutes: number }> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const limit = await checkRateLimit("rsvpAnswer", { account: linkKey(parsed.data) });
  if (!limit.allowed) return { outcome: "retry", minutes: minutes(limit.retryAfterSeconds) };
  return opposeAsGuest(parsed.data);
}
