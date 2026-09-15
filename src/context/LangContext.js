/**
 * Langue et sens de lecture (français / arabe).
 *
 * Corrigé le 10/09/2026 — `I18nManager.forceRTL()` était appelé à chaque
 * démarrage dès que l'arabe était mémorisé. Or `forceRTL` ne prend effet
 * qu'après un redémarrage complet de l'application : le résultat était un état
 * incohérent, `isRTL === true` côté JavaScript pendant que la mise en page
 * restait en LTR, jusqu'à ce que l'utilisateur ferme et rouvre l'application.
 * Le changement de langue paraissait ne « marcher qu'une fois sur deux ».
 *
 * L'application ne force donc plus la mise en page native. Le sens de lecture
 * est appliqué dans les styles, où il est immédiat et réversible :
 *   - `isRTL` pour les décisions de mise en page (flexDirection, icônes) ;
 *   - `dirStyle` pour le texte (textAlign + writingDirection).
 *
 * `allowRTL(true)` reste posé : il autorise le rendu RTL du texte arabe
 * (ponctuation, chiffres, texte bidirectionnel) sans retourner l'interface.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANG } from '../config/api';

const LangContext = createContext(null);
const STORAGE_KEY = 'lang';

// Autorise le rendu bidirectionnel du texte, sans retourner la mise en page.
I18nManager.allowRTL(true);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved === 'ar' || saved === 'fr') setLangState(saved); })
      .catch(() => {});
  }, []);

  const value = useMemo(() => {
    const isRTL = lang === 'ar';

    const setLang = (next, persist = true) => {
      if (next !== 'fr' && next !== 'ar') return;
      setLangState(next);
      if (persist) AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    };

    return {
      lang,
      setLang,
      isRTL,
      /** Valeur française ou arabe, selon la langue courante. */
      t: (fr, ar) => (isRTL ? ar : fr),
      /** Style de texte à étaler sur un <Text> : `style={[s.txt, dirStyle]}`. */
      dirStyle: {
        textAlign: isRTL ? 'right' : 'left',
        writingDirection: isRTL ? 'rtl' : 'ltr',
      },
      /** Sens d'une rangée. */
      rowDirection: isRTL ? 'row-reverse' : 'row',
      /** Icône de progression, dans le bon sens. */
      forwardIcon: isRTL ? 'chevron-back' : 'chevron-forward',
      backIcon: isRTL ? 'arrow-forward' : 'arrow-back',
    };
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
