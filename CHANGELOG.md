## 0.3.1 — Récupération autonome des joueurs
- Le PJ contrôlé est désormais prioritaire comme destinataire du butin.
- Aucun assignement de personnage Foundry n'est requis si le joueur contrôle son token PJ.
- Fallbacks automatiques : personnage assigné, unique PJ possédé sur la scène, puis unique PJ possédé dans le monde.
- Si plusieurs PJ sont possibles, le joueur choisit lui-même le destinataire.
- Support renforcé des Actors synthétiques / tokens non liés via UUID de token.
- Le MJ actif continue de sécuriser la transaction en arrière-plan, sans assignation manuelle.
- Aucune modification de la logique actuelle des composants détériorés : elle reste prévue pour une évolution séparée.

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
