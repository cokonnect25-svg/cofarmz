// lib/firebase.ts
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

let analytics: any = null;
let logEventFn: any = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!
};

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Initialize analytics only on client side
if (typeof window !== 'undefined') {
  (async () => {
    try {
      const { getAnalytics, logEvent } = await import('firebase/analytics');
      analytics = getAnalytics(app);
      logEventFn = logEvent;
    } catch (err) {
      console.warn('Analytics failed to load:', err);
    }
  })();
}

interface LogParams {
  [key: string]: string | number | boolean | undefined;
}

export const logPageView = (pageName: string, params: LogParams = {}): void => {
  if (analytics && logEventFn) {
    logEventFn(analytics, 'page_view', {
      page_title: pageName,
      page_location: window.location.href,
      ...params
    });
  }
};

export const logUserAction = (action: string, params: LogParams = {}): void => {
  if (analytics && logEventFn) {
    logEventFn(analytics, action, {
      user_id: auth.currentUser?.uid,
      timestamp: new Date().toISOString(),
      platform: 'capacitor',
      ...params
    });
  }
};