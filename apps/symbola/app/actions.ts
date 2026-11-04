"use server";

import { createAppConnection } from "@symbola/db/client";
import { hideFirstSteps, InvalidHelpItemError, markTourSeen, recordHelpProgress } from "@/modules/hub/service";
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

// Lot 10 (AIDE-05 à AIDE-07) — progression d'une visite ou d'un tutoriel.
export async function recordHelpProgressAction(itemKey: string, status: "started" | "postponed" | "completed", step: number): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return;
  const { sql, db } = createAppConnection();
  try {
    await recordHelpProgress(db, { userId: auth.user.id, itemKey, status, step });
  } catch (error) {
    if (!(error instanceof InvalidHelpItemError)) throw error;
  } finally {
    await sql.end();
  }
}
