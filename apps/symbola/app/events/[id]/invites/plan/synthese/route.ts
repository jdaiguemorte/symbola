// Lot 50 (INV-06 ; D6 à D8 ; SEC-12, SEC-13) — téléchargement de la synthèse pour le traiteur, PDF ou
// tableur. Contrôles côté serveur : session, organisation, modules Évènements et Invités, rôle
// (la version nominative pour la titulaire seule : un membre qui la demande reçoit la version sans
// nom), évènement et temps fort de l'organisation. Le fichier est calculé à la demande, jamais rangé ;
// le téléchargement est tracé sans contenu. Une erreur ne dit rien d'un évènement d'une autre
// organisation (404). Textes dans la langue de l'organisation.
import { z } from "zod";
import { CATERER_SUMMARY_FORMATS, CATERER_SUMMARY_VERSIONS } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { refusedResponse } from "@/lib/access-refusals";
import { downloadCatererSummary, renderCatererSummary } from "@/modules/guests/service";
import { listOrganizations } from "@/modules/hub/service";
import { guestErrorKey } from "../../form-schemas";
import { guestsAccess } from "../../access";

const querySchema = z.object({
  id: z.uuid(),
  temps: z.uuid(),
  format: z.enum(CATERER_SUMMARY_FORMATS),
  version: z.enum(CATERER_SUMMARY_VERSIONS).default("aggregate"),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const access = await guestsAccess();
  if (!access) return new Response(null, { status: 404 });
  const search = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ id: (await params).id, temps: search.get("temps"), format: search.get("format"), version: search.get("version") ?? undefined });
  if (!parsed.success) return new Response(null, { status: 404 });
  const organization = (await listOrganizations(appDatabase())).find((row) => row.id === access.organizationId);
  const locale = organization?.language === "en" ? "en" : "fr";
  let summary;
  try {
    summary = await downloadCatererSummary({
      organizationId: access.organizationId,
      userId: access.userId,
      viewer: access.viewer,
      eventId: parsed.data.id,
      keyMomentId: parsed.data.temps,
      requested: parsed.data.version,
      format: parsed.data.format,
      locale,
    });
  } catch (error) {
    if (guestErrorKey(error)) return refusedResponse(request);
    throw error;
  }
  const file = await renderCatererSummary(summary, parsed.data.format, locale);
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
