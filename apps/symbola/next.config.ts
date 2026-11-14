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
  // Lot 16 (L16-SEC-02, ADR 0044) : ni caméra, ni micro, ni géolocalisation (la
  // carte cherche autour d'une adresse saisie, jamais de la position de
  // l'appareil) ; la fenêtre de l'app ne partage rien avec une page d'une
  // autre origine qu'elle ouvrirait ou qui l'ouvrirait.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS n'a de sens qu'en HTTPS : en dev (HTTP), l'envoyer ferait courir
  // le risque qu'un navigateur retienne une exigence HTTPS locale.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const LINK_PAGES = ["/lien", "/lien/:path*", "/portail", "/portail/:path*", "/prestataire", "/prestataire/:path*"];
const linkPageHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false, // ne pas annoncer la techno via X-Powered-By
  // postgres.js ne doit pas passer dans le bundler webpack (SOC-04 ; plus de
  // hachage de mot de passe dans l'app depuis le lot 33, ADR 0067).
  // @react-pdf/renderer (PRD-EVT-05) charge ses polices et sa mise en page
  // depuis node_modules à l'exécution : même traitement.
  serverExternalPackages: ["postgres", "@react-pdf/renderer"],
  // pdfkit (sous @react-pdf/renderer) charge ses polices standard
  // (Helvetica…) par un alias interne (`#standard-fonts/…`) que le traçage
  // de la sortie standalone ne suit pas : sans cette inclusion, l'image
  // Docker ne sait générer aucun PDF (constaté au déploiement du staging,
  // lot 6). Le CI vérifie leur présence dans l'image construite.
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**"],
  },
  // Lot 16 (L16-SEC-02, ADR 0044) : les actions serveur gardent la limite par
  // défaut de Next.js (1 Mo). Les fichiers (devis, plaquettes, imports, 20 Mo)
  // passent par des routes dédiées qui contrôlent la session et la limite de
  // débit avant de lire le corps (lib/uploads/receive.ts).
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Lot 26a (SEC-17, ADR 0053) : pages à lien personnel jamais indexées ni
      // mises en cache, sans référent vers un autre site ; ces en-têtes,
      // déclarés après, remplacent ceux du dessus.
      ...LINK_PAGES.map((source) => ({ source, headers: linkPageHeaders })),
      // Lot 29a (ARC-09, ADR 0064) : le service worker n'est jamais gardé par le cache HTTP,
      // pour qu'un déploiement (ou l'interrupteur d'arrêt) atteigne chaque appareil.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // L'écran du jour J n'est gardé que par la copie voulue (Cache Storage), jamais par le
      // cache HTTP du navigateur ; il n'est ni indexé ni cité comme référent.
      { source: "/jour-j/:path*", headers: linkPageHeaders },
    ];
  },
  // Lot 26a (ADR 0053 § 9) : l'espace des mariés par compte n'existe plus ; une
  // ancienne adresse mène à la page « lien non valable ».
  async redirects() {
    return [
      { source: "/espace", destination: "/lien", permanent: false },
      { source: "/espace/:path*", destination: "/lien", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
