// Lot 60 (L60-PLA-05 ; D8, POR-10, SEC-14 à SEC-17) — le plan de salle par un lien personnel : la
// session du lien (relue à chaque requête), les modules Évènements et Plans de salle ouverts ; pour un
// client, la rubrique « Plan de salle » ouverte sur son lien (fermée par défaut) ; pour un
// prestataire, son statut retenu (vérifié par le service). L'évènement est toujours celui du lien.
import type { LinkAccess } from "@/modules/events/service";
import { downloadSharedFloorplanPdf, FloorplanNotFoundError, sharedFloorplanBackground, type FloorplanLinkAccess } from "@/modules/floorplans/service";
import { currentLinkAccess } from "@/lib/link-session";
import { fileDownloadResponse } from "@/lib/file-response";
import { isValidId } from "@/app/events/module-access";
import { isFloorplansAvailable } from "./access";

export function floorplanRubricOpen(access: Pick<LinkAccess, "audience" | "rights">): boolean {
  return access.audience === "client" && access.rights.rubrics.includes("floorplan");
}

export async function linkFloorplanAccess(audience: "vendor" | "client", given?: LinkAccess | null): Promise<FloorplanLinkAccess | null> {
  const access = given === undefined ? await currentLinkAccess() : given;
  if (!access || access.audience !== audience) return null;
  if (audience === "client" && !floorplanRubricOpen(access)) return null;
  if (!(await isFloorplansAvailable(access.organizationId, "events"))) return null;
  return { organizationId: access.organizationId, eventId: access.eventId, linkId: access.linkId, audience, vendorCandidateId: access.vendorCandidateId };
}

const PRIVATE_HEADERS = { "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer" };

export async function sharedFloorplanPdfResponse(audience: "vendor" | "client", layoutId: string, locale: "fr" | "en"): Promise<Response> {
  const access = isValidId(layoutId) ? await linkFloorplanAccess(audience) : null;
  if (!access) return new Response(null, { status: 404 });
  try {
    const file = await downloadSharedFloorplanPdf(access, layoutId, locale);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...PRIVATE_HEADERS,
      },
    });
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}

export async function sharedFloorplanBackgroundResponse(audience: "vendor" | "client", layoutId: string): Promise<Response> {
  const access = isValidId(layoutId) ? await linkFloorplanAccess(audience) : null;
  if (!access) return new Response(null, { status: 404 });
  try {
    const response = fileDownloadResponse(await sharedFloorplanBackground(access, layoutId), { inline: true });
    for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
    return response;
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
