## v0.6.16 — Mise à jour réellement publiée

Les modifications d'ordre stable des outils et du routage marchand sont publiées sous 0.6.16. Le tag 0.6.15 était déjà utilisé par une version antérieure et ne pouvait pas servir à distribuer ces changements via le pipeline existant.

## v0.6.16 — Ordre stable des outils Foundry

Les six commandes H0D des barres de scène ont désormais des **ordres numériques fixes et distincts** (200–250), définis dans `scripts/h0d-tool-order.js`. La création d'un outil ne dépend plus de `Object.keys(tools).length`, qui faisait dépendre le classement de l'ordre d'enregistrement des hooks et produisait des collisions (notamment entre Loot et Commerce).

- Tokens : butin (200), prélèvement MJ (210), régénération MJ (220), gestion marchand MJ (230), consulter les marchands (240).
- Tuiles : lier un marchand MJ (250).
- Les droits des joueurs / MJ, comportements, actions et données de butin restent inchangés.
- Test dédié : unicité et câblage des ordres. Aucune migration des Actors, Tokens ou stocks.

## v0.6.15 — Commerce et troc par les PJ depuis le token d'un vendeur

Les PNJ utilisant un template Créature ou PJ peuvent également être **vendeurs H0D** : sélectionne le token en MJ, ouvre l'outil **H0D Commerce**, active « Rôle Marchand », renseigne les offres et coche **« Troc automatique par valeur »** si ce vendeur accepte cette règle facultative. Le coffre Conteneur fonctionne toujours. Pour ouvrir la boutique, un joueur **cible le token vendeur avec T**, puis clique H0D Loot. Aucune tuile ni permission de lecture des flags secrets du PNJ n'est nécessaire ; le MJ connecté publie automatiquement la carte privée.

### Règle de troc (opt-in par vendeur seulement)
La règle proposée est **1 point de « Valeur / troc » sur un objet ou de « Valeur unitaire » sur une ressource = 1 jeton du prix de vente**. Cette équivalence est une option explicite à activer par le MJ, non une règle imposée à toute la campagne. Les vendeurs non configurés et les articles sans prix entier ou utilisant une autre monnaie n'acceptent pas le troc automatique. Un prix explicitement réglé à zéro autorise une transaction gratuite uniquement si le vendeur a accepté la règle.

Les prix des offres de la Caravane de la Longue Corde restent ceux du Catalogue (1 à 3 jetons, avec la variante à prix variable exclue jusqu'à définition d'un prix). Le conditionnement des Flèches renforcées ×5 reste inchangé. Chaque action « Troquer » concerne un lot et son prix.

Le joueur choisit son PJ possédé et les quantités d'objets ou ressources valorisés qu'il offre. Le client MJ valide sur le stock canonique l'inventaire réel, les prix, les stocks et les permissions ; **aucune confirmation humaine du MJ**. Les ressources retenues sont déduites du PJ, l'article lui est attribué et le stock du vendeur diminue. Un reçu des ressources remises reste dans `flags.h0d-loot.merchant.barterReceipts` (100 dernières transactions), mais ces ressources ne deviennent pas automatiquement des offres de revente du vendeur. Les piles entièrement épuisées sont supprimées après succès.

**Surpaiement :** aucun rendu de différence. Le joueur reçoit une confirmation distincte indiquant le surplus avant de valider, et le serveur vérifie cet accord. Si l'attribution de l'article ou l'enregistrement du stock échoue, le module tente de restituer la valeur débitée et de retirer l'article créé, puis signale explicitement tout échec de cette restauration.

**Sécurité :** les anciennes commandes « Prendre 1 / Prendre tout » ne permettent plus de récupérer gratuitement des marchandises. Elles restent actives pour les carcasses et les conteneurs de butin. Le vendeur doit être sur la scène du joueur et un MJ connecté reste requis techniquement ; le MJ n'a aucun bouton d'approbation à presser.

**Limites :** cette version gère le **troc en valeur**, pas un portefeuille autonome de jetons ni la négociation des prix. Elle ne détermine pas le prix des offres non chiffrées et ne revend pas automatiquement les objets remis. Les contrôles automatisés ne remplacent pas un test réel en Foundry VTT 14.

---

