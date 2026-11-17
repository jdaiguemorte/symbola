// Porte d'entrée unique pour l'envoi d'e-mails (SOC-04, PRD-HUB-01). Lot 40b (ARC-12, ADR 0076) :
// l'envoi passe par l'adaptateur en service (transport.ts) : SMTP (Mailpit en dev, un vrai serveur
// en staging et en production ; packages/env : SMTP_HOST/PORT/USER/PASSWORD/FROM), ou le double
// en mémoire des tests.
import { currentMailTransport, type SendMailInput } from "./transport";

export { buildTransportOptions, senderAddress, type SendMailInput } from "./transport";

export async function sendMail(input: SendMailInput): Promise<void> {
  await currentMailTransport().send(input);
}
