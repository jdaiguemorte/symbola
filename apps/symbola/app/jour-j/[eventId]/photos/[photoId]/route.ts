// Lot 51 (JRJ-06, JRJ-07, JRJ-09 ; ADR 0027, DPO-9) — une photo du jour J, servie par l'app après le
// contrôle des droits (équipe de l'organisation, évènement ouvert au jour J), jamais en cache. Les
// photos restent internes : ni client ni prestataire n'y accèdent.
import { fileDownloadResponse } from "@/lib/file-response";
import { isValidId } from "@/app/events/module-access";
import { readDayPhoto } from "@/modules/events/service";
import { dayOfAccess } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string; photoId: string }> }): Promise<Response> {
  const { eventId, photoId } = await params;
  const access = await dayOfAccess(request, eventId, { write: false });
  if (!access.ok) return access.response;
  if (!isValidId(photoId)) return new Response(null, { status: 404 });
  // Lot 52 (D3) : le reçu d'une remise d'argent reste fermé au renfort.
  const file = await readDayPhoto(access.organizationId, eventId, photoId, { withoutHandovers: access.viewer.kind === "helper" });
  return file ? fileDownloadResponse(file, { inline: true }) : new Response(null, { status: 404 });
}