## v0.6.14 — Carcasses joueur et PM des griffes ordinaires

**Compte joueur :** cibler la carcasse avec **T**, puis cliquer sur **H0D Loot**. Le client MJ actif fournit directement une carte privée partagée au PJ et aux MJ. Aucun bouton d'approbation n'est demandé au MJ. Le joueur choisit ensuite **Prendre 1 / Prendre tout ce type / Tout récupérer** pour son PJ possédé. Les erreurs et les transferts effectivement terminés doivent être notifiés au joueur.

**Prérequis :** un client MJ actif, un butin déjà généré par le MJ, et un personnage avec droits **Propriétaire** pour le joueur. Ces prérequis servent aux permissions Foundry, pas à une approbation manuelle.

**Machines :** une griffe générique est du recyclage de métal : **1 griffe ordinaire donne 1 Plaque métallique (PM)**, et non un objet « Griffe ». Les cartes historiques encore actives sont relues selon cette règle, y compris au prélèvement. Les composants nommés uniques/rares restent des pièces physiques récupérables. Aucune modification des inventaires de PJ déjà existants n'est réalisée.

**Test en situation :** ouvrir la carte avec un PJ, récupérer une ressource en présence du MJ, vérifier l'augmentation de son inventaire et la diminution du stock ; vérifier aussi un Scrapper à griffe générique et une pièce rare nommée. La réussite des tests automatisés ne garantit pas le résultat sur un serveur Foundry v14.

---

## v0.6.13 — Prélèvement immédiat (sans demande au MJ)

Sur un token Conteneur, le joueur cible le coffre (T), ouvre son stock avec H0D Loot et clique sur **Prendre 1** ou **Prendre tout ce type**. **Aucune demande d'approbation et aucune confirmation préalable** ne sont affichées. Le module notifie uniquement le transfert réellement accompli ou une erreur.

Le MJ ne reçoit aucune validation à effectuer. Sa session reste nécessaire techniquement pour enregistrer les changements sur des Actors protégés par Foundry. En **Stock marchand**, la monnaie n'est toujours pas encaissée automatiquement : le retrait est indépendant du paiement, qui reste géré séparément.

Les quantités explicites et le stock de Senn ne changent pas à l'installation. Tests automatisés et contrôles en jeu à distinguer.

---

## v0.6.12 — Coffres et stocks sur tokens (plus de tuiles)

Le **template Conteneur v1.0** de H0D Template Manager utilise le stock `flags.h0d-loot.merchant`, sans Items embarqués. Son fonctionnement repose maintenant directement sur le token du coffre.

**Pour le MJ :** mettre un coffre sur la scène, ouvrir **Stock marchand** depuis sa fiche (ou les contrôles des tokens), activer le rôle Marchand si le mode est « Stock marchand », puis définir ou importer les offres. Sélectionner le token et cliquer sur **H0D Loot — ouvrir ou générer le butin** pour afficher sa carte de stock dans le chat.

**Pour les joueurs :** cibler le coffre avec **T**, puis cliquer sur le bouton **H0D Loot** des contrôles des tokens. Une carte privée partagée avec les MJ présente les articles, prix et quantités, avec les commandes de retrait. Aucune tuile n'est nécessaire.

- **Quantités :** toute quantité absente/vide est interprétée comme **1** (modifiable dans le stock marchand), tandis que **0** et les quantités positives restent inchangées. Les anciennes valeurs absentes ne sont pas réécrites lors du simple affichage.
- **Conditionnement :** la quantité du stock représente le nombre de lots, et non toujours le nombre d’unités. Pour Senn, une offre « Flèches renforcées ×5 » avec quantité **1** remet **5 flèches** au PJ, conformément au conditionnement explicite de H0D Catalogue. Le nom du lot suit l’objet transféré.
- **Butin / Réserve :** « Prendre 1 », « Prendre tout ce type » et « Tout récupérer » peuvent remettre les objets dans l'inventaire du PJ ; les accès restent narratifs et doivent être arbitrés par le MJ.
- **Stock marchand :** « Prendre 1 » et « Prendre tout ce type » remettent les objets, mais **aucune monnaie n'est prélevée**. Le MJ doit arbitrer les achats et ajuster les jetons manuellement. Le retrait global est désactivé dans ce mode.
- **Sécurité :** seuls les PJ possédés par le demandeur sont destinataires, le MJ actif effectue les écritures, le stock est relu à chaque retrait et les demandes concurrentes du même coffre sont sérialisées.
- **Données canoniques :** le transfert exige H0D Equipment Builder actif et une référence exacte pouvant être générée. Si une référence manque ou est incomplète, la prise échoue sans modifier sa quantité ; aucun objet n'est inventé.
- **Compatibilité :** les anciens stocks du marchand et le butin de carcasse persistent. Les tuiles et leurs flags existants ne sont pas effacés, mais l'ancienne interface des tuiles n'est plus activée.

