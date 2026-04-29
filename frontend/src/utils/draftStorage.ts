import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY_NEW = '@audit_draft_new';
const BASE_URL = 'http://157.180.28.98:5050';

let _serverSyncTimer: ReturnType<typeof setTimeout> | null = null;

export interface AuditDraft {
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

export const draftStorage = {
  save: async (formData: any, step: number): Promise<void> => {
    try {
      const stripped = stripPhotos(formData);
      const draft: AuditDraft = { formData: stripped, step, savedAt: Date.now() };
      await AsyncStorage.setItem(DRAFT_KEY_NEW, JSON.stringify(draft));
    } catch {}
  },

  load: async (): Promise<AuditDraft | null> => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY_NEW);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY_NEW);
    } catch {}
  },

  // Server sync — debounced 2s to avoid hammering the server on every keystroke
  syncToServer: (token: string, formData: any, step: number): void => {
    if (!token) return;
    if (_serverSyncTimer) clearTimeout(_serverSyncTimer);
    _serverSyncTimer = setTimeout(async () => {
      try {
        const stripped = stripPhotos(formData);
        await fetch(`${BASE_URL}/drafts`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ formData: stripped, step }),
        });
      } catch {}
    }, 2000);
  },

  loadFromServer: async (token: string): Promise<AuditDraft | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${BASE_URL}/drafts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.draft) {
        return {
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

  // Immediate sync — used when app goes to background (bypasses the 2s debounce)
  syncToServerNow: async (token: string, formData: any, step: number): Promise<void> => {
    if (!token) return;
    if (_serverSyncTimer) { clearTimeout(_serverSyncTimer); _serverSyncTimer = null; }
    try {
      const stripped = stripPhotos(formData);
      await fetch(`${BASE_URL}/drafts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ formData: stripped, step }),
      });
    } catch {}
  },

  clearOnServer: (token: string): void => {
    if (!token) return;
    fetch(`${BASE_URL}/drafts`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  },

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
