/**
 * OneSignal Universal Push Notification Service
 * Dispatches push notifications seamlessly to Web browsers and Mobile Apps (iOS / Android)
 * using OneSignal's external_id unified identity model.
 */

interface SendPushOptions {
  userIds?: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
  icon?: string;
}

export const sendOneSignalPush = async ({
  userIds,
  title,
  message,
  url,
  data = {},
  icon,
}: SendPushOptions): Promise<boolean> => {
  const appId = process.env.ONESIGNAL_APP_ID || '44dd5693-e9aa-421a-8e15-9301b88acf22';
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    console.warn('[OneSignal] REST API Key is missing in environment variables.');
    return false;
  }

  if (!userIds || userIds.length === 0) {
    return false;
  }

  // Filter valid string IDs
  const validUserIds = userIds.map((id) => String(id)).filter(Boolean);
  if (validUserIds.length === 0) return false;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const targetUrl = url ? (url.startsWith('http') ? url : `${clientUrl}${url}`) : clientUrl;

  const payload: Record<string, any> = {
    app_id: appId,
    target_channel: 'push',
    include_aliases: {
      external_id: validUserIds,
    },
    headings: {
      en: title,
    },
    contents: {
      en: message,
    },
    url: targetUrl,
    data: {
      ...data,
      click_action: targetUrl,
    },
  };

  if (icon) {
    payload.chrome_web_icon = icon;
    payload.chrome_icon = icon;
  }

  console.log(`[OneSignal] Attempting to send push to User(s):`, validUserIds, `Title: "${title}"`);

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = (await response.json()) as any;
    console.log(`[OneSignal] Response status: ${response.status}`, resData);

    if (!response.ok || (resData.errors && resData.errors.length > 0)) {
      console.warn('[OneSignal] Push warning/error details:', resData);
      return false;
    }

    console.log(`[OneSignal] Push successfully accepted by OneSignal! Recipients count: ${resData?.recipients || 0}`);
    return true;
  } catch (err) {
    console.error('[OneSignal] Push request network/system failed:', err);
    return false;
  }
};

export const sendBroadcastPush = async ({
  title,
  message,
  url,
  data = {},
}: {
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
}): Promise<boolean> => {
  const appId = process.env.ONESIGNAL_APP_ID || '44dd5693-e9aa-421a-8e15-9301b88acf22';
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) return false;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const targetUrl = url ? (url.startsWith('http') ? url : `${clientUrl}${url}`) : clientUrl;

  const payload = {
    app_id: appId,
    included_segments: ['Subscribed Users', 'Total Subscriptions'],
    headings: { en: title },
    contents: { en: message },
    url: targetUrl,
    data,
  };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (err) {
    console.error('[OneSignal] Broadcast push error:', err);
    return false;
  }
};
