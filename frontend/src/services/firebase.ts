import { initializeApp } from 'firebase/app';
import {
    GoogleAuthProvider,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    initializeAuth,
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Firebase project: gtavi-6991d ("HuaPlay")
 * Web app:          1:310696387200:web:867537fd06a46180bbfc65
 *
 * These values are not secrets. A Firebase web config identifies the project to
 * the client and is expected to ship in the bundle — access is controlled by
 * Authentication and Security Rules, not by hiding this object. Fetched with:
 *   npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID> --project gtavi-6991d
 */
const firebaseConfig = {
    apiKey: 'AIzaSyDZdqn-UYb3e2Qo0si-fc9g43T8IZNaL6A',
    authDomain: 'gtavi-6991d.firebaseapp.com',
    projectId: 'gtavi-6991d',
    storageBucket: 'gtavi-6991d.firebasestorage.app',
    messagingSenderId: '310696387200',
    appId: '1:310696387200:web:867537fd06a46180bbfc65',
    measurementId: 'G-E4B316WGEC',
};

export const app = initializeApp(firebaseConfig);

// Omit popupRedirectResolver at startup so Firebase doesn't inject the
// ~134KB third-party auth iframe + gapi scripts on public page loads.
// browserPopupRedirectResolver is passed directly to signInWithPopup on demand.
export const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

let firestorePromise: Promise<Firestore> | null = null;

/** Lazily loads the Firestore SDK only when a signed-in user reads/writes user data. */
export function getFirestoreDb(): Promise<Firestore> {
    if (!firestorePromise) {
        firestorePromise = import('firebase/firestore').then(({ getFirestore }) => getFirestore(app));
    }
    return firestorePromise;
}

export const googleProvider = new GoogleAuthProvider();
// Always let the user pick an account rather than silently reusing the last one.
googleProvider.setCustomParameters({ prompt: 'select_account' });
