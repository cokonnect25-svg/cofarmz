// lib/firebase.ts
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, ref, set, push, onValue, onDisconnect, Database } from 'firebase/database';

let analytics: any = null;
let logEventFn: any = null;
let db: Database | null = null;

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

// Initialize Realtime Database
if (typeof window !== 'undefined') {
  db = getDatabase(app);
  
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

// ── USER PRESENCE & ACTIVITY TRACKING ──

interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  currentPage: string;
  lastSeen: number;
  platform: string;
}

export const setUserOnline = (userId: string, userInfo: Partial<UserInfo>): void => {
  if (!db) return;
  const userRef = ref(db, `presence/${userId}`);
  set(userRef, {
    ...userInfo,
    state: 'online',
    lastSeen: Date.now(),
  });
  
  import('firebase/database').then(({ onDisconnect }) => {
    onDisconnect(userRef).update({
      state: 'offline',
      lastSeen: Date.now(),
    });
  });
};

// ── PAGE VIEW TRACKING ──

interface PageViewData {
  viewerId: string;
  viewerName: string | null;
  viewerEmail: string | null;
  viewerRole?: string;
  pageType: 'user_profile' | 'farmer_profile' | 'machinery_details' | 'machinery_list' | 'nearby_farmers' | 'reservation' | 'other';
  targetId: string;  // userId, farmerId, machineryId, etc.
  targetName?: string;
  metadata?: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

// Generate unique session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('tracking_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tracking_session_id', sessionId);
  }
  return sessionId;
};

export const trackPageView = (data: Omit<PageViewData, 'timestamp' | 'sessionId'>): void => {
  if (!db) return;
  
  const viewRef = push(ref(db, `page_views/${data.pageType}/${data.targetId}`));
  const fullData: PageViewData = {
    ...data,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  };
  
  set(viewRef, fullData);
  
  // Also log to user's personal activity log
  if (data.viewerId) {
    const userActivityRef = push(ref(db, `user_activity/${data.viewerId}`));
    set(userActivityRef, {
      action: 'page_view',
      pageType: data.pageType,
      targetId: data.targetId,
      targetName: data.targetName,
      metadata: data.metadata,
      timestamp: Date.now(),
    });
  }
  
  // Also log to analytics if available
  if (analytics && logEventFn) {
    logEventFn(analytics, 'page_view', {
      page_type: data.pageType,
      target_id: data.targetId,
      viewer_id: data.viewerId,
    });
  }
};

// ── ACTION TRACKING (filters, clicks, bookings) ──

export const trackUserAction = (
  viewerId: string,
  action: string,
  data: {
    pageType: string;
    targetId?: string;
    metadata?: Record<string, any>;
  }
): void => {
  if (!db) return;
  
  const actionRef = push(ref(db, `actions/${viewerId}`));
  set(actionRef, {
    action,
    pageType: data.pageType,
    targetId: data.targetId,
    metadata: data.metadata,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  });
  
  // Also log to page-specific actions
  if (data.targetId) {
    const pageActionRef = push(ref(db, `page_actions/${data.pageType}/${data.targetId}`));
    set(pageActionRef, {
      action,
      viewerId,
      metadata: data.metadata,
      timestamp: Date.now(),
    });
  }
};

// ── REALTIME SUBSCRIBERS ──

export const getOnlineUsers = (callback: (users: any[]) => void): (() => void) => {
  if (!db) return () => {};
  const presenceRef = ref(db, 'presence');
  return onValue(presenceRef, (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((child) => {
      const val = child.val();
      if (val.state === 'online') {
        users.push({ uid: child.key, ...val });
      }
    });
    callback(users);
  });
};

export const getUserActivity = (userId: string, callback: (activities: any[]) => void): (() => void) => {
  if (!db) return () => {};
  const activityRef = ref(db, `user_activity/${userId}`);
  return onValue(activityRef, (snapshot) => {
    const activities: any[] = [];
    snapshot.forEach((child) => {
      activities.push({ id: child.key, ...child.val() });
    });
    callback(activities.reverse());
  });
};

// ── GET PAGE VIEWS FOR SPECIFIC TARGET ──

export const getPageViews = (
  pageType: string,
  targetId: string,
  callback: (views: any[]) => void
): (() => void) => {
  if (!db) return () => {};
  const viewsRef = ref(db, `page_views/${pageType}/${targetId}`);
  return onValue(viewsRef, (snapshot) => {
    const views: any[] = [];
    snapshot.forEach((child) => {
      views.push({ id: child.key, ...child.val() });
    });
    callback(views.reverse());
  });
};


export const getAllPageViews = (
  pageType: string,
  callback: (views: any[]) => void
): (() => void) => {
  if (!db) return () => {};
  const viewsRef = ref(db, `page_views/${pageType}`);
  return onValue(viewsRef, (snapshot) => {
    const allViews: any[] = [];
    snapshot.forEach((targetChild) => {
      const targetId = targetChild.key;
      targetChild.forEach((viewChild) => {
        allViews.push({
          id: viewChild.key,
          targetId,
          ...viewChild.val(),
        });
      });
    });
    callback(allViews.sort((a, b) => b.timestamp - a.timestamp));
  });
};

// ── GET ALL ACTIONS ──

export const getAllActions = (
  callback: (actions: any[]) => void
): (() => void) => {
  if (!db) return () => {};
  const actionsRef = ref(db, 'actions');
  return onValue(actionsRef, (snapshot) => {
    const allActions: any[] = [];
    snapshot.forEach((userChild) => {
      const userId = userChild.key;
      userChild.forEach((actionChild) => {
        allActions.push({
          id: actionChild.key,
          viewerId: userId,
          ...actionChild.val(),
        });
      });
    });
    callback(allActions.sort((a, b) => b.timestamp - a.timestamp));
  });
};

interface LogParams {
  [key: string]: string | number | boolean | undefined;
}

export const logPageView = (pageName: string, params: LogParams = {}): void => {
  if (analytics && logEventFn) {
    logEventFn(analytics, 'page_view', {
      page_title: pageName,
      page_location: typeof window !== 'undefined' ? window.location.href : '',
      ...params,
    });
  }
};

export const logUserAction = (action: string, params: LogParams = {}): void => {
  if (analytics && logEventFn) {
    logEventFn(analytics, action, {
      user_id: auth.currentUser?.uid,
      timestamp: new Date().toISOString(),
      platform: 'capacitor',
      ...params,
    });
  }
};