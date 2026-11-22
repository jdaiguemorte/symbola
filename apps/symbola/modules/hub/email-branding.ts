// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) — la marque des e-mails de l'organisation et la signature
// de chaque membre. La marque (police, ligne libre du pied, nom affiché de l'expéditeur, éléments
// affichés des signatures, personne dont la signature porte les envois automatiques) se règle par la
// titulaire ; chaque membre remplit sa signature dans « Mon compte » et n'écrit que la sienne (la base
// le garantit aussi : politique restrictive de la migration 0208). La photo est contrôlée comme le
// logo : type lu dans le contenu, taille, antivirus, stockage privé. Une signature part avec l'accès du
// membre. Exposé seulement par service.ts (ADR 0011).
import { and, eq } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { currentActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { emailBranding, memberSignatures } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, detectFileType, getPrivateObject, uploadFile } from "@symbola/files";
import { composeMailSignature, displayUrl, signatureText, type MailSignature } from "@symbola/mail";
import { starterEmailBranding } from "@symbola/starter-templates";
import {
  EMAIL_FONTS,
  SIGNATURE_ELEMENTS,
  SIGNATURE_LINKS_MAX,
  type EmailBrandingView,
  type EmailFont,
  type MemberSignatureView,
  type SignatureElement,
  type SignatureLink,
} from "@symbola/contracts";

export const EMAIL_FOOTER_LINE_MAX = 200;
export const EMAIL_SENDER_NAME_MAX = 80;
export const SIGNATURE_TEXT_MAX = 120;
export const SIGNATURE_LINK_LABEL_MAX = 40;
export const SIGNATURE_URL_MAX = 300;
// Une petite photo (56 px affichés) : 1 Mo suffit largement.
export const SIGNATURE_PHOTO_MAX_SIZE_BYTES = 1024 * 1024;

const CONTROL = /[\u0000-\u001f\u007f]/;
const PHONE = /^[0-9+(). -]{3,40}$/;

export class EmailBrandingInvalidError extends Error {
  constructor(readonly fields: ("font" | "footerLine" | "senderName" | "signatureElements" | "automaticSigner")[]) {
    super("marque des e-mails invalide");
    this.name = "EmailBrandingInvalidError";
  }
}

export type MemberSignatureField = "displayName" | "jobTitle" | "phone" | "website" | "links";

export class MemberSignatureInvalidError extends Error {
  constructor(readonly fields: MemberSignatureField[]) {
    super("signature invalide");
    this.name = "MemberSignatureInvalidError";
  }
}

export class SignaturePhotoUploadError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected" | "storage_full") {
    super(`photo de signature refusée : ${reason}`);
    this.name = "SignaturePhotoUploadError";
  }
}

function inOrganization<T>(organizationId: string, fn: Parameters<typeof withOrganization<T>>[2]): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// Texte d'une ligne : espaces resserrés, vide = nul ; refusé s'il porte un caractère de contrôle ou
// dépasse la longueur.
function cleanLine(value: string | null | undefined, max: number): { value: string | null; ok: boolean } {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { value: null, ok: true };
  return { value: text, ok: text.length <= max && !CONTROL.test(text) };
}

// Une adresse saisie sans « https:// » le reçoit ; seules les adresses http(s) sans espace passent.
export function normalizeSignatureUrl(value: string | null | undefined): { value: string | null; ok: boolean } {
  const text = (value ?? "").trim();
  if (!text) return { value: null, ok: true };
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (url.length > SIGNATURE_URL_MAX || !/^https?:\/\/[^\s"<>]+\.[^\s"<>]+$/i.test(url)) return { value: null, ok: false };
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? { value: url, ok: true } : { value: null, ok: false };
  } catch {
    return { value: null, ok: false };
  }
}

export { displayUrl };

// ——— La marque de l'organisation ———

function brandingView(row: typeof emailBranding.$inferSelect | undefined): EmailBrandingView {
  const starter = starterEmailBranding();
  if (!row) return { font: starter.font, footerLine: null, senderName: null, signatureElements: starter.signatureElements, automaticSignerUserId: null };
  return {
    font: (EMAIL_FONTS as readonly string[]).includes(row.font) ? row.font : starter.font,
    footerLine: row.footerLine,
    senderName: row.senderName,
    signatureElements: row.signatureElements.filter((element): element is SignatureElement => (SIGNATURE_ELEMENTS as readonly string[]).includes(element)),
    automaticSignerUserId: row.automaticSignerUserId,
  };
}

