"use server";

// Lot 33 (SEC-07, HUB-01, ADR 0067) — demande d'un lien de connexion par e-mail, qui inscrit
// aussi une adresse inconnue. Même réponse pour une adresse connue ou inconnue (SEC-13) et pour
// un robot (piège, lot 24b). Débit limité par adresse IP et par adresse e-mail (lot 16).
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { isHoneypotFilled } from "@/lib/honeypot";
import { sendMagicLink } from "@/lib/identity";
import { checkRateLimit, longestWait, rateLimitMessage } from "@/lib/rate-limit";

export type LinkRequestState = { sent?: boolean; error?: string };

export async function requestLinkAction(_previous: LinkRequestState, formData: FormData): Promise<LinkRequestState> {
  if (isHoneypotFilled(formData)) return { sent: true };
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: (await getTranslations("Login"))("invalidEmail") };
  const wait = longestWait(await checkRateLimit("login", { account: parsed.data }));
  if (wait !== null) return { error: await rateLimitMessage(wait) };
  await sendMagicLink(parsed.data, (await getLocale()) === "en" ? "en" : "fr");
  return { sent: true };
}
