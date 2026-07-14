import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import type { AgentSession, CopilotMessage } from '@sfcc/shared';
import type { AppModule, UserRole } from '@sfcc/shared';

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  grantedModules: AppModule[];
  createdAt: string;
  updatedAt: string;
}

export interface UiPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  copilotOpen: boolean;
  defaultDevHub?: string;
}

export interface Template {
  id: string;
  name: string;
  type: 'scratch_org' | 'sfdmu' | 'query' | 'org_setup';
  config: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

let app: App | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let usingInMemory = false;
let devAuthWarned = false;

function loadServiceAccountFromFile(): FirebaseConfig | null {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, 'utf8')) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!json.project_id || !json.client_email || !json.private_key) return null;
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch {
    return null;
  }
}

function resolveFirebaseProjectId(tokenAud?: string): string {
  const configured = process.env.FIREBASE_PROJECT_ID?.trim();
  if (configured && !configured.includes('your-firebase') && !configured.includes('your-project')) {
    return configured;
  }
  if (tokenAud) return tokenAud;
  throw new Error('FIREBASE_PROJECT_ID is required');
}

function verifyIdTokenDev(token: string): DecodedIdToken {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8'),
  ) as {
    sub: string;
    email?: string;
    aud: string;
    iss: string;
    exp: number;
  };

  if (!payload.sub) throw new Error('Token missing sub');
  if (payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  const projectId = resolveFirebaseProjectId(payload.aud);
  if (payload.aud !== projectId) throw new Error(`Invalid audience: ${payload.aud}`);
  const expectedIss = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIss) throw new Error(`Invalid issuer: ${payload.iss}`);

  return { ...payload, uid: payload.sub } as DecodedIdToken;
}

function isValidServiceAccountCredentials(
  projectId: string | undefined,
  clientEmail: string | undefined,
  privateKey: string | undefined,
): boolean {
  if (!projectId || !clientEmail || !privateKey) return false;
  if (projectId.includes('your-firebase') || clientEmail.includes('your-project')) return false;
  const trimmedKey = privateKey.trim();
  if (!trimmedKey.includes('BEGIN PRIVATE KEY') || trimmedKey.includes('...')) return false;
  return true;
}

export function initFirebase(config?: FirebaseConfig): Firestore {
  if (db) return db;

  const fromFile = config ? null : loadServiceAccountFromFile();
  const projectId = config?.projectId ?? fromFile?.projectId ?? process.env.FIREBASE_PROJECT_ID;
  const clientEmail = config?.clientEmail ?? fromFile?.clientEmail ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    config?.privateKey ?? fromFile?.privateKey ?? process.env.FIREBASE_PRIVATE_KEY ?? ''
  ).replace(/\\n/g, '\n');

  if (!isValidServiceAccountCredentials(projectId, clientEmail, privateKey)) {
    console.warn(
      '[Firebase] Missing or invalid Admin SDK credentials — using dev auth mode. ' +
      'Set FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_PATH for production.',
    );
    usingInMemory = true;
    return createInMemoryStore();
  }

  usingInMemory = false;

  try {
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }),
      });
    } else {
      app = getApps()[0]!;
    }

    db = getFirestore(app);
    auth = getAuth(app);
    return db;
  } catch (error) {
    console.warn(
      '[Firebase] Failed to initialize Admin SDK — using dev auth mode:',
      error instanceof Error ? error.message : error,
    );
    usingInMemory = true;
    app = null;
    auth = null;
    db = createInMemoryStore();
    return db;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (usingInMemory) return null;
  if (!auth) initFirebase();
  return auth;
}

export interface FirebaseAuthUserSummary {
  uid: string;
  email: string;
  displayName: string;
}

/** List all users from Firebase Authentication (requires Admin SDK credentials). */
export async function listFirebaseAuthUsers(): Promise<FirebaseAuthUserSummary[]> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return [];

  const users: FirebaseAuthUserSummary[] = [];
  let pageToken: string | undefined;
  do {
    const result = await firebaseAuth.listUsers(1000, pageToken);
    for (const user of result.users) {
      if (!user.email) continue;
      users.push({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName ?? user.email.split('@')[0] ?? 'User',
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth) {
    return firebaseAuth.verifyIdToken(token);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Firebase Admin credentials not configured');
  }

  if (!devAuthWarned) {
    console.warn('[Firebase] Dev mode: accepting Firebase ID tokens without Admin SDK signature verification');
    devAuthWarned = true;
  }
  return verifyIdTokenDev(token);
}

/** Issue a Firebase custom token for client sign-in (requires Admin SDK). */
export async function createCustomTokenForUid(uid: string): Promise<string> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error('Firebase Admin credentials not configured');
  }
  return firebaseAuth.createCustomToken(uid);
}

export function getFirebaseDb(): Firestore {
  if (!db) return initFirebase();
  return db;
}

