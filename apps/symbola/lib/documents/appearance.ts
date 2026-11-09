// Lot 17 (DEV-09, ADR 0046) — couleurs d'un document à partir de la couleur
// choisie : lisibles quelle que soit la couleur (décision D). Fonctions pures,
// partagées par le PDF et par l'aperçu de l'écran Documents, pour que les
// deux montrent exactement les mêmes couleurs.
import type { DocumentFont } from "@symbola/contracts";

export type DocumentAppearance = {
  // Titres, filets, intitulés : contraste d'au moins 4,5:1 sur le blanc.
  accent: string;
  // Texte posé sur l'accent (bandeau du total) : blanc ou encre.
  onAccent: string;
  // Fond léger des blocs « De » et « Pour ».
  tint: string;
  font: DocumentFont;
};

export const DOCUMENT_INK = "#1f1c1a";
const WHITE = "#ffffff";
export const MIN_TEXT_CONTRAST = 4.5;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function toHex(values: number[]): string {
  return `#${values.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("")}`;
}

// Luminance relative (WCAG 2.x).
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

// Assombrit par pas de 12 % jusqu'au contraste voulu sur le blanc.
export function readableOnWhite(hex: string): string {
  let color = hex.toLowerCase();
  for (let step = 0; step < 24 && contrastRatio(color, WHITE) < MIN_TEXT_CONTRAST; step++) {
    color = toHex(channels(color).map((value) => value * 0.88));
  }
  return color;
}

export function textOn(hex: string): string {
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, DOCUMENT_INK) ? WHITE : DOCUMENT_INK;
}

// Mélange avec le blanc (amount = part de la couleur).
export function tintOf(hex: string, amount = 0.09): string {
  return toHex(channels(hex).map((value) => value * amount + 255 * (1 - amount)));
}

// couleur null : la couleur neutre de départ (documents antérieurs au lot 17
// et organisations qui n'ont rien choisi).
export function documentAppearance(color: string | null | undefined, font: DocumentFont | null | undefined, defaultColor: string): DocumentAppearance {
  let accent = readableOnWhite(color && /^#[0-9a-f]{6}$/i.test(color) ? color : defaultColor);
  // Les intitulés « De » et « Pour » sont posés sur la teinte : même seuil.
  for (let step = 0; step < 24 && contrastRatio(accent, tintOf(accent)) < MIN_TEXT_CONTRAST; step++) {
    accent = toHex(channels(accent).map((value) => value * 0.88));
  }
  return { accent, onAccent: textOn(accent), tint: tintOf(accent), font: font === "classic" ? "classic" : "modern" };
}
