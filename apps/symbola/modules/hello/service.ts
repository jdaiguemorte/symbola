// Porte d'entrée publique du module hello — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat
// HTTP /v1/hello si ce module est extrait en app autonome.
import { createGreetingRow, findGreetingText } from "./repository";
import type {
  CreateGreetingInput,
  CreateGreetingResult,
  Greeting,
} from "@symbola/contracts";

export { helloPrivacy } from "./privacy";
export type { CreateGreetingInput, CreateGreetingResult, Greeting };

export function getGreeting(): Greeting {
  return { message: findGreetingText() };
}

export async function createGreeting(input: CreateGreetingInput): Promise<CreateGreetingResult> {
  const row = await createGreetingRow(input);
  return { id: row.id, message: row.message };
}
