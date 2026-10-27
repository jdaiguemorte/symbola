// Période demandée (paramètres d'URL validés par Zod) ; par défaut, la
// période bimestrielle en cours à Paris.
import { z } from "zod";
import { parisTodayString } from "../quote-display";
import { bimonthlyPeriods } from "./csv";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function requestedPeriod(params: { from?: string | undefined; to?: string | undefined }): { from: string; to: string } {
  const from = dateSchema.safeParse(params.from);
  const to = dateSchema.safeParse(params.to);
  if (from.success && to.success) return { from: from.data, to: to.data };
  const today = parisTodayString();
  return bimonthlyPeriods(Number(today.slice(0, 4))).find((period) => period.from <= today && today <= period.to)!;
}
