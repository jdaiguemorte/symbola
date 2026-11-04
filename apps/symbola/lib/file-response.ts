// ADR 0027 — réponse d'un fichier privé servi par l'app, après les
// contrôles de session, d'organisation et de rôle faits par la route.
// Toujours en téléchargement (comme les autres PDF de l'app), jamais mis en
// cache, type déclaré respecté par le navigateur.
import type { FileDownload } from "@symbola/contracts";

export function fileDownloadResponse(file: FileDownload): Response {
  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
