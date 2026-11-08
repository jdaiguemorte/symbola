"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { clearSessionCookie, getSessionToken } from "@/lib/auth-context";

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) {
    const db = appDatabase();
    await destroySession(db, token);
  }
  await clearSessionCookie();
  redirect("/login");
}
