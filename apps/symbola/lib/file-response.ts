// ADR 0027 — réponse d'un fichier privé servi par l'app, après les
// contrôles de session, d'organisation et de rôle faits par la route.
// En téléchargement (comme les autres PDF de l'app), jamais mis en cache, type
// déclaré respecté par le navigateur. Lot 29b (JRJ-04) : un document du jour J
// s'ouvre dans le navigateur (inline), pour se lire sur le téléphone ; son type
// est déjà vérifié par le contenu à l'envoi (PDF ou image).
import type { FileDownload } from "@symbola/contracts";

export function fileDownloadResponse(file: FileDownload, options: { inline?: boolean } = {}): Response {
  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": `${options.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
