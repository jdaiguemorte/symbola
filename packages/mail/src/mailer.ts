// Porte d'entrée unique pour l'envoi d'e-mails (SOC-04, PRD-HUB-01). Mailpit en
// dev (sans authentification) ; un vrai serveur SMTP en staging/production
// (packages/env : SMTP_HOST/PORT/USER/PASSWORD/FROM).
import nodemailer from "nodemailer";
import { parseEnv, type Env } from "@symbola/env";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  // Lot 31b (réponse 1 de l'avocat, D11) : le contrat signé, remis sur support durable. Lot 38a :
  // « cid » joint l'image en ligne (le logo de l'en-tête).
  attachments?: { filename: string; content: Buffer; contentType: string; cid?: string }[];
  // Lot 38a (MSG-01, HUB-18 ; D2, D4) : la version HTML, le nom affiché de l'expéditeur (celui de
  // l'organisation ; l'adresse reste SMTP_FROM) et l'adresse où vont les réponses.
  html?: string;
  fromName?: string;
  replyTo?: string;
};

// L'adresse de SMTP_FROM, qu'il soit « adresse » ou « Nom <adresse> ».
export function senderAddress(from: string): string {
  return /<([^<>]+)>/.exec(from)?.[1]?.trim() ?? from.trim();
}

// Isolé de sendMail() pour être testé sans connexion réseau : le port 465
// (SMTPS implicite) utilise une connexion chiffrée dès l'ouverture, les
// autres (ex. 587, STARTTLS) non. SMTP_USER vide (Mailpit) = pas d'auth.
export function buildTransportOptions(env: Env) {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  };
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const env = parseEnv(process.env);
  const transport = nodemailer.createTransport(buildTransportOptions(env));

  await transport.sendMail({
    from: input.fromName ? { name: input.fromName, address: senderAddress(env.SMTP_FROM) } : env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.attachments ? { attachments: input.attachments } : {}),
  });
}
