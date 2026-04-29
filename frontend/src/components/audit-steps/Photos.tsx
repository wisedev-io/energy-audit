import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://157.180.28.98:5050';

// Map section string IDs to backend numeric section IDs
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

// floorplan managed in Dimensions; bills in EnergyConsumption; temphum/lux in Measurements
const photoSections = [
  { id: 'exterior',   name: "Tashqi ko'rinish",      required: 3 },
  { id: 'windows',    name: 'Eshik & Derazalar',     required: 3 },
  { id: 'heating',    name: 'Isitish tizimi',         required: 1 },
  { id: 'cooling',    name: 'Sovutish tizimi',        required: 1 },
  { id: 'appliances', name: 'Elektr jihozlar',        required: 6 },
  { id: 'thermal',    name: 'Teplovizor (ixtiyoriy)', required: 0 },
];

export interface PhotoItem {
  id: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
  serverKey?: string;
  progress: number;        // 0–100
  uploading: boolean;
  error?: string;
  totalBytes: number;
  loadedBytes: number;
  etaSecs?: number;
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Photos({ data, updateData }: any) {
  const initItems = (): Record<string, PhotoItem[]> => {
    if (data.photoItems) return data.photoItems;
    // Restore from old plain URI format if present
    if (data.photos) {
      const restored: Record<string, PhotoItem[]> = {};
      for (const [sec, uris] of Object.entries(data.photos as Record<string, string[]>)) {
        restored[sec] = uris.map(uri => ({
          id: makeId(),
          uri,
          serverKey: undefined,
          progress: 0,
          uploading: false,
          totalBytes: 0,
          loadedBytes: 0,
        }));
      }
      return restored;
    }
    return photoSections.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {} as Record<string, PhotoItem[]>);
  };

  const [photoItems, setPhotoItems] = useState<Record<string, PhotoItem[]>>(initItems);
  const [activeSection, setActiveSection] = useState(photoSections[0].id);
  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({});

  // Notify parent — preserve sections managed by other steps
  const notifyParent = (items: Record<string, PhotoItem[]>) => {
    updateData({ photoItems: { ...(data.photoItems || {}), ...items } });
  };

  // Re-upload any restored photos that lost their server key
  useEffect(() => {
    const items = { ...photoItems };
    let changed = false;
    for (const [sec, list] of Object.entries(items)) {
      list.forEach((item, idx) => {
        if (!item.serverKey && !item.uploading && item.uri) {
          changed = true;
          startUpload(items, sec, idx);
        }
      });
    }
    if (changed) setPhotoItems({ ...items });
  }, []); // only on mount

  const startUpload = (
    items: Record<string, PhotoItem[]>,
    sectionId: string,
    idx: number
  ) => {
    const item = items[sectionId]?.[idx];
    if (!item || item.uploading || item.serverKey) return;

    const xhrKey = `${sectionId}_${item.id}`;
    const xhr = new XMLHttpRequest();
    xhrRefs.current[xhrKey] = xhr;

    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (Date.now() - startTime) / 1000 || 0.001;
      const speed = e.loaded / elapsed;
      const remaining = speed > 0 ? Math.round((e.total - e.loaded) / speed) : undefined;
      setPhotoItems(prev => {
        const list = [...(prev[sectionId] || [])];
        const i = list.findIndex(p => p.id === item.id);
        if (i < 0) return prev;
        list[i] = {
          ...list[i],
          progress: Math.round((e.loaded / e.total) * 100),
          loadedBytes: e.loaded,
          totalBytes: e.total,
          etaSecs: remaining,
        };
        return { ...prev, [sectionId]: list };
      });
    };