**Tests :** automatisation statique / simulation effectuée ; comportement réel à vérifier avec **Foundry v14**, un compte MJ et un compte joueur. Cette version ne représente pas encore un module d'achat avec paiement automatique.

---

## v0.6.11 — Sources canoniques des marchandises et ressources

**H0D Catalogue v0.1.7 est la référence pour les Items.** H0D Loot reste responsable des états de carcasses, des transferts sécurisés, des RollTables et du commerce. Il ne crée pas un second catalogue.

- L'éditeur de stock marchand propose les références **éligibles** de H0D Catalogue, et non toutes les anciennes entrées Equipment Builder. Les plans incomplets et les objets réservés n'y apparaissent pas.
- Le stock exact Senn continue à être résolu via `getStockResolved` pour conserver ses 21 offres, prix et quantités spécifiques.
- Une ressource correspondante est résolue par clé ou nom exact et type `resource`. Les **nouvelles ressources transférées** utilisent les propriétés CSB du Catalogue quand la correspondance est sûre ; la source compendium reste une source de template et d'image.
- Si aucune référence canonique exacte n'existe, l'ancien circuit bibliothèque/compendium continue sans inventer d'équivalent.
- Les ressources déjà dans les inventaires des PJ **ne sont pas modifiées**. L'historique des prélèvements et les butins persistants restent inchangés.
- `game.modules.get("h0d-loot").api.equipmentCatalogueAudit()` liste les correspondances possibles des ressources historiques.
- Si Catalogue est désactivé, l'éditeur et la récupération disposent du circuit historique comme secours, explicitement identifiable.

Ce raccordement ne rend pas les transactions marchandes automatiques et n'implique pas de migration de fiches.

## v0.6.10 — Prélèvement autonome des carcasses (sans validation du MJ)

- Après clic sur « Prendre 1 », « Prendre tout ce type » ou « Tout récupérer », le **joueur transfère directement vers son PJ possédé / contrôlé**. Aucune fenêtre d'approbation du MJ n'est affichée.
- Les cartes privées ouvertes par les joueurs sont désormais adressées aussi aux MJ : le client MJ principal reçoit automatiquement la demande de transfert. Cela répare une situation où la carte privée était introuvable côté MJ.
- Les anciennes cartes privées de carcasses peuvent être traitées depuis le butin canonique enregistré sur le Token, même si la carte n'apparaît pas dans les messages du MJ.
- Les prélèvements simultanés d'une même carcasse sont sérialisés afin d'éviter qu'un même composant soit prélevé plusieurs fois.
- Les contrôles d'appartenance du PJ, de quantité restante, d'identité de la carcasse et la mise à jour des cartes sont conservés.
- **Un client MJ actif reste nécessaire techniquement** pour appliquer les modifications protégées par Foundry, mais **n'a aucune action de validation à effectuer**. Les transactions hors connexion MJ ne sont pas couvertes.
- Validation en serveur Foundry v14 requise : tests automatisés de présence des garde-fous réussis.

## v0.6.9 — Consultation des étals sans sélection de tuile (joueurs)

Foundry v14 ne permet pas aux joueurs de sélectionner les tuiles comme le MJ. H0D Loot propose désormais un accès supplémentaire indépendant de cette sélection.

