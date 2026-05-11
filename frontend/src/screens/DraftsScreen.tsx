import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftStorage, AuditDraft } from '../utils/draftStorage';
import { Colors, Radius, Shadow, Space } from '../theme';

const TOTAL_STEPS = 10;

interface Props {
  onBack: () => void;
  navigation: any;
  onResume?: (draft: AuditDraft) => void;
}

export default function DraftsScreen({ onBack, navigation, onResume }: Props) {
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<AuditDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrafts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [local, token] = await Promise.all([
      draftStorage.loadAll(),
      AsyncStorage.getItem('auth_token'),
    ]);

    let merged = [...local];

    if (token) {
      const serverDraft = await draftStorage.loadFromServer(token);
      if (serverDraft) {
        const existingIdx = merged.findIndex(d => d.id === serverDraft.id);
        if (existingIdx < 0) {
          // Server has a draft not in local storage — add it and persist locally
          merged = [serverDraft, ...merged];
          draftStorage.save(serverDraft.formData, serverDraft.step);
        } else if (serverDraft.savedAt > merged[existingIdx].savedAt) {
          // Server version is newer — update local
          merged[existingIdx] = serverDraft;
          draftStorage.save(serverDraft.formData, serverDraft.step);
        }
      }
    }

    merged.sort((a, b) => b.savedAt - a.savedAt);
    setDrafts(merged);

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleResume = useCallback((draft: AuditDraft) => {
    if (onResume) {
      onResume(draft);
    } else {
      navigation.navigate('Editor', { resumeDraftId: draft.id });
    }
  }, [navigation, onResume]);

  const handleDelete = useCallback(async (id: string) => {
    await draftStorage.clearById(id);
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

  const renderItem = useCallback(({ item, index }: { item: AuditDraft; index: number }) => {
    const isEdit = Boolean(item.formData?.edit_case);
    const displayName = isEdit
      ? item.formData.edit_case
      : (item.formData?.case_number || item.id);
    const progressPct = Math.min(100, Math.round((item.step / TOTAL_STEPS) * 100));

    return (
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: isEdit ? Colors.orangeLight : Colors.primaryLight }]}>
          <Ionicons
            name={isEdit ? 'create-outline' : 'document-text-outline'}
            size={18}
            color={isEdit ? Colors.orange : Colors.primary}
          />
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowName} numberOfLines={1}>{displayName}</Text>
            <View style={[styles.typeBadge, { backgroundColor: isEdit ? Colors.orangeLight : Colors.primaryLight }]}>
              <Text style={[styles.typeBadgeText, { color: isEdit ? Colors.orange : Colors.primary }]}>
                {isEdit ? 'Edit' : 'New'}
              </Text>
            </View>
          </View>
          <Text style={styles.rowMeta}>
            Step {item.step}/{TOTAL_STEPS} · {draftStorage.formatAge(item.savedAt)}
          </Text>
          <View style={styles.progressBg}>
            <View style={[
              styles.progressFill,
              {
                width: `${progressPct}%` as any,
                backgroundColor: isEdit ? Colors.orange : Colors.primary,
              },
            ]} />
          </View>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.resumeBtn, { backgroundColor: isEdit ? Colors.orange : Colors.primary }]}
            onPress={() => handleResume(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={12} color="#fff" />
            <Text style={styles.resumeText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleResume, handleDelete]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drafts</Text>
        {drafts.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{drafts.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="document-outline" size={40} color={Colors.border} />
          </View>
          <Text style={styles.emptyTitle}>No drafts</Text>
          <Text style={styles.emptyText}>
            Unsaved audits and in-progress edits appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => loadDrafts(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.listNote}>
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} · tap Resume to continue
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, flex: 1 },
  headerBadge: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xxxl,
    gap: Space.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSec },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  listContent: { padding: Space.lg, paddingBottom: Space.xxxl },
  listNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Space.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.sm,
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.xs },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  rowMeta: { fontSize: 11, color: Colors.textMuted, marginBottom: 5 },
  progressBg: { height: 3, backgroundColor: Colors.divider, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, flexShrink: 0 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  resumeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
  },
});
