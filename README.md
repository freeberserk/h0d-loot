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
