// Porte d'entrée unique pour l'envoi d'e-mails (SOC-04, HUB-01). Mailpit en
// dev (sans authentification) ; un vrai serveur SMTP en staging/production
// (packages/env : SMTP_HOST/PORT/USER/PASSWORD/FROM).
import nodemailer from "nodemailer";
import { parseEnv, type Env } from "@symbola/env";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

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
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
