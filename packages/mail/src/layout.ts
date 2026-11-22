// Lot 38a (MSG-01, HUB-18 ; D4 ; ADR 0072) — mise en page d'un e-mail, en HTML et en texte : en
// tête le logo (joint à l'e-mail, référencé par « cid: ») ou le nom de l'expéditeur ; un bandeau à
// sa couleur ; les paragraphes et le bouton ; en pied ses coordonnées et une mention. Tableaux et
// styles en ligne : ce que les messageries affichent partout. Tout texte est échappé ; seules les
// adresses http(s) deviennent des liens.
// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) : la police de l'organisation (quatre familles des
// messageries, repli sur une police système), la signature de la personne qui écrit (photo jointe en
// ligne, « cid: »), une mention de pied facultative (« Envoyé avec Symbola » ne reste que sur les
// e-mails de Symbola).
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
  // Nulle ou absente : pas de mention sous les coordonnées.
  footerNote?: string | null;
  // « Essai » : bandeau au-dessus du message (D7).
  banner?: string | null;
  font?: MailFont;
  signature?: MailSignature | null;
};

export type MailFont = "sans" | "serif" | "elegant" | "rounded";

// Une signature déjà composée : le nom, des lignes (fonction et organisation, téléphone et site), des
// liens (libellé et adresse) ; photoCid : la pièce jointe en ligne de la photo (nulle : sans photo).
export type MailSignature = { name: string; lines: string[]; links: { label: string; url: string }[]; photoCid: string | null };

// Familles reconnues par les messageries, chacune terminée par une police système.
export const MAIL_FONT_STACKS: Record<MailFont, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  elegant: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  rounded: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif",
};

export function mailFontStack(font: MailFont | undefined): string {
  return MAIL_FONT_STACKS[font ?? "sans"] ?? MAIL_FONT_STACKS.sans;
}

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

function signatureHtml(signature: MailSignature, accent: string): string {
  const links = signature.links
    .map((link) => {
      const url = safeUrl(link.url);
      return url ? `<a href="${url}" style="color:${accent};text-decoration:underline">${escapeHtml(link.label)}</a>` : "";
    })
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  const text = [
    `<strong style="font-size:15px">${escapeHtml(signature.name)}</strong>`,
    ...signature.lines.map((line) => `<span style="font-size:13px;color:${MUTED}">${escapeHtml(line)}</span>`),
    ...(links ? [`<span style="font-size:13px">${links}</span>`] : []),
  ].join("<br>");
  const photo = signature.photoCid
    ? `<td style="padding:0 14px 0 0;vertical-align:top"><img src="cid:${escapeHtml(signature.photoCid)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:28px;border:0;object-fit:cover"></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px"><tr>${photo}<td style="vertical-align:top;line-height:1.5">${text}</td></tr></table>`;
}

export function renderMailHtml(layout: MailLayout): string {
  const accent = safeColor(layout.accent, INK);
  const font = mailFontStack(layout.font);
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
  const signature = layout.signature ? signatureHtml(layout.signature, accent) : "";
  const footer = [...layout.footerLines.map((line) => escapeHtml(line)), ...(layout.footerNote ? [`<span style="color:${MUTED}">${escapeHtml(layout.footerNote)}</span>`] : [])].join("<br>");
  return [
    `<!DOCTYPE html><html lang="${layout.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(layout.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${PAGE};font-family:${font};color:${INK};font-size:15px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;border-top:4px solid ${accent};font-family:${font}">`,
    `<tr><td style="padding:24px 28px 8px">${header}</td></tr>`,
    `<tr><td style="padding:16px 28px 8px">${banner}${blocks}${signature}</td></tr>`,
    `<tr><td style="padding:16px 28px 24px;border-top:1px solid #e7e3df;font-size:12px;line-height:1.6;color:${INK}">${footer}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");
}

// Version texte : le bouton devient son intitulé puis l'adresse, sur deux lignes.
export function renderMailText(layout: MailLayout): string {
  const body = layout.blocks.map((block) => (block.kind === "paragraph" ? block.text : `${block.label}\n${block.url}`)).join("\n\n");
  const banner = layout.banner ? `${layout.banner}\n\n` : "";
  const signature = layout.signature ? `\n\n${signatureText(layout.signature)}` : "";
  const footer = [...layout.footerLines, ...(layout.footerNote ? [layout.footerNote] : [])].join("\n");
  return `${banner}${body}${signature}\n\n--\n${footer}\n`;
}

// La signature en texte : le nom, ses lignes, puis chaque lien « Libellé : adresse » (aussi pour les
// messages préparés que la planner envoie de sa messagerie).
export function signatureText(signature: MailSignature, separator = " : "): string {
  return [signature.name, ...signature.lines, ...signature.links.map((link) => `${link.label}${separator}${link.url}`)].join("\n");
}
