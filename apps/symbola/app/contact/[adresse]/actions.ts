"use server";

// Lot 44 (CRM-01 ; D4, D6 ; ADR 0084) — envoi du formulaire de contact public, sans compte : l'adresse
// désigne l'organisation ; la garde (piège, délai scellé, débit) et la validation sont dans
// lib/contact-form/submit.ts. Un envoi refusé par la garde reçoit la même réponse qu'un succès.
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { handleContactSubmission, type ContactFormState } from "@/lib/contact-form/submit";

export async function submitContactAction(_previous: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return handleContactSubmission(formData, { headers: await headers(), locale });
}