export async function getEmailBranding(organizationId: string): Promise<EmailBrandingView> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(emailBranding).where(eq(emailBranding.organizationId, organizationId)));
  return brandingView(row);
}

export type EmailBrandingInput = {
  font: string;
  footerLine: string | null;
  senderName: string | null;
  signatureElements: string[];
  automaticSignerUserId: string | null;
};

// La personne choisie pour les envois automatiques doit être une Planner active de l'organisation
// (titulaire ou collaboratrice ; jamais un Comptable, dont l'accès ne porte pas sur la relation).
async function isActivePlanner(organizationId: string, userId: string): Promise<boolean> {
  const team = await listTeam(appDatabase(), organizationId);
  return team.some((member) => member.id === userId && !member.disabledAt && (member.role === "owner" || member.role === "member"));
}

export async function saveEmailBranding(organizationId: string, input: EmailBrandingInput): Promise<EmailBrandingView> {
  const fields: EmailBrandingInvalidError["fields"] = [];
  const font = (EMAIL_FONTS as readonly string[]).includes(input.font) ? (input.font as EmailFont) : null;
  if (!font) fields.push("font");
  const footerLine = cleanLine(input.footerLine, EMAIL_FOOTER_LINE_MAX);
  if (!footerLine.ok) fields.push("footerLine");
  const senderName = cleanLine(input.senderName, EMAIL_SENDER_NAME_MAX);
  if (!senderName.ok || /[<>"]/.test(senderName.value ?? "")) fields.push("senderName");
  const elements = [...new Set(input.signatureElements)];
  if (!elements.every((element) => (SIGNATURE_ELEMENTS as readonly string[]).includes(element))) fields.push("signatureElements");
  const signer = input.automaticSignerUserId?.trim() || null;
  if (signer && !(await isActivePlanner(organizationId, signer))) fields.push("automaticSigner");
  if (fields.length > 0) throw new EmailBrandingInvalidError(fields);
  const values = {
    font: font!,
    footerLine: footerLine.value,
    senderName: senderName.value,
    signatureElements: SIGNATURE_ELEMENTS.filter((element) => elements.includes(element)),
    automaticSignerUserId: signer,
  };
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(emailBranding)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: emailBranding.organizationId, set: { ...values, updatedAt: new Date() } }),
  );
  return values;
}

// ——— La signature d'un membre ———

function signatureView(row: typeof memberSignatures.$inferSelect | undefined): MemberSignatureView | null {
  if (!row) return null;
  return {
    displayName: row.displayName,
    jobTitle: row.jobTitle,
    phone: row.phone,
    website: row.website,
    links: Array.isArray(row.links) ? row.links.slice(0, SIGNATURE_LINKS_MAX) : [],
    hasPhoto: row.photoKey !== null,
    photoVersion: row.photoKey ? (row.photoKey.split("/").pop()?.split(".")[0] ?? null) : null,
  };
}

async function signatureRow(organizationId: string, userId: string) {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(memberSignatures).where(and(eq(memberSignatures.organizationId, organizationId), eq(memberSignatures.userId, userId))));
  return row;
}

export async function getMemberSignature(organizationId: string, userId: string): Promise<MemberSignatureView | null> {
  return signatureView(await signatureRow(organizationId, userId));
}

export type MemberSignatureInput = {
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
  website: string | null;
  links: { label: string; url: string }[];
};

