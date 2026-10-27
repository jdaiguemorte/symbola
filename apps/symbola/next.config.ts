import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// En-têtes de sécurité (SOC-09, CLAUDE.md §5) — posés au niveau de l'app,
// pas seulement de Traefik, pour qu'ils tiennent même si un module est
// extrait en app autonome plus tard (ADR 0011) et change de frontal.
// La Content-Security-Policy n'est PAS ici : elle a besoin d'un nonce
// différent à chaque requête (middleware.ts) pour autoriser les scripts
// inline que Next.js injecte lui-même à l'hydratation, sans quoi l'app
// affiche un écran blanc (constaté au premier déploiement réel).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // HSTS n'a de sens qu'en HTTPS : en dev (HTTP), l'envoyer ferait courir
  // le risque qu'un navigateur retienne une exigence HTTPS locale.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false, // ne pas annoncer la techno via X-Powered-By
  // @node-rs/argon2 et postgres.js embarquent du binaire natif : Next ne
  // doit pas tenter de les passer dans le bundler webpack (SOC-04).
  // @react-pdf/renderer (EVT-05) charge ses polices et sa mise en page
  // depuis node_modules à l'exécution : même traitement.
  serverExternalPackages: ["@node-rs/argon2", "@node-rs/argon2-darwin-arm64", "postgres", "@react-pdf/renderer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
