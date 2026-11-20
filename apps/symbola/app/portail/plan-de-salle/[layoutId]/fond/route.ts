// Lot 60 (D4, ADR 0027) — le fond de plan de la version diffusée, par le lien (client).
import { sharedFloorplanBackgroundResponse } from "@/app/plans-de-salle/link-access";

export async function GET(_request: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const { layoutId } = await params;
  return sharedFloorplanBackgroundResponse("client", layoutId);
}
