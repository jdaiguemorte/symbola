// HUB-03 — garde-fou commun à toutes les routes /admin/*. L'Admin
// n'accède jamais aux données métier d'une organisation (voir
// modules/hub) : ce garde-fou ne fait que vérifier le rôle, rien de plus.
import { redirect } from "next/navigation";
import { getAuthContext } from "./auth-context";

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.user.role !== "admin") redirect("/");
  return { userId: auth.user.id, email: auth.user.email };
}
