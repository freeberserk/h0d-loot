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
