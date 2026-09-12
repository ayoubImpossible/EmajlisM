# eMajlis – Application Mobile CSEFRS

Application mobile officielle du **Conseil Supérieur de l'Éducation, de la Formation et de la Recherche Scientifique** (CSEFRS) du Maroc.

Construite avec **Expo + React Native (JS)** et connectée aux trois backends PHP du site emajlis.

---

## Architecture

```
emajlis-app/
├── App.js                         # Point d'entrée, providers globaux
├── app.json                       # Config Expo (name, bundle IDs, plugins)
├── .env                           # Variables d'environnement (à copier en .env.local)
├── google-services.json           # Config Firebase Android (remplacer par le vrai)
│
└── src/
    ├── config/
    │   ├── api.js                 # URLs backend + constantes pagination/catégories
    │   ├── firebase.js            # Init Firebase (Auth, Firestore, Storage)
    │   └── theme.js               # Couleurs, espacements, ombres (extrait de theme1.css)
    │
    ├── context/
    │   ├── LangContext.js         # Switcher FR/AR + gestion RTL
    │   └── AuthContext.js         # JWT login contre /membre/api/login
    │
    ├── services/
    │   ├── membreService.js       # Appels /membre/api/membres
    │   ├── publicationService.js  # Appels /publi/api/publications
    │   └── notificationService.js # Enregistrement Expo Push / FCM
    │
    ├── components/
    │   ├── common/
    │   │   ├── Header.js
    │   │   ├── SearchBar.js
    │   │   ├── LoadingSpinner.js
    │   │   └── EmptyState.js
    │   ├── membre/
    │   │   └── MembreCard.js
    │   └── publication/
    │       └── PublicationCard.js
    │
    ├── screens/
    │   ├── HomeScreen.js              # Dashboard + stats
    │   ├── MembresScreen.js           # Liste des membres (search + filtres)
    │   ├── MembreDetailScreen.js      # Profil complet d'un membre
    │   ├── PublicationsScreen.js      # Liste des publications (search + catégories)
    │   ├── PublicationDetailScreen.js # Détail + téléchargements
    │   └── SettingsScreen.js          # Langue, notifications, compte
    │
    └── navigation/
        └── AppNavigator.js            # Bottom tabs + stacks imbriqués
```

---

## Backends connectés

| Service | URL | Description |
|---------|-----|-------------|
| **Membres** | `/membre/api/membres` | Annuaire des ~100 membres du Conseil |
| **Publications** | `/publi/api/publications` | Rapports, avis, études |
| **HumHub** | `/api/v1` | Réseau social institutionnel (REST v0.11.2) |

---

## Setup rapide

### 1. Prérequis
- Node.js 18+
- npm 10+
- Expo CLI : `npm install -g expo-cli`
- Expo Go sur votre téléphone (Android/iOS)

### 2. Configuration
```bash
# Cloner et entrer dans le projet
cd emajlis-app

# Créer le fichier de config local
cp .env .env.local
```

Éditer `.env.local` :
```
EXPO_PUBLIC_BASE_URL=http://<IP_DE_VOTRE_SERVEUR>
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
# etc.
```

### 3. Firebase
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Créer un projet (ou utiliser celui de la plateforme existante avec le module `fcm-push`)
3. Ajouter une app Android (package : `ma.csefrs.emajlis`)
4. Télécharger `google-services.json` → le placer à la racine du projet
5. Remplacer les valeurs dans `src/config/firebase.js`

### 4. Lancer l'app
```bash
npm start
# Scanner le QR code avec Expo Go
```

### 5. Build production
```bash
# Installer EAS CLI
npm install -g eas-cli

# Configurer
eas build:configure

# Build Android APK
eas build --platform android --profile preview
```

---

## Fonctionnalités

- 🏠 **Dashboard** – stats globales des publications, accès rapide
- 👥 **Membres** – annuaire bilingue FR/AR, filtres (bureau, GSTFC, présidents, rapporteurs), profil complet
- 📚 **Publications** – rapports, avis, études avec filtres par catégorie, téléchargement des fichiers PDF
- 🔔 **Notifications push** – Firebase Cloud Messaging (même projet que le module HumHub `fcm-push`)
- 🌐 **Bilingue** – Français / Arabe avec support RTL complet
- 🔐 **Auth JWT** – login admin contre l'API `/membre`

---

## Variables d'environnement (`EXPO_PUBLIC_*`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_BASE_URL` | URL du serveur (ex: `http://192.168.1.100`) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Clé API Firebase |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domaine Firebase Auth |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket Firebase Storage |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID FCM |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | App ID Firebase |
