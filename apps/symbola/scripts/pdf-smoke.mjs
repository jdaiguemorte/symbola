// Vérification de l'image Docker (CI, job « Build image + Trivy ») : la sortie
// standalone sait générer un PDF avec les polices standard (Helvetica…).
// Lancé depuis le dossier de server.js, dans l'image construite :
//   docker run --rm -v "$PWD/apps/symbola/scripts/pdf-smoke.mjs:/tmp/pdf-smoke.mjs:ro" \
//     -w /app/apps/symbola --entrypoint node <image> /tmp/pdf-smoke.mjs
// Échoue si pdfkit ne trouve pas ses polices (constaté au déploiement du
// staging, lot 6 : next.config.ts, outputFileTracingIncludes).
import path from "node:path";
import { createRequire } from "node:module";

const requireFromApp = createRequire(path.join(process.cwd(), "server.js"));
const React = requireFromApp("react");
const { renderToBuffer, Document, Page, Text } = requireFromApp("@react-pdf/renderer");

const page = React.createElement(
  Page,
  { size: "A4" },
  React.createElement(Text, { style: { fontFamily: "Helvetica" } }, "Élodie & Inès"),
  React.createElement(Text, { style: { fontFamily: "Helvetica-Bold" } }, "Total : 1 500,00 €"),
);

renderToBuffer(React.createElement(Document, null, page))
  .then((buffer) => {
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("sortie qui n'est pas un PDF");
    console.log(`PDF généré (${buffer.length} octets)`);
  })
  .catch((error) => {
    console.error("Génération PDF impossible dans l'image :", error instanceof Error ? error.message : error);
    process.exit(1);
  });