// In-memory fallback when Firebase is not configured
const memoryStore = new Map<string, Map<string, unknown>>();

function createInMemoryStore(): Firestore {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: memoryStore.get(name)?.has(id) ?? false,
          data: () => memoryStore.get(name)?.get(id),
          id,
        }),
        set: async (data: unknown, opts?: { merge?: boolean }) => {
          if (!memoryStore.has(name)) memoryStore.set(name, new Map());
          const existing = memoryStore.get(name)!.get(id) as Record<string, unknown> | undefined;
          memoryStore.get(name)!.set(id, opts?.merge && existing ? { ...existing, ...(data as object) } : data);
        },
        update: async (data: unknown) => {
          if (!memoryStore.has(name)) memoryStore.set(name, new Map());
          const existing = (memoryStore.get(name)!.get(id) as Record<string, unknown>) ?? {};
          memoryStore.get(name)!.set(id, { ...existing, ...(data as object) });
        },
        delete: async () => {
          memoryStore.get(name)?.delete(id);
        },
      }),
      where: () => ({
        get: async () => ({ docs: [], empty: true }),
        limit: () => ({ get: async () => ({ docs: [], empty: true }) }),
      }),
      add: async (data: unknown) => {
        const docId = crypto.randomUUID();
        if (!memoryStore.has(name)) memoryStore.set(name, new Map());
        memoryStore.get(name)!.set(docId, data);
        return { id: docId };
      },
      get: async () => {
        const store = memoryStore.get(name);
        const docs = store
          ? Array.from(store.entries()).map(([id, data]) => ({
              id,
              data: () => data,
              exists: true,
            }))
          : [];
        return { docs, empty: docs.length === 0 };
      },
    }),
  } as unknown as Firestore;
}

// Collection helpers
const COLLECTIONS = {
  USER_PROFILES: 'userProfiles',
  UI_PREFERENCES: 'uiPreferences',
  TEMPLATES: 'templates',
  AGENT_SESSIONS: 'agentSessions',
} as const;

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const doc = await getFirebaseDb().collection(COLLECTIONS.USER_PROFILES).doc(userId).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  await getFirebaseDb().collection(COLLECTIONS.USER_PROFILES).doc(profile.id).set(profile, { merge: true });
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const snapshot = await getFirebaseDb().collection(COLLECTIONS.USER_PROFILES).get();
  return snapshot.docs.map((d) => d.data() as UserProfile);
}

export async function updateUserAccess(
  userId: string,
  updates: { grantedModules?: AppModule[]; role?: UserRole },
): Promise<UserProfile | null> {
  const ref = getFirebaseDb().collection(COLLECTIONS.USER_PROFILES).doc(userId);
  const existing = await ref.get();
  if (!existing.exists) return null;
  const data = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(data, { merge: true });
  const updated = await ref.get();
  return updated.data() as UserProfile;
}

export async function createUserProfileOnSignup(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const now = new Date().toISOString();
  const full: UserProfile = { ...profile, createdAt: now, updatedAt: now };
  await upsertUserProfile(full);
  return full;
}

export async function getUiPreferences(userId: string): Promise<UiPreferences | null> {
  const doc = await getFirebaseDb().collection(COLLECTIONS.UI_PREFERENCES).doc(userId).get();
  return doc.exists ? (doc.data() as UiPreferences) : null;
}

export async function upsertUiPreferences(prefs: UiPreferences): Promise<void> {
  await getFirebaseDb().collection(COLLECTIONS.UI_PREFERENCES).doc(prefs.userId).set(prefs, { merge: true });
}

export async function getTemplates(type?: string): Promise<Template[]> {
  const col = getFirebaseDb().collection(COLLECTIONS.TEMPLATES);
  const snapshot = type
    ? await col.where('type', '==', type).get()
    : await col.get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Template));
}

export async function saveTemplate(template: Omit<Template, 'id'> & { id?: string }): Promise<string> {
  const id = template.id ?? crypto.randomUUID();
  await getFirebaseDb().collection(COLLECTIONS.TEMPLATES).doc(id).set({ ...template, id });
  return id;
}

export async function getAgentSession(sessionId: string): Promise<AgentSession | null> {
  const doc = await getFirebaseDb().collection(COLLECTIONS.AGENT_SESSIONS).doc(sessionId).get();
  return doc.exists ? (doc.data() as AgentSession) : null;
}

export async function saveAgentSession(session: AgentSession): Promise<void> {
  await getFirebaseDb().collection(COLLECTIONS.AGENT_SESSIONS).doc(session.id).set(session);
}

export async function appendAgentMessage(sessionId: string, message: CopilotMessage): Promise<void> {
  const session = await getAgentSession(sessionId);
  if (!session) return;
  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
  await saveAgentSession(session);
}

export { COLLECTIONS };
