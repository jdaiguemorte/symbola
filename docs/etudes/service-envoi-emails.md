# Étude — Le service d'envoi des e-mails (lot 55, D2)

**Date** : 19/11/2026. **Pour** : Julien, qui choisit. **Décision de Julien (19/11/2026) : Scaleway
Transactional Email, formule Essential** (ADR 0102). **Contexte** : décision du 19/11 (chaque
organisation envoie depuis `<partie locale>@<domaine d'envoi de Symbola>`) et MSG-05 (journal
des envois : remis, rejeté, plainte). IONOS, utilisé aujourd'hui, demande une boîte ou un alias
par adresse d'expédition et ne rend pas compte de la remise : MSG-05 est impossible avec lui.

Chiffres relevés le 19/11/2026 sur les pages publiques des services et quelques sources
secondaires (signalées). Les prix bougent : à vérifier sur la page de tarifs au moment de
souscrire.

## Critères

1. Hébergement des données dans l'Union européenne (et exposition au CLOUD Act).
2. Adresses d'expédition libres sur un domaine vérifié (sans créer chaque adresse à la main).
3. Webhooks de remise et de rejet, et **comment ils sont signés** (SEC-19 : webhook signé, refusé
   s'il ne l'est pas).
4. Envoi par SMTP : l'app garde son adaptateur actuel (lot 40b, ADR 0076), aucune dépendance de
   code en plus.
5. Prix pour quelques milliers d'e-mails par mois.
6. Contrat de sous-traitance (DPA, article 28 du RGPD).

## Tableau

| | **Scaleway TEM** (France) | **Brevo** (France) | **Mailjet** (France, groupe Sinch, Suède) | **Lettermint** (Pays-Bas) |
| --- | --- | --- | --- | --- |
| Hébergement | Paris seulement (région `fr-par`), rien de répliqué hors UE ; centres de données de Scaleway (groupe Iliad) | UE : OVH (France, Allemagne) et Google Cloud (Belgique) pour une partie | UE : Google Cloud à Francfort et Saint-Ghislain (Belgique) | Pays-Bas, serveurs en Europe |
| Exposition au CLOUD Act | Non (société et hébergeur français) | Partielle (Google Cloud) | Oui par l'hébergeur (Google Cloud) | Non annoncée ; aucune certification affichée |
| Adresses libres sur le domaine vérifié | **Oui** : toute adresse du domaine vérifié (SPF, DKIM) | Probable : le domaine authentifié suffit selon la communauté ; la doc officielle parle de « senders » déclarés, à tester | **Oui** : validation de tout le domaine (`*@domaine`) | Non confirmé par la doc trouvée |
| Webhooks remis / rejeté / plainte | Oui (`email_delivered`, `email_dropped`, `email_mailbox_not_found`, `email_spam`…), via le service Topics and Events | Oui (Delivered, Hard/Soft bounce, Spam, Blocked…) | Oui (sent, bounce, blocked, spam) | Oui |
| **Signature du webhook** | **Signée** : format SNS, signature RSA vérifiée avec le certificat public de Scaleway (`SigningCertURL`) ; faisable avec `node:crypto`, sans dépendance | **Pas de signature** : en-têtes personnalisés ou jeton « Bearer » choisis à la création | **Pas de signature** : identifiant et mot de passe dans l'URL (Basic) | **Signée** : HMAC-SHA256 du corps avec horodatage (`X-Lettermint-Signature`), anti-rejeu |
| SMTP | Oui (STARTTLS, 50 Mo max) | Oui (relais SMTP) | Oui | Oui |
| Prix pour ~5 000 e-mails/mois | Formule Essential : 300 inclus puis 0,25 € les 1 000 → **environ 1,20 €/mois** (1 webhook par domaine, 5 domaines) ; Topics and Events facturé à part, quelques centimes | Starter ≈ 9 $/mois pour 5 000 ; ≈ 18 à 29 $ pour 20 000 (sources secondaires, divergentes) ; logo Brevo à retirer en option | Gratuit jusqu'à 6 000/mois (200/jour) ; Essential ≈ 15 $/mois pour 15 000 | Starter 10 €/mois pour 10 000 ; gratuit 300/mois |
| DPA | Oui (DPA général de Scaleway + conditions propres à TEM) ; **aucun sous-traitant dédié** pour le contenu des e-mails | Oui (DPA Brevo), sous-traitants dont Google | Oui (DPA Sinch / Mailjet SAS), sous-traitants dont Google | Oui (Lettermint B.V.), non lu |
| Points faibles | Webhook en deux temps : créer un « topic » et confirmer l'abonnement ; formule Essential limitée à 1 webhook par domaine (suffit : un webhook porte tous les types) ; pas de SLA hors formule Scale (80 €/mois) | Pas de signature ; outil d'abord marketing | Pas de signature ; maison mère hors de France, hébergement Google | Jeune ; adresses libres non confirmées ; peu de recul |

