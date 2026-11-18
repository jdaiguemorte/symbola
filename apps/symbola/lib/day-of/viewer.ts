// Lot 52 (EVT-06, SEC-12, SEC-13 ; D2, D3 ; ADR 0094) — qui ouvre le mode Jour J d'un évènement :
// une personne de l'équipe (session de compte, Propriétaire ou Planner qui voit l'évènement), ou le
// renfort du jour J de cet évènement (session de son lien personnel, de la veille au lendemain). Tout
// autre cas répond comme une page inexistante, sans dire si l'évènement existe : le lien d'un renfort
// n'ouvre ni un autre évènement, ni une autre organisation, ni aucun autre écran.
import { getLinkSessionToken } from "@/lib/link-session";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canViewEvent, dayHelperAccess, resolveLinkSession } from "@/modules/events/service";
import { getEventVisibility } from "@/modules/hub/service";
import { appDatabase } from "@symbola/db/client";

export type DayOfViewer =
  | { kind: "team"; organizationId: string; userId: string; actorId: string }
  | { kind: "helper"; organizationId: string; linkId: string; personName: string; actorId: string };

export type DayOfViewerResult = { viewer: DayOfViewer } | { refused: "signed_out" | "mfa" | "not_planner" | "not_found" | "link" };

export async function resolveDayOfViewer(eventId: string): Promise<DayOfViewerResult> {
  const auth = await getPlannerAuthContext();
  if (auth.status === "mfa_required") return { refused: "mfa" };
  if (auth.status === "authenticated" && auth.user.organizationId && (auth.user.role === "owner" || auth.user.role === "member")) {
    const organizationId = auth.user.organizationId;
    const { allPlannersSeeAll } = await getEventVisibility(appDatabase(), organizationId);
    if (!(await canViewEvent(organizationId, { userId: auth.user.id, role: auth.user.role, allPlannersSeeAll }, eventId))) return { refused: "not_found" };
    return { viewer: { kind: "team", organizationId, userId: auth.user.id, actorId: auth.user.id } };
  }
  // Un compte qui n'est pas de l'équipe d'une organisation (Exploitation, Comptable) : renvoyé à ses
  // écrans, comme avant le lot 52 ; les routes répondent 401.
  if (auth.status === "authenticated" || auth.status === "forbidden") return { refused: "not_planner" };
  const token = await getLinkSessionToken();
  if (!token) return { refused: "signed_out" };
  const access = await dayHelperAccess(token, eventId);
  if (!access) {
    // Le lien d'un client, d'un prestataire ou d'un invité n'est pas une entrée du jour J : comme sans
    // session, la connexion (la réponse d'avant le lot 52). Un lien de renfort retiré ou expiré : « link ».
    const other = await resolveLinkSession(token);
    return { refused: other && other.audience !== "day_helper" ? "signed_out" : "link" };
  }
  return { viewer: { kind: "helper", organizationId: access.organizationId, linkId: access.linkId, personName: access.personName, actorId: access.linkId } };
}
