// Porte d'entrée publique du module hello — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat
// HTTP /v1/hello si ce module est extrait en app autonome.
import { createGreetingRow, findGreetingText } from "./repository";
import type {
  CreateGreetingInput,
  CreateGreetingResult,
  Greeting,
} from "@symbola/contracts";
import { getSignedDownloadUrl, createStorageClient, uploadFile } from "@symbola/files";

export { helloPrivacy } from "./privacy";
export type { CreateGreetingInput, CreateGreetingResult, Greeting };

export function getGreeting(): Greeting {
  return { message: findGreetingText() };
}

export async function createGreeting(input: CreateGreetingInput): Promise<CreateGreetingResult> {
  const row = await createGreetingRow(input);
  return { id: row.id, message: row.message };
}

// Envoi d'un fichier via hello (SOC-08, démonstration du pipeline
// @symbola/files) : type vérifié par le contenu, taille maximale
// paramétrable par l'appelant, antivirus, stockage privé.
export const uploadGreetingAttachment = uploadFile;

export async function getGreetingAttachmentUrl(key: string, expiresInSeconds: number): Promise<string> {
  const storage = createStorageClient();
  return getSignedDownloadUrl(storage, key, expiresInSeconds);
}
