/**
 * Briques d'interface communes.
 *
 * Pourquoi ce dossier : chaque écran redéfinissait sa propre barre de titre, ses
 * cartes, ses puces de filtre et son bandeau d'erreur, avec des valeurs de
 * couleur et d'espacement écrites à la main. Résultat : des marges différentes
 * d'un écran à l'autre, des encoches gérées une fois sur deux, et aucun moyen
 * d'appliquer un thème sombre sans reprendre trente fichiers.
 *
 * Tout ici lit le thème (`useTheme`) et la largeur réelle de l'écran. Les écrans
 * décrivent ce qu'ils montrent, pas comment le peindre.
 */

export { default as Screen } from './Screen';
export { default as AppBar } from './AppBar';
export { default as Card } from './Card';
export { default as Chip, ChipRow } from './Chip';
export { default as Button } from './Button';
export { default as Banner } from './Banner';
export { default as EmptyState } from './EmptyState';
export { default as Avatar } from './Avatar';
export { default as Badge } from './Badge';
export { Skeleton, SkeletonList } from './Skeleton';
