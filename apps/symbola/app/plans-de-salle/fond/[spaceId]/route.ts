// Lot 60 (D4, ADR 0027) — le fond de plan d'un espace, pour l'équipe : session, organisation, module
// Plans de salle et module dont dépend l'espace (et, pour un évènement, sa visibilité) vérifiés ;
// image servie par l'app, jamais mise en cache. Un espace d'ailleurs répond comme un absent.
import { refusedResponse } from "@/lib/access-refusals";
import { fileDownloadResponse } from "@/lib/file-response";
import { FloorplanNotFoundError, getSpace, getSpaceBackground } from "@/modules/floorplans/service";
import { isValidId } from "@/app/events/module-access";
import { canSeeFloorplanEvent, floorplansAccess } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }): Promise<Response> {
  const { spaceId } = await params;
  if (!isValidId(spaceId)) return new Response(null, { status: 404 });
  const access = (await floorplansAccess("vendors")) ?? (await floorplansAccess("events"));
  if (!access) return new Response(null, { status: 404 });
  const found = await getSpace(access.organizationId, spaceId);
  if (!found) return refusedResponse(request);
  const dependsOn = found.space.eventId ? "events" : "vendors";
  const scoped = await floorplansAccess(dependsOn);
  if (!scoped || (found.space.eventId && !(await canSeeFloorplanEvent(scoped, found.space.eventId)))) return refusedResponse(request);
  try {
    return fileDownloadResponse(await getSpaceBackground(access.organizationId, spaceId), { inline: true });
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return refusedResponse(request);
    throw error;
  }
}
