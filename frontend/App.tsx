import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from './src/screens/DashboardScreen';
import NewAuditScreen from './src/screens/NewAuditScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { getAuth, clearAuth } from './src/auth';
import { Colors, Shadow } from './src/theme';

const Tab = createBottomTabNavigator();

type TabRoute = { key: string; name: string };
type TabState = { index: number; routes: TabRoute[] };

const TAB_CONFIG: Record<string, { inactive: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap; label: string }> = {
  Home:     { inactive: 'home-outline',           active: 'home',           label: 'Home' },
  Editor:   { inactive: 'add-circle-outline',     active: 'add-circle',     label: 'Create' },
  Folders:  { inactive: 'folder-outline',         active: 'folder',         label: 'Audits' },
  Settings: { inactive: 'settings-outline',       active: 'settings',       label: 'Settings' },
};

function CustomTabBar({ state, navigation }: { state: TabState; navigation: any }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            style={styles.tabItem}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
          >
            <View style={[styles.tabIndicator, focused && styles.tabIndicatorActive]}>
              <Ionicons
                name={focused ? cfg.active : cfg.inactive}
                size={22}
                color={focused ? Colors.white : Colors.textMuted}
              />
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function App() {
  const [appState, setAppState] = useState<'loading' | 'login' | 'register' | 'app'>('loading');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      const { token: savedToken, user: savedUser } = await getAuth();
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
        setAppState('app');
      } else {
        setAppState('login');
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (loggedUser: any, loggedToken: string) => {
    setUser(loggedUser);
    setToken(loggedToken);
    setAppState('app');
  };

  const handleLogout = async () => {
    await clearAuth();
    setUser(null);
    setToken('');
    setAppState('login');
  };

  if (appState === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <View style={styles.splashIconWrap}>
            <Ionicons name="flash" size={44} color={Colors.white} />
          </View>
          <Text style={styles.splashTitle}>Energy Audit</Text>
          <Text style={styles.splashSub}>Professional Assessment Tool</Text>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={styles.splashSpinner} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (appState === 'login') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLogin={handleLogin} onGoRegister={() => setAppState('register')} />
      </SafeAreaProvider>
    );
  }

  if (appState === 'register') {
    return (
      <SafeAreaProvider>
        <RegisterScreen onLogin={handleLogin} onGoLogin={() => setAppState('login')} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          tabBar={(props) => <CustomTabBar state={props.state as TabState} navigation={props.navigation} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Home" component={DashboardScreen} />
          <Tab.Screen name="Editor" component={NewAuditScreen} />
          <Tab.Screen
            name="Folders"
            children={({ navigation }: any) => (
              <HistoryScreen navigation={navigation} user={user} />
            )}
          />
          <Tab.Screen
            name="Settings"
            children={() => <SettingsScreen onLogout={handleLogout} user={user} />}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  splashSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  splashSpinner: {
    marginTop: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    ...Shadow.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIndicator: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicatorActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
