// Activation de la double authentification (ADR 0028) : QR code à scanner,
// clé à saisir à la main, et lien otpauth:// complet en repli. Composant sans
// état, utilisé par l'écran /mfa (planner, Admin) et par l'espace des mariés.
import type { TotpSetupDisplay } from "@/lib/totp-qr";

const QUIET_ZONE = 4; // marge blanche réglementaire autour du QR code, en modules

export function TotpSetup({
  display,
  labels,
}: {
  display: TotpSetupDisplay;
  labels: { qr: string; manualKey: string; setupLink: string };
}) {
  const side = display.qr.size + QUIET_ZONE * 2;
  return (
    <div className="totp-setup">
      {/* Nom accessible par <title> (et non aria-label) : le champ « Code » voisin garde un libellé unique. */}
      <svg className="totp-qr" role="img" viewBox={`0 0 ${side} ${side}`} shapeRendering="crispEdges">
        <title>{labels.qr}</title>
        <rect width={side} height={side} fill="#ffffff" />
        <path d={display.qr.path} fill="#000000" transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`} />
      </svg>
      <p>
        {labels.manualKey} <span className="totp-secret">{display.secretGroups}</span>
      </p>
      <details>
        <summary>{labels.setupLink}</summary>
        <code>{display.provisioningUri}</code>
      </details>
    </div>
  );
}