- Dans les **contrôles des Tokens**, nouveau bouton **« H0D Commerce — consulter les marchands de la scène »**, accessible aux MJ et aux joueurs.
- Une seule vitrine accessible : elle s'ouvre directement. Plusieurs vitrines : fenêtre de choix des marchands.
- Seules les **tuiles visibles et liées à un marchand actif sur la scène actuelle** sont proposées ; aucune permission sur l'Actor marchand ou sur le calque Tuiles n'est requise.
- Le **double-clic sur la tuile** reste disponible en complément (à confirmer sur chaque configuration Foundry).
- Aucun changement des stocks, liens de tuiles ou droits de PJ ; aucun achat automatique.
- Un test automatise l'ouverture de la vitrine depuis la barre d'outils avec un compte joueur sans accès aux Actors.

**Test** : charger la scène avec le compte joueur, sélectionner les **contrôles des Tokens** à gauche, puis cliquer sur l'icône boutique « consulter les marchands ». La fenêtre doit afficher les offres de Raska. Ne pas chercher à sélectionner sa tuile avec le joueur : cette opération est réservée au MJ dans Foundry.

## v0.6.8 — Correctif : marchands sur tokens non liés

- Le sélecteur de la tuile recherche désormais les marchands du répertoire **et** les Actors synthétiques des tokens présents sur les scènes. Un marchand configuré directement sur un token non lié n'est plus ignoré.
- Les options distinguent « (répertoire) » et « (token — Nom de la scène) » pour éviter les confusions si plusieurs exemplaires d'un PNJ existent.
- Chaque vitrine mémorise la source exacte de son stock ; les mises à jour d'un token ne remplacent pas celles de l'Actor du répertoire (ou d'un autre token).
- Les anciennes tuiles liées à des Actors du répertoire restent compatibles. Aucun stock n'est réinitialisé, aucune donnée d'inventaire personnel n'est modifiée.
- Test automatisé du cas token non lié ajouté, en plus des contrôles structurels existants. Validation de l'interface en jeu encore nécessaire.

**Test** : mettre à jour H0D Loot, vérifier sur le token PNJ que « Rôle Marchand » est activé, sélectionner la tuile et rouvrir « Associer la tuile ». L'entrée du marchand doit apparaître avec son origine.

## v0.6.7 — Vitrine marchande liée à une tuile Foundry v14

Cette version utilise **une tuile déjà placée sur la scène** : aucun JSON de tuile à exporter, importer ou recréer. Le stock du marchand reste sur l'Actor, **hors encombrement**.

**Configurer la tuile (MJ)** :
1. Vérifier que H0D Loot v0.6.7 est actif et que le PNJ possède le rôle Marchand activé.
2. Sur la scène, passer aux **contrôles des tuiles**, sélectionner **une seule tuile** (par exemple « Stock Marchand »).
3. Cliquer sur l'outil **boutique — lier la tuile sélectionnée à un marchand** dans les contrôles des tuiles.
4. Choisir le PNJ Marchand, puis valider. L'association est sauvegardée sur la tuile.
5. Pour retirer la liaison : sélectionner la même tuile et choisir « Aucun (détacher la vitrine) ».

**Consultation (joueurs)** : sur la scène, **double-cliquer sur l'image de la tuile**, sans passer par l'outil Tuiles (réservé au MJ). Une fenêtre affiche les offres par catégorie avec quantités et prix, sans accès à la fiche du marchand. Le MJ peut aussi tester depuis un autre outil que celui d'édition des tuiles.

**Fonctionnement** :
- `flags.h0d-loot.merchant` sur l'Actor reste la **source du stock**. La tuile conserve uniquement un **instantané public filtré** (`flags.h0d-loot.merchantTile`) : nom du marchand, nom/catégorie des articles, quantité, prix et monnaie. **Aucune note privée, fiche d'Actor, droit de propriété ou inventaire personnel** n'est transmis aux joueurs.
- Les changements du stock et du rôle Marchand mettent à jour les tuiles associées via le client MJ connecté. Si le MJ est hors ligne pendant une modification effectuée par une autre voie, la tuile peut montrer la dernière version publiée ; le MJ peut resynchroniser ensuite.
- Une tuile masquée n'est pas interactive pour les joueurs. La désactivation du rôle Marchand suspend la vitrine sans effacer la liaison.
- Les tuiles et le stock existants sont conservés. La publication en chat de v0.6.6 reste disponible.
- Aucun transfert d'objet ni paiement automatique dans cette version.

**API MJ de secours**, si le bouton des contrôles des tuiles n'est pas affiché dans une configuration Foundry :
`game.h0dMerchant.linkSelectedMerchantTile()` ouvre le même sélecteur sur la tuile actuellement sélectionnée.
`game.h0dMerchant.syncMerchantTiles(actor)` republie son stock sur toutes les tuiles liées.

**Validation** : tests de structure/syntaxe automatisés réussis en CI ; le déclenchement du double-clic et l'affichage côté joueur nécessitent encore un test réel sous Foundry v14.

## v0.6.6 — Vitrine publique et catalogue uniquement
- Suppression du formulaire « Ajouter une marchandise libre » ; ajouts via H0D Equipment Builder uniquement.
- Nouvelle action « Enregistrer et publier la vitrine aux joueurs » : crée une carte de chat publique avec les offres, quantités et prix, sans accès à la fiche PNJ.
- La publication est un instantané : les changements suivants nécessitent une nouvelle publication. Aucun achat ni paiement automatique.
- Les stocks existants et les références libres historiques sont conservés et restent modifiables/supprimables.

## v0.6.5 — Catégories du stock marchand
- Le sélecteur Equipment Builder regroupe désormais les références par type (armes, armures, munitions, objets, ressources, autres types présents), avec ordre alphabétique dans chaque groupe.
- Les données et les transactions ne changent pas. Aucun template CSB modifié.

## v0.6.4 — Sélection depuis H0D Equipment Builder

- L'éditeur du stock marchand propose les références de `game.h0dEquipmentBuilder.getReferenceCatalog()` lorsque le Builder est actif.
- L'ajout conserve la clé et le nom canoniques, avec quantité, prix et monnaie définis par le MJ.
- Les stocks précédents et les articles libres sont conservés. Aucun transfert ni paiement automatique.
- Aucune modification requise des templates Actor ni du Builder ; validation en jeu encore nécessaire.

## v0.6.3 — Édition du stock marchand

- Accès depuis la fiche Actor du marchand via l'icône boutique dans l'en-tête (MJ uniquement, si rôle Marchand actif).
- Édition des noms, quantités, prix, monnaies et notes ; ajout et suppression de marchandises.
- Stock persistant en flags, hors encombrement ; stock existant conservé.
- Les références libres peuvent être renseignées ; liaison au Builder Équipement et transferts automatiques prévus dans une étape ultérieure.
- Les modifications sont enregistrées après validation ; le remplacement par le stock Senn exige une confirmation.
- Validation en Foundry v14 encore nécessaire.

## v0.6.2 — Première étape du commerce (MJ)

- Sélectionner un token PNJ puis cliquer sur l'outil **boutique** dans les contrôles de Tokens pour activer le rôle Marchand, choisir une fiche acheteur et consulter le stock.
- Stock stocké dans `flags.h0d-loot.merchant` : **pas d'Items embarqués**, donc pas de contribution à l'encombrement du PNJ.
- Option **Charger le stock Senn** depuis H0D Catalogue : les quantités non précisées restent inconnues, et le remplacement exige confirmation.
- API MJ : `game.h0dMerchant.openMerchant(actor)`, `setMerchantRole(actor,true)`, `setMerchantOffers(actor,offers)`, `assignMerchantBuyer(actor,pj)`, `importCatalogueStock(actor,key)`.
- **Limite** : consultation et préparation uniquement. Aucun paiement, retrait d'objet, transfert ou synchronisation de stock automatique. Le stock reste présent si le rôle Marchand est désactivé.

# H0D Loot v0.6.0 — Récolte cohérente avec le scan et la décision du MJ

## Le principe

Le système ne peut pas deviner ce que le MJ a dit aux joueurs pendant la séance. Désormais, le MJ peut **définir les ressources réellement récupérables** d'une ou plusieurs carcasses de faune, avec une ressource garantie et une note tirée du scan.

Ce réglage ne change **ni le barème de Menace ni les poids** de la table générale ; il restreint les résultats éligibles et remplace un tirage par la ressource garantie.

### Pour les chiens sauvages de la séance

1. Sélectionner le(s) token(s) de chien(s) sauvage(s) dans la scène Foundry.
2. Cliquer sur le nouvel outil **patte de faune — H0D Loot, récolte après scan** dans les outils de Tokens (réservé au MJ), ou utiliser l'API `game.modules.get("h0d-loot").api.configureHarvest()`.
3. Choisir **Récolte dirigée MJ / scan**.
4. **Décocher Viande**, laisser **Peau / fourrure** et éventuellement **Os** autorisés ; choisir **Ressource garantie : Peau / fourrure**. Ajouter une note telle que « Viande de mauvaise qualité ; peau intacte ». Le trophée rare peut également être désactivé.
5. Conserver la case **Corriger aussi le butin déjà généré** pour que la carte existante soit mise à jour sans refaire tous les tirages.

### Comportement

- La règle est enregistrée **sur chaque token sélectionné** : elle survit à la réouverture de la carcasse et à une régénération explicite.
- La **récolte libre** utilise exactement le fonctionnement précédent.
- La **récolte dirigée** tire parmi les résultats autorisés de la RollTable des créatures, en respectant leurs poids. Une ressource garantie occupe d'abord **un tirage de la formule existante** (elle n'est pas une récompense gratuite supplémentaire).
- Le MJ peut cocher « Autres résultats » pour autoriser des résultats personnalisés hors des quatre familles classiques.
- Si la ressource garantie n'existe pas dans la table, le module refuse l'opération et **n'invente pas de nouvelle ressource**.
- Pour un butin déjà généré, les ressources interdites **encore présentes** sont retirées, et la ressource garantie est ajoutée si elle manque. Le reste est conservé ; **pas de nouveau tirage aléatoire**.
- Les **prélèvements déjà transférés** ne sont jamais révoqués. L'inventaire des joueurs et l'historique `claims` restent inchangés. Une ancienne prise peut donc apparaître à quantité zéro comme fait historique.
- Les cartes de butin liées au token sont synchronisées par le système de persistance existant, et les notes de scan sont visibles.
- Le bouton **↻ Régénérer** reste distinct, volontaire et nécessite confirmation. Modifier une règle de récolte n'exécute jamais ce bouton.

