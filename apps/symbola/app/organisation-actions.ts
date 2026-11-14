"use server";

// Lot 33 (HUB-02, D6) — passer d'une organisation à l'autre, ou en créer une autre (son propre
// démarrage). Refus sans détail si le compte n'a pas d'adhésion active à l'organisation demandée
// (même réponse qu'une organisation inexistante, SEC-13). L'Exploitation n'a pas d'organisation.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addMembership, createOrganization, PROVISIONAL_ORGANIZATION_NAME, switchOrganization } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { ORGANIZATION_COOKIE_MAX_AGE_S, ORGANIZATION_COOKIE_NAME } from "@/lib/active-organization";
import { getSessionToken } from "@/lib/auth-context";
import { requireSignedIn } from "@/lib/guards";

async function rememberOrganization(organizationId: string): Promise<void> {
  (await cookies()).set(ORGANIZATION_COOKIE_NAME, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORGANIZATION_COOKIE_MAX_AGE_S,
  });
}

export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const auth = await requireSignedIn();
  const organizationId = z.uuid().safeParse(formData.get("organizationId"));
  const token = await getSessionToken();
  if (auth.user.role === "admin" || !organizationId.success || !token) redirect("/");
  if (await switchOrganization(appDatabase(), token, organizationId.data)) await rememberOrganization(organizationId.data);
  redirect("/");
}

export async function createOrganizationAction(): Promise<void> {
  const auth = await requireSignedIn();
  const token = await getSessionToken();
  if (auth.user.role === "admin" || !token) redirect("/");
  const db = appDatabase();
  const organization = await createOrganization(db, PROVISIONAL_ORGANIZATION_NAME);
  await addMembership(db, { userId: auth.user.id, organizationId: organization.id, role: "owner" });
  await switchOrganization(db, token, organization.id);
  await rememberOrganization(organization.id);
  redirect("/demarrage");
}
