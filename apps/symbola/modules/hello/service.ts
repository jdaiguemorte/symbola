// Porte d'entrée publique du module hello — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat
// HTTP /v1/hello si ce module est extrait en app autonome.
import { findGreetingText } from "./repository";

export type Greeting = {
  message: string;
};

export function getGreeting(): Greeting {
  return { message: findGreetingText() };
}
