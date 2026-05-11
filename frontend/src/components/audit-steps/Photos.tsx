import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://157.180.28.98:5050';

export const SECTION_SEC_ID: Record<string, number> = {
  exterior: 1,
  windows: 2,
  floorplan: 3,
  heating: 4,
  cooling: 5,
  appliances: 6,
  bills: 7,
  temphum: 8,
  lux: 9,
  thermal: 10,
};

const SEC_ID_TO_SECTION: Record<number, string> = Object.fromEntries(
  Object.entries(SECTION_SEC_ID).map(([k, v]) => [v, k])
);

const photoSections = [
  { id: 'exterior',   name: "Tashqi ko'rinish",      required: 3 },
  { id: 'windows',    name: 'Eshik & Derazalar',     required: 3 },
  { id: 'heating',    name: 'Isitish tizimi',         required: 1 },
  { id: 'cooling',    name: 'Sovutish tizimi',        required: 1 },
  { id: 'appliances', name: 'Elektr jihozlar',        required: 6 },
  { id: 'thermal',    name: 'Teplovizor (ixtiyoriy)', required: 0 },
];

interface PhotoItem {
  id: string;
  uri: string;          // local compressed URI while uploading, server URL after
  fileName: string;
  secId: number;
  slotNo?: number;      // set after server confirms upload
  uploading: boolean;
  progress: number;     // 0–100
  loadedBytes: number;
  totalBytes: number;
  error?: string;
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Compress to 1200px / 75% JPEG before upload — keeps files small for fast transfer
async function compressPhoto(
  a: { uri: string; fileName?: string; mimeType?: string }
): Promise<{ uri: string; mimeType: string; fileName: string; isPlaceholder: boolean }> {
  const origFileName = a.fileName || a.uri.split('/').pop() || 'photo.jpg';

  // Web HEIC: browser cannot render HEIC, show placeholder; actual JPEG comes from server
  if (Platform.OS === 'web') {
    const isHeic = (a.mimeType || '').toLowerCase().includes('heic') ||
      (a.mimeType || '').toLowerCase().includes('heif') ||
      origFileName.toLowerCase().endsWith('.heic') ||
      origFileName.toLowerCase().endsWith('.heif');
    if (isHeic) {
      return {
        uri: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>',
        mimeType: 'image/heic',
        fileName: origFileName,
        isPlaceholder: true,
      };
    }
  }

  // Skip compression for data: URIs
  if (a.uri.startsWith('data:')) {
    return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: origFileName, isPlaceholder: false };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      a.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    const baseName = origFileName.replace(/\.[^.]+$/, '') || 'photo';
    return { uri: result.uri, mimeType: 'image/jpeg', fileName: `${baseName}.jpg`, isPlaceholder: false };
  } catch {
    return { uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: origFileName, isPlaceholder: false };
  }
}

