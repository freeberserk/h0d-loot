# H0D Loot — v0.1.0

Module Foundry VTT v14 conçu pour la campagne Zero Dawn sous **Custom System Builder**.

## Ce que fait cette version

- ajoute un bouton **H0D Loot** dans les outils Token du MJ ;
- lit automatiquement le type d'Actor : **Machine** ou **Créature** ;
- lit automatiquement le niveau de Menace :
  - Machine : `H0D_Machine_Niveau_Menace`
  - Créature : `H0D_Creature_Menace`
- conserve le barème de la macro d'origine : Menace 1 → `1d3`, ... Menace 10 → `3d6` ;
- crée deux RollTables éditables au premier lancement :
  - `H0D Loot — Ressources machine`
  - `H0D Loot — Ressources créature`
- utilise les vrais Items H0D fournis dans `Item Généré.zip` (45 ressources uniques) ;
- détecte plusieurs pièces rares de machines quand elles existent réellement sur l'Actor et sont intactes/détachées ;
- publie une carte de butin persistante dans le chat ;
- permet aux joueurs de prendre 1 ressource, tout un type de ressource, ou tout le butin ;
- empile automatiquement `H0D_Ressource_Quantite` dans le PJ destinataire ;
- empêche le reroll accidentel d'un même token.

## Utilisation

1. Sélectionner un ou plusieurs tokens Machine/Créature.
2. Dans les outils **Token**, cliquer sur l'icône **boîte ouverte** `H0D Loot`.
3. Le butin est publié dans le chat.
4. Les joueurs utilisent les boutons **Prendre**.

**Maj + clic** sur le bouton H0D Loot force la régénération du butin des tokens sélectionnés.

Sans token sélectionné, le bouton ouvre le mode manuel (type, nombre, Menace), équivalent à la macro d'origine.

## Macro/API facultative

```js
game.modules.get("h0d-loot").api.generate();
```

Génération manuelle :

```js
game.modules.get("h0d-loot").api.manual();
```

Réinitialiser le verrou de loot des tokens sélectionnés :

```js
game.modules.get("h0d-loot").api.reset();
```

## Tables de loot

Les tables créées par le module sont des RollTables normales : le MJ peut modifier librement les poids et les résultats. Pour qu'un résultat soit transférable automatiquement, son texte doit correspondre au nom d'une ressource de la bibliothèque H0D.

Les noyaux de machine ne sont **pas** ajoutés automatiquement en v0.1.0 : leur attribution selon Menace/taille n'est pas encore figée. Ils sont présents dans la bibliothèque et pourront être intégrés dans une prochaine version sans recréer les Items.

## Pièces rares

En v0.1.0, une pièce rare est ajoutée seulement si le module trouve une pièce/arme correspondante sur la Machine et que son état est récupérable (intacte ou détachée, PV > 0, pas endommagée). Cela évite de tirer au hasard un Canon de Ravager sur une carcasse qui ne l'avait pas.

## Installation Forge / GitHub

Manifest prévu :

`https://github.com/freeberserk/h0d-loot/releases/latest/download/module.json`

Pour la release `v0.1.0`, joindre :

- `module.json`
- `h0d-loot.zip`

## Compatibilité

- Foundry VTT v14
- Custom System Builder 6.x (données H0D actuelles)
