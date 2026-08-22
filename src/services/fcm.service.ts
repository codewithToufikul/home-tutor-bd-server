import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let isFcmInitialized = false;

const initializeFcm = () => {
  if (isFcmInitialized) return;

  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
      const serviceAccount = JSON.parse(serviceAccountVar);
      initializeApp({
        credential: cert(serviceAccount),
      });
      isFcmInitialized = true;
      console.log('🔥 FCM (Firebase Cloud Messaging) Initialized via ENV JSON');
    } else {
      console.warn('⚠️ FCM Warning: FIREBASE_SERVICE_ACCOUNT environment variable is not set. Push notifications will be logged in mock mode.');
    }
  } catch (err) {
    console.warn('⚠️ FCM Initialization Error:', err instanceof Error ? err.message : err);
  }
};

initializeFcm();

export const sendFcmNotification = async (payload: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) => {
  if (!payload.tokens || payload.tokens.length === 0) {
    return;
  }

  if (!isFcmInitialized) {
    console.log(`📱 [FCM Mock Push Notification] To ${payload.tokens.length} devices | Title: "${payload.title}" | Body: "${payload.body}"`);
    return;
  }

  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: payload.tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    console.log(`📱 FCM Push Notification sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);
  } catch (err) {
    console.error('❌ Failed to send FCM Push Notification:', err);
  }
};
