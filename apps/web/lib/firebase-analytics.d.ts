// lib/firebase-analytics.d.ts
declare module 'firebase/analytics' {
  import { FirebaseApp } from 'firebase/app';
  
  export interface Analytics {
    app: FirebaseApp;
  }
  
  export function getAnalytics(app?: FirebaseApp): Analytics;
  export function logEvent(analyticsInstance: Analytics, eventName: string, eventParams?: Record<string, any>): void;
  export function isSupported(): Promise<boolean>;
}