// Lignes vides ignorées ; un lien a son nom et son adresse, ou rien ; quatre au plus.
export function validateMemberSignature(input: MemberSignatureInput): { values: Omit<MemberSignatureInput, "links"> & { links: SignatureLink[] }; fields: MemberSignatureField[] } {
  const fields: MemberSignatureField[] = [];
  const displayName = cleanLine(input.displayName, SIGNATURE_TEXT_MAX);
  if (!displayName.ok) fields.push("displayName");
  const jobTitle = cleanLine(input.jobTitle, SIGNATURE_TEXT_MAX);
  if (!jobTitle.ok) fields.push("jobTitle");
  const phone = cleanLine(input.phone, 40);
  if (phone.value && !PHONE.test(phone.value)) fields.push("phone");
  const website = normalizeSignatureUrl(input.website);
  if (!website.ok) fields.push("website");
  const links: SignatureLink[] = [];
  let linksOk = true;
  for (const link of input.links) {
    const label = cleanLine(link.label, SIGNATURE_LINK_LABEL_MAX);
    const url = normalizeSignatureUrl(link.url);
    if (!label.value && !url.value && url.ok) continue;
    if (!label.ok || !label.value || !url.ok || !url.value) {
      linksOk = false;
      continue;
    }
    links.push({ label: label.value, url: url.value });
  }
  if (!linksOk || links.length > SIGNATURE_LINKS_MAX) fields.push("links");
  return { values: { displayName: displayName.value, jobTitle: jobTitle.value, phone: phone.value, website: website.value, links }, fields };
}

// userId : la personne de la session, jamais une valeur reçue d'un formulaire.
export async function saveMemberSignature(organizationId: string, userId: string, input: MemberSignatureInput): Promise<MemberSignatureView> {
  const { values, fields } = validateMemberSignature(input);
  if (fields.length > 0) throw new MemberSignatureInvalidError(fields);
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .insert(memberSignatures)
      .values({ organizationId, userId, ...values })
      .onConflictDoUpdate({ target: [memberSignatures.organizationId, memberSignatures.userId], set: { ...values, updatedAt: new Date() } })
      .returning(),
  );
  return signatureView(row)!;
}

