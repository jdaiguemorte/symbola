"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { clearSessionCookie, getSessionToken } from "@/lib/auth-context";

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) {
    const { sql, db } = createAppConnection();
    try {
      await destroySession(db, token);
    } finally {
      await sql.end();
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
