// Lot 51 (ARC-09, JRJ-05 à JRJ-09 ; D3, D5, D7, ADR 0091) — la file d'actions du jour J, reçue du
// téléphone par lots, dans l'ordre. Chaque action a son identifiant créé sur l'appareil : une action
// déjà reçue est ignorée (« duplicate »), ce qui permet de rejouer la file sans risque. L'auteur est
// la personne de la session (une action faite hors ligne ne part qu'avec la session de son auteur).
// Un décalage validé est appliqué, diffusé, puis les prestataires concernés sont prévenus une fois.
import type { DayActionOutcome } from "@symbola/contracts";
import { applyDayAction } from "@/modules/events/service";
import { recordDayHandover } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { renderRecipientProgramPdf } from "@/app/events/[id]/programme/render-program-pdf";
import { dayActionBatchSchema, DAY_ACTIONS_BODY_MAX_BYTES } from "@/lib/day-of/action-schema";
import { deviceInstant } from "@/modules/events/service";
import { dayOfAccess } from "../access";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  const access = await dayOfAccess(request, eventId, { write: true });
  if (!access.ok) return access.response;
  if (Number(request.headers.get("content-length") ?? "0") > DAY_ACTIONS_BODY_MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > DAY_ACTIONS_BODY_MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = dayActionBatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const { organizationId, userId, event } = access;
  const now = new Date();
  const outcomes: DayActionOutcome[] = [];
  for (const action of parsed.data.actions) {
    if (action.kind === "handover") {
      // JRJ-09 : la remise est tenue par le module Budget (dégradation propre s'il n'est pas souscrit).
      const at = deviceInstant(action.deviceAt, now);
      if (!at || !(await isBudgetModuleEnabled(organizationId))) {
        outcomes.push({ actionId: action.actionId, status: "rejected", reason: at ? "module" : "time" });
        continue;
      }
      const status = await recordDayHandover({ organizationId, eventId, paymentId: action.paymentId, userId, actionId: action.actionId, handedOverAt: at, timeZone: event.timeZone });
      outcomes.push(status === "not_found" ? { actionId: action.actionId, status: "rejected", reason: "payment" } : { actionId: action.actionId, status });
      continue;
    }
    const result = await applyDayAction({ organizationId, eventId, userId, action, now, renderDocument: (document) => renderRecipientProgramPdf(organizationId, document) });
    outcomes.push({ actionId: action.actionId, status: result.status, ...(result.reason ? { reason: result.reason } : {}) });
  }
  return Response.json({ outcomes }, { headers: { "Cache-Control": "no-store" } });
}
