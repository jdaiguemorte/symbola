// Lot 16 (L16-ARC-01, ADR 0043) — gardes d'accès des écrans. Chaque page protégée
// en appelle une en première ligne : la garde renvoie la personne connectée,
// ou la redirige (connexion, double authentification, accueil). Lot 26a : les
// tiers n'ont pas de compte ; leur garde est requireLink (session de lien). La RLS protège les données ; la garde protège l'écran. Un test
// (guards.test.ts) vérifie que chaque page hors des écrans publics en appelle
// une.
import { notFound, redirect } from "next/navigation";
import type { AuthenticatedUser } from "@symbola/auth";
import type { LinkAccess, LinkAudience } from "@/modules/events/service";
import { getAuthContext, getPlannerAuthContext } from "./auth-context";
import { currentLinkAccess } from "./link-session";

export type SignedIn = { status: "authenticated"; user: AuthenticatedUser };
export type OrganizationUser = AuthenticatedUser & { organizationId: string };
export type InOrganization = { status: "authenticated"; user: OrganizationUser };

// Toute personne connectée : accueil, profil, centre d'aide.
export async function requireSignedIn(): Promise<SignedIn> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  return auth;
}

// Lot 33 (D4) — page « Sécurisez votre compte » : seulement pour une session qui attend la double
// authentification (Propriétaire, Exploitation). Sans session, la connexion ; session complète,
// l'accueil.
export async function requirePendingMfa(): Promise<{ userId: string; role: "owner" | "member" | "admin" }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "authenticated") redirect("/");
  return { userId: auth.userId, role: auth.role };
}

// Écrans de la planner (titulaire ou collaborateur, PRD-EVT-06) : l'Admin va à
// sa console.
export async function requirePlanner(): Promise<InOrganization> {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  if (auth.status === "forbidden") redirect("/");
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

// Lot 26a (UX-11, SEC-14 ; ADR 0053) — portail d'un tiers, ouvert par son lien
// personnel : la session de lien est relue en base à chaque requête. Sans
// session valable, la page « lien non valable » propose d'en demander un
// nouveau. Une session de compte (planner) n'ouvre pas le portail.
// Lot 26b (SC-S3) : l'espace d'un autre public répond comme inexistant (le
// lien d'un prestataire n'ouvre jamais le portail du client).
export async function requireLink(audience?: LinkAudience): Promise<LinkAccess> {
  const access = await currentLinkAccess();
  if (!access) redirect("/lien");
  if (audience && access.audience !== audience) notFound();
  return access;
}

// PRD-HUB-03 — console Admin (/admin/*). L'Admin n'accède jamais aux données
// métier d'une organisation (ADR 0029) : cette garde ne vérifie que le rôle.
export async function requireOperator(): Promise<{ userId: string; email: string }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  if (auth.user.role !== "admin") redirect("/");
  return { userId: auth.user.id, email: auth.user.email };
}
