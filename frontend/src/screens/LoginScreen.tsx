import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, saveAuth } from '../auth';

export default function LoginScreen({ onLogin, onGoRegister }: { onLogin: (user: any, token: string) => void, onGoRegister: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password.trim());
      if (res.success) {
        await saveAuth(res.token, res.user);
        onLogin(res.user, res.token);
      } else {
        Alert.alert('Login Failed', res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      Alert.alert('Connection Error', `Cannot reach server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#1e3a8a', '#2563eb']} style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="flash" size={40} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Energy Audit</Text>
        <Text style={styles.headerSubtitle}>Sign in to continue</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.loginButtonGradient}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="log-in" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Sign In</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={onGoRegister}>
            <Text style={styles.registerButtonText}>Create New Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hintBox}>
          <Ionicons name="information-circle" size={16} color="#6b7280" />
          <Text style={styles.hintText}>Default admin: admin / admin123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  content: { flex: 1 },
  contentContainer: { padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: '#111827' },
  eyeIcon: { paddingRight: 14 },
  loginButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  loginButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  loginButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: '#9ca3af' },
  registerButton: { backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  registerButtonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' },
  hintText: { fontSize: 12, color: '#6b7280' },
});
