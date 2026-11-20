// Lot 55 (POR-11 ; ADR 0102) — icône du portail installé : le logo de l'organisation (celui de ses
// documents et de ses e-mails), désignée par son identifiant non devinable ; sinon l'icône de Symbola.
import { isValidId } from "@/app/events/module-access";
import { organizationLogoResponse } from "@/app/logo/logo-response";

export async function GET(request: Request, { params }: { params: Promise<{ organisation: string }> }): Promise<Response> {
  const { organisation } = await params;
  const fallback = () => Response.redirect(new URL("/icons/512.png", request.url), 302);
  if (!isValidId(organisation)) return fallback();
  const response = await organizationLogoResponse(organisation);
  return response.ok ? response : fallback();
}
