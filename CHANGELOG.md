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

## 0.6.3 — Édition des stocks marchands
- Accès depuis l'en-tête Actor, modification des offres, ajout/suppression ; aucune transaction automatique.

## 0.6.2 — Marchands optionnels
- Stock marchand hors encombrement via flags Actor, interface MJ, sélection d'un acheteur et import du stock de Senn depuis Catalogue.
- Aucun transfert ni paiement automatique.

## 0.6.1
- Récolte dirigée activée automatiquement à l'ouverture de l'outil MJ ; suppression du choix libre/dirigé dans cette fenêtre. Le bouton classique reste aléatoire.

## 0.6.0 — Récolte dirigée par le MJ après scan
- Nouvel outil MJ pour définir, sur une ou plusieurs carcasses de faune, les familles de ressources autorisées et une ressource garantie.
- Respect des tables et de leurs poids : viande, os, peau, trophée, autres résultats ; aucun barème ni objet inventé.
- Cas concret chiens sauvages : désactiver la viande et garantir une peau.
- Réconciliation des butins existants **sans reroll ni annulation des prélèvements** ; synchronisation des cartes et flags.
- Note de scan visible dans la carte ; réglages persistants sur le token, conservés lors d'une régénération.
- Machines et humanoïdes exclus de cette règle.

## 0.5.1 — Génération en série sans fermeture de fenêtre

- La fenêtre reste ouverte après une génération ; conserve le profil, le mode et les champs saisis pour une nouvelle opération.
- Bouton **Exécuter** dans le formulaire et bouton **Fermer** explicite ; protection contre les doubles clics et l'exécution simultanée.
- Affichage du résultat/erreur dans la fenêtre sans la fermer.
- Concerne uniquement le dialogue MJ de **génération manuelle de butin** ; les fenêtres de récupération des joueurs restent inchangées.
- Données et règles de génération inchangées. La fermeture du dialogue n'annule pas un document déjà créé.

## 0.5.0 — Rapport MJ des composants détruits
- Les pièces détachables dont l'état final est **Détruite** restent totalement exclues du butin : aucun composant et aucune récupération secondaire.
- Lors de la génération d'un butin Machine, H0D Loot crée désormais un **message privé aux MJ** listant uniquement ces pièces détruites.
- Le rapport affiche le nom de la pièce, ses PV finaux et la mention **aucun rendement**.
- Ce rapport ne contient aucun bouton de récupération et n'est jamais visible par les joueurs.
- Le message privé est rattaché au cycle de butin de la carcasse : une régénération avec suppression des cartes nettoie aussi l'ancien rapport.
- Les cartes de butin joueurs restent inchangées et ne montrent pas les pièces détruites.

## 0.4.0 — Récupération autonome & composants détériorés
- Les joueurs peuvent récupérer eux-mêmes le butin vers leur PJ contrôlé, sans assignement manuel du MJ.
- Fallbacks destinataire : personnage assigné, unique PJ possédé sur la scène, unique PJ possédé dans le monde, puis choix joueur.
- Le MJ actif reste l'autorité technique du transfert en arrière-plan.
- Pièce détachée avec PV > 0 : elle reste un composant exploitable pour le craft ; son état reflète ses PV restants.
- Pièce détachée à 0 PV : elle devient un **composant détérioré** transférable (Objet / Pièce de machine, état Cassé).
- Un composant détérioré fournit en plus **1 ressource secondaire** selon sa famille :
  - réservoir / bonbonne / sac de fluide → fluide élémentaire correspondant ;
  - batterie / réacteur / générateur → cellule d’énergie faible ;
  - optique / radar / capteur → lentilles optiques ;
  - électronique / module / relais → circuit ancien abîmé ;
  - structure / griffe / plaque / membre rigide → plaques métalliques ;
  - stabilisateur / câblage / élément souple → fibres synthétiques ;
  - cœur / noyau → noyau de machine adapté à la catégorie Petite / Moyenne / Lourde.
- Si l’élément d’un réservoir est impossible à déterminer, le rendement reste volontairement « À arbitrer par le MJ ».
- Une pièce détruite reste exclue de cette règle de récupération.
- Aucune modification des templates n’est requise pour cette version.

## 0.3.0 — Pièces de machine récupérables
- Lecture des composants physiques embarqués, sans convertir les attaques abstraites en butin.
- Seules les pièces détachables et récupérables sont éligibles ; châssis toujours exclus.
- Pièces intactes : objets H0D de type PieceMachine dans l'inventaire du PJ.
- Pièces endommagées : 1 ressource générique H0D par composant, selon son type (barème provisoire à régler).
- Pièces à 0 PV et non détruites : entrée informative non transférable, dans l'attente du rendement MJ.
- Répartition PNJ/faune et carcasses persistantes inchangée.

# Changelog

## 0.2.0
- Butin persistant sur les tokens/carcasses.
- Ouverture du butin par les joueurs via ciblage T + bouton H0D Loot.
- Possessions réelles des PNJ et membres de faction.
- Régénération explicite via bouton dédié, sans Maj+clic.
- Migration à la volée des carcasses v0.1.1.
- Cartes regroupées par catégories : armes, armures, munitions, objets, ressources.
