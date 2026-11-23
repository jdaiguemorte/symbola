// NFR-02 (ADR 0115) — une lecture faite une fois par affichage. Un écran appelle la même lecture
// depuis la mise en page, la page et ses composants (la session, l'état des modules…) : sans mise en
// commun, la synthèse d'un évènement relisait ainsi la session dix fois, réécrivant chaque fois son
// expiration. Le résultat est gardé le temps d'une requête d'affichage (cache() de React, propre à la
// requête : rien n'est partagé entre deux requêtes ni entre deux personnes).
//
// Seulement à l'affichage (GET) : une action serveur (POST) peut changer ce qu'elle relit ensuite
// (connexion, second facteur, module activé), elle relit donc toujours. Hors d'une requête (tâche de
// fond, test), aucune méthode : la lecture est faite à chaque appel.
import { cache } from "react";
import { requestMethod } from "./request-method";

export function memoizePerRequest<A extends unknown[], R>(read: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const memoized = cache(read);
  return async (...args: A) => ((await requestMethod()) === "GET" ? memoized(...args) : read(...args));
}
