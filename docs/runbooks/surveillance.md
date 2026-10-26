# Runbook — Surveillance (SOC-11)

Uptime Kuma surveille l'app et le socle de **staging** et de **production**
et alerte par e-mail. Il tourne dans le socle partagé
(`infra/compose/docker-compose.socle.yml`), une seule instance pour tout
le VPS.

**Rappel** : Claude Code prépare, Julien exécute toute commande sur le VPS.

## Ce qui est surveillé

Chaque environnement expose `GET /health` (sans session) :

```json
{ "status": "ok", "version": "<sha du commit>", "checks": { "database": "ok", "storage": "ok", "antivirus": "ok" } }
```

- `status` vaut `ok` (HTTP 200) si PostgreSQL, Garage et ClamAV répondent
  en moins de 2 s, sinon `degraded` (HTTP 503). La réponse ne contient
  jamais de détail d'erreur ni de donnée métier.
- `version` est le SHA du commit gravé dans l'image par la CI : il permet
  de vérifier quelle version tourne après un déploiement ou un retour
  arrière.

Interroger `/health` par l'URL publique teste toute la chaîne : DNS
(Ionos), Traefik, certificat Let's Encrypt, app, base, stockage,
antivirus. Un seul moniteur par environnement couvre donc l'app et le
socle.

## Démarrage

Uptime Kuma démarre avec le socle :

```bash
docker compose -f infra/compose/docker-compose.socle.yml \
  --env-file infra/compose/.env.socle -p symbola-socle up -d
```

La console n'est publiée que sur `127.0.0.1:3001` du VPS. Pour l'ouvrir
depuis ton poste :

```bash
ssh -N -L 3001:127.0.0.1:3001 <utilisateur>@<vps>
```

puis `http://localhost:3001` dans le navigateur.

## Première configuration (une fois)

1. **Créer le compte administrateur dès le premier accès** (le premier
   visiteur le crée) : mot de passe long généré, puis activer la double
   authentification dans *Paramètres → Sécurité*.
2. **Notification e-mail** (*Paramètres → Notifications → SMTP*) :
   serveur SMTP de la boîte qui enverra les alertes, destinataire = ton
   adresse. Tant que le service d'e-mail transactionnel n'est pas choisi
   (question ouverte du PRD), une boîte e-mail Ionos du domaine
   `symbola.fr` convient. Cocher « Activer par défaut » puis envoyer un
   e-mail de test.
3. **Moniteurs** (*Ajouter une nouvelle sonde*), un par environnement :

   | Champ | Production | Staging |
   | --- | --- | --- |
   | Type | HTTP(s) – Mot-clé | HTTP(s) – Mot-clé |
   | URL | `https://<APP_DOMAIN de .env.production>/health` | `https://<APP_DOMAIN de .env.staging>/health` |
   | Mot-clé | `"status":"ok"` | `"status":"ok"` |
   | Intervalle | 60 s | 300 s |
   | Tentatives avant alerte | 2 | 2 |
   | Notification expiration certificat | activée (14 jours) | activée (14 jours) |

4. **Sauvegarde nocturne** (lien avec SOC-10) : une sonde de type *Push*
   « Sauvegarde restic », intervalle 26 h. Le script de sauvegarde appelle
   l'URL Push en fin de sauvegarde réussie : une nuit sans sauvegarde
   déclenche une alerte.

## Vérification

- [ ] `curl -s https://<domaine>/health` renvoie `"status":"ok"` et le SHA attendu, pour chaque environnement.
- [ ] Le port 3001 n'est pas joignable depuis Internet : `nc -vz <ip-du-vps> 3001` échoue depuis ton poste.
- [ ] Arrêter ClamAV de staging (`docker compose ... -p symbola-staging stop clamav`) : `/health` passe en 503 et l'alerte e-mail arrive après deux tentatives. Relancer ClamAV, l'alerte de rétablissement arrive.
- [ ] Les données d'Uptime Kuma (volume `uptime_kuma_data`) sont incluses dans la sauvegarde (SOC-10).
