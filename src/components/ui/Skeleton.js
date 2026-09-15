/**
 * Blocs de chargement.
 *
 * Un grand rond qui tourne au milieu d'un écran blanc ne dit rien de ce qui
 * arrive. Des blocs à la forme du contenu attendu rendent l'attente plus courte
 * — et, en thème sombre, ne font pas clignoter l'écran en blanc.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../config/theme';

export function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Quelques cartes fantômes, à la forme d'une liste de contenus. */
export function SkeletonList({ count = 4, variant = 'card' }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.block,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.borderLight,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: 8,
            },
          ]}
        >
          {variant === 'card' ? (
            <>
              <View style={styles.row}>
                <Skeleton width={70} height={16} radius={999} />
                <View style={{ flex: 1 }} />
                <Skeleton width={44} height={10} />
              </View>
              <Skeleton width="88%" height={15} />
              <Skeleton width="62%" height={12} />
            </>
          ) : (
            <View style={styles.row}>
              <Skeleton width={38} height={38} radius={19} />
              <View style={{ flex: 1, gap: 7 }}>
                <Skeleton width="70%" height={13} />
                <Skeleton width="45%" height={10} />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
