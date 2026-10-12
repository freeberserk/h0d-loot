# H0D Loot — v0.4.0

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