## Ce que le code attend (déjà prêt derrière une interface)

Le lot 55 code l'envoi et le journal derrière une interface (`EmailDeliveryWebhookAdapter`) :

- l'envoi reste en **SMTP** par l'adaptateur du lot 40b : seuls `SMTP_HOST`, `SMTP_USER`,
  `SMTP_PASSWORD` et le domaine d'envoi changent ;
- un **adaptateur de webhook** par service traduit l'appel reçu en statuts (remis, rejeté,
  plainte) après avoir vérifié la signature. Le lot livre un adaptateur **simulé** (HMAC-SHA256
  horodaté) pour les tests ; l'adaptateur du service choisi s'écrit en un fichier.

Avec Brevo ou Mailjet, le webhook n'est pas signé : on vérifierait un secret partagé (en-tête ou
Basic), ce qui protège moins (le secret circule à chaque appel) et s'écarte de la lettre de
SEC-19. Il faudrait l'écrire dans l'ADR.

## Recommandation

**Scaleway Transactional Email**, formule Essential :

- société, hébergeur et données en France, sans sous-traitant dédié ni exposition au CLOUD Act ;
- toute adresse du domaine vérifié, ce que demande la décision du 19/11 ;
- webhooks **signés** (SEC-19), vérifiables sans dépendance ;
- SMTP, donc aucun changement de bibliothèque ;
- environ 1 à 2 € par mois au volume du pilote ; passage à la formule Scale (80 €/mois, SLA,
  IP dédiée) seulement si le volume l'exige.

Second choix : **Lettermint**, si Scaleway déçoit à l'essai (signature HMAC simple, mais adresses
libres à confirmer et société plus jeune). Brevo et Mailjet marchent, mais sans webhook signé.

## Ce qu'il faudra faire une fois le service choisi (Julien)

1. Ouvrir le compte et signer le DPA ; l'ajouter à `docs/conformite/sous-traitants.md` (DPO).
2. Créer le sous-domaine d'envoi (D1, par défaut `envoi.symbola.fr`) chez le registraire :
   SPF, DKIM, DMARC, et le MX de retour si le service le demande.
3. Créer le webhook (et, pour Scaleway, le « topic » Topics and Events et son abonnement HTTPS
   vers `/api/webhooks/email-delivery`), puis poser son secret dans l'environnement.
4. Me dire le service retenu : j'écris son adaptateur de webhook et l'ADR passe de « proposé » à
   « accepté ».

## Sources

- Scaleway TEM, tarifs et formules : <https://www.scaleway.com/en/transactional-email-tem/>,
  <https://www.scaleway.com/en/docs/transactional-email/how-to/manage-tem-plans/>
- Scaleway TEM, limites et SMTP : <https://www.scaleway.com/en/docs/transactional-email/reference-content/tem-capabilities-and-limits/>
- Scaleway TEM, webhooks par Topics and Events : <https://www.scaleway.com/en/docs/transactional-email/api-cli/use-webhooks-with-sns-topics/>,
  <https://www.scaleway.com/en/docs/topics-and-events/reference-content/verifying-webhooks/>
- Scaleway TEM, données personnelles et DPA : <https://www.scaleway.com/en/docs/transactional-email/reference-content/data-privacy/>,
  <https://www.scaleway.com/en/contracts/>
- Brevo, lieu des données : <https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location>
- Brevo, webhooks : <https://developers.brevo.com/docs/transactional-webhooks>,
  <https://developers.brevo.com/docs/secured-webhooks>
- Brevo, domaine et expéditeurs : <https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability>,
  <https://community.brevo.com/t/declare-senders-for-transactional-mails/580>
- Brevo, prix (secondaires) : <https://moosend.com/blog/brevo-pricing/>, <https://tajo.io/blog/brevo-pricing-guide>
- Mailjet, sécurité et hébergement : <https://www.mailjet.com/legal/security-privacy/>
- Mailjet, domaine entier : <https://documentation.mailjet.com/hc/en-us/articles/360042561594-How-to-validate-an-entire-sending-domain>
- Mailjet, webhooks : <https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview>,
  <https://hookdeck.com/webhooks/platforms/guide-to-mailjet-webhooks-features-and-best-practices>
- Mailjet, prix : <https://www.mailjet.com/pricing/>
- Lettermint : <https://lettermint.co/pricing>, <https://lettermint.co/docs/platform/webhooks/signing.md>,
  <https://europeanpurpose.com/tool/lettermint>
