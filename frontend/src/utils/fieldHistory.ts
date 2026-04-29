import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@field_history_v1_';
const MAX = 5;

export const fieldHistory = {
  get: async (key: string): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  add: async (key: string, value: string): Promise<void> => {
    const v = value.trim();
    if (!v) return;
    try {
      const current = await fieldHistory.get(key);
      const next = [v, ...current.filter(x => x !== v)].slice(0, MAX);
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(next));
    } catch {}
  },
};
