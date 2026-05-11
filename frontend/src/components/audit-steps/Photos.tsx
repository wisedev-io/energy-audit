import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
  isExisting?: boolean;    // true = restored from DB on edit, skip re-upload
  progress: number;        // 0–100
  uploading: boolean;
  error?: string;
  totalBytes: number;
  loadedBytes: number;
  etaSecs?: number;
}

const MAX_CONCURRENT = 6;

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compress a photo to 1200px wide at 75% JPEG quality.
 * On web, skip compression if the URI is a data: URI (e.g. HEIC SVG placeholder).
 * Returns { uri, mimeType, fileName }.
 */
async function compressPhoto(
  a: { uri: string; fileName?: string; mimeType?: string }
): Promise<{ uri: string; mimeType: string; fileName: string }> {
  const origFileName = a.fileName || a.uri.split('/').pop() || 'photo.jpg';

  // Skip compression for data: URIs (HEIC SVG placeholder on web)
  if (a.uri.startsWith('data:')) {
    return {
      uri: a.uri,
      mimeType: a.mimeType || 'image/jpeg',
      fileName: origFileName,
    };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      a.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    const baseName = origFileName.replace(/\.[^.]+$/, '') || 'photo';
    return {
      uri: result.uri,
      mimeType: 'image/jpeg',
      fileName: `${baseName}.jpg`,
    };
  } catch {
    // Fallback: return original
    return {
      uri: a.uri,
      mimeType: a.mimeType || 'image/jpeg',
      fileName: origFileName,
    };
  }
}

