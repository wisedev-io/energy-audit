import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://157.180.28.98:5050';

export default function SettingsScreen({ onLogout, user }: { onLogout: () => void, user: any }) {
  const [audName, setAudName] = useState('');
  const [audJshshr, setAudJshshr] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      // Show cached values instantly — no spinner if we have them
      const cached = await AsyncStorage.getItem('auditor_profile');
      if (cached) {
        const p = JSON.parse(cached);
        setAudName(p.aud_name || '');
        setAudJshshr(p.aud_jshshr || '');
        setProfileLoading(false);
      }
      // Sync with server in background
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await fetch(`${BASE_URL}/auth/profile`, {
          headers: { 'Authorization': `Bearer ${token}` },
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
        // server unreachable — cached values already shown
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Account & Configuration</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Account card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.full_name || user?.username || 'User'}</Text>
            <Text style={styles.profileRole}>@{user?.username} · {user?.role}</Text>
          </View>
        </View>

        {/* Auditor profile */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="id-card" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Auditor Profile</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Saved once here — auto-filled on every new case.
          </Text>

          {profileLoading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Auditor Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={audName}
                  onChangeText={setAudName}
                  placeholder="Full Name"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>JSHSHR (ID Number)</Text>
                <TextInput
                  style={styles.input}
                  value={audJshshr}
                  onChangeText={setAudJshshr}
                  placeholder="14-digit personal ID"
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="checkmark" size={18} color="#fff" />
                }
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* App info */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="cloud-upload" size={20} color="#2563eb" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Server</Text>
              <Text style={styles.settingSubtitle}>157.180.28.98:5050</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="information-circle" size={20} color="#2563eb" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>About</Text>
              <Text style={styles.settingSubtitle}>Energy Audit v1.0.0</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  content: { padding: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#111827' },
  profileRole: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  sectionSubtitle: { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: '500' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, marginTop: 4 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  settingSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 16, paddingVertical: 16, marginBottom: 24 },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
});