### Limites délibérées

- Rien n'est deviné à partir du nom « Chien sauvage » : le MJ décide, comme pour un loup, un sanglier ou un oiseau.
- Aucune modification automatique des ressources de **machines** ou des **inventaires de PNJ/factions**.
- La qualité médiocre de la viande est une **note narrative**, pas un nouvel item ni une règle sanitaire inventée.
- Le réglage n'agit pas sur le générateur manuel sans token : celui-ci continue d'utiliser la table générique jusqu'à ce que des profils plus complets soient validés.
- La récolte dirigée exige une RollTable **avec remise** (les tables H0D par défaut le sont).

---
## 0.5.1 — Génération en série sans fermeture de fenêtre

- La fenêtre reste ouverte après une génération ; conserve le profil, le mode et les champs saisis pour une nouvelle opération.
- Bouton **Exécuter** dans le formulaire et bouton **Fermer** explicite ; protection contre les doubles clics et l'exécution simultanée.
- Affichage du résultat/erreur dans la fenêtre sans la fermer.
- Concerne uniquement le dialogue MJ de **génération manuelle de butin** ; les fenêtres de récupération des joueurs restent inchangées.
- Données et règles de génération inchangées. La fermeture du dialogue n'annule pas un document déjà créé.

# H0D Loot — v0.5.1

