"use server";

import { cookies } from "next/headers";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";

// Lot 10 (AIDE-05) — préférence d'affichage, un an, sans donnée personnelle.
export async function setAutoToursAction(enabled: boolean): Promise<void> {
  (await cookies()).set(AUTO_TOURS_COOKIE, enabled ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
