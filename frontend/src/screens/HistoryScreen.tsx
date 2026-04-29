import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Linking, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { draftStorage, AuditDraft } from '../utils/draftStorage';

const BASE_URL = 'http://157.180.28.98:5050';

function reconstructEnergyArrays(raw: any): any {
  const result = { ...raw };
  [2023, 2024, 2025].forEach(yr => {
    result[`y${yr}`] = Array.from({ length: 12 }, (_, mi) => ({
      gas: raw[`gas_${yr}_${mi}`] || '',
      elec: raw[`elec_${yr}_${mi}`] || '',
      other: raw[`other_${yr}_${mi}`] || '',
    }));
  });
  return result;
}

export default function HistoryScreen({ navigation, user = null }: { navigation?: any, user?: any }) {
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

  useEffect(() => {
    const loadUser = async () => {
      if (!user) {
        const userStr = await AsyncStorage.getItem('auth_user');
        if (userStr) setCurrentUser(JSON.parse(userStr));
      }
    };
    loadUser();
  }, []);

  const loadCases = useCallback(async () => {
    try {
      setError('');
      const token = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${BASE_URL}/cases`, {
        headers: { 'Authorization': `Bearer ${token}` },
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
      const res = await fetch(`${BASE_URL}/cases/${caseName}/form`);
      const raw = await res.json();
      if (raw.error) { Alert.alert('Error', raw.error); return; }
      const editData = reconstructEnergyArrays(raw);
      editData.edit_case = caseName;
      navigation.navigate('Editor', { editData, editCaseName: caseName });
    } catch (err: any) {
      Alert.alert('Error', `Error loading case: ${err.message}`);
    } finally {
      setEditLoading(null);
    }
  };

  const handleDelete = (caseName: string) => {
    setPendingDelete(caseName);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const caseName = pendingDelete;
    setPendingDelete(null);
    setDeleteLoading(caseName);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Not logged in. Please restart the app and login again.');
        return;
      }
      const res = await fetch(`${BASE_URL}/cases/${encodeURIComponent(caseName)}/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `Server error (HTTP ${res.status})` };
      }
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

  const downloadFile = (caseName: string, filename: string) => {
    Linking.openURL(`${BASE_URL}/cases/${caseName}/${filename}`);
  };

  const canManage = (audit: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return audit.created_by === currentUser.id;
  };

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.owner?.toLowerCase().includes(searchQuery.toLowerCase());
    if (myOnly && currentUser) {
      return matchesSearch && c.created_by === currentUser.id;
    }
    return matchesSearch;
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <Text style={styles.headerTitle}>Folders</Text>
        <Text style={styles.headerSubtitle}>{filteredCases.length} cases</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !myOnly && styles.toggleBtnActive]}
            onPress={() => setMyOnly(false)}
          >
            <Text style={[styles.toggleText, !myOnly && styles.toggleTextActive]}>All Audits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, myOnly && styles.toggleBtnActive]}
            onPress={() => setMyOnly(true)}
          >
            <Text style={[styles.toggleText, myOnly && styles.toggleTextActive]}>My Cases</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search..." placeholderTextColor="#9ca3af" />
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Draft in progress banner */}
        {localDraft && navigation && (
          <View style={styles.draftBanner}>
            <View style={styles.draftBannerLeft}>
              <Ionicons name="document-text" size={22} color="#f97316" />
              <View>
                <Text style={styles.draftBannerTitle}>Draft in progress</Text>
                <Text style={styles.draftBannerSub}>
                  Last saved {draftStorage.formatAge(localDraft.savedAt)} · Step {localDraft.step}
                </Text>
              </View>
            </View>
            <View style={styles.draftBannerActions}>
              <TouchableOpacity
                style={styles.draftResumeBtn}
                onPress={() => navigation.navigate('Editor', { startFresh: undefined })}
              >
                <Text style={styles.draftResumeBtnText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  draftStorage.clear();
                  setLocalDraft(null);
                }}
              >
                <Ionicons name="close-circle" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading cases...</Text>
          </View>
        ) : (
          <ScrollView style={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {filteredCases.map((audit) => (
              <View key={audit.name} style={styles.auditCard}>
                <View style={styles.auditHeader}>
                  <View style={styles.auditIcon}>
                    <Ionicons name="business" size={22} color="#fff" />
                  </View>
                  <View style={styles.auditInfo}>
                    <View style={styles.badge}>
                    <Text style={styles.badgeText}>{audit.name}</Text>
                    </View>
                    <Text style={styles.auditOwner}>{audit.owner || '—'}</Text>
                    <Text style={styles.auditDate}>{audit.updated_at}</Text>
                  </View>
                </View>

                {audit.files?.length > 0 && (
                  <View style={styles.filesRow}>
                    {audit.files.map((file: string) => (
                      <TouchableOpacity key={file} style={styles.fileChip} onPress={() => downloadFile(audit.name, file)}>
                        <Ionicons name={file.endsWith('.xlsx') ? 'grid' : 'document-text'} size={12} color="#2563eb" />
                        <Text style={styles.fileChipText}>{file.split('.').pop()?.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {canManage(audit) && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButtonEdit, editLoading === audit.name && styles.actionButtonDisabled]}
                      onPress={() => handleEdit(audit.name)}
                      disabled={editLoading === audit.name}
                    >
                      {editLoading === audit.name
                        ? <ActivityIndicator size="small" color="#2563eb" style={{ width: 16, height: 16 }} />
                        : <Ionicons name="pencil" size={16} color="#2563eb" />
                      }
                      <Text style={styles.actionButtonTextEdit}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButtonDanger, deleteLoading === audit.name && styles.actionButtonDisabled]}
                      onPress={() => handleDelete(audit.name)}
                      disabled={deleteLoading === audit.name}
                    >
                      {deleteLoading === audit.name
                        ? <ActivityIndicator size="small" color="#ef4444" style={{ width: 16, height: 16 }} />
                        : <Ionicons name="trash" size={16} color="#ef4444" />
                      }
                      <Text style={styles.actionButtonTextDanger}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            {filteredCases.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>{myOnly ? 'You have no cases yet' : 'No audits found'}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="trash" size={32} color="#ef4444" />
            <Text style={styles.modalTitle}>Delete Audit</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete{'\n'}
              <Text style={styles.modalCaseName}>"{pendingDelete}"</Text>?{'\n'}
              This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPendingDelete(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={confirmDelete}>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  content: { flex: 1, padding: 16 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#2563eb' },
  draftBanner: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  draftBannerTitle: { fontSize: 13, fontWeight: '700', color: '#c2410c' },
  draftBannerSub: { fontSize: 11, color: '#9a3412', marginTop: 2 },
  draftBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftResumeBtn: { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  draftResumeBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, elevation: 2, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  errorBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { flex: 1, fontSize: 13, color: '#ef4444' },
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, color: '#6b7280' },
  list: { flex: 1 },
  auditCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  auditHeader: { flexDirection: 'row', marginBottom: 12 },
  auditIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  auditInfo: { flex: 1 },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  auditOwner: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  auditDate: { fontSize: 11, color: '#6b7280' },
  filesRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  fileChipText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionButtonEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  actionButtonTextEdit: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  actionButtonDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  actionButtonTextDanger: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  actionButtonDisabled: { opacity: 0.6 },
  emptyState: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#6b7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalMessage: { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 22 },
  modalCaseName: { fontWeight: '700', color: '#111827' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
  modalCancelBtn: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalDeleteBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalDeleteText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
