/**
 * Conteneur d'écran.
 *
 * Règle la couleur de fond du thème, respecte les encoches, et — sur tablette —
 * limite la largeur de lecture au lieu d'étirer une colonne de texte sur toute
 * la dalle. C'est ce que fait le web : au-delà d'environ 700 points, une ligne
 * devient pénible à suivre.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../config/theme';

export default function Screen({
  children,
  style,
  edges = ['top'],
  centered = false,   // limite la largeur sur grand écran
  background,         // 'app' | 'card'
}) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();

  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const bg = background === 'card' ? colors.bgCard : colors.bgApp;

  if (centered && layout.isTablet) {
    return (
      <View style={[styles.root, { backgroundColor: bg }, pad, style]}>
        <View style={[styles.centered, { maxWidth: layout.readingWidth }]}>{children}</View>
      </View>
    );
  }

  return <View style={[styles.root, { backgroundColor: bg }, pad, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, width: '100%', alignSelf: 'center' },
});
