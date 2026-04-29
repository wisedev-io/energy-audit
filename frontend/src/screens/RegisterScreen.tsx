import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, saveAuth } from '../auth';

export default function RegisterScreen({ onLogin, onGoLogin }: { onLogin: (user: any, token: string) => void, onGoLogin: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register(username.trim(), password.trim(), fullName.trim());
      if (res.success) {
        const loginRes = await api.login(username.trim(), password.trim());
        if (loginRes.success) {
          await saveAuth(loginRes.token, loginRes.user);
          onLogin(loginRes.user, loginRes.token);
        }
      } else {
        Alert.alert('Registration Failed', res.error || 'Could not create account');
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
          <Ionicons name="person-add" size={40} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>Join Energy Audit System</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="at" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Choose a username" autoCapitalize="none" autoCorrect={false} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry={!showPassword} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" secureTextEntry={!showPassword} autoCapitalize="none" />
            </View>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.registerButtonGradient}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.registerButtonText}>Create Account</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={onGoLogin}>
            <Text style={styles.loginButtonText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
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
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: '#111827' },
  eyeIcon: { paddingRight: 14 },
  registerButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  registerButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  registerButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  loginButton: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  loginButtonText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
