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

// Lot 37a (DOC-01, D5 ; ADR 0070) — l'aperçu sans téléchargement : un PDF ou une image
// (types vérifiés par le contenu à l'envoi) s'affiche dans le navigateur quand l'adresse demande
// « ?apercu=1 », dans son propre onglet (l'app interdit d'être encadrée : X-Frame-Options DENY,
// frame-ancestors 'none'). Tout autre type se télécharge.
const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

export function isPreviewableMime(mime: string | null | undefined): boolean {
  return Boolean(mime && PREVIEWABLE.has(mime));
}

export function wantsPreview(request: Request): boolean {
  return new URL(request.url).searchParams.get("apercu") === "1";
}

export function fileResponse(file: FileDownload, request: Request): Response {
  return fileDownloadResponse(file, { inline: wantsPreview(request) && isPreviewableMime(file.contentType) });
}

// Adresse d'aperçu d'une route de fichier (le paramètre s'ajoute à ceux qu'elle a déjà).
export function previewPath(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}apercu=1`;
}
