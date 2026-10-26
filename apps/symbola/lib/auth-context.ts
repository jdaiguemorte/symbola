// Plomberie HTTP (cookie) pour SOC-04 — ne contient aucune logique
// d'authentification : tout est délégué à @symbola/auth (seule porte
// d'entrée, ADR 0013). Ce fichier ne fait que lire/écrire le cookie de
// session httpOnly et appeler requireUser().
import { cookies } from "next/headers";
import { createAppConnection } from "@symbola/db/client";
import { requireUser, type AuthResult } from "@symbola/auth";

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
