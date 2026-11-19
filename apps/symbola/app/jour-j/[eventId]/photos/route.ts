// Lot 51 (JRJ-06, JRJ-07, JRJ-09, ARC-09 ; ADR 0027, ADR 0091) — une photo de la file du jour J,
// réduite sur le téléphone puis envoyée au retour du réseau. Reçue comme tout envoi (même origine,
// session, débit, taille), puis contrôlée à l'arrivée (taille, antivirus, type par le contenu) : une
// photo refusée est signalée et l'incident, la case ou la remise restent. Une action rejouée est
// ignorée. Le reçu d'une remise se rattache à l'échéance du module Budget.
import { attachDayHandoverReceipt, isDayHandoverPayment } from "@/modules/budget/service";
import { dayOfSettings, receiveDayPhoto } from "@/modules/events/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { dayPhotoMetaSchema } from "@/lib/day-of/action-schema";
import { receiveUpload } from "@/lib/uploads/receive";
import { dayOfAccess } from "../access";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  const settings = dayOfSettings("fr");
  const received = await receiveUpload(request, settings.photoMaxBytes + 64 * 1024);
  if (!received.ok) return received.response;
  const access = await dayOfAccess(request, eventId, { write: true });
  if (!access.ok) return access.response;
  let meta;
  try {
    meta = dayPhotoMetaSchema.parse(JSON.parse(String(received.formData.get("meta") ?? "")));
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const { organizationId, userId, linkId } = access;
  if (meta.subject === "handover") {
    // Lot 52 (D3) : le reçu d'une remise d'argent n'est pas du ressort du renfort.
    if (linkId) return Response.json({ actionId: meta.actionId, status: "rejected", reason: "scope" });
    if (!(await isBudgetModuleEnabled(organizationId)) || !meta.subjectId || !(await isDayHandoverPayment(organizationId, eventId, meta.subjectId))) {
      return Response.json({ actionId: meta.actionId, status: "rejected", reason: "subject" });
    }
  }
  const file = received.formData.get("photo");
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null;
  const result = await receiveDayPhoto({ organizationId, eventId, userId, linkId, meta, bytes, maxBytes: settings.photoMaxBytes });
  if (result.status === "applied" && result.photo?.state === "stored" && meta.subject === "handover" && meta.subjectId) {
    await attachDayHandoverReceipt({ organizationId, eventId, paymentId: meta.subjectId, photoId: result.photo.id });
  }
  return Response.json(
    { actionId: meta.actionId, status: result.status, ...(result.reason ? { reason: result.reason } : {}), photo: result.photo ? { id: result.photo.id, state: result.photo.state, rejection: result.photo.rejection } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
