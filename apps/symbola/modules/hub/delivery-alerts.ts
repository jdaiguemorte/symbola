// Lot 55 (MSG-05 ; ADR 0101) — le webhook du service d'envoi, puis l'alerte : un e-mail rejeté ou
// signalé comme indésirable crée la notification « e-mail rejeté » (lot 53) pour l'équipe, qui mène à
// la fiche du contact (où l'alerte s'affiche) ou, sans contact, au journal des envois. La notification
// ne porte jamais l'adresse (SEC-20) : le nom du contact seulement.
import { getContact } from "./contacts";
import { contactIdForRecipient, handleEmailDeliveryWebhook, type EmailDeliveryWebhookResult } from "./email-deliveries";
import { notify } from "./notifications";

export async function receiveEmailDeliveryWebhook(input: { headers: Headers; rawBody: string; now?: Date }): Promise<EmailDeliveryWebhookResult> {
  const result = await handleEmailDeliveryWebhook(input);
  for (const change of result.changes) {
    if (change.status !== "bounced" && change.status !== "complained") continue;
    const contactId = await contactIdForRecipient(change.organizationId, change.recipient);
    const contact = contactId ? await getContact(change.organizationId, contactId) : null;
    await notify({
      organizationId: change.organizationId,
      type: "email_bounced",
      eventId: change.eventId,
      objectKey: change.deliveryId,
      params: { name: contact?.displayName ?? "", status: change.status },
      href: contact ? `/contacts/${contact.id}` : "/parametres/envois",
      ...(input.now ? { now: input.now } : {}),
    });
  }
  return result;
}
