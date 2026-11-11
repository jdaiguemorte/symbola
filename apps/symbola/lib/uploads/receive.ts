// Lot 16 (L16-SEC-02, ADR 0044) — réception d'un envoi de fichier par une route
// dédiée, hors des actions serveur (dont la limite revient à 1 Mo). Dans
// l'ordre, avant de lire le corps : même origine (comme les actions serveur),
// session de l'équipe, limite de débit, taille annoncée. Le corps est ensuite
// lu en flux et coupé dès qu'il dépasse la limite, même sans taille annoncée.
import { getLocale, getTranslations } from "next-intl/server";
import { formatFileSize, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import type { OrganizationUser } from "@/lib/guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import type { UploadState } from "./state";

// Un fichier de 20 Mo (devis, fiche, export) et la place des autres champs :
// la limite qu'avaient toutes les actions serveur jusqu'au lot 16.
export const UPLOAD_BODY_MAX_BYTES = 21 * 1024 * 1024;

export type ReceivedUpload = { ok: true; user: OrganizationUser; formData: FormData } | { ok: false; response: Response };

export function uploadResponse(state: UploadState, status = 200): Response {
  return Response.json(state, { status, headers: { "Cache-Control": "no-store" } });
}

// Même règle que les actions serveur de Next.js : l'origine de la page qui
// envoie doit être celle de l'app.
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function boundedBody(body: ReadableStream<Uint8Array>, maxBytes: number, onExceeded: () => void): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          onExceeded();
          controller.error(new Error("corps de l'envoi trop lourd"));
        } else controller.enqueue(chunk);
      },
    }),
  );
}

export async function receiveUpload(request: Request, maxBytes: number = UPLOAD_BODY_MAX_BYTES): Promise<ReceivedUpload> {
  const t = await getTranslations("Upload");
  const refuse = (state: UploadState, status: number): ReceivedUpload => ({ ok: false, response: uploadResponse(state, status) });
  if (!isSameOrigin(request.headers)) return refuse({ error: t("refused") }, 403);

  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return refuse({ error: t("unauthenticated") }, 401);

  const limited = await checkRateLimit("upload", { account: auth.user.id, headers: request.headers });
  if (!limited.allowed) return { ok: false, response: await rateLimitedResponse(limited) };

  const tooLarge = async () => refuse({ error: t("tooLarge", { max: formatFileSize(maxBytes, (await getLocale()) as Locale) }) }, 413);
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) return tooLarge();
  if (!request.body) return refuse({ error: t("failed") }, 400);

  let exceeded = false;
  try {
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: boundedBody(request.body, maxBytes, () => {
        exceeded = true;
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const formData = await bounded.formData();
    return { ok: true, user: { ...auth.user, organizationId: auth.user.organizationId }, formData };
  } catch {
    return exceeded ? tooLarge() : refuse({ error: t("failed") }, 400);
  }
}
