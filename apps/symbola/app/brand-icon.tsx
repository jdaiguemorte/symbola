// Lot 29a (ARC-09, décision D7) — icône de l'application, dessinée par next/og (inclus dans
// Next) à partir du logo du cadre de l'app (app-shell.tsx, mêmes cercles).
import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "./brand-colors";

// size : côté de l'image ; scale : part occupée par le logo (une icône « maskable » le
// garde dans la zone sûre) ; background : fond plein, ou transparent.
export function brandIcon(size: number, scale: number, background: string | null): ImageResponse {
  const mark = Math.round(size * scale);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: background ?? "transparent",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="26" fill="none" stroke={BRAND_COLORS.primary} strokeWidth="3" />
          <circle cx="22" cy="28" r="11" fill="none" stroke={BRAND_COLORS.ink} strokeWidth="3" />
          <circle cx="34" cy="28" r="11" fill="none" stroke={BRAND_COLORS.primary} strokeWidth="3" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
