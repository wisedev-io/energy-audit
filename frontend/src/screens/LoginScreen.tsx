import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput as TI,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, saveAuth } from '../auth';
import { Colors, Radius, Shadow, Space } from '../theme';

export default function LoginScreen({
  onLogin,
  onGoRegister,
}: {
  onLogin: (user: any, token: string) => void;
  onGoRegister: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const passwordRef = useRef<TI>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password.trim());
      if (res.success) {
        await saveAuth(res.token, res.user);
        onLogin(res.user, res.token);
      } else {
        Alert.alert('Sign In Failed', res.error || 'Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Connection Error', `Cannot reach server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + 32 }]}
      >
        <View style={styles.logoWrap}>
          <Ionicons name="flash" size={38} color={Colors.white} />
        </View>
        <Text style={styles.headerTitle}>Energy Audit</Text>
        <Text style={styles.headerSub}>Professional Assessment Tool</Text>
      </LinearGradient>

      {/* Form card */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to your account</Text>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputWrap, focusedField === 'username' && styles.inputWrapFocused]}>
              <Ionicons
                name="person-outline"
                size={18}
                color={focusedField === 'username' ? Colors.primary : Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={focusedField === 'password' ? Colors.primary : Colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* Register */}
          <TouchableOpacity style={styles.secondaryBtn} onPress={onGoRegister} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>Create New Account</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.hintText}>Default: admin / admin123</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingBottom: 40,
    alignItems: 'center',
    gap: 8,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '400' },

  scroll: { flex: 1 },
  scrollContent: { padding: Space.xxl, paddingTop: Space.xl },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    ...Shadow.md,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 14, color: Colors.textSec, marginBottom: Space.xxl },

  fieldGroup: { marginBottom: Space.lg },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSec, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  inputWrapFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: { paddingRight: 14, paddingLeft: 8 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    marginTop: Space.sm,
    ...Shadow.sm,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: Colors.white },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Space.xl },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 14, fontSize: 13, color: Colors.textMuted },

  secondaryBtn: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSec },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginTop: Space.lg,
  },
  hintText: { fontSize: 12, color: Colors.textMuted },
});
