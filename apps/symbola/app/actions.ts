"use server";

import { createAppConnection } from "@symbola/db/client";
import { hideFirstSteps, markTourSeen } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";

export async function markTourSeenAction(moduleKey: string): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return;

  const { sql, db } = createAppConnection();
  try {
    await markTourSeen(db, auth.user.id, moduleKey);
  } finally {
    await sql.end();
  }
}

export async function hideFirstStepsAction(): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return;

  const { sql, db } = createAppConnection();
  try {
    await hideFirstSteps(db, auth.user.id);
  } finally {
    await sql.end();
  }
}
