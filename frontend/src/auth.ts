import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://157.180.28.98:5050';

export const api = {
  login: async (username: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  register: async (username: string, password: string, full_name: string) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, full_name }),
    });
    return res.json();
  },

  me: async (token: string) => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  },

  logout: async (token: string) => {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  },
};

export const saveAuth = async (token: string, user: any) => {
  await AsyncStorage.setItem('auth_token', token);
  await AsyncStorage.setItem('auth_user', JSON.stringify(user));
};

export const getAuth = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  const userStr = await AsyncStorage.getItem('auth_user');
  return { token, user: userStr ? JSON.parse(userStr) : null };
};

export const clearAuth = async () => {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('auth_user');
};
