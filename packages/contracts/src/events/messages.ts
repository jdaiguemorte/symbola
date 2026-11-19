// Lot 55 (MSG-03, POR-06 ; D3 ; ADR 0101) — fils de discussion par évènement et par sujet. Un message
// est « interne » (l'équipe seulement) ou « partagé » (les clients dont le lien ouvre la rubrique
// « Messages », et les prestataires que la planner ajoute au sujet). Un message interne n'a aucun
// chemin vers un destinataire extérieur : il n'est écrit que par l'équipe, depuis sa propre zone, et
// les lectures d'un lien ne prennent que les messages partagés.
export const MESSAGE_VISIBILITIES = ["internal", "shared"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const MESSAGE_TOPIC_NAME_MAX = 120;
export const MESSAGE_BODY_MAX = 5000;
// Pièces jointes d'un message (ADR 0027 : type par le contenu, taille, antivirus, stockage privé).
export const MESSAGE_ATTACHMENTS_MAX = 5;

export type MessageAttachmentView = { id: string; label: string; mime: string; sizeBytes: number };

export type MessageView = {
  id: string;
  topicId: string;
  visibility: MessageVisibility;
  // « team » : un membre de l'équipe ; « link » : la personne d'un lien (client, prestataire).
  authorKind: "team" | "link";
  authorName: string;
  body: string;
  attachments: MessageAttachmentView[];
  createdAt: string;
};

export type MessageTopicSummary = {
  id: string;
  eventId: string;
  name: string;
  // Les prestataires ajoutés au sujet (leurs liens) ; les clients voient tous les sujets.
  vendorLinkIds: string[];
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
};

// Les destinataires extérieurs d'un message partagé, nommés sur le bouton d'envoi (D3).
export type MessageRecipient = { linkId: string; audience: "client" | "vendor"; name: string };

export type MessageTopicThread = MessageTopicSummary & { messages: MessageView[]; recipients: MessageRecipient[] };

// Ce qu'un lien voit : les messages partagés seulement.
export type LinkMessageTopic = { id: string; name: string; messageCount: number; lastMessageAt: string | null };
export type LinkMessageThread = LinkMessageTopic & { messages: MessageView[] };

export type MessageFileInput = { label: string; content: Uint8Array };
