// Lot 16 (ARC-01, ADR 0043) — gardes d'accès des écrans. Chaque page protégée
// en appelle une en première ligne : la garde renvoie la personne connectée,
// ou la redirige (connexion, double authentification, espace du marié,
// accueil). La RLS protège les données ; la garde protège l'écran. Un test
// (guards.test.ts) vérifie que chaque page hors des écrans publics en appelle
// une.
import { redirect } from "next/navigation";
import type { AuthenticatedUser } from "@symbola/auth";
import { getAuthContext, getClientAuthContext, getPlannerAuthContext } from "./auth-context";

export type SignedIn = { status: "authenticated"; user: AuthenticatedUser };
export type OrganizationUser = AuthenticatedUser & { organizationId: string };
export type InOrganization = { status: "authenticated"; user: OrganizationUser };

// Toute personne connectée : accueil, profil, centre d'aide.
export async function requireSignedIn(): Promise<SignedIn> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  return auth;
}

// Écrans de la planner (titulaire ou collaborateur, EVT-06) : un marié va à
// son espace, l'Admin à sa console.
export async function requirePlanner(): Promise<InOrganization> {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  const { organizationId } = auth.user;
  if (!organizationId) redirect("/");
  return { status: "authenticated", user: { ...auth.user, organizationId } };
}

// Écrans réservés à la titulaire du compte (module RGPD, cahier des charges
// § 6) : un collaborateur reçoit null, et l'écran lui explique qu'il n'y a
// pas accès.
export async function requireOwner(): Promise<InOrganization | null> {
  const auth = await requirePlanner();
  return auth.user.role === "owner" ? auth : null;
}

// Espace du marié (EVT-06), réservé au rôle « client ». L'appartenance à
// l'événement est vérifiée ensuite par le module events, à chaque requête.
export async function requireClient(): Promise<InOrganization> {
  const auth = await getClientAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect("/");
  const { organizationId } = auth.user;
  if (!organizationId) redirect("/login");
  return { status: "authenticated", user: { ...auth.user, organizationId } };
}

// HUB-03 — console Admin (/admin/*). L'Admin n'accède jamais aux données
// métier d'une organisation (ADR 0029) : cette garde ne vérifie que le rôle.
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.user.role !== "admin") redirect("/");
  return { userId: auth.user.id, email: auth.user.email };
}