    xhr.onload = () => {
      delete xhrRefs.current[xhrKey];
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.key) {
          setPhotoItems(prev => {
            const list = [...(prev[sectionId] || [])];
            const i = list.findIndex(p => p.id === item.id);
            if (i < 0) return prev;
            list[i] = { ...list[i], serverKey: json.key, progress: 100, uploading: false, totalBytes: json.size || list[i].totalBytes, loadedBytes: json.size || list[i].totalBytes };
            const updated = { ...prev, [sectionId]: list };
            notifyParent(updated);
            return updated;
          });
        } else {
          markError(sectionId, item.id, 'Upload failed');
        }
      } catch {
        markError(sectionId, item.id, 'Server error');
      }
    };

    xhr.onerror = () => {
      delete xhrRefs.current[xhrKey];
      markError(sectionId, item.id, 'Network error');
    };

    // Mark as uploading
    items[sectionId][idx] = { ...item, uploading: true, progress: 0, error: undefined };

    // On web, item.uri is a blob: URL with no extension — use fileName from picker if available
    const filename = item.fileName || item.uri.split('/').pop() || 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    // Also inspect the URI path itself — on iOS, fileName may report .jpg while the URI still points to a .heic file
    const uriBasename = item.uri.split('/').pop() || '';
    const uriExt = uriBasename.split('.').pop()?.toLowerCase() || '';
    // HEIC detection: check extension (both filename and URI) AND mimeType.
    // Extension takes priority — iOS sometimes reports 'image/jpeg' mimeType for HEIC files.
    const isHeicFile =
      ext === 'heic' || ext === 'heif' ||
      uriExt === 'heic' || uriExt === 'heif' ||
      (item.mimeType || '').toLowerCase().includes('heic') ||
      (item.mimeType || '').toLowerCase().includes('heif');
    const mimeType = isHeicFile
      ? 'image/heic'
      : (item.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg'));

    xhr.open('POST', `${BASE_URL}/upload_photo`);

    if (Platform.OS === 'web') {
      const uploadUri = (item as any)._originalUri || item.uri;
      fetch(uploadUri)
        .then(r => r.blob())
        .then(blob => {
          // On web, browser converts HEIC to JPEG automatically — always send as JPEG
          const finalFilename = filename.replace(/\.[^.]+$/, '.jpg');
          const typedBlob = new Blob([blob], { type: 'image/jpeg' });
          const fd = new FormData();
          fd.append('photo', typedBlob, finalFilename);
          xhr.send(fd);
        })
        .catch(() => markError(sectionId, item.id, 'Failed to read image'));
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: item.uri, name: filename, type: mimeType } as any);
      xhr.send(fd);
    }
  };

  const markError = (sectionId: string, itemId: string, error: string) => {
    setPhotoItems(prev => {
      const list = [...(prev[sectionId] || [])];
      const i = list.findIndex(p => p.id === itemId);
      if (i < 0) return prev;
      list[i] = { ...list[i], uploading: false, progress: 0, error };
      return { ...prev, [sectionId]: list };
    });
  };

  const retryUpload = (sectionId: string, itemId: string) => {
    setPhotoItems(prev => {
      const list = [...(prev[sectionId] || [])];
      const idx = list.findIndex(p => p.id === itemId);
      if (idx < 0) return prev;
      list[idx] = { ...list[idx], error: undefined, uploading: false, serverKey: undefined, progress: 0 };
      const updated = { ...prev, [sectionId]: list };
      startUpload(updated, sectionId, idx);
      return updated;
    });
  };

  const addPhotos = (sectionId: string, assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    setPhotoItems(prev => {
      const existing = prev[sectionId] || [];
      const newItems: PhotoItem[] = assets.map(a => {
        const isHeic = a.mimeType?.includes('heic') || a.mimeType?.includes('heif') ||
          a.fileName?.toLowerCase().endsWith('.heic') || a.fileName?.toLowerCase().endsWith('.heif');
        // For HEIC on web, use a grey placeholder since browser can't display HEIC
        const displayUri = (Platform.OS === 'web' && isHeic)
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>'
          : a.uri;
        return {
          id: makeId(),
          uri: displayUri,
          fileName: a.fileName,
          mimeType: a.mimeType,
          progress: 0,
          uploading: false,
          totalBytes: 0,
          loadedBytes: 0,
          _originalUri: a.uri,
        };
      });
      const updated = { ...prev, [sectionId]: [...existing, ...newItems] };
      // Start uploads immediately
      newItems.forEach((_, offset) => {
        const idx = existing.length + offset;
        startUpload(updated, sectionId, idx);
      });
      notifyParent(updated);
      return updated;
    });
  };

  const removePhoto = (sectionId: string, itemId: string) => {
    const item = photoItems[sectionId]?.find(p => p.id === itemId);
    if (item) {
      const xhrKey = `${sectionId}_${item.id}`;
      xhrRefs.current[xhrKey]?.abort();
      delete xhrRefs.current[xhrKey];
    }
    setPhotoItems(prev => {
      const updated = { ...prev, [sectionId]: (prev[sectionId] || []).filter(p => p.id !== itemId) };
      notifyParent(updated);
      return updated;
    });
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

  const currentItems = photoItems[activeSection] || [];
  const currentSection = photoSections.find(s => s.id === activeSection);
  const uploadingCount = Object.values(photoItems).flat().filter(p => p.uploading).length;
  const totalCount = Object.values(photoItems).flat().length;
  const doneCount = Object.values(photoItems).flat().filter(p => !!p.serverKey).length;

  return (
    <ScrollView style={styles.container}>
      {uploadingCount > 0 && (
        <View style={styles.globalProgress}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.globalProgressText}>Uploading {uploadingCount} photo{uploadingCount > 1 ? 's' : ''}… ({doneCount}/{totalCount} done)</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="camera" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Photo Documentation</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs}>
          {photoSections.map(s => {
            const items = photoItems[s.id] || [];
            const done = items.filter(p => !!p.serverKey).length;
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
          {currentItems.map((item) => {
            return (
            <View key={item.id} style={styles.photoContainer}>
              {item.uri.startsWith('data:image/svg') ? (
                <View style={[styles.photo, styles.heicPlaceholder, item.uploading && styles.photoDim]}>
                  <Ionicons name="image-outline" size={28} color="#9ca3af" />
                  <Text style={styles.heicPlaceholderText}>HEIC</Text>
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={[styles.photo, item.uploading && styles.photoDim]} />
              )}

              {/* Upload progress overlay */}
              {item.uploading && (
                <View style={styles.progressOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.progressPct}>{item.progress}%</Text>
                  {item.totalBytes > 0 && (
                    <Text style={styles.progressBytes}>
                      {formatBytes(item.loadedBytes)}/{formatBytes(item.totalBytes)}
                    </Text>
                  )}
                  {item.etaSecs !== undefined && item.etaSecs > 0 && (
                    <Text style={styles.progressEta}>{item.etaSecs}s left</Text>
                  )}
                </View>
              )}

              {/* Done indicator */}
              {item.serverKey && !item.uploading && (
                <View style={styles.doneIndicator}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </View>
              )}

              {/* Error indicator */}
              {item.error && !item.uploading && (
                <TouchableOpacity style={styles.errorIndicator} onPress={() => retryUpload(activeSection, item.id)}>
                  <Ionicons name="warning" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>Retry</Text>
                </TouchableOpacity>
              )}

              {/* Remove button */}
              <TouchableOpacity onPress={() => removePhoto(activeSection, item.id)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
            );
          })}

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
            {currentItems.filter(p => !!p.serverKey).length >= currentSection.required
              ? '✓ Minimum photos uploaded'
              : `Add at least ${currentSection.required - currentItems.filter(p => !!p.serverKey).length} more photo(s)`}
          </Text>
        )}
      </View>
    </ScrollView>
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
  progressEta: { color: 'rgba(255,255,255,0.85)', fontSize: 9 },
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
