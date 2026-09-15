/**
 * E-Majlis — point d'entrée.
 *
 * Modifié le 11/09/2026 :
 *   - `ThemeProvider` enveloppe l'application : le thème clair/sombre et les
 *     dimensions de l'écran deviennent disponibles partout ;
 *   - la barre d'état était figée en « dark-content » sur fond blanc, illisible
 *     en thème sombre. Elle suit désormais le thème (c'est `ThemeProvider` qui
 *     la règle) ;
 *   - `SafeAreaProvider` remonte au-dessus du reste : les encoches et la barre
 *     de navigation doivent être connues avant le premier rendu des écrans.
 */

import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from './src/config/theme';
import { LangProvider } from './src/context/LangContext';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
