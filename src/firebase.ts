import "fake-indexeddb/auto";
import { initializeApp } from 'firebase/app';
import { initializeAnalytics, isSupported, logEvent as firebaseLogEvent, Analytics } from 'firebase/analytics';


// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB-DvvsX1hcamnonJfXkBnpJzB90ryj0jY",
    authDomain: "bolt-downloader.firebaseapp.com",
    projectId: "bolt-downloader",
    storageBucket: "bolt-downloader.firebasestorage.app",
    messagingSenderId: "135427754994",
    appId: "1:135427754994:web:acc7cdb1dc4363af39f96b",
    measurementId: "G-2YLK6BFDS9"
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
