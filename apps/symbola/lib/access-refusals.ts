// Lot 24a (SEC-13, SC-S1, décision D4) — un identifiant introuvable dans une
// adresse (page ou route), demandé par une personne connectée, va au journal
// de SON organisation : la route (identifiants remplacés par [id]) et
// l'identifiant demandé. Rien de l'autre organisation : la RLS ne laisse rien
// voir, et la réponse reste celle d'un objet inexistant (SEC-13). Au plus une
// ligne par minute, par personne et par route, pour ne pas noyer le journal
// (mémoire du processus : l'app tourne en un seul processus, ADR 0011).
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { getAuthContext } from "./auth-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THROTTLE_MS = 60_000;
const MAX_REMEMBERED = 10_000;
const lastRecorded = new Map<string, number>();

export function refusedRoute(pathname: string): { route: string; objectId: string } | null {
  const segments = pathname.split("/");
  const ids = segments.filter((segment) => UUID.test(segment));
  if (ids.length === 0) return null;
  return { route: segments.map((segment) => (UUID.test(segment) ? "[id]" : segment)).join("/"), objectId: ids.at(-1)!.toLowerCase() };
}

function remember(key: string, now: number): void {
  if (lastRecorded.size >= MAX_REMEMBERED) {
    for (const [stored, at] of lastRecorded) if (now - at >= THROTTLE_MS) lastRecorded.delete(stored);
    if (lastRecorded.size >= MAX_REMEMBERED) lastRecorded.clear();
  }
  lastRecorded.set(key, now);
}

// Renvoie vrai si une ligne a été écrite. Ne lève jamais : un journal en
// panne ne change pas la réponse.
export async function journalAccessRefusal(pathname: string, now: number = Date.now()): Promise<boolean> {
  const refused = refusedRoute(pathname);
  if (!refused) return false;
  try {
    const auth = await getAuthContext();
    if (auth.status !== "authenticated" || !auth.user.organizationId) return false;
    const key = `${auth.user.id}:${refused.route}`;
    const last = lastRecorded.get(key);
    if (last !== undefined && now - last < THROTTLE_MS) return false;
    remember(key, now);
    await recordAudit(appDatabase(), {
      organizationId: auth.user.organizationId,
      action: "hub.access.refused",
      objectId: refused.objectId,
      details: { route: refused.route },
      actor: { kind: "member", id: auth.user.id },
    });
    return true;
  } catch (error) {
    console.error("refus d'accès non journalisé", error instanceof Error ? error.name : "erreur");
    return false;
  }
}

// Réponse d'une route pour un objet introuvable : la même pour « inexistant »
// et « d'une autre organisation » (SEC-13), et le refus journalisé.
export async function refusedResponse(request: Request): Promise<Response> {
  await journalAccessRefusal(new URL(request.url).pathname);
  return new Response(null, { status: 404 });
}
