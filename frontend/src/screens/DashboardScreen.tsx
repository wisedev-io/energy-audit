import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftStorage, AuditDraft } from '../utils/draftStorage';
import { Colors, Radius, Shadow, Space } from '../theme';
import DraftsScreen from './DraftsScreen';

const BASE_URL = 'http://157.180.28.98:5050';
const RECENT_LIMIT = 5;

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [localDraft, setLocalDraft] = useState<AuditDraft | null>(null);
  const [allDraftsCount, setAllDraftsCount] = useState(0);
  const [showDrafts, setShowDrafts] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setShowDrafts(false);
      setLoadingCases(true);

      Promise.all([
        fetch(`${BASE_URL}/cases`)
          .then(r => r.json())
          .catch(() => []),
        draftStorage.loadAll(),
      ]).then(([data, drafts]) => {
        if (!active) return;
        const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
          const byUpdated = String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
          if (byUpdated !== 0) return byUpdated;
          return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
        });
        setRecentCases(sorted.slice(0, RECENT_LIMIT));
        setLocalDraft(drafts[0] || null);
        setAllDraftsCount(drafts.length);
      }).finally(() => {
        if (active) setLoadingCases(false);
      });

      return () => { active = false; };
    }, [])
  );

  const handleStartNew = () => {
    navigation.navigate('Editor', { startFresh: Date.now() });
  };

  const handleResumeDraft = () => {
    navigation.navigate('Editor');
  };

  const handleDiscardDraft = () => {
    if (localDraft) {
      draftStorage.clearById(localDraft.id);
      setAllDraftsCount(prev => Math.max(0, prev - 1));
    }
    setLocalDraft(null);
  };

  if (showDrafts) {
    return (
      <DraftsScreen
        onBack={() => setShowDrafts(false)}
        navigation={navigation}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <View>
            <Image source={require('../../assets/logo-ea.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.headerSub}>Energy Assessment</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Draft in Progress — workflow shortcut */}
        {localDraft && (
          <View style={styles.draftCard}>
            <View style={styles.draftLeft}>
              <View style={styles.draftIconWrap}>
                <Ionicons name="document-text-outline" size={22} color={Colors.orange} />
              </View>
              <View style={styles.draftInfo}>
                <Text style={styles.draftTitle}>Draft in Progress</Text>
                <Text style={styles.draftMeta}>
                  Step {localDraft.step}/10 · {draftStorage.formatAge(localDraft.savedAt)}
                </Text>
              </View>
            </View>
            <View style={styles.draftActions}>
              <TouchableOpacity style={styles.resumeBtn} onPress={handleResumeDraft} activeOpacity={0.8}>
                <Text style={styles.resumeBtnText}>Resume</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDiscardDraft} style={styles.discardBtn}>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Primary Action */}
        <TouchableOpacity style={styles.newAuditBtn} onPress={handleStartNew} activeOpacity={0.85}>
          <View style={styles.newAuditIcon}>
            <Ionicons name="add" size={26} color={Colors.white} />
          </View>
          <View style={styles.newAuditText}>
            <Text style={styles.newAuditTitle}>Start New Energy Audit</Text>
            <Text style={styles.newAuditSub}>10-step guided assessment</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Secondary Action */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Folders')}
          activeOpacity={0.7}
        >
          <View style={[styles.secondaryBtnIcon, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.secondaryBtnText}>Edit Existing Case</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Drafts Button */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setShowDrafts(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.secondaryBtnIcon, { backgroundColor: Colors.orangeLight }]}>
            <Ionicons name="document-text-outline" size={20} color={Colors.orange} />
          </View>
          <Text style={styles.secondaryBtnText}>Drafts</Text>
          {allDraftsCount > 0 && (
            <View style={styles.draftsBtnBadge}>
              <Text style={styles.draftsBtnBadgeText}>{allDraftsCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Recent Cases */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Folders')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {loadingCases ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading cases…</Text>
            </View>
          ) : recentCases.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="folder-open-outline" size={36} color={Colors.border} />
              </View>
              <Text style={styles.emptyTitle}>No cases yet</Text>
              <Text style={styles.emptyText}>Start your first energy audit above</Text>
            </View>
          ) : (
            recentCases.map((audit, idx) => (
              <TouchableOpacity
                key={audit.name}
                style={[styles.caseRow, idx < recentCases.length - 1 && styles.caseRowBorder]}
                onPress={() => navigation.navigate('Folders')}
                activeOpacity={0.6}
              >
                <View style={styles.caseIcon}>
                  <Ionicons name="business-outline" size={18} color={Colors.primary} />
                </View>
                <View style={styles.caseInfo}>
                  <Text style={styles.caseName} numberOfLines={1}>{audit.name}</Text>
                  <Text style={styles.caseOwner} numberOfLines={1}>{audit.owner || '—'}</Text>
                </View>
                <Text style={styles.caseDate}>{audit.updated_at?.split(' ')[0] || ''}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Stats row */}
        {recentCases.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="documents-outline" size={20} color={Colors.primary} />
              <Text style={styles.statValue}>{recentCases.length}+</Text>
              <Text style={styles.statLabel}>Cases</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={[styles.statValue, { color: Colors.success }]}>Active</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cloud-done-outline" size={20} color={Colors.primaryMid} />
              <Text style={styles.statValue}>Live</Text>
              <Text style={styles.statLabel}>Sync</Text>
            </View>
          </View>
        )}
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 46, height: 46 },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { padding: Space.lg, gap: Space.md, paddingBottom: Space.xxxl },

  // Draft card
  draftCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDDCAB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.orange,
    ...Shadow.sm,
  },
  draftLeft: { flexDirection: 'row', alignItems: 'center', gap: Space.md, flex: 1 },
  draftIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftInfo: { flex: 1 },
  draftTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  draftMeta: { fontSize: 12, color: Colors.textSec, marginTop: 2 },
  draftActions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  resumeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  discardBtn: { padding: 4 },

  // New audit button
  newAuditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
    ...Shadow.md,
  },
  newAuditIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newAuditText: { flex: 1 },
  newAuditTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  newAuditSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Secondary button
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  secondaryBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  draftsBtnBadge: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 2,
  },
  draftsBtnBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  // Recent cases section
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.xl, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.textMuted },

  emptyState: { alignItems: 'center', padding: Space.xxxl, gap: Space.sm },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.textSec },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    gap: Space.md,
  },
  caseRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  caseIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseInfo: { flex: 1 },
  caseName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  caseOwner: { fontSize: 12, color: Colors.textSec, marginTop: 2 },
  caseDate: { fontSize: 11, color: Colors.textMuted },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});
