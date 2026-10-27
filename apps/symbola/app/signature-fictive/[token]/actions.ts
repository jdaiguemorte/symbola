"use server";

import { redirect } from "next/navigation";
import { actOnFakeSignature } from "@/modules/quotes/service";

// DEV-02 — page de signature du faux fournisseur (développement, essai
// guidé) : le lien personnel suffit, comme chez le vrai fournisseur.
export async function fakeSignatureAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const action = formData.get("decision") === "decline" ? "decline" : "sign";
  if (!/^[0-9a-f-]{36}$/.test(token)) return;
  await actOnFakeSignature(token, action);
  redirect(`/signature-fictive/${token}`);
}
