/**
 * Navigation.
 *
 * Modifications du 10/09/2026 :
 *   - **onglet Documents** : le Drive est la partie la plus utilisÃ©e de la
 *     plateforme (plusieurs milliers de fichiers) et n'avait aucune entrÃ©e dans
 *     l'application ;
 *   - **onglet Profil** : le profil n'Ã©tait accessible que par l'avatar de
 *     l'accueil, invisible depuis les autres onglets ;
 *   - l'agenda rejoint la pile d'accueil, avec un bouton dans l'en-tÃªte : cinq
 *     onglets restent lisibles, six ne le sont plus. Aucun Ã©cran n'est perdu ;
 *   - la porte d'entrÃ©e regarde le **jeton**, plus l'objet utilisateur. Au
 *     dÃ©marrage, le jeton est restaurÃ© avant le profil : tester `user` renvoyait
 *     briÃ¨vement Ã  l'Ã©cran de connexion une session pourtant valide ;
 *   - les Ã©crans communs sont dÃ©clarÃ©s dans chaque pile qui peut les atteindre,
 *     pour qu'aucune navigation ne se termine par une erreur silencieuse.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import EspacesScreen from '../screens/EspacesScreen';
import SpaceDetailScreen from '../screens/SpaceDetailScreen';
import DriveScreen from '../screens/DriveScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ContentDetailScreen from '../screens/ContentDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import CalendrierScreen from '../screens/CalendrierScreen';
import EServicesScreen from '../screens/EServicesScreen';
import MesDemandesScreen from '../screens/MesDemandesScreen';
import DemandeFormScreen from '../screens/DemandeFormScreen';
import DemandeDetailScreen from '../screens/DemandeDetailScreen';
import AdminDemandesScreen from '../screens/AdminDemandesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MembresScreen from '../screens/MembresScreen';
import WebViewScreen from '../screens/WebViewScreen';

// `MembreDetailScreen` n'est plus dÃ©clarÃ© : il reposait sur `/user/{id}`, qui
// rÃ©pond 401 Ã  un membre ordinaire (BG-14). La fiche d'une personne s'ouvre
// dÃ©sormais sur son profil web, depuis l'Ã©cran des membres. Le fichier est
// conservÃ© sur disque en attendant sa suppression.
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { Colors } from '../config/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const stackOpts = {
  headerShown: false,
  cardStyle: { backgroundColor: Colors.bgApp },
};

/** Ã‰crans atteignables depuis presque partout : dÃ©clarÃ©s dans chaque pile. */
function commonScreens() {
  return (
    <>
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Drive" component={DriveScreen} />
      <Stack.Screen name="SpaceDetail" component={SpaceDetailScreen} />
      <Stack.Screen name="WebView" component={WebViewScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Calendrier" component={CalendrierScreen} />
      {commonScreens()}
    </Stack.Navigator>
  );
}

function EspacesStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="EspacesMain" component={EspacesScreen} />
      <Stack.Screen name="Membres" component={MembresScreen} />
      {commonScreens()}
    </Stack.Navigator>
  );
}

function EServicesStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="EServicesMain" component={EServicesScreen} />
      <Stack.Screen name="MesDemandes" component={MesDemandesScreen} />
      <Stack.Screen name="DemandeForm" component={DemandeFormScreen} />
      <Stack.Screen name="DemandeDetail" component={DemandeDetailScreen} />
      <Stack.Screen name="AdminDemandes" component={AdminDemandesScreen} />
      <Stack.Screen name="Membres" component={MembresScreen} />
      {commonScreens()}
    </Stack.Navigator>
  );
}

function DocumentsStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="DocumentsMain" component={DocumentsScreen} />
      {commonScreens()}
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Membres" component={MembresScreen} />
      {commonScreens()}
    </Stack.Navigator>
  );
}

function TabIcon({ iconActive, iconInactive, focused, isCenter }) {
  if (isCenter) {
    return (
      <View style={[tabStyles.centerWrap, focused && tabStyles.centerWrapActive]}>
        <Ionicons name={focused ? iconActive : iconInactive} size={18} color={focused ? '#fff' : Colors.primary} />
      </View>
    );
  }
  return (
    <View style={tabStyles.iconWrap}>
      {focused && <View style={tabStyles.activeBar} />}
      <Ionicons name={focused ? iconActive : iconInactive} size={21} color={focused ? Colors.primary : Colors.textMuted} />
    </View>
  );
}

function MainTabs() {
  const { t } = useLang();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.tabBar,
        tabBarLabelStyle: tabStyles.label,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarItemStyle: tabStyles.tabItem,
        // CRITICAL FIX: unmount inactive tab stacks so they stop firing
        // background requests. Without this, HomeStack keeps loading feed
        // filters while the user is on Espaces, saturating the socket pool.
        unmountOnBlur: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: t('Accueil', 'Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©'),
          tabBarIcon: ({ focused }) => <TabIcon iconActive="home" iconInactive="home-outline" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Espaces"
        component={EspacesStack}
        options={{
          tabBarLabel: t('Espaces', 'Ø§Ù„ÙØ¶Ø§Ø¡Ø§Øª'),
          tabBarIcon: ({ focused }) => <TabIcon iconActive="grid" iconInactive="grid-outline" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="EServices"
        component={EServicesStack}
        options={{
          tabBarLabel: t('Services', 'Ø§Ù„Ø®Ø¯Ù…Ø§Øª'),
          tabBarIcon: ({ focused }) => <TabIcon iconActive="apps" iconInactive="apps-outline" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsStack}
        options={{
          tabBarLabel: t('Documents', 'Ø§Ù„ÙˆØ«Ø§Ø¦Ù‚'),
          tabBarIcon: ({ focused }) => <TabIcon iconActive="folder-open" iconInactive="folder-open-outline" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Compte"
        component={ProfileStack}
        options={{
          tabBarLabel: t('Profil', 'Ø§Ù„Ù…Ù„Ù'),
          tabBarIcon: ({ focused }) => <TabIcon iconActive="person" iconInactive="person-outline" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  // `token` et non `user` : au dÃ©marrage le jeton est restaurÃ© avant le profil.
  const { token, loading } = useAuth();
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token
          ? <Stack.Screen name="Login" component={LoginScreen} />
          : <Stack.Screen name="Main" component={MainTabs} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const TAB_HEIGHT = Platform.OS === 'ios' ? 82 : 64;
const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF', borderTopWidth: 0,
    height: TAB_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8, paddingTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  tabItem: { paddingTop: 4 },
  label: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.2, marginTop: 2 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative', paddingTop: 2 },
  activeBar: { position: 'absolute', top: -8, width: 20, height: 3, borderRadius: 2, backgroundColor: Colors.primary },
  centerWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -2, borderWidth: 1.5, borderColor: `${Colors.primary}25`,
  },
  centerWrapActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 6, elevation: 6,
  },
});