export default function Photos({ data, updateData, embedded }: any) {
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

  // Concurrency tracking
  const activeUploadCount = useRef(0);
  const pendingQueue = useRef<Array<{ sectionId: string; item: PhotoItem }>>([]);

  // Notify parent — preserve sections managed by other steps
  const notifyParent = (items: Record<string, PhotoItem[]>) => {
    updateData({ photoItems: { ...(data.photoItems || {}), ...items } });
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

  // Forward declaration via ref so doXHRUpload can call processQueue
  const processQueueRef = useRef<(() => void) | null>(null);

  const doXHRUpload = useCallback((sectionId: string, item: PhotoItem) => {
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
      activeUploadCount.current--;
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.key) {
          setPhotoItems(prev => {
            const list = [...(prev[sectionId] || [])];
            const i = list.findIndex(p => p.id === item.id);
            if (i < 0) return prev;
            list[i] = {
              ...list[i],
              serverKey: json.key,
              progress: 100,
              uploading: false,
              totalBytes: json.size || list[i].totalBytes,
              loadedBytes: json.size || list[i].totalBytes,
            };
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
      processQueueRef.current?.();
    };

    xhr.onerror = () => {
      delete xhrRefs.current[xhrKey];
      activeUploadCount.current--;
      markError(sectionId, item.id, 'Network error');
      processQueueRef.current?.();
    };

    xhr.open('POST', `${BASE_URL}/upload_photo`);

    // Determine file details from item (already compressed)
    const filename = item.fileName || item.uri.split('/').pop() || 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const uriBasename = item.uri.split('/').pop() || '';
    const uriExt = uriBasename.split('.').pop()?.toLowerCase() || '';
    // HEIC detection — only relevant for non-compressed items or fallback
    const isHeicFile =
      ext === 'heic' || ext === 'heif' ||
      uriExt === 'heic' || uriExt === 'heif' ||
      (item.mimeType || '').toLowerCase().includes('heic') ||
      (item.mimeType || '').toLowerCase().includes('heif');

    // After compression, mimeType is set to 'image/jpeg' for native.
    // Use item.mimeType if set (from compressPhoto), else derive from extension.
    const mimeType = item.mimeType && !isHeicFile
      ? item.mimeType
      : (isHeicFile ? 'image/heic' : (ext === 'png' ? 'image/png' : 'image/jpeg'));

    if (Platform.OS === 'web') {
      // On web, item.uri may be a blob: URL; use _originalUri if available
      const uploadUri = (item as any)._originalUri || item.uri;
      fetch(uploadUri)
        .then(r => r.blob())
        .then(blob => {
          // On web, always send as JPEG (browser converts HEIC automatically)
          const finalFilename = filename.replace(/\.[^.]+$/, '.jpg');
          const typedBlob = new Blob([blob], { type: 'image/jpeg' });
          const fd = new FormData();
          fd.append('photo', typedBlob, finalFilename);
          xhr.send(fd);
        })
        .catch(() => {
          activeUploadCount.current--;
          markError(sectionId, item.id, 'Failed to read image');
          processQueueRef.current?.();
        });
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: item.uri, name: filename, type: mimeType } as any);
      xhr.send(fd);
    }
  }, []);

  const processQueue = useCallback(() => {
    while (activeUploadCount.current < MAX_CONCURRENT && pendingQueue.current.length > 0) {
      const next = pendingQueue.current.shift()!;
      activeUploadCount.current++;
      // Mark as uploading in state
      setPhotoItems(prev => {
        const list = [...(prev[next.sectionId] || [])];
        const idx = list.findIndex(p => p.id === next.item.id);
        if (idx < 0) {
          activeUploadCount.current--;
          return prev;
        }
        list[idx] = { ...list[idx], uploading: true, progress: 0, error: undefined };
        return { ...prev, [next.sectionId]: list };
      });
      // Start XHR (pass item object for URI/name/type since it may not be in state yet)
      doXHRUpload(next.sectionId, next.item);
    }
  }, [doXHRUpload]);

  // Keep processQueueRef in sync so doXHRUpload callbacks can call it
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Re-upload any locally-added photos that lost their server key (e.g. after a hot-reload).
  // Skip photos marked isExisting — those are already in the DB and don't need re-uploading.
  useEffect(() => {
    const items = { ...photoItems };
    let changed = false;
    for (const [sec, list] of Object.entries(items)) {
      list.forEach((item) => {
        if (!item.serverKey && !item.uploading && !item.isExisting && item.uri) {
          changed = true;
          pendingQueue.current.push({ sectionId: sec, item });
        }
      });
    }
    if (changed) {
      setPhotoItems({ ...items });
      processQueue();
    }
  }, []); // only on mount

  const retryUpload = (sectionId: string, itemId: string) => {
    setPhotoItems(prev => {
      const list = [...(prev[sectionId] || [])];
      const idx = list.findIndex(p => p.id === itemId);
      if (idx < 0) return prev;
      const item = { ...list[idx], error: undefined, uploading: false, serverKey: undefined, progress: 0 };
      list[idx] = item;
      const updated = { ...prev, [sectionId]: list };
      // Enqueue back and process
      pendingQueue.current.push({ sectionId, item });
      processQueue();
      return updated;
    });
  };

  const addPhotos = async (sectionId: string, assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    // Compress each photo before adding
    const compressedAssets = await Promise.all(
      assets.map(async (a) => {
        const isHeic = a.mimeType?.includes('heic') || a.mimeType?.includes('heif') ||
          a.fileName?.toLowerCase().endsWith('.heic') || a.fileName?.toLowerCase().endsWith('.heif');
        // For HEIC on web, use a grey placeholder since browser can't display HEIC
        const isWebHeicPlaceholder = Platform.OS === 'web' && isHeic;
        const displayUri = isWebHeicPlaceholder
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>'
          : a.uri;
        // Compress the real URI (not the SVG placeholder)
        const compressed = await compressPhoto({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType });
        return {
          originalUri: a.uri,
          displayUri,
          compressed,
          isWebHeicPlaceholder,
        };
      })
    );

    setPhotoItems(prev => {
      const existing = prev[sectionId] || [];
      const newItems: PhotoItem[] = compressedAssets.map(ca => {
        // On native: display and upload from the compressed URI
        // On web HEIC: display SVG placeholder, upload from originalUri (web browser handles HEIC→JPEG)
        // On web non-HEIC: display and upload from the compressed URI (or blob: URI)
        const uploadUri = ca.isWebHeicPlaceholder ? ca.originalUri : ca.compressed.uri;
        return {
          id: makeId(),
          uri: ca.displayUri,        // What to show in the image thumbnail
          fileName: ca.compressed.fileName,
          mimeType: ca.compressed.mimeType,
          progress: 0,
          uploading: false,
          totalBytes: 0,
          loadedBytes: 0,
          // On web, doXHRUpload fetches _originalUri (or item.uri) via blob fetch
          // Pass the correct upload URI so doXHRUpload uses it
          _originalUri: ca.isWebHeicPlaceholder ? ca.originalUri : uploadUri,
          // Override display uri with compressed uri for native display
          ...(Platform.OS !== 'web' ? { uri: ca.compressed.uri } : {}),
        } as PhotoItem & { _originalUri?: string };
      });

      const updated = { ...prev, [sectionId]: [...existing, ...newItems] };
      notifyParent(updated);

      // Enqueue each new item for upload
      newItems.forEach(item => {
        pendingQueue.current.push({ sectionId, item });
      });
      // Call processQueue after enqueueing via a microtask to let state settle
      setTimeout(() => processQueue(), 0);

      return updated;
    });
  };

  const removePhoto = (sectionId: string, itemId: string) => {
    const item = photoItems[sectionId]?.find(p => p.id === itemId);
    if (item) {
      const xhrKey = `${sectionId}_${item.id}`;
      xhrRefs.current[xhrKey]?.abort();
      delete xhrRefs.current[xhrKey];
      // Also remove from pending queue
      pendingQueue.current = pendingQueue.current.filter(
        q => !(q.sectionId === sectionId && q.item.id === itemId)
      );
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

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      {uploadingCount > 0 && (
        <View style={styles.globalProgress}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.globalProgressText}>Uploading {doneCount} / {totalCount}</Text>
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
