// Lot 40b (ARC-12, décision D10, ADR 0076) — l'e-mail derrière une interface : changer de
// fournisseur ne touche qu'un adaptateur. Deux adaptateurs : SMTP (nodemailer ; Mailpit en dev,
// IONOS en production) et un double en mémoire pour les tests. Une suite de contrat commune
// (transport-contract.ts) s'exécute contre les deux.
import nodemailer from "nodemailer";
import { parseEnv, type Env } from "@symbola/env";

export type MailAttachment = { filename: string; content: Buffer; contentType: string; cid?: string };

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  // Lot 31b (réponse 1 de l'avocat, D11) : le contrat signé, remis sur support durable. Lot 38a :
  // « cid » joint l'image en ligne (le logo de l'en-tête).
  attachments?: MailAttachment[];
  // Lot 38a (MSG-01, HUB-18 ; D2, D4) : la version HTML, le nom affiché de l'expéditeur (celui de
  // l'organisation ; l'adresse reste SMTP_FROM) et l'adresse où vont les réponses.
  html?: string;
  fromName?: string;
  replyTo?: string;
  // Lot 55 (MSG-04 révisée, MSG-05 ; ADR 0101) : l'adresse d'expédition de l'organisation
  // (« <partie locale>@<domaine d'envoi> », à la place de celle de SMTP_FROM) et l'identifiant du
  // message (en-tête Message-ID, « <référence> »), par lequel le webhook du service d'envoi retrouve
  // la ligne du journal des envois.
  fromAddress?: string;
  messageId?: string;
};

export interface MailTransport {
  readonly name: string;
  // Envoie le message, ou rejette (serveur injoignable, refus) : jamais d'échec silencieux.
  send(message: SendMailInput): Promise<void>;
}

// L'adresse de SMTP_FROM, qu'il soit « adresse » ou « Nom <adresse> ».
export function senderAddress(from: string): string {
  return /<([^<>]+)>/.exec(from)?.[1]?.trim() ?? from.trim();
}

// L'expéditeur : l'adresse de l'organisation si elle est donnée (lot 55), sinon celle de SMTP_FROM ;
// avec le nom affiché de l'organisation s'il est donné.
export function fromHeader(message: Pick<SendMailInput, "fromName" | "fromAddress">, smtpFrom: string): string | { name: string; address: string } {
  const address = message.fromAddress ?? senderAddress(smtpFrom);
  if (message.fromName) return { name: message.fromName, address };
  return message.fromAddress ?? smtpFrom;
}

// Isolé pour être testé sans connexion réseau : le port 465 (SMTPS implicite) chiffre dès
// l'ouverture, les autres (587, STARTTLS) non. SMTP_USER vide (Mailpit) = pas d'authentification.
export function buildTransportOptions(env: Env) {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  };
}

// Les variables d'environnement sont lues à l'envoi (comme avant le lot 40b), pas à la création.
export function smtpTransport(options: { env?: Env } = {}): MailTransport {
  return {
    name: "smtp",
    async send(message) {
      const env = options.env ?? parseEnv(process.env);
      const transport = nodemailer.createTransport(buildTransportOptions(env));
      await transport.sendMail({
        from: fromHeader(message, env.SMTP_FROM),
        ...(message.messageId ? { messageId: message.messageId } : {}),
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
      });
    },
  };
}

// Double de test : garde les messages envoyés ; `failNext(n)` fait échouer les n envois suivants,
// comme un serveur injoignable.
export type MemoryMailTransport = MailTransport & { readonly sent: SendMailInput[]; failNext(count?: number): void };

export function memoryTransport(): MemoryMailTransport {
  const sent: SendMailInput[] = [];
  let failures = 0;
  return {
    name: "memory",
    sent,
    failNext(count = 1) {
      failures = count;
    },
    async send(message) {
      if (failures > 0) {
        failures -= 1;
        throw new Error("serveur d'envoi injoignable (double de test)");
      }
      sent.push({ ...message, ...(message.attachments ? { attachments: message.attachments.map((attachment) => ({ ...attachment })) } : {}) });
    },
  };
}

let configured: MailTransport | null = null;

// L'adaptateur en service : SMTP par défaut ; un test peut en poser un autre (null : retour au
// défaut).
export function configureMailTransport(transport: MailTransport | null): void {
  configured = transport;
}

export function currentMailTransport(): MailTransport {
  return configured ?? smtpTransport();
}
