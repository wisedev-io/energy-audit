import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Space } from '../theme';

const BASE_URL = 'http://157.180.28.98:5050';

function AvatarLetters({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
  return (
    <View style={avatarStyles.wrap}>
      <Text style={avatarStyles.text}>{initials || '?'}</Text>
    </View>
  );
}
const avatarStyles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 22, fontWeight: '700', color: Colors.white },
});

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
};
function SettingRow({ icon, iconColor = Colors.primary, iconBg = Colors.primaryLight, label, value, onPress, chevron = true, last = false }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[rowStyles.row, !last && rowStyles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={rowStyles.labelWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        {value ? <Text style={rowStyles.value} numberOfLines={1}>{value}</Text> : null}
      </View>
      {chevron && onPress ? (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: { flex: 1 },
  label: { fontSize: 15, fontWeight: '500', color: Colors.text },
  value: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
});

export default function SettingsScreen({ onLogout, user }: { onLogout: () => void; user: any }) {
  const insets = useSafeAreaInsets();
  const [audName, setAudName] = useState('');
  const [audJshshr, setAudJshshr] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const cached = await AsyncStorage.getItem('auditor_profile');
      if (cached) {
        const p = JSON.parse(cached);
        setAudName(p.aud_name || '');
        setAudJshshr(p.aud_jshshr || '');
        setProfileLoading(false);
      }
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await fetch(`${BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          const name = json.aud_name || '';
          const jshshr = json.aud_jshshr || '';
          setAudName(name);
          setAudJshshr(jshshr);
          await AsyncStorage.setItem('auditor_profile', JSON.stringify({ aud_name: name, aud_jshshr: jshshr }));
        }
      } catch {
        // use cached
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ aud_name: audName, aud_jshshr: audJshshr }),
      });
      const json = await res.json();
      if (json.success) {
        await AsyncStorage.setItem('auditor_profile', JSON.stringify({ aud_name: audName, aud_jshshr: audJshshr }));
        Alert.alert('Saved', 'Auditor profile updated. New cases will use these values automatically.');
      } else {
        Alert.alert('Error', json.error || 'Failed to save');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  const displayName = user?.full_name || user?.username || 'User';

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <AvatarLetters name={displayName} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>@{user?.username} · {user?.role}</Text>
          </View>
          <View style={[styles.roleChip, user?.role === 'admin' && styles.roleChipAdmin]}>
            <Text style={[styles.roleChipText, user?.role === 'admin' && styles.roleChipTextAdmin]}>
              {user?.role === 'admin' ? 'Admin' : 'Auditor'}
            </Text>
          </View>
        </View>

        {/* Auditor Profile section */}
        <Text style={styles.sectionLabel}>Auditor Profile</Text>
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Ionicons name="id-card-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionCardTitle}>Auto-filled on every new case</Text>
          </View>

          {profileLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading profile…</Text>
            </View>
          ) : (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Auditor Full Name</Text>
                <View style={[styles.inputWrap, focusedField === 'name' && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    value={audName}
                    onChangeText={setAudName}
                    placeholder="Full Name"
                    placeholderTextColor={Colors.textMuted}
                    autoCorrect={false}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>JSHSHR (ID Number)</Text>
                <View style={[styles.inputWrap, focusedField === 'jshshr' && styles.inputWrapFocused]}>
                  <TextInput
                    style={styles.input}
                    value={audJshshr}
                    onChangeText={setAudJshshr}
                    placeholder="14-digit personal ID"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onFocus={() => setFocusedField('jshshr')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="checkmark-outline" size={18} color={Colors.white} />
                )}
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* App info section */}
        <Text style={styles.sectionLabel}>Application</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="cloud-outline"
            label="Server"
            value="157.180.28.98:5050"
            chevron={false}
          />
          <SettingRow
            icon="flash-outline"
            label="App Version"
            value="Energy Audit v1.0.0"
            chevron={false}
            last
          />
        </View>

        {/* Sign Out */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            </View>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Space.xl, paddingHorizontal: Space.lg },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginBottom: Space.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.text },
  profileMeta: { fontSize: 13, color: Colors.textSec, marginTop: 3 },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleChipAdmin: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  roleChipText: { fontSize: 11, fontWeight: '600', color: Colors.textSec },
  roleChipTextAdmin: { color: Colors.primary },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Space.sm,
    marginLeft: Space.xs,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Space.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionCardTitle: { fontSize: 13, color: Colors.textSec, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.xl, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.textSec },

  fieldGroup: { paddingHorizontal: Space.lg, paddingTop: Space.md },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSec,
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputWrap: {
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  inputWrapFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  input: {
    paddingHorizontal: Space.md,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    margin: Space.lg,
    ...Shadow.sm,
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: Colors.danger },
});
