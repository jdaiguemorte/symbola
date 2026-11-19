// Lot 16 (L16-ARC-01, ADR 0043) — gardes d'accès des écrans. Chaque page protégée
// en appelle une en première ligne : la garde renvoie la personne connectée,
// ou la redirige (connexion, double authentification, accueil). Lot 26a : les
// tiers n'ont pas de compte ; leur garde est requireLink (session de lien). La RLS protège les données ; la garde protège l'écran. Un test
// (guards.test.ts) vérifie que chaque page hors des écrans publics en appelle
// une.
import { notFound, redirect } from "next/navigation";
import { isAccountingReaderRole, type AuthenticatedUser, type AuthResult, type Role } from "@symbola/auth";
import type { LinkAccess, LinkAudience } from "@/modules/events/service";
import { appDatabase } from "@symbola/db/client";
import { isOrganizationClosed } from "@/modules/hub/service";
import { getAuthContext, getPlannerAuthContext } from "./auth-context";
import { READ_ONLY_ROLE } from "./read-only";
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
export async function requirePendingMfa(): Promise<{ userId: string; role: Role }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "authenticated") redirect("/");
  return { userId: auth.userId, role: auth.role };
}

// Écrans de la planner (titulaire ou collaborateur, PRD-EVT-06) : l'Admin va à
// sa console.
// Lot 35c (RGP-11, ADR 0100) : un espace fermé ne sert plus qu'à exporter et à rouvrir. Les écrans
// redirigent vers la fermeture ; seuls la fermeture et l'export l'acceptent (allowClosed).
export const CLOSED_ORGANIZATION_PATH = "/parametres/fermeture";
// Lot 54 (HUB-27, D2 ; ADR 0101) : allowReadOnly, une écriture permise à un espace en lecture seule
// (fin d'essai) : l'abonnement, l'export, la fermeture.
export type GuardOptions = { allowClosed?: boolean; allowReadOnly?: boolean };
export const READ_ONLY_REDIRECT_PATH = "/parametres/abonnement";

async function redirectIfClosed(organizationId: string, options: GuardOptions): Promise<void> {
  if (!options.allowClosed && (await isOrganizationClosed(appDatabase(), organizationId))) redirect(CLOSED_ORGANIZATION_PATH);
}

export async function requirePlanner(options: GuardOptions = {}): Promise<InOrganization> {
  const auth = await getPlannerAuthContext({ allowReadOnly: options.allowReadOnly ?? false });
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  // Lot 54 : une écriture refusée à un espace en lecture seule ramène à « Mon abonnement ».
  if (auth.status === "forbidden" && auth.role === READ_ONLY_ROLE) redirect(`${READ_ONLY_REDIRECT_PATH}?erreur=read_only`);
  // Lot 52 : le Comptable retourne à ses écrans de lecture.
  if (auth.status === "forbidden") redirect(auth.role === "accountant" ? "/comptable" : "/");
  const { organizationId } = auth.user;
  if (!organizationId) redirect("/");
  await redirectIfClosed(organizationId, options);
  return { status: "authenticated", user: { ...auth.user, organizationId } };
}

// Écrans réservés à la titulaire du compte (module RGPD, cahier des charges
// § 6) : un collaborateur reçoit null, et l'écran lui explique qu'il n'y a
// pas accès.
export async function requireOwner(options: GuardOptions = {}): Promise<InOrganization | null> {
  const auth = await requirePlanner(options);
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

// Lot 52 (HUB-04 ; ADR 0094) — écrans de lecture comptable (factures et avoirs, encaissements,
// e-reporting, journaux) : la Propriétaire, les Planners et le Comptable (lecture seule). ownerOnly :
// une Planner reçoit null (l'écran lui dit qu'il est réservé), comme requireOwner. L'Exploitation va
// à sa console.
export async function requireAccountingReader(options: { ownerOnly?: boolean } = {}): Promise<(InOrganization & { readOnly: boolean }) | null> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  if (!isAccountingReaderRole(auth.user.role) || !auth.user.organizationId) redirect("/");
  if (options.ownerOnly && auth.user.role === "member") return null;
  await redirectIfClosed(auth.user.organizationId, {});
  return { status: "authenticated", user: { ...auth.user, organizationId: auth.user.organizationId }, readOnly: auth.user.role === "accountant" };
}

// Lot 52 : le Comptable n'a que ses écrans ; son accueil est /comptable.
export async function requireAccountant(): Promise<InOrganization> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/securite");
  if (auth.user.role !== "accountant" || !auth.user.organizationId) redirect("/");
  await redirectIfClosed(auth.user.organizationId, {});
  return { status: "authenticated", user: { ...auth.user, organizationId: auth.user.organizationId } };
}

// Lot 52 (HUB-05, D4) — « Mes sessions » (/securite) : toute session de compte, qu'elle attende ou non
// la double authentification (la page le lui demande alors) ; sans session, la connexion.
export async function requireAccountSession(): Promise<Exclude<AuthResult, { status: "unauthenticated" }>> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  return auth;
}

// Lot 52 (HUB-04, D1) — page publique qui s'adapte à une personne connectée (confirmation du transfert
// de propriété) : la session complète, sinon null.
export async function optionalSignedIn(): Promise<SignedIn | null> {
  const auth = await getAuthContext();
  return auth.status === "authenticated" ? auth : null;
}
