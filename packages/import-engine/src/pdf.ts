// Lot 14 (ADR 0034) — lecture du texte d'un PDF avec sa position, pour les
// fiches exportées par un logiciel tiers. Côté serveur seulement : aucun
// rendu, aucune police ni ressource chargée depuis le réseau, scripts et
// formulaires (XFA) ignorés ; la version 6 de pdfjs n'évalue plus jamais de
// code (chemin de la faille CVE-2024-4367 retiré). Taille, nombre de pages
// et durée bornés ; le fichier n'est jamais gardé.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfTextItem = {
  text: string;
  // Coin haut-gauche, en points, mesuré depuis le haut de la page.
  x: number;
  y: number;
  width: number;
  size: number;
};

export type PdfPage = { width: number; height: number; items: PdfTextItem[] };

export type PdfLimits = { maxBytes: number; maxPages: number; timeoutMs: number };

export const DEFAULT_PDF_LIMITS: PdfLimits = { maxBytes: 10 * 1024 * 1024, maxPages: 3, timeoutMs: 10_000 };

export type PdfFailureReason = "not_pdf" | "too_large" | "encrypted" | "too_many_pages" | "no_text" | "unreadable" | "timeout";

export type PdfReadResult = { ok: true; pages: PdfPage[] } | { ok: false; reason: PdfFailureReason };

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export function looksLikePdf(bytes: Uint8Array): boolean {
  // La signature peut être précédée de quelques octets (tolérance usuelle des lecteurs : 1 Ko).
  const window = Math.min(bytes.length, 1024);
  outer: for (let start = 0; start + PDF_SIGNATURE.length <= window; start += 1) {
    for (let index = 0; index < PDF_SIGNATURE.length; index += 1) {
      if (bytes[start + index] !== PDF_SIGNATURE[index]) continue outer;
    }
    return true;
  }
  return false;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readPdfText(bytes: Uint8Array, limits: PdfLimits = DEFAULT_PDF_LIMITS): Promise<PdfReadResult> {
  if (bytes.length > limits.maxBytes) return { ok: false, reason: "too_large" };
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not_pdf" };

  // pdfjs prend la main sur le tampon : on lui en donne une copie.
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    enableXfa: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    isOffscreenCanvasSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: true,
    verbosity: 0,
  });
  try {
    const outcome = await withTimeout(
      (async (): Promise<PdfReadResult> => {
        let document;
        try {
          document = await task.promise;
        } catch (error) {
          return { ok: false, reason: error instanceof Error && error.name === "PasswordException" ? "encrypted" : "unreadable" };
        }
        if (document.numPages > limits.maxPages) return { ok: false, reason: "too_many_pages" };
        const pages: PdfPage[] = [];
        for (let number = 1; number <= document.numPages; number += 1) {
          const page = await document.getPage(number);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const items: PdfTextItem[] = [];
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const size = Math.abs(item.transform[3] as number) || item.height;
            items.push({
              text: item.str,
              x: item.transform[4] as number,
              // La ligne de base est mesurée depuis le bas : on la ramène en haut de ligne.
              y: viewport.height - (item.transform[5] as number) - size,
              width: item.width,
              size,
            });
          }
          pages.push({ width: viewport.width, height: viewport.height, items });
        }
        if (pages.every((page) => page.items.length === 0)) return { ok: false, reason: "no_text" };
        return { ok: true, pages };
      })(),
      limits.timeoutMs,
    );
    return outcome === "timeout" ? { ok: false, reason: "timeout" } : outcome;
  } finally {
    await task.destroy();
  }
}