Module Foundry VTT v14 pour la campagne Zero Dawn sous **Custom System Builder**.

## Nouveau en 0.2.0

### Carcasses persistantes

Le butin est maintenant enregistré directement sur le **TokenDocument** de la cible. Le token présent sur la carte devient donc la carcasse : aucun Actor « Carcasse » supplémentaire n'est nécessaire.

- le MJ sélectionne une cible et clique sur **H0D Loot** pour générer le butin ;
- si le butin existe déjà, le même bouton le réaffiche sans nouveau tirage ;
- les joueurs ciblent une carcasse avec **T**, puis cliquent sur **H0D Loot** pour recevoir une vue privée de son contenu ;
- les prélèvements sont validés par le MJ et mettent à jour l'état persistant de la carcasse.

### Régénération explicite

Le raccourci `Maj + clic` a été supprimé. Un second bouton MJ **↻ H0D Loot** régénère volontairement le butin des tokens sélectionnés, après confirmation.

### Humanoïdes : possessions réelles

Les fiches `H0D_Creature` dont `H0D_Creature_Type` vaut `PNJ` ou `Faction` ne reçoivent plus de loot animal aléatoire. Le module expose les véritables Items présents sur leur fiche :

- armes (`O6qwtv7ozECILPHV`) ;
- armures (`dEeBbuthkI0CVMa3`) ;
- objets et munitions (`H0DObjTpl0000001`) ;
- ressources (`H0DResTpl0000001`).

