/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, UserCredential } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc, deleteDoc, getDoc, terminate, setLogLevel, query, limit } from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch (e) {}

import firebaseConfig from '../../firebase-applet-config.json';

// Double-wrapped configuration resolver
let isFirebaseConfigured = false;
let app: any = null;
let db: any = null;
let auth: any = null;

const checkLocalStorageQuota = () => {
  try {
    return localStorage.getItem('fs_quota_exceeded') === 'true' || sessionStorage.getItem('fs_quota_exceeded') === 'true';
  } catch {
    return false;
  }
};

export function terminateFirestore() {
  if (db) {
    console.warn("Campaign Panel: Terminating client-side Firestore connection due to Quota limits.");
    const oldDb = db;
    db = null;
    isFirebaseConfigured = false;
    terminate(oldDb).catch(() => {});
  }
}

// Async initialization check to prevent Firestore from starting if quota is exceeded
const initFirebasePromise = (async () => {
  try {
    const isPlaceholderConfig = !firebaseConfig || 
                                !firebaseConfig.apiKey || 
                                firebaseConfig.apiKey.includes('remixed-') || 
                                firebaseConfig.projectId === 'remixed-project-id' ||
                                firebaseConfig.apiKey === 'MY_FIREBASE_API_KEY';

    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && !isPlaceholderConfig) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      
      // Proactively check both server-side lock status and localStorage
      let serverQuotaExceeded = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const sRes = await fetch('/api/db/get', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (sRes.ok) {
          const sDb = await sRes.json();
          if (sDb && sDb.isFirestoreQuotaExceededServer) {
            serverQuotaExceeded = true;
          }
        }
      } catch (err) {
        console.warn("Pre-init server quota check skipped/offline:", err);
      }

      const cachedQuota = checkLocalStorageQuota();

      const localIsQuotaError = (err: any): boolean => {
        if (!err) return false;
        const errMsg = String(err.message || err).toLowerCase();
        const errCode = String(err.code !== undefined ? err.code : '').toLowerCase();
        return (
          (errCode === "resource-exhausted" ||
          errCode === "resource_exhausted" ||
          errCode === "8" ||
          errCode.includes("quota") ||
          errMsg.includes("quota") ||
          errMsg.includes("exhausted") ||
          errMsg.includes("billing") ||
          errMsg.includes("limit exceeded") ||
          errMsg.includes("resource_exhausted")) &&
          !errMsg.includes("timeout") &&
          !errMsg.includes("timed out")
        );
      };

      if (serverQuotaExceeded || cachedQuota) {
        isFirebaseConfigured = false;
        console.warn('Campaign Panel: Skipping Firestore initialization because a quota exceeded state is cached or reported by server.');
        try {
          localStorage.setItem('fs_quota_exceeded', 'true');
          sessionStorage.setItem('fs_quota_exceeded', 'true');
        } catch {}
        terminateFirestore();
      } else {
        const testDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
        try {
          const runWithTimeout = <T>(promise: Promise<T>, timeoutMs: number = 1500, label: string): Promise<T> => {
            return Promise.race([
              promise,
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Firestore ${label} check timed out`)), timeoutMs))
            ]);
          };

          // Probe Firestore with a lightweight check to verify if the free tier read quota is exceeded
          const testQuery = query(collection(testDb, "settings"), limit(1));
          await runWithTimeout(getDocs(testQuery), 1500, "read");

          db = testDb;
          isFirebaseConfigured = true;
          console.log('Campaign Panel: Real Firebase Backend successfully initialized and verified active.');
        } catch (testErr: any) {
          console.warn("Campaign Panel: Proactive Firebase Dry-run check failed:", testErr.message || testErr);
          const isTimeout = testErr && (testErr.message === "Firestore operation timed out" || String(testErr).toLowerCase().includes("timeout") || String(testErr.message || testErr).toLowerCase().includes("timeout") || String(testErr.message || testErr).toLowerCase().includes("timed out"));
          if (localIsQuotaError(testErr)) {
            try {
              localStorage.setItem('fs_quota_exceeded', 'true');
              sessionStorage.setItem('fs_quota_exceeded', 'true');
            } catch {}
            fetch('/api/db/report-quota', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }).catch(() => {});
            isFirebaseConfigured = false;
            try {
              terminate(testDb).catch(() => {});
            } catch {}
          } else if (isTimeout) {
            console.warn("Campaign Panel: Proactive dry-run connection timed out. Using standard Firebase but not locking down.");
            db = testDb;
            isFirebaseConfigured = true;
          } else {
            isFirebaseConfigured = false;
            try {
              terminate(testDb).catch(() => {});
            } catch {}
          }
        }
      }
    } else {
      isFirebaseConfigured = false;
      console.warn('Campaign Panel: Mock/placeholder Firebase config detected. Falling back to central Express REST server.');
    }
  } catch (e) {
    isFirebaseConfigured = false;
    console.warn('Campaign Panel: Firebase initialization error:', e);
  }
})();

export { app, db, auth, isFirebaseConfigured, collection, getDocs, setDoc, deleteDoc, getDoc, doc, initFirebasePromise };

// Custom Firestore Action error handler according to firebase-integration skill 
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || 'simulated_user_id',
      email: auth?.currentUser?.email || 'simulated@gmail.com',
      emailVerified: auth?.currentUser?.emailVerified || true,
      isAnonymous: auth?.currentUser?.isAnonymous || false,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Secure Guard Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection safely
export async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration and internet connectivity.");
    }
  }
}
