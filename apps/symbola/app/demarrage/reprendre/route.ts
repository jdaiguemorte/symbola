// Lot 74a (HUB-09, PAR-01 ; critère 2) — l'accueil d'une titulaire dont l'assistant n'est pas fini passe ici une
// fois par session : le témoin est posé, puis l'assistant s'ouvre à la question où elle s'est arrêtée. Rien
// n'est lu ni écrit en base ; l'assistant refait ses contrôles (session, titulaire). Sans session de titulaire,
// aucun témoin : la page de l'assistant dit ce qu'il faut.
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import { secureCookies } from "@/lib/cookie-security";
import { ONBOARDING_RESUMED_COOKIE, sessionMark } from "@/lib/onboarding/resume";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Adresse relative (RFC 9110) : la même origine que l'accueil, derrière le mandataire comme en local.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/demarrage" } });
  const auth = await getAuthContext();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // Témoin de session : il disparaît à la fermeture du navigateur.
  if (auth.status === "authenticated" && auth.user.role === "owner" && token) {
    response.cookies.set(ONBOARDING_RESUMED_COOKIE, sessionMark(token), { path: "/", sameSite: "lax", httpOnly: true, secure: secureCookies() });
  }
  return response;
}
