import "fake-indexeddb/auto";
import { initializeApp } from 'firebase/app';
import { initializeAnalytics, isSupported, logEvent as firebaseLogEvent, Analytics } from 'firebase/analytics';


// Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics
// We check if window is defined because this might run in main process (though we target renderer)
// and strict environments might throw if 'window' or 'document' is missing.
let analytics: Analytics | null = null;

const initAnalytics = async () => {
    if (typeof window !== 'undefined') {
        try {
            const supported = await isSupported();
            if (supported) {
                analytics = initializeAnalytics(app);
                console.log("[Analytics] Initialization successful. Supported: true");
            } else {
                console.warn("[Analytics] Initialization skipped. Supported: false (Environment mismatch)");
            }
        } catch (e) {
            console.warn("[Analytics] Failed to initialize:", e);
        }
    }
};

// Kick off initialization
initAnalytics();


export const logEvent = (eventName: string, eventParams?: { [key: string]: any }) => {
    if (analytics) {
        try {
            firebaseLogEvent(analytics, eventName, eventParams);
            console.log(`[Analytics] Logged: ${eventName}`, eventParams);
        } catch (error) {
            console.warn(`[Analytics] Failed to log event: ${eventName}`, error);
        }
    } else {
        // In dev or dry-run, we might still want to see this
        console.debug(`[Analytics (Dry Run)] ${eventName}`, eventParams);
    }
};

export const logError = (error: any) => {
    logEvent('app_exception', {
        description: error?.message || String(error),
        fatal: false
    });
};

export default app;
