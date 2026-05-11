import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = '@audit_drafts';
const LEGACY_KEY = '@audit_draft_new';
const BASE_URL = 'http://157.180.28.98:5050';

let _serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _syncRetryTimer: ReturnType<typeof setTimeout> | null = null;

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'failed';
let _syncStatus: SyncStatus = 'idle';
let _syncStatusCb: ((s: SyncStatus) => void) | null = null;

function setSyncStatus(s: SyncStatus) {
  _syncStatus = s;
  _syncStatusCb?.(s);
}

export interface AuditDraft {
  id: string;
  formData: any;
  step: number;
  savedAt: number;
}

function stripPhotos(formData: any): any {
  const stripped = { ...formData };
  if (stripped.photoItems) {
    const cleanItems: Record<string, any[]> = {};
    for (const [sec, items] of Object.entries(stripped.photoItems as Record<string, any[]>)) {
      cleanItems[sec] = (items as any[]).map((item: any) => ({
        uri: item.uri,
        serverKey: item.serverKey,
      }));
    }
    stripped.photoItems = cleanItems;
  }
  return stripped;
}

async function readAll(): Promise<AuditDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (raw) return JSON.parse(raw) as AuditDraft[];
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const id = parsed.formData?.draft_id || parsed.formData?.case_number || 'draft_legacy';
      const migrated: AuditDraft = { id, formData: parsed.formData, step: parsed.step, savedAt: parsed.savedAt || Date.now() };
      await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([migrated]));
      await AsyncStorage.removeItem(LEGACY_KEY);
      return [migrated];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeAll(drafts: AuditDraft[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn('[draftStorage] AsyncStorage write failed:', e);
  }
}

// Retry delays: 5s then 15s after the initial attempt
const RETRY_DELAYS = [5000, 15000];

async function _doServerSync(token: string, formData: any, step: number, attempt: number): Promise<void> {
  if (_syncRetryTimer) { clearTimeout(_syncRetryTimer); _syncRetryTimer = null; }
  setSyncStatus('syncing');
  try {
    const stripped = stripPhotos(formData);
    const res = await fetch(`${BASE_URL}/drafts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ formData: stripped, step }),
    });
    let json: any = {};
    try { json = await res.json(); } catch {}
    if (!res.ok || json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
    setSyncStatus('ok');
  } catch (e) {
    console.warn(`[draftStorage] Server sync attempt ${attempt + 1} failed:`, e);
    if (attempt < RETRY_DELAYS.length) {
      _syncRetryTimer = setTimeout(
        () => _doServerSync(token, formData, step, attempt + 1),
        RETRY_DELAYS[attempt],
      );
      // keep status as 'syncing' — retries are still pending
    } else {
      setSyncStatus('failed');
    }
  }
}

export const draftStorage = {
  save: async (formData: any, step: number): Promise<void> => {
    const id = formData.draft_id || formData.case_number || `draft_${Date.now()}`;
    const stripped = stripPhotos(formData);
    const drafts = await readAll();
    const idx = drafts.findIndex(d => d.id === id);
    const draft: AuditDraft = { id, formData: stripped, step, savedAt: Date.now() };
    if (idx >= 0) drafts[idx] = draft;
    else drafts.push(draft);
    await writeAll(drafts);
  },

  loadAll: async (): Promise<AuditDraft[]> => {
    const drafts = await readAll();
    return drafts.sort((a, b) => b.savedAt - a.savedAt);
  },

  load: async (): Promise<AuditDraft | null> => {
    const drafts = await readAll();
    if (!drafts.length) return null;
    return drafts.sort((a, b) => b.savedAt - a.savedAt)[0];
  },

  clearById: async (id: string): Promise<void> => {
    const drafts = await readAll();
    await writeAll(drafts.filter(d => d.id !== id));
  },

  clear: async (): Promise<void> => {
    try { await AsyncStorage.removeItem(DRAFTS_KEY); } catch {}
  },

  syncToServer: (token: string, formData: any, step: number): void => {
    if (!token) return;
    // Cancel any pending debounce and any pending retry
    if (_serverSyncTimer) clearTimeout(_serverSyncTimer);
    if (_syncRetryTimer) { clearTimeout(_syncRetryTimer); _syncRetryTimer = null; }
    _serverSyncTimer = setTimeout(() => _doServerSync(token, formData, step, 0), 2000);
  },

  syncToServerNow: async (token: string, formData: any, step: number): Promise<void> => {
    if (!token) return;
    if (_serverSyncTimer) { clearTimeout(_serverSyncTimer); _serverSyncTimer = null; }
    await _doServerSync(token, formData, step, 0);
  },

  clearOnServer: (token: string): void => {
    if (!token) return;
    fetch(`${BASE_URL}/drafts`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(e => console.warn('[draftStorage] Failed to clear server draft:', e));
  },

  loadFromServer: async (token: string): Promise<AuditDraft | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${BASE_URL}/drafts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.draft) {
        const id = json.draft.formData?.draft_id || json.draft.formData?.case_number || 'server_draft';
        return {
          id,
          formData: json.draft.formData,
          step: json.draft.step,
          savedAt: json.draft.savedAt ? new Date(json.draft.savedAt).getTime() : Date.now(),
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  getSyncStatus: (): SyncStatus => _syncStatus,

  onSyncStatus: (cb: (s: SyncStatus) => void): void => { _syncStatusCb = cb; },
  offSyncStatus: (): void => { _syncStatusCb = null; },

  formatAge: (savedAt: number): string => {
    const mins = Math.round((Date.now() - savedAt) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  },
};
