// Lot 11 (ADR 0031 § 7) — fond de carte servi par l'app, en lecture par
// plages (PMTiles) : session de l'équipe vérifiée, jamais de service tiers
// appelé par le navigateur. Le worker de MapLibre est un fichier statique
// (public/maplibre), pas cette route.
import { open, stat } from "node:fs/promises";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { parseRange, resolveTileFile } from "@/lib/map/tiles";

// Au-delà, le navigateur redemande la suite : PMTiles lit par petits blocs.
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const file = resolveTileFile((await params).path);
  if (!file) return new Response(null, { status: 404 });
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response(null, { status: 404 });
  }
  const isFont = file.endsWith(".pbf");
  const contentType = isFont ? "application/x-protobuf" : "application/octet-stream";
  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const start = range?.start ?? 0;
  const end = Math.min(range?.end ?? size - 1, start + MAX_CHUNK_BYTES - 1);
  if (!range && size > MAX_CHUNK_BYTES) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(end - start + 1);
    await handle.read(buffer, 0, buffer.length, start);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400",
    };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    return new Response(new Uint8Array(buffer), { status: range ? 206 : 200, headers });
  } finally {
    await handle.close();
  }
}
