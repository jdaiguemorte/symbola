// Lot 38a (MSG-01, HUB-18 ; D4 ; ADR 0072) — mise en page d'un e-mail, en HTML et en texte : en
// tête le logo (joint à l'e-mail, référencé par « cid: ») ou le nom de l'expéditeur ; un bandeau à
// sa couleur ; les paragraphes et le bouton ; en pied ses coordonnées et une mention. Tableaux et
// styles en ligne : ce que les messageries affichent partout. Tout texte est échappé ; seules les
// adresses http(s) deviennent des liens.
export type MailBlock = { kind: "paragraph"; text: string } | { kind: "button"; url: string; label: string };

export type MailLayout = {
  lang: "fr" | "en";
  subject: string;
  senderName: string;
  // Référence de la pièce jointe en ligne du logo ; null : le nom à la place.
  logoCid: string | null;
  // Couleur lisible sur blanc (#rrggbb) et couleur du texte posé dessus.
  accent: string;
  textOnAccent: string;
  blocks: MailBlock[];
  footerLines: string[];
  footerNote: string;
  // « Essai » : bandeau au-dessus du message (D7).
  banner?: string | null;
};

const INK = "#1f1c1a";
const MUTED = "#6b6560";
const PAGE = "#f5f3f1";
const COLOR = /^#[0-9a-fA-F]{6}$/;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeColor(value: string, fallback: string): string {
  return COLOR.test(value) ? value : fallback;
}

function safeUrl(url: string): string | null {
  return /^https?:\/\/[^\s"<>]+$/.test(url) ? url : null;
}

// Paragraphe : échappé, adresses http(s) cliquables, sauts de ligne gardés.
function paragraphHtml(text: string, accent: string): string {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${accent};text-decoration:underline">${url}</a>`)
    .replace(/\n/g, "<br>");
}

export function renderMailHtml(layout: MailLayout): string {
  const accent = safeColor(layout.accent, INK);
  const onAccent = safeColor(layout.textOnAccent, "#ffffff");
  const header = layout.logoCid
    ? `<img src="cid:${escapeHtml(layout.logoCid)}" alt="${escapeHtml(layout.senderName)}" style="display:block;max-height:56px;max-width:220px;border:0">`
    : `<span style="font-size:20px;font-weight:600;color:${accent}">${escapeHtml(layout.senderName)}</span>`;
  const blocks = layout.blocks
    .map((block) => {
      if (block.kind === "paragraph") return `<p style="margin:0 0 16px;line-height:1.55">${paragraphHtml(block.text, accent)}</p>`;
      const url = safeUrl(block.url);
      if (!url) return "";
      return `<p style="margin:8px 0 24px"><a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:6px;background:${accent};color:${onAccent};font-weight:600;text-decoration:none">${escapeHtml(block.label)}</a></p><p style="margin:0 0 16px;font-size:12px;color:${MUTED};word-break:break-all">${escapeHtml(url)}</p>`;
    })
    .join("");
  const banner = layout.banner ? `<p style="margin:0 0 16px;padding:8px 12px;border-radius:4px;background:#fff4d6;color:${INK};font-weight:600">${escapeHtml(layout.banner)}</p>` : "";
  const footer = [...layout.footerLines.map((line) => escapeHtml(line)), `<span style="color:${MUTED}">${escapeHtml(layout.footerNote)}</span>`].join("<br>");
  return [
    `<!DOCTYPE html><html lang="${layout.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(layout.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${PAGE};font-family:Helvetica,Arial,sans-serif;color:${INK};font-size:15px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;border-top:4px solid ${accent}">`,
    `<tr><td style="padding:24px 28px 8px">${header}</td></tr>`,
    `<tr><td style="padding:16px 28px 8px">${banner}${blocks}</td></tr>`,
    `<tr><td style="padding:16px 28px 24px;border-top:1px solid #e7e3df;font-size:12px;line-height:1.6;color:${INK}">${footer}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");
}

// Version texte : le bouton devient son intitulé puis l'adresse, sur deux lignes.
export function renderMailText(layout: MailLayout): string {
  const body = layout.blocks.map((block) => (block.kind === "paragraph" ? block.text : `${block.label}\n${block.url}`)).join("\n\n");
  const banner = layout.banner ? `${layout.banner}\n\n` : "";
  const footer = [...layout.footerLines, layout.footerNote].join("\n");
  return `${banner}${body}\n\n--\n${footer}\n`;
}
