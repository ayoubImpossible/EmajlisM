# certs/

Ce dossier contient les certificats **intermédiaires publics** nécessaires pour
compléter la chaîne TLS que le serveur HumHub n'envoie pas.

## Pourquoi

Mesuré le 10/09/2026 (`node test/tls-chain.js emajlis-dev.csefrs.ma`) :

```
Chaine presentee par le serveur :
  [0] sujet   : *.csefrs.ma
      emetteur: Sectigo Public Server Authentication CA DV R36
Nombre de certificats envoyes : 1
Verification standard : ECHEC — UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

Le serveur ne présente que la feuille. Les navigateurs le compensent seuls
(ils récupèrent l'intermédiaire via l'extension AIA, ou l'ont en cache) ;
Node.js ne le fait pas et refuse la connexion.

Le contournement précédent — `NODE_TLS_REJECT_UNAUTHORIZED=0` dans `.env` —
supprimait la vérification TLS pour **tout** le processus Node, donc aussi pour
les appels sortants sans rapport avec HumHub. Il a été retiré.

## Ce que fait ce dossier

`src/services/humhub.js` charge tous les `.pem` d'ici et les **ajoute** aux
racines de confiance de Node (`tls.rootCertificates`) — il ne les remplace pas.
La vérification reste complète : la feuille doit être signée par cet
intermédiaire, lui-même signé par une racine de confiance. Un fichier altéré ne
fait pas passer un faux certificat, il fait échouer la validation.

## Contenu

| Fichier | Sujet | Émetteur | Expire |
|---|---|---|---|
| `sectigo-public-server-auth-ca-dv-r36.pem` | Sectigo Public Server Authentication CA DV R36 | Sectigo Public Server Authentication Root R46 | 22/03/2036 |

Empreinte SHA-1 : `DD55B4520291E276588F0DD02FAFD83A7368E0FA`
Source : http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt
(URL lue dans l'extension AIA du certificat serveur lui-même).

Ces certificats sont **publics** : aucun secret ici.

## La vraie correction

Elle est côté serveur, et n'a pas été appliquée (consigne : ne pas toucher à
`192.168.4.28`). Il faut servir le bundle complet dans nginx :

```nginx
ssl_certificate      /chemin/vers/fullchain.pem;   # feuille + intermédiaire
ssl_certificate_key  /chemin/vers/privkey.pem;
```

Vérification : `openssl s_client -connect emajlis-dev.csefrs.ma:443 -servername emajlis-dev.csefrs.ma`
doit afficher deux certificats dans la chaîne et `Verify return code: 0 (ok)`.

Une fois corrigé côté serveur, ce dossier peut être vidé sans rien changer au
fonctionnement. Voir `docs/EMajlis-Mobile-Backend-Gaps.md`, BG-11.
