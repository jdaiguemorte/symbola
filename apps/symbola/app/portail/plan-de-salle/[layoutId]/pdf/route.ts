// Lot 60 (L60-PLA-05) — la version diffusée du plan de salle en PDF, par le lien (client) : accès relu
// à chaque demande (link-access.ts) ; un plan d'un autre évènement répond comme un absent.
import { getLocale } from "next-intl/server";
import { sharedFloorplanPdfResponse } from "@/app/plans-de-salle/link-access";

export async function GET(_request: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const { layoutId } = await params;
  return sharedFloorplanPdfResponse("client", layoutId, (await getLocale()) === "en" ? "en" : "fr");
}
