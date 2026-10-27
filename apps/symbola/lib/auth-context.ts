// Plomberie HTTP (cookie) pour SOC-04 — ne contient aucune logique
// d'authentification : tout est délégué à @symbola/auth (seule porte
// d'entrée, ADR 0013). Ce fichier ne fait que lire/écrire le cookie de
// session httpOnly et appeler requireUser().
// Plomberie pure : pas d'import "next/server" ici. Importer next/server
// (after()) dans ce fichier a cassé setSessionCookie()/cookies() sur une
// requête ultérieure (login) en dev — bundling Server Actions perturbé,
// même quand after() n'était jamais exécuté. La collecte d'usage (SOC-13,
// ADR 0017) est câblée séparément, au niveau de chaque page protégée
// (voir app/page.tsx), pas ici.
import { cookies } from "next/headers";
import { createAppConnection } from "@symbola/db/client";
import { isPlannerRole, requireUser, type AuthResult } from "@symbola/auth";

export const SESSION_COOKIE_NAME = "symbola_session";

export async function getAuthContext(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const { sql, db } = createAppConnection();
  try {
    return await requireUser(db, token);
  } finally {
    await sql.end();
  }
}

// EVT-06 : écrans et actions de la planner. Un compte marié (ou l'Admin)
// y reçoit « forbidden » : le type oblige chaque page à le traiter, et
// toute action qui n'accepte que « authenticated » le refuse d'office.
export type PlannerAuthResult = AuthResult | { status: "forbidden"; role: string };

export function toPlannerAuth(result: AuthResult): PlannerAuthResult {
  if (result.status !== "authenticated") return result;
  if (!isPlannerRole(result.user.role)) return { status: "forbidden", role: result.user.role };
  return result;
}

export async function getPlannerAuthContext(): Promise<PlannerAuthResult> {
  return toPlannerAuth(await getAuthContext());
}

// EVT-06 : espace du marié, réservé au rôle « client ». L'appartenance à
// l'événement est vérifiée ensuite par le module events, à chaque requête.
export function toClientAuth(result: AuthResult): PlannerAuthResult {
  if (result.status !== "authenticated") return result;
  if (result.user.role !== "client") return { status: "forbidden", role: result.user.role };
  return result;
}

export async function getClientAuthContext(): Promise<PlannerAuthResult> {
  return toClientAuth(await getAuthContext());
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h (PRD HUB-01, proposé)
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