export default function Photos({ data, updateData, embedded }: any) {
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [activeSection, setActiveSection] = useState(photoSections[0].id);
  const [initialLoading, setInitialLoading] = useState(true);

  const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map());

  const sessionId: string | undefined = data.session_id;
  const caseName: string | undefined = data._caseName;

  // Notify parent about uploading status so submit can be blocked
  const prevUploadingRef = useRef(false);
  useEffect(() => {
    const isUploading = photoItems.some(p => p.uploading);
    if (isUploading !== prevUploadingRef.current) {
      prevUploadingRef.current = isUploading;
      updateData({ photosUploading: isUploading });
    }
  }, [photoItems]);

  // Abort all XHRs on unmount
  useEffect(() => {
    return () => { xhrMap.current.forEach(xhr => xhr.abort()); };
  }, []);

  // Load existing photos on mount
  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    setInitialLoading(true);
    try {
      let list: Array<{ sec_id: number; slot_no: number; filename: string }> = [];

      if (caseName) {
        // Edit mode: _photos is already in data from the form endpoint
        list = data._photos || [];
      } else if (sessionId) {
        // New audit: fetch photos previously saved to this session
        try {
          const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(sessionId)}/photos`);
          if (res.ok) list = await res.json();
        } catch { /* network error — start empty */ }
      }

      if (list.length > 0) {
        const items: PhotoItem[] = list.map(p => ({
          id: `existing_${p.sec_id}_${p.slot_no}`,
          uri: caseName
            ? `${BASE_URL}/cases/${encodeURIComponent(caseName)}/photos/${p.sec_id}/${p.slot_no}`
            : `${BASE_URL}/sessions/${encodeURIComponent(sessionId!)}/photos/${p.sec_id}/${p.slot_no}`,
          fileName: p.filename,
          secId: p.sec_id,
          slotNo: p.slot_no,
          uploading: false,
          progress: 100,
          loadedBytes: 0,
          totalBytes: 0,
        }));
        setPhotoItems(items);
      }
    } finally {
      setInitialLoading(false);
    }
  };

  const updateItem = useCallback((id: string, updates: Partial<PhotoItem>) => {
    setPhotoItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const startUpload = useCallback((item: PhotoItem, originalUri: string, isPlaceholder: boolean) => {
    const uploadUrl = caseName
      ? `${BASE_URL}/cases/${encodeURIComponent(caseName)}/photos/${item.secId}`
      : `${BASE_URL}/sessions/${encodeURIComponent(sessionId!)}/photos/${item.secId}`;

    const xhr = new XMLHttpRequest();
    xhrMap.current.set(item.id, xhr);
    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (Date.now() - startTime) / 1000 || 0.001;
      const speed = e.loaded / elapsed;
      const pct = Math.round((e.loaded / e.total) * 100);
      updateItem(item.id, { progress: pct, loadedBytes: e.loaded, totalBytes: e.total });
    };

    xhr.onload = () => {
      xhrMap.current.delete(item.id);
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.slot_no !== undefined) {
          // Replace local URI with server URL so HEIC placeholders resolve to real JPEG
          const serverUri = caseName
            ? `${BASE_URL}/cases/${encodeURIComponent(caseName)}/photos/${item.secId}/${json.slot_no}`
            : `${BASE_URL}/sessions/${encodeURIComponent(sessionId!)}/photos/${item.secId}/${json.slot_no}`;
          updateItem(item.id, {
            uploading: false,
            progress: 100,
            slotNo: json.slot_no,
            uri: serverUri,
          });
        } else {
          updateItem(item.id, { uploading: false, error: 'Upload failed' });
        }
      } catch {
        updateItem(item.id, { uploading: false, error: 'Server error' });
      }
    };

    xhr.onerror = () => {
      xhrMap.current.delete(item.id);
      updateItem(item.id, { uploading: false, error: 'Network error' });
    };

    xhr.open('POST', uploadUrl);

    if (Platform.OS === 'web') {
      // On web fetch the original blob (before compression/placeholder substitution)
      fetch(isPlaceholder ? item.uri : originalUri)
        .then(r => r.blob())
        .then(blob => {
          const fd = new FormData();
          const fname = item.fileName.replace(/\.[^.]+$/, '.jpg');
          fd.append('photo', new Blob([blob], { type: 'image/jpeg' }), fname);
          xhr.send(fd);
        })
        .catch(() => {
          xhrMap.current.delete(item.id);
          updateItem(item.id, { uploading: false, error: 'Failed to read image' });
        });
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: originalUri, name: item.fileName, type: item.fileName.toLowerCase().endsWith('.heic') || item.fileName.toLowerCase().endsWith('.heif') ? 'image/heic' : 'image/jpeg' } as any);
      xhr.send(fd);
    }
  }, [caseName, sessionId, updateItem]);

  const addPhotos = async (sectionId: string, assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    if (!sessionId && !caseName) return;

    const secId = SECTION_SEC_ID[sectionId];
    const compressed = await Promise.all(assets.map(a => compressPhoto(a)));

    const newItems: PhotoItem[] = compressed.map((c, i) => ({
      id: makeId(),
      uri: c.uri,
      fileName: c.fileName,
      secId,
      slotNo: undefined,
      uploading: true,
      progress: 0,
      loadedBytes: 0,
      totalBytes: 0,
    }));

    // Add to state immediately so photos appear with spinner right away
    setPhotoItems(prev => [...prev, ...newItems]);

    // Start each upload immediately — no queue, no delay
    newItems.forEach((item, i) => {
      startUpload(item, assets[i].uri, compressed[i].isPlaceholder);
    });
  };

  const retryUpload = async (item: PhotoItem) => {
    updateItem(item.id, { error: undefined, uploading: true, progress: 0 });
    // We don't have the original asset anymore — re-compress from current uri
    const sectionId = SEC_ID_TO_SECTION[item.secId] || 'exterior';
    const c = await compressPhoto({ uri: item.uri, fileName: item.fileName });
    const refreshed = { ...item, uploading: true, progress: 0, error: undefined };
    setPhotoItems(prev => prev.map(p => p.id === item.id ? refreshed : p));
    startUpload(refreshed, item.uri, c.isPlaceholder);
  };

  const removePhoto = async (item: PhotoItem) => {
    // Abort in-progress XHR
    const xhr = xhrMap.current.get(item.id);
    if (xhr) { xhr.abort(); xhrMap.current.delete(item.id); }

    // Delete from server if already saved
    if (item.slotNo !== undefined) {
      const deleteUrl = caseName
        ? `${BASE_URL}/cases/${encodeURIComponent(caseName)}/photos/${item.secId}/${item.slotNo}`
        : `${BASE_URL}/sessions/${encodeURIComponent(sessionId!)}/photos/${item.secId}/${item.slotNo}`;
      fetch(deleteUrl, { method: 'DELETE' }).catch(() => {});
    }

    setPhotoItems(prev => prev.filter(p => p.id !== item.id));
  };

  const pickImage = async (sectionId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) addPhotos(sectionId, result.assets.map(a => ({ uri: a.uri, fileName: a.fileName ?? undefined, mimeType: a.mimeType ?? undefined })));
  };

  const takePhoto = async (sectionId: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) addPhotos(sectionId, [{ uri: result.assets[0].uri, fileName: result.assets[0].fileName ?? undefined, mimeType: result.assets[0].mimeType ?? undefined }]);
  };

  const currentSecId = SECTION_SEC_ID[activeSection];
  const currentItems = photoItems.filter(p => p.secId === currentSecId);
  const currentSection = photoSections.find(s => s.id === activeSection);
  const allUploading = photoItems.filter(p => p.uploading).length;
  const allDone = photoItems.filter(p => p.slotNo !== undefined && !p.uploading).length;
  const allTotal = photoItems.length;

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      {initialLoading && (
        <View style={styles.globalProgress}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.globalProgressText}>Loading photos…</Text>
        </View>
      )}

      {!initialLoading && allUploading > 0 && (
        <View style={styles.globalProgress}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.globalProgressText}>Uploading {allDone} / {allTotal}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="camera" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Photo Documentation</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs}>
          {photoSections.map(s => {
            const secId = SECTION_SEC_ID[s.id];
            const items = photoItems.filter(p => p.secId === secId);
            const done = items.filter(p => p.slotNo !== undefined && !p.uploading).length;
            const uploading = items.filter(p => p.uploading).length;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setActiveSection(s.id)}
                style={[
                  styles.sectionTab,
                  activeSection === s.id && styles.activeSectionTab,
                  done >= s.required && s.required > 0 && styles.completeSectionTab,
                ]}
              >
                <Text style={styles.sectionTabName}>{s.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.sectionTabCount}>{done}/{s.required || '?'}</Text>
                  {uploading > 0 && <ActivityIndicator size="small" color="#2563eb" style={{ transform: [{ scale: 0.6 }] }} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.photoGrid}>
          {currentItems.map((item) => (
            <View key={item.id} style={styles.photoContainer}>
              {item.uri.startsWith('data:image/svg') ? (
                <View style={[styles.photo, styles.heicPlaceholder, item.uploading && styles.photoDim]}>
                  <Ionicons name="image-outline" size={28} color="#9ca3af" />
                  <Text style={styles.heicPlaceholderText}>HEIC</Text>
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={[styles.photo, item.uploading && styles.photoDim]} />
              )}

              {/* Upload progress overlay — shown only while uploading */}
              {item.uploading && (
                <View style={styles.progressOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.progressPct}>{item.progress}%</Text>
                  {item.totalBytes > 0 && (
                    <Text style={styles.progressBytes}>
                      {formatBytes(item.loadedBytes)}/{formatBytes(item.totalBytes)}
                    </Text>
                  )}
                </View>
              )}

              {/* Done indicator — green for new upload, purple for pre-existing */}
              {item.slotNo !== undefined && !item.uploading && !item.error && (
                <View style={styles.doneIndicator}>
                  <Ionicons
                    name={item.id.startsWith('existing_') ? 'cloud-done-outline' : 'checkmark-circle'}
                    size={18}
                    color={item.id.startsWith('existing_') ? '#6366f1' : '#10b981'}
                  />
                </View>
              )}

              {/* Error with retry */}
              {item.error && !item.uploading && (
                <TouchableOpacity style={styles.errorIndicator} onPress={() => retryUpload(item)}>
                  <Ionicons name="warning" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>Retry</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => removePhoto(item)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.addPhotoButtons}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => takePhoto(activeSection)} style={styles.addPhotoButton}>
                <Ionicons name="camera" size={32} color="#9ca3af" />
                <Text style={styles.addPhotoText}>Camera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => pickImage(activeSection)} style={styles.addPhotoButton}>
              <Ionicons name="images" size={32} color="#9ca3af" />
              <Text style={styles.addPhotoText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {currentSection && currentSection.required > 0 && (
          <Text style={styles.requirement}>
            {currentItems.filter(p => p.slotNo !== undefined && !p.uploading).length >= currentSection.required
              ? '✓ Minimum photos uploaded'
              : `Add at least ${currentSection.required - currentItems.filter(p => p.slotNo !== undefined && !p.uploading).length} more photo(s)`}
          </Text>
        )}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  globalProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 12 },
  globalProgressText: { fontSize: 13, color: '#1d4ed8', fontWeight: '500' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  sectionTabs: { marginBottom: 16 },
  sectionTab: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginRight: 8, minWidth: 90 },
  activeSectionTab: { backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#bfdbfe' },
  completeSectionTab: { backgroundColor: '#d1fae5' },
  sectionTabName: { fontSize: 12, color: '#111827', marginBottom: 2 },
  sectionTabCount: { fontSize: 10, color: '#6b7280' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoContainer: { width: '31%', aspectRatio: 1, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: 8 },
  photoDim: { opacity: 0.5 },
  progressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 2 },
  progressPct: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  progressBytes: { color: 'rgba(255,255,255,0.85)', fontSize: 9, textAlign: 'center' },
  doneIndicator: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#fff', borderRadius: 10 },
  errorIndicator: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 2 },
  errorText: { color: '#ef4444', fontSize: 10, fontWeight: '600' },
  removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
  addPhotoButtons: { width: '31%', aspectRatio: 1, gap: 4 },
  addPhotoButton: { flex: 1, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  requirement: { fontSize: 12, color: '#6b7280', marginTop: 12 },
  heicPlaceholder: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', gap: 4 },
  heicPlaceholderText: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
});
