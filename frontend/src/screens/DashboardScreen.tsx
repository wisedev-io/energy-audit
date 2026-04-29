import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const BASE_URL = 'http://157.180.28.98:5050';
const RECENT_LIMIT = 5;

export default function DashboardScreen({ navigation }: any) {
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingCases(true);
      fetch(`${BASE_URL}/cases`)
        .then(r => r.json())
        .then(data => {
          if (!active) return;
          const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
            const byUpdated = String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
            if (byUpdated !== 0) return byUpdated;
            return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
          });
          setRecentCases(sorted.slice(0, RECENT_LIMIT));
        })
        .catch(() => {})
        .finally(() => { if (active) setLoadingCases(false); });
      return () => { active = false; };
    }, [])
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.headerSubtitle}>Home</Text>
      </LinearGradient>

      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.navigate('Editor', { startFresh: Date.now() })} style={styles.mainButton}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.mainButtonGradient}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.mainButtonText}>Start New Energy Audit</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Folders')} style={styles.editButton}>
          <View style={styles.editButtonInner}>
            <Ionicons name="pencil" size={20} color="#2563eb" />
            <Text style={styles.editButtonText}>Edit Existing Case</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Folders')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingCases ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : recentCases.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>No cases yet</Text>
            </View>
          ) : (
            recentCases.map((audit) => (
              <View key={audit.name} style={styles.auditCard}>
                <View style={styles.auditIcon}>
                  <Ionicons name="business" size={22} color="#fff" />
                </View>
                <View style={styles.auditInfo}>
                  <View style={styles.auditHeaderRow}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{audit.name}</Text></View>
                    <Text style={styles.auditDate}>{audit.updated_at}</Text>
                  </View>
                  <Text style={styles.auditOwner}>{audit.owner || '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, alignItems: 'flex-start' },
  logo: { width: 160, height: 48, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  content: { padding: 16 },
  mainButton: { marginBottom: 10, borderRadius: 16, overflow: 'hidden', elevation: 4 },
  mainButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 8 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editButton: { marginBottom: 20, borderRadius: 16, borderWidth: 2, borderColor: '#2563eb', overflow: 'hidden' },
  editButtonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, backgroundColor: '#eff6ff' },
  editButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  viewAllText: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: '#9ca3af' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  auditCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  auditIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  auditInfo: { flex: 1 },
  auditHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  auditDate: { fontSize: 11, color: '#9ca3af' },
  auditOwner: { fontSize: 13, color: '#374151', fontWeight: '500' },
});
