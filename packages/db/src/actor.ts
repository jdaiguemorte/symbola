// Lot 23 (partie B ; DAT-06, SEC-19 ; ADR 0060) — l'auteur des écritures en
// base. withOrganization le fixe dans la transaction (app.actor_kind,
// app.actor_id) : le journal d'audit et les colonnes created_by/updated_by
// le lisent, sans que les dépôts aient à le passer.
//
// D'où vient l'auteur :
// 1. withActor(acteur, fn) : déclaré explicitement (connexion, tâche de fond,
//    script d'exploitation) ;
// 2. sinon le résolveur enregistré par l'app : la session de la requête en
//    cours (cookie) ;
// 3. sinon « system » (tâche de fond, test, script).
import { AsyncLocalStorage } from "node:async_hooks";

export type ActorKind = "member" | "admin" | "operator" | "system";
export type Actor = { kind: ActorKind; id: string | null };

export const SYSTEM_ACTOR: Actor = { kind: "system", id: null };

type Registry = {
  storage: AsyncLocalStorage<Actor>;
  resolver: (() => Promise<Actor | null>) | null;
};

// Un seul registre par processus : Next charge ce paquet dans plusieurs
// bundles (instrumentation, pages, routes), chacun avec sa copie du module.
const REGISTRY_KEY = Symbol.for("symbola.db.actor");

function registry(): Registry {
  const holder = globalThis as unknown as Record<symbol, Registry | undefined>;
  holder[REGISTRY_KEY] ??= { storage: new AsyncLocalStorage<Actor>(), resolver: null };
  return holder[REGISTRY_KEY];
}

export function withActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return registry().storage.run(actor, fn);
}

export function registerActorResolver(resolver: (() => Promise<Actor | null>) | null): void {
  registry().resolver = resolver;
}

export async function currentActor(): Promise<Actor> {
  const declared = registry().storage.getStore();
  if (declared) return declared;
  const resolver = registry().resolver;
  if (resolver) {
    try {
      const resolved = await resolver();
      if (resolved) return resolved;
    } catch {
      // Hors requête HTTP (tâche de fond lancée au démarrage) : pas de session.
    }
  }
  return SYSTEM_ACTOR;
}