// Comme le logo (lot 17) : PNG ou JPEG lus dans le contenu, 1 Mo au plus, antivirus, stockage privé.
// L'ancienne photo est retirée du stockage (un e-mail déjà parti a la sienne en pièce jointe).
export async function uploadSignaturePhoto(organizationId: string, userId: string, content: Uint8Array): Promise<void> {
  if (content.byteLength > SIGNATURE_PHOTO_MAX_SIZE_BYTES) throw new SignaturePhotoUploadError("too_large");
  const type = detectFileType(content);
  if (type?.mime !== "image/png" && type?.mime !== "image/jpeg") throw new SignaturePhotoUploadError("unsupported_type");
  const upload = await uploadFile({ organizationId, buffer: Buffer.from(content), maxSizeBytes: SIGNATURE_PHOTO_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new SignaturePhotoUploadError(upload.reason);
  const previous = (await signatureRow(organizationId, userId))?.photoKey ?? null;
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(memberSignatures)
      .values({ organizationId, userId, photoKey: upload.key, photoSizeBytes: upload.size })
      .onConflictDoUpdate({ target: [memberSignatures.organizationId, memberSignatures.userId], set: { photoKey: upload.key, photoSizeBytes: upload.size, updatedAt: new Date() } }),
  );
  if (previous) await deletePhotoObject(organizationId, previous);
}

async function deletePhotoObject(organizationId: string, key: string): Promise<void> {
  try {
    await deletePrivateObject(createStorageClient(), key);
  } catch (error) {
    // Un objet resté dans le stockage n'est cité par aucune ligne ; le journal n'a pas de donnée personnelle.
    console.warn(`photo de signature non retirée du stockage (organisation ${organizationId})`, error instanceof Error ? error.name : "erreur");
  }
}

export async function removeSignaturePhoto(organizationId: string, userId: string): Promise<void> {
  const previous = (await signatureRow(organizationId, userId))?.photoKey ?? null;
  if (!previous) return;
  await inOrganization(organizationId, (tx) =>
    tx.update(memberSignatures).set({ photoKey: null, photoSizeBytes: null, updatedAt: new Date() }).where(and(eq(memberSignatures.organizationId, organizationId), eq(memberSignatures.userId, userId))),
  );
  await deletePhotoObject(organizationId, previous);
}

// La photo de sa signature, servie par l'app à la personne elle-même (aperçu de « Ma signature »).
export async function loadSignaturePhoto(organizationId: string, userId: string): Promise<{ data: Buffer; mime: "image/png" | "image/jpeg" } | null> {
  const key = (await signatureRow(organizationId, userId))?.photoKey ?? null;
  if (!key) return null;
  try {
    const data = await getPrivateObject(createStorageClient(), key);
    const mime = detectFileType(data)?.mime;
    return mime === "image/png" || mime === "image/jpeg" ? { data, mime } : null;
  } catch {
    console.warn(`photo de signature illisible (organisation ${organizationId})`);
    return null;
  }
}

// RGP-05 : la signature part avec l'accès du membre (retrait par la titulaire). Renvoie vrai si une
// signature existait.
export async function eraseMemberSignature(organizationId: string, userId: string): Promise<boolean> {
  const removed = await inOrganization(organizationId, (tx) =>
    tx.delete(memberSignatures).where(and(eq(memberSignatures.organizationId, organizationId), eq(memberSignatures.userId, userId))).returning({ photoKey: memberSignatures.photoKey }),
  );
  for (const row of removed) if (row.photoKey) await deletePhotoObject(organizationId, row.photoKey);
  return removed.length > 0;
}

// Le relevé de stockage (DOC-12) : les photos des signatures comptent avec les images.
export async function signaturePhotoUsage(organizationId: string): Promise<{ files: number; bytes: number }> {
  const rows = await inOrganization(organizationId, (tx) => tx.select({ size: memberSignatures.photoSizeBytes }).from(memberSignatures).where(eq(memberSignatures.organizationId, organizationId)));
  const photos = rows.filter((row) => row.size !== null);
  return { files: photos.length, bytes: photos.reduce((sum, row) => sum + (row.size ?? 0), 0) };
}

// ——— La signature d'un e-mail ———

export type ResolvedSignature = { signature: MailSignature; photo: { data: Buffer; format: "png" | "jpg" } | null };

// Qui signe : la personne donnée, sinon la personne de la session qui fait le geste (un membre de
// l'organisation), sinon — envoi automatique, tiers par son lien — la personne choisie dans le
// réglage, sinon la titulaire. Une personne sans signature (ou sans nom affiché) n'en met aucune :
// jamais celle d'une autre à sa place.
async function signerOf(organizationId: string, branding: EmailBrandingView, senderUserId: string | null | undefined): Promise<string | null> {
  const team = await listTeam(appDatabase(), organizationId);
  const active = (id: string | null | undefined) => (id ? team.find((member) => member.id === id && !member.disabledAt && member.role !== "accountant") : undefined);
  if (senderUserId !== undefined) return active(senderUserId)?.id ?? null;
  const actor = await currentActor();
  if (actor.kind === "member" && active(actor.id)) return actor.id;
  return active(branding.automaticSignerUserId)?.id ?? team.find((member) => member.role === "owner" && !member.disabledAt)?.id ?? null;
}

export function composeSignature(view: MemberSignatureView, elements: SignatureElement[], organizationName: string): MailSignature | null {
  return composeMailSignature(view, elements, organizationName);
}

export async function resolveEmailSignature(input: { organizationId: string; organizationName: string; branding: EmailBrandingView; senderUserId?: string | null; withPhoto?: boolean }): Promise<ResolvedSignature | null> {
  const signer = await signerOf(input.organizationId, input.branding, input.senderUserId);
  if (!signer) return null;
  const view = await getMemberSignature(input.organizationId, signer);
  const signature = view ? composeSignature(view, input.branding.signatureElements, input.organizationName) : null;
  if (!signature) return null;
  if (!signature.photoCid || input.withPhoto === false) return { signature, photo: null };
  const photo = await loadSignaturePhoto(input.organizationId, signer);
  if (!photo) return { signature: { ...signature, photoCid: null }, photo: null };
  return { signature, photo: { data: photo.data, format: photo.mime === "image/png" ? "png" : "jpg" } };
}

// Lot 66c (D5) : la signature en texte de la personne connectée, que la fenêtre « Préparer l'e-mail »
// ajoute à la fin du message si elle coche « Ajouter ma signature ». Nulle sans signature.
export async function memberSignatureText(input: { organizationId: string; organizationName: string; userId: string; locale: "fr" | "en" }): Promise<string | null> {
  const [branding, view] = await Promise.all([getEmailBranding(input.organizationId), getMemberSignature(input.organizationId, input.userId)]);
  const signature = view ? composeSignature(view, branding.signatureElements, input.organizationName) : null;
  return signature ? signatureText(signature, input.locale === "en" ? ": " : " : ") : null;
}
