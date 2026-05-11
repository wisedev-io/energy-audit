import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Linking, Alert, Modal, Animated, Easing, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftStorage, AuditDraft } from '../utils/draftStorage';
import { Colors, Radius, Shadow, Space } from '../theme';

const BASE_URL = 'http://157.180.28.98:5050';

// Backend stores energy as gas_2023: [v0,v1,...] arrays; reconstruct y2023 from them.
// Fallback: try flat gas_2023_0 / gas_2023_1 keys for older records.
function reconstructEnergyArrays(raw: any): any {
  const result = { ...raw };
  [2023, 2024, 2025].forEach(yr => {
    const gasArr  = raw[`gas_${yr}`];
    const elecArr = raw[`elec_${yr}`];
    const otherArr = raw[`other_${yr}`];
    if (Array.isArray(gasArr)) {
      result[`y${yr}`] = Array.from({ length: 12 }, (_, mi) => ({
        gas:   String(gasArr[mi]   ?? ''),
        elec:  String(elecArr?.[mi]  ?? ''),
        other: String(otherArr?.[mi] ?? ''),
      }));
    } else {
      result[`y${yr}`] = Array.from({ length: 12 }, (_, mi) => ({
        gas:   raw[`gas_${yr}_${mi}`]   || '',
        elec:  raw[`elec_${yr}_${mi}`]  || '',
        other: raw[`other_${yr}_${mi}`] || '',
      }));
    }
  });
  return result;
}

// Rebuild list arrays that step components initialise from (e.g. data.floors_list).
function reconstructStructuredArrays(raw: any): any {
  const r = { ...raw };

  if (!r.floors_list) {
    const list = [];
    for (let i = 1; i <= 5; i++) {
      if (raw[`floor_l${i}`] != null || raw[`floor_w${i}`] != null)
        list.push({ l: String(raw[`floor_l${i}`] ?? ''), w: String(raw[`floor_w${i}`] ?? '') });
    }
    if (list.length) r.floors_list = list;
  }

  if (!r.doors_list) {
    const list = [];
    for (let i = 1; i <= 5; i++) {
      if (raw[`door_w${i}`] != null || raw[`door_h${i}`] != null)
        list.push({ w: String(raw[`door_w${i}`] ?? ''), h: String(raw[`door_h${i}`] ?? ''), n: String(raw[`door_n${i}`] ?? '1') });
    }
    if (list.length) r.doors_list = list;
  }

  if (!r.windows_list) {
    const list = [];
    for (let i = 1; i <= 5; i++) {
      if (raw[`win_w${i}`] != null || raw[`win_h${i}`] != null)
        list.push({ w: String(raw[`win_w${i}`] ?? ''), h: String(raw[`win_h${i}`] ?? ''), n: String(raw[`win_n${i}`] ?? '1') });
    }
    if (list.length) r.windows_list = list;
  }

  if (!r.walls_list) {
    const list = [];
    for (let i = 1; i <= 5; i++) {
      if (raw[`wall_p${i}`] != null || raw[`wall_h${i}`] != null)
        list.push({ p: String(raw[`wall_p${i}`] ?? ''), h: String(raw[`wall_h${i}`] ?? '') });
    }
    if (list.length) r.walls_list = list;
  }

  if (!r.appliances_list) {
    const list = [];
    for (let i = 1; i <= 10; i++) {
      if (raw[`apl${i}_name`])
        list.push({ name: String(raw[`apl${i}_name`] ?? ''), w: String(raw[`apl${i}_w`] ?? ''), n: String(raw[`apl${i}_n`] ?? '1'), hrs: String(raw[`apl${i}_hrs`] ?? '') });
    }
    if (list.length) r.appliances_list = list;
  }

  return r;
}


function getCaseNo(caseName: string): string {
  return caseName?.match(/EA-(\d+)/)?.[1] || caseName;
}