Les attaques naturelles évidentes comme Poings, Morsure, Griffes ou Crocs sont ignorées par défaut. Le réglage peut être désactivé.

Les objets transférés sont clonés depuis l'Item réellement présent sur le PNJ au moment de la prise. Ils sont placés dans le stockage `PJ` et les états « actif/équipé » sont neutralisés pour éviter une activation automatique.

## Machines et créatures

Le système précédent reste en place :

- barème Menace 1 → `1d3` jusqu'à Menace 10 → `3d6` ;
- RollTables éditables pour machines et faune ;
- pièces rares de machine intactes/détachées ;
- Compendium partagé comme source officielle des ressources H0D ;
- empilement automatique de `H0D_Ressource_Quantite` ;
- boutons **Prendre 1**, **Tout ce type** et **Tout récupérer**.

## Compendium de ressources

Par défaut :

`forge-vtt-shared-compendiums-h0d_compendium.item-1-item`

Le diagnostic reste accessible avec :

```js
const d = game.modules.get("h0d-loot").api.diagnose();
console.log(d);
```

## Installation / mise à jour Forge

Release GitHub : `v0.2.0`

Assets de la release :

- `module.json`
- `h0d-loot.zip`

Manifest permanent :

`https://github.com/freeberserk/h0d-loot/releases/latest/download/module.json`




## Récupération autonome — v0.4.0

Le joueur cible une carcasse avec **T**, ouvre **H0D Loot**, puis utilise **Prendre 1**, **Tout ce type** ou **Tout récupérer**.

Le destinataire est résolu automatiquement dans cet ordre :

1. PJ actuellement contrôlé par le joueur ;
2. personnage Foundry assigné à l'utilisateur ;
3. unique PJ possédé présent sur la scène ;
4. unique PJ possédé dans le monde ;
5. choix par le joueur s'il possède plusieurs PJ possibles.

Le MJ n'a plus à assigner manuellement le butin. Son client reste l'autorité technique qui sécurise et écrit la transaction sur la carcasse persistante.

## Composants de machine détériorés

La récupération des pièces détachables suit désormais ces règles :

- **Détachée, PV > 0** : la pièce elle-même est récupérable comme objet de craft, avec son état et ses PV d'origine conservés en métadonnées.
- **Détachée, 0 PV** : la pièce est récupérable comme **composant détérioré** et fournit en plus **1 ressource secondaire**.
- **Détruite** : pas de composant récupérable par cette règle.

Récupération secondaire automatique :

- réservoirs / bonbonnes / sacs de fluide → fluide élémentaire correspondant ;
- batteries / réacteurs / générateurs → cellule d'énergie faible ;
- optiques / radars / capteurs → lentilles optiques ;
- électronique / modules / relais → circuit ancien abîmé ;
- structure / griffes / plaques / membres rigides → plaques métalliques ;
- éléments souples / stabilisateurs / câblages → fibres synthétiques ;
- cœurs / noyaux → noyau de machine selon la catégorie de la machine.

Si un réservoir ne permet pas d'identifier son élément, H0D Loot le laisse volontairement à arbitrer au lieu d'inventer un fluide.


## Rapport privé MJ — composants détruits

Pour une machine, une pièce détachable dont l'état final est **Détruite** ne produit rien :
ni objet récupérable, ni récupération secondaire.

À la génération du butin, H0D Loot envoie toutefois aux MJ un message privé de contrôle listant ces pièces avec leurs PV finaux et la mention **aucun rendement**.

Ce rapport est purement informatif : il n'a aucun bouton de prise et n'apparaît jamais côté joueurs.
Il sert à vérifier visuellement la fin de la chaîne **création → PV → état → loot**.
