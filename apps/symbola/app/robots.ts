// Lot 26a (SEC-17) — Symbola est une application, pas un site : aucun robot
// n'a à parcourir ses pages, et les pages à lien personnel encore moins (elles
// portent en plus X-Robots-Tag: noindex).
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