function getFileDisplayName(filename: string, caseNo: string): string {
  if (filename.endsWith('_passport.docx')) return `passport-${caseNo}.docx`;
  if (filename.endsWith('.docx')) return `report-${caseNo}.docx`;
  if (filename.endsWith('.xlsx')) return `calculations-${caseNo}.xlsx`;
  return filename;
}

function getFileIcon(filename: string): string {
  if (filename.endsWith('.xlsx')) return 'grid-outline';
  if (filename.includes('passport')) return 'document-outline';
  if (filename.endsWith('.zip')) return 'archive-outline';
  return 'document-text-outline';
}

export default function HistoryScreen({ navigation, user = null }: { navigation?: any; user?: any }) {
  const insets = useSafeAreaInsets();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(user);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [myOnly, setMyOnly] = useState(false);
  const [localDraft, setLocalDraft] = useState<AuditDraft | null>(null);
  const [photoErrors, setPhotoErrors] = useState<Set<string>>(new Set());

  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (refreshing) {
      spinAnim.setValue(0);
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })
      );
      spinLoopRef.current.start();
    } else {
      spinLoopRef.current?.stop();
      spinAnim.setValue(0);
    }
  }, [refreshing]);

  const spinDeg = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  useEffect(() => {
    if (!user) {
      AsyncStorage.getItem('auth_user').then(s => {
        if (s) setCurrentUser(JSON.parse(s));
      });
    }
  }, []);

  const loadCases = useCallback(async () => {
    try {
      setError('');
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${BASE_URL}/cases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const byUpdated = String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
        if (byUpdated !== 0) return byUpdated;
        return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
      });
      setCases(sorted);
    } catch (err: any) {
      setError(`Cannot connect to server: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCases();
      draftStorage.load().then(d => setLocalDraft(d));
    }, [loadCases])
  );

  const onRefresh = () => { setRefreshing(true); loadCases(); };

  const handleEdit = async (caseName: string) => {
    if (!navigation) return;
    setEditLoading(caseName);
    try {
      const res = await fetch(`${BASE_URL}/cases/${encodeURIComponent(caseName)}/form`);
      const raw = await res.json();
      if (raw.error) { Alert.alert('Error', raw.error); return; }

      let editData = reconstructEnergyArrays(raw);
      editData = reconstructStructuredArrays(editData);
      editData.edit_case = caseName;
      editData._caseName = caseName;
      // _photos stays in editData so Photos component can load existing photos on mount

      navigation.navigate('Editor', { editData, editCaseName: caseName });
    } catch (err: any) {
      Alert.alert('Error', `Error loading case: ${err.message}`);
    } finally {
      setEditLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const caseName = pendingDelete;
    setPendingDelete(null);
    setDeleteLoading(caseName);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) { Alert.alert('Error', 'Not logged in.'); return; }
      const res = await fetch(`${BASE_URL}/cases/${encodeURIComponent(caseName)}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      let data: any = {};
      try { data = await res.json(); } catch { data = { success: false, error: `HTTP ${res.status}` }; }
      if (data.success) {
        await loadCases();
      } else {
        Alert.alert('Delete failed', data.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      Alert.alert('Network error', err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const canManage = (audit: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return audit.created_by === currentUser.id;
  };

  const filteredCases = cases.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.owner?.toLowerCase().includes(q);
    if (myOnly && currentUser) return matchSearch && c.created_by === currentUser.id;
    return matchSearch;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Cases</Text>
            <Text style={styles.headerSub}>{filteredCases.length} {filteredCases.length === 1 ? 'audit' : 'audits'}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing}>
            <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
              <Ionicons name="refresh-outline" size={20} color={refreshing ? Colors.primary : Colors.textMuted} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or owner…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Toggle: All / Mine */}
        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleBtn, !myOnly && styles.toggleBtnActive]}
            onPress={() => setMyOnly(false)}
          >
            <Text style={[styles.toggleLabel, !myOnly && styles.toggleLabelActive]}>All Audits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, myOnly && styles.toggleBtnActive]}
            onPress={() => setMyOnly(true)}
          >
            <Text style={[styles.toggleLabel, myOnly && styles.toggleLabelActive]}>My Cases</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Draft banner */}
        {localDraft && navigation && (
          <View style={styles.draftBanner}>
            <Ionicons name="document-text-outline" size={18} color={Colors.orange} />
            <View style={styles.draftBannerText}>
              <Text style={styles.draftBannerTitle}>Draft in progress</Text>
              <Text style={styles.draftBannerSub}>
                Step {localDraft.step}/10 · {draftStorage.formatAge(localDraft.savedAt)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.draftResumeBtn}
              onPress={() => navigation.navigate('Editor')}
            >
              <Text style={styles.draftResumeBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { draftStorage.clear(); setLocalDraft(null); }}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="wifi-outline" size={18} color={Colors.danger} />
            <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
            <TouchableOpacity onPress={loadCases}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading cases…</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {filteredCases.map(audit => (
              <View key={audit.name} style={styles.auditCard}>
                {/* Card header */}
                <View style={styles.auditCardHeader}>
                  <View style={styles.auditIconWrap}>
                    {!photoErrors.has(audit.name) ? (
                      <Image
                        source={{ uri: `${BASE_URL}/cases/${encodeURIComponent(audit.name)}/photos/1/1` }}
                        style={styles.auditPhoto}
                        onError={() => setPhotoErrors(prev => new Set([...prev, audit.name]))}
                        resizeMode="cover"
                      />
                    ) : (audit.owner || '').replace(/[^a-zA-ZЀ-ӿ]/g, '').length > 0 ? (
                      <Text style={styles.auditInitials}>
                        {(audit.owner || '').replace(/[^a-zA-ZЀ-ӿ]/g, '').slice(0, 2).toUpperCase()}
                      </Text>
                    ) : (
                      <Ionicons name="business-outline" size={36} color={Colors.primary} />
                    )}
                  </View>
                  <View style={styles.auditMeta}>
                    <Text style={styles.auditName} numberOfLines={1}>{audit.name}</Text>
                    <Text style={styles.auditOwner} numberOfLines={1}>{audit.owner || '—'}</Text>
                  </View>
                  <View style={styles.auditDateWrap}>
                    <Text style={styles.auditDateLabel}>Created: {audit.created_at?.split('T')[0] || audit.created_at?.split(' ')[0] || ''}</Text>
                    {audit.updated_at && audit.created_at && audit.updated_at.split('T')[0] !== audit.created_at.split('T')[0] && (
                      <Text style={styles.auditDateEdited}>Edited: {audit.updated_at?.split('T')[0] || ''}</Text>
                    )}
                  </View>
                </View>

                {/* Files */}
                {(audit.files?.length > 0 || true) && (
                  <View style={styles.filesRow}>
                    {audit.files?.map((file: string) => {
                      const caseNo = getCaseNo(audit.name);
                      const displayName = getFileDisplayName(file, caseNo);
                      const iconName = getFileIcon(file);
                      return (
                        <TouchableOpacity
                          key={file}
                          style={styles.fileChip}
                          onPress={() => Linking.openURL(`${BASE_URL}/cases/${encodeURIComponent(audit.name)}/${encodeURIComponent(file)}`)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={iconName as any} size={12} color={Colors.primary} />
                          <Text style={styles.fileChipText} numberOfLines={1}>{displayName}</Text>
                          <Ionicons name="download-outline" size={11} color={Colors.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                    {/* Photos ZIP */}
                    <TouchableOpacity
                      style={[styles.fileChip, styles.fileChipZip]}
                      onPress={() => Linking.openURL(`${BASE_URL}/cases/${encodeURIComponent(audit.name)}/photos.zip`)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="archive-outline" size={12} color={Colors.orange} />
                      <Text style={[styles.fileChipText, { color: Colors.orange }]} numberOfLines={1}>
                        photos-{getCaseNo(audit.name)}.zip
                      </Text>
                      <Ionicons name="download-outline" size={11} color={Colors.orange} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions */}
                {canManage(audit) && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn, editLoading === audit.name && styles.actionBtnDisabled]}
                      onPress={() => handleEdit(audit.name)}
                      disabled={!!editLoading || !!deleteLoading}
                      activeOpacity={0.7}
                    >
                      {editLoading === audit.name ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ width: 16, height: 16 }} />
                      ) : (
                        <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                      )}
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn, deleteLoading === audit.name && styles.actionBtnDisabled]}
                      onPress={() => setPendingDelete(audit.name)}
                      disabled={!!editLoading || !!deleteLoading}
                      activeOpacity={0.7}
                    >
                      {deleteLoading === audit.name ? (
                        <ActivityIndicator size="small" color={Colors.danger} style={{ width: 16, height: 16 }} />
                      ) : (
                        <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                      )}
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {filteredCases.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="folder-open-outline" size={40} color={Colors.border} />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No results found' : myOnly ? 'No cases yet' : 'No audits found'}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Try a different search term' : 'Start a new energy audit'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Delete Confirm Modal */}
      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="trash-outline" size={28} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Audit?</Text>
            <Text style={styles.modalMsg}>
              This will permanently remove{'\n'}
              <Text style={styles.modalCaseName}>"{pendingDelete}"</Text>
              {'\n'}and cannot be undone.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={confirmDelete}>
                <Ionicons name="trash-outline" size={16} color={Colors.white} />
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Space.md,
    ...Shadow.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    gap: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 0 },

  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.surface, ...Shadow.sm },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  toggleLabelActive: { color: Colors.primary },

  body: { flex: 1, paddingHorizontal: Space.lg, paddingTop: Space.md },

  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: '#FDDCAB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.orange,
  },
  draftBannerText: { flex: 1 },
  draftBannerTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  draftBannerSub: { fontSize: 11, color: Colors.textSec, marginTop: 1 },
  draftResumeBtn: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.xs,
  },
  draftResumeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger },
  retryText: { fontSize: 13, color: Colors.danger, fontWeight: '700' },

  loadingBox: { alignItems: 'center', paddingVertical: 64, gap: Space.md },
  loadingText: { fontSize: 14, color: Colors.textSec },

  list: { flex: 1 },
  listContent: { gap: Space.md, paddingBottom: Space.xxxl },

  auditCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  auditCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Space.md, gap: Space.md },
  auditIconWrap: {
    width: 84,
    height: 84,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  auditPhoto: { width: 84, height: 84 },
  auditMeta: { flex: 1 },
  auditName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  auditOwner: { fontSize: 13, color: Colors.textSec, marginTop: 2 },
  auditInitials: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  auditDateWrap: { alignItems: 'flex-end', flexShrink: 0 },
  auditDateLabel: { fontSize: 10, color: Colors.textMuted },
  auditDateEdited: { fontSize: 10, color: Colors.orange, marginTop: 1 },

  filesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginBottom: Space.md },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 200,
  },
  fileChipText: { fontSize: 11, color: Colors.primary, fontWeight: '600', flexShrink: 1 },
  fileChipZip: { backgroundColor: Colors.orangeLight, borderColor: '#FDDCAB' },

  actionRow: { flexDirection: 'row', gap: Space.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionBtnDisabled: { opacity: 0.5 },
  editBtn: { backgroundColor: Colors.primaryLight, borderColor: Colors.border },
  editBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  deleteBtn: { backgroundColor: Colors.dangerLight, borderColor: '#FECACA' },
  deleteBtnText: { fontSize: 13, color: Colors.danger, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 64, gap: Space.sm },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSec },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  // Delete Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.xxxl,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Space.xxxl,
    alignItems: 'center',
    gap: Space.md,
    width: '100%',
    ...Shadow.lg,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalMsg: { fontSize: 14, color: Colors.textSec, textAlign: 'center', lineHeight: 22 },
  modalCaseName: { fontWeight: '700', color: Colors.text },
  modalBtns: { flexDirection: 'row', gap: Space.md, width: '100%', marginTop: Space.sm },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSec },
  modalDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  modalDeleteText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
