import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import DashboardScreen from './src/screens/DashboardScreen';
import NewAuditScreen from './src/screens/NewAuditScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { getAuth, clearAuth } from './src/auth';

const Tab = createBottomTabNavigator();

export default function App() {
  const [appState, setAppState] = useState<'loading'|'login'|'register'|'app'>('loading');
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (appState === 'login') {
    return <LoginScreen onLogin={handleLogin} onGoRegister={() => setAppState('register')} />;
  }

  if (appState === 'register') {
    return <RegisterScreen onLogin={handleLogin} onGoLogin={() => setAppState('login')} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Editor') iconName = focused ? 'add-circle' : 'add-circle-outline';
            else if (route.name === 'Folders') iconName = focused ? 'folder' : 'folder-outline';
            else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
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
  );
}
