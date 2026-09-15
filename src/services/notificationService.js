/**
 * Notification Service
 * Registers the device for Expo push notifications and wraps FCM token management.
 * The site's HumHub 'fcm-push' module consumes these tokens on the backend.
 */
import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';

// How foreground notifications should be presented
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

/**
 * Request permission and return the Expo push token.
 * Returns null if the device is a simulator or permission was denied.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted.');
    return null;
  }

  // For Expo Go / bare workflow
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenData.data;
  console.log('[Notifications] Expo push token:', token);

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:       'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#21A1B3',
    });
  }

  return token;
}

/**
 * Listen for incoming notifications while the app is in the foreground.
 * @param {function} onReceive  callback(notification)
 * @returns cleanup function
 */
export function addNotificationListener(onReceive) {
  const sub = Notifications.addNotificationReceivedListener(onReceive);
  return () => sub.remove();
}

/**
 * Listen for user tapping a notification.
 * @param {function} onResponse  callback(response)
 * @returns cleanup function
 */
export function addResponseListener(onResponse) {
  const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => sub.remove();
}
