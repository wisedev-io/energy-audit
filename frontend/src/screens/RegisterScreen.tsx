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

export default function RegisterScreen({
  onLogin,
  onGoLogin,
}: {
  onLogin: (user: any, token: string) => void;
  onGoLogin: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const usernameRef = useRef<TI>(null);
  const passwordRef = useRef<TI>(null);
  const confirmRef = useRef<TI>(null);

  const handleRegister = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
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
        Alert.alert('Registration Failed', res.error || 'Could not create account.');
      }
    } catch (err: any) {
      Alert.alert('Connection Error', `Cannot reach server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: string) => ({
    focused: focusedField === key,
    wrapStyle: [styles.inputWrap, focusedField === key && styles.inputWrapFocused],
    iconColor: focusedField === key ? Colors.primary : Colors.textMuted,
    onFocus: () => setFocusedField(key),
    onBlur: () => setFocusedField(null),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <TouchableOpacity onPress={onGoLogin} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backBtnText}>Sign In</Text>
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <Ionicons name="person-add-outline" size={34} color={Colors.white} />
        </View>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSub}>Join Energy Audit System</Text>
      </LinearGradient>

      {/* Form */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={field('name').wrapStyle}>
              <Ionicons name="person-outline" size={18} color={field('name').iconColor} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                onFocus={field('name').onFocus}
                onBlur={field('name').onBlur}
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={field('user').wrapStyle}>
              <Ionicons name="at-outline" size={18} color={field('user').iconColor} style={styles.inputIcon} />
              <TextInput
                ref={usernameRef}
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Choose a username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={field('user').onFocus}
                onBlur={field('user').onBlur}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={field('pass').wrapStyle}>
              <Ionicons name="lock-closed-outline" size={18} color={field('pass').iconColor} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 6 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                onFocus={field('pass').onFocus}
                onBlur={field('pass').onBlur}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={field('confirm').wrapStyle}>
              <Ionicons name="lock-closed-outline" size={18} color={field('confirm').iconColor} style={styles.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                onFocus={field('confirm').onFocus}
                onBlur={field('confirm').onBlur}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Already have account */}
          <TouchableOpacity onPress={onGoLogin} style={styles.loginLink} activeOpacity={0.7}>
            <Text style={styles.loginLinkText}>Already have an account?{' '}</Text>
            <Text style={[styles.loginLinkText, styles.loginLinkBold]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingBottom: 32,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 2,
  },
  backBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  scroll: { flex: 1 },
  scrollContent: { padding: Space.xxl, paddingTop: Space.xl },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    ...Shadow.md,
  },

  fieldGroup: { marginBottom: Space.lg },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSec,
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
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

  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Space.xl,
    paddingVertical: Space.sm,
  },
  loginLinkText: { fontSize: 14, color: Colors.textSec },
  loginLinkBold: { color: Colors.primary, fontWeight: '600' },
});
