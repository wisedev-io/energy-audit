import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const BASE_URL = 'http://157.180.28.98:5050';

interface FPPhoto {
  id: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
  serverKey?: string;
  progress: number;
  uploading: boolean;
  error?: string;
  totalBytes: number;
  loadedBytes: number;
}

function makeId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function fmtBytes(b: number) { return b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`; }

export default function Dimensions({ data, updateData }: any) {
  const [activeTab, setActiveTab] = useState<'floor'|'door'|'window'|'wall'>('floor');

  const [floors, setFloors] = useState(data.floors_list || [{ l: '', w: '' }]);
  const [doors, setDoors] = useState(data.doors_list || [{ w: '', h: '', n: '1' }]);
  const [windows, setWindows] = useState(data.windows_list || [{ w: '', h: '', n: '1' }]);
  const [walls, setWalls] = useState(data.walls_list || [{ p: '', h: '' }]);

  // Floorplan photos — lives in formData.photoItems.floorplan
  const [fpPhotos, setFpPhotos] = useState<FPPhoto[]>(() => {
    const existing: any[] = data.photoItems?.floorplan || [];
    return existing.map((item: any) => ({
      id: item.id || makeId(),
      uri: item.uri || '',
      fileName: item.fileName,
      mimeType: item.mimeType,
      serverKey: item.serverKey,
      progress: 0,
      uploading: false,
      totalBytes: item.totalBytes || 0,
      loadedBytes: item.loadedBytes || 0,
    }));
  });
  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({});

  const notifyFP = (photos: FPPhoto[]) => {
    updateData({ photoItems: { ...(data.photoItems || {}), floorplan: photos } });
  };

  // Re-upload any restored photos missing serverKey
  useEffect(() => {
    const list = [...fpPhotos];
    let changed = false;
    list.forEach((item, idx) => {
      if (!item.serverKey && !item.uploading && item.uri) {
        changed = true;
        startUpload(list, idx);
      }
    });
    if (changed) setFpPhotos([...list]);
  }, []);

  const startUpload = (list: FPPhoto[], idx: number) => {
    const item = list[idx];
    if (!item || item.uploading || item.serverKey) return;
    const xhrKey = item.id;
    const xhr = new XMLHttpRequest();
    xhrRefs.current[xhrKey] = xhr;
    const startTime = Date.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const speed = e.loaded / ((Date.now() - startTime) / 1000 || 0.001);
      setFpPhotos(prev => {
        const nl = [...prev];
        const i = nl.findIndex(p => p.id === item.id);
        if (i < 0) return prev;
        nl[i] = { ...nl[i], progress: Math.round((e.loaded / e.total) * 100), loadedBytes: e.loaded, totalBytes: e.total };
        return nl;
      });
    };
    xhr.onload = () => {
      delete xhrRefs.current[xhrKey];
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.key) {
          setFpPhotos(prev => {
            const nl = [...prev];
            const i = nl.findIndex(p => p.id === item.id);
            if (i < 0) return prev;
            nl[i] = { ...nl[i], serverKey: json.key, progress: 100, uploading: false };
            notifyFP(nl);
            return nl;
          });
        } else {
          markError(item.id, 'Upload failed');
        }
      } catch { markError(item.id, 'Server error'); }
    };
    xhr.onerror = () => { delete xhrRefs.current[xhrKey]; markError(item.id, 'Network error'); };
    list[idx] = { ...item, uploading: true, progress: 0, error: undefined };
    const filename = item.fileName || item.uri.split('/').pop() || 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const uriExt = (item.uri.split('/').pop() || '').split('.').pop()?.toLowerCase() || '';
    const isHeic = ext === 'heic' || ext === 'heif' || uriExt === 'heic' || uriExt === 'heif' ||
      (item.mimeType || '').toLowerCase().includes('heic');
    const mimeType = isHeic ? 'image/heic' : (item.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg'));
    xhr.open('POST', `${BASE_URL}/upload_photo`);
    if (Platform.OS === 'web') {
      fetch((item as any)._originalUri || item.uri).then(r => r.blob()).then(blob => {
        const fd = new FormData();
        fd.append('photo', new Blob([blob], { type: 'image/jpeg' }), filename.replace(/\.[^.]+$/, '.jpg'));
        xhr.send(fd);
      }).catch(() => markError(item.id, 'Failed to read image'));
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: item.uri, name: filename, type: mimeType } as any);
      xhr.send(fd);
    }
  };

  const markError = (id: string, error: string) => {
    setFpPhotos(prev => {
      const nl = [...prev];
      const i = nl.findIndex(p => p.id === id);
      if (i < 0) return prev;
      nl[i] = { ...nl[i], uploading: false, progress: 0, error };
      return nl;
    });
  };

  const retryUpload = (id: string) => {
    setFpPhotos(prev => {
      const nl = [...prev];
      const idx = nl.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      nl[idx] = { ...nl[idx], error: undefined, uploading: false, serverKey: undefined, progress: 0 };
      startUpload(nl, idx);
      return nl;
    });
  };

  const addPhotos = (assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    setFpPhotos(prev => {
      const newItems: FPPhoto[] = assets.map(a => {
        const isHeic = a.mimeType?.includes('heic') || a.fileName?.toLowerCase().endsWith('.heic');
        const displayUri = (Platform.OS === 'web' && isHeic)
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>'
          : a.uri;
        return { id: makeId(), uri: displayUri, fileName: a.fileName, mimeType: a.mimeType, progress: 0, uploading: false, totalBytes: 0, loadedBytes: 0, _originalUri: a.uri } as any;
      });
      const updated = [...prev, ...newItems];
      newItems.forEach((_, offset) => startUpload(updated, prev.length + offset));
      notifyFP(updated);
      return updated;
    });
  };

  const removePhoto = (id: string) => {
    xhrRefs.current[id]?.abort();
    delete xhrRefs.current[id];
    setFpPhotos(prev => {
      const updated = prev.filter(p => p.id !== id);
      notifyFP(updated);
      return updated;
    });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9 });
    if (!result.canceled) addPhotos(result.assets.map(a => ({ uri: a.uri, fileName: a.fileName ?? undefined, mimeType: a.mimeType ?? undefined })));
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) addPhotos([{ uri: result.assets[0].uri, fileName: result.assets[0].fileName ?? undefined, mimeType: result.assets[0].mimeType ?? undefined }]);
  };

  // ── Measurement helpers ──────────────────────────────────────────────────
  const calcFloorArea = (row: any) => (parseFloat(row.l)||0) * (parseFloat(row.w)||0);
  const calcDoorArea = (row: any) => (parseFloat(row.w)||0) * (parseFloat(row.h)||0) * (parseFloat(row.n)||1);
  const calcWinArea = (row: any) => (parseFloat(row.w)||0) * (parseFloat(row.h)||0) * (parseFloat(row.n)||1);
  const calcWallArea = (row: any) => (parseFloat(row.p)||0) * (parseFloat(row.h)||0);

  const syncToForm = (fl: any[], do_: any[], wi: any[], wa: any[]) => {
    const out: any = { floors_list: fl, doors_list: do_, windows_list: wi, walls_list: wa };
    fl.forEach((r, i) => { out[`floor_l${i+1}`] = r.l; out[`floor_w${i+1}`] = r.w; });
    do_.forEach((r, i) => { out[`door_w${i+1}`] = r.w; out[`door_h${i+1}`] = r.h; out[`door_n${i+1}`] = r.n; });
    wi.forEach((r, i) => { out[`win_w${i+1}`] = r.w; out[`win_h${i+1}`] = r.h; out[`win_n${i+1}`] = r.n; });
    wa.forEach((r, i) => { out[`wall_p${i+1}`] = r.p; out[`wall_h${i+1}`] = r.h; });
    updateData(out);
  };

  const updateRow = (list: any[], setList: any, index: number, field: string, value: string, fl=floors, do_=doors, wi=windows, wa=walls) => {
    const newList = [...list];
    newList[index] = { ...newList[index], [field]: value };
    setList(newList);
    syncToForm(list === floors ? newList : fl, list === doors ? newList : do_, list === windows ? newList : wi, list === walls ? newList : wa);
  };

  const addRow = (list: any[], setList: any, empty: any) => {
    const newList = [...list, empty];
    setList(newList);
    syncToForm(list === floors ? newList : floors, list === doors ? newList : doors, list === windows ? newList : windows, list === walls ? newList : walls);
  };

  const delRow = (list: any[], setList: any, index: number) => {
    if (list.length <= 1) return;
    const newList = list.filter((_, i) => i !== index);
    setList(newList);
    syncToForm(list === floors ? newList : floors, list === doors ? newList : doors, list === windows ? newList : windows, list === walls ? newList : walls);
  };

  const tabs = ['floor', 'door', 'window', 'wall'];

  const renderFloors = () => (
    <>
      {floors.map((row: any, i: number) => (
        <View key={i} style={styles.rowCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Floor {i+1}</Text>
            {floors.length > 1 && <TouchableOpacity onPress={() => delRow(floors, setFloors, i)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.half}><Text style={styles.label}>Length m (floor_l{i+1})</Text><TextInput style={styles.input} value={row.l} onChangeText={(v) => updateRow(floors, setFloors, i, 'l', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.half}><Text style={styles.label}>Width m (floor_w{i+1})</Text><TextInput style={styles.input} value={row.w} onChangeText={(v) => updateRow(floors, setFloors, i, 'w', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
          </View>
          <View style={styles.areaBox}><Text style={styles.areaLabel}>Area: {calcFloorArea(row).toFixed(2)} m²</Text></View>
        </View>
      ))}
      <TouchableOpacity onPress={() => addRow(floors, setFloors, { l: '', w: '' })} style={styles.addBtn}>
        <Ionicons name="add-circle" size={20} color="#2563eb" /><Text style={styles.addBtnText}>Add Floor</Text>
      </TouchableOpacity>
      <View style={styles.totalBox}><Text style={styles.totalLabel}>Total Floor Area:</Text><Text style={styles.totalValue}>{floors.reduce((s: number, r: any) => s + calcFloorArea(r), 0).toFixed(2)} m²</Text></View>
    </>
  );

  const renderDoors = () => (
    <>
      {doors.map((row: any, i: number) => (
        <View key={i} style={styles.rowCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Door {i+1}</Text>
            {doors.length > 1 && <TouchableOpacity onPress={() => delRow(doors, setDoors, i)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.third}><Text style={styles.label}>Width (door_w{i+1})</Text><TextInput style={styles.input} value={row.w} onChangeText={(v) => updateRow(doors, setDoors, i, 'w', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.third}><Text style={styles.label}>Height (door_h{i+1})</Text><TextInput style={styles.input} value={row.h} onChangeText={(v) => updateRow(doors, setDoors, i, 'h', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.third}><Text style={styles.label}>Count (door_n{i+1})</Text><TextInput style={styles.input} value={row.n} onChangeText={(v) => updateRow(doors, setDoors, i, 'n', v)} placeholder="1" keyboardType="numeric" /></View>
          </View>
          <View style={styles.areaBox}><Text style={styles.areaLabel}>Area: {calcDoorArea(row).toFixed(2)} m²</Text></View>
        </View>
      ))}
      <TouchableOpacity onPress={() => addRow(doors, setDoors, { w: '', h: '', n: '1' })} style={styles.addBtn}>
        <Ionicons name="add-circle" size={20} color="#2563eb" /><Text style={styles.addBtnText}>Add Door</Text>
      </TouchableOpacity>
      <View style={styles.totalBox}><Text style={styles.totalLabel}>Total Door Area:</Text><Text style={styles.totalValue}>{doors.reduce((s: number, r: any) => s + calcDoorArea(r), 0).toFixed(2)} m²</Text></View>
    </>
  );

  const renderWindows = () => (
    <>
      {windows.map((row: any, i: number) => (
        <View key={i} style={styles.rowCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Window {i+1}</Text>
            {windows.length > 1 && <TouchableOpacity onPress={() => delRow(windows, setWindows, i)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.third}><Text style={styles.label}>Width (win_w{i+1})</Text><TextInput style={styles.input} value={row.w} onChangeText={(v) => updateRow(windows, setWindows, i, 'w', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.third}><Text style={styles.label}>Height (win_h{i+1})</Text><TextInput style={styles.input} value={row.h} onChangeText={(v) => updateRow(windows, setWindows, i, 'h', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.third}><Text style={styles.label}>Count (win_n{i+1})</Text><TextInput style={styles.input} value={row.n} onChangeText={(v) => updateRow(windows, setWindows, i, 'n', v)} placeholder="1" keyboardType="numeric" /></View>
          </View>
          <View style={styles.areaBox}><Text style={styles.areaLabel}>Area: {calcWinArea(row).toFixed(2)} m²</Text></View>
        </View>
      ))}
      <TouchableOpacity onPress={() => addRow(windows, setWindows, { w: '', h: '', n: '1' })} style={styles.addBtn}>
        <Ionicons name="add-circle" size={20} color="#2563eb" /><Text style={styles.addBtnText}>Add Window</Text>
      </TouchableOpacity>
      <View style={styles.totalBox}><Text style={styles.totalLabel}>Total Window Area:</Text><Text style={styles.totalValue}>{windows.reduce((s: number, r: any) => s + calcWinArea(r), 0).toFixed(2)} m²</Text></View>
    </>
  );

  const renderWalls = () => (
    <>
      {walls.map((row: any, i: number) => (
        <View key={i} style={styles.rowCard}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle}>Wall {i+1}</Text>
            {walls.length > 1 && <TouchableOpacity onPress={() => delRow(walls, setWalls, i)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.half}><Text style={styles.label}>Perimeter m (wall_p{i+1})</Text><TextInput style={styles.input} value={row.p} onChangeText={(v) => updateRow(walls, setWalls, i, 'p', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
            <View style={styles.half}><Text style={styles.label}>Height m (wall_h{i+1})</Text><TextInput style={styles.input} value={row.h} onChangeText={(v) => updateRow(walls, setWalls, i, 'h', v)} placeholder="0.0" keyboardType="decimal-pad" /></View>
          </View>
          <View style={styles.areaBox}><Text style={styles.areaLabel}>Area: {calcWallArea(row).toFixed(2)} m²</Text></View>
        </View>
      ))}
      <TouchableOpacity onPress={() => addRow(walls, setWalls, { p: '', h: '' })} style={styles.addBtn}>
        <Ionicons name="add-circle" size={20} color="#2563eb" /><Text style={styles.addBtnText}>Add Wall</Text>
      </TouchableOpacity>
      <View style={styles.totalBox}><Text style={styles.totalLabel}>Total Wall Area:</Text><Text style={styles.totalValue}>{walls.reduce((s: number, r: any) => s + calcWallArea(r), 0).toFixed(2)} m²</Text></View>
    </>
  );

  const uploadingCount = fpPhotos.filter(p => p.uploading).length;
  const doneCount = fpPhotos.filter(p => !!p.serverKey).length;

  return (
    <ScrollView style={styles.container}>

      {/* ── Floor Plan Photos (Bino rejasi) ──────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="map" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Bino rejasi (Floor Plan)</Text>
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>{doneCount}/2</Text>
          </View>
        </View>
        <Text style={styles.photoHint}>
          Upload floor plan photos here — you can reference them while filling in measurements below.
        </Text>

        {uploadingCount > 0 && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.uploadProgressText}>Uploading {uploadingCount} photo…</Text>
          </View>
        )}

        {/* Large photo previews */}
        {fpPhotos.map((item) => (
          <View key={item.id} style={styles.fpPhotoWrap}>
            {item.uri.startsWith('data:image/svg') ? (
              <View style={[styles.fpPhoto, styles.heicPlaceholder]}>
                <Ionicons name="image-outline" size={36} color="#9ca3af" />
                <Text style={styles.heicText}>HEIC</Text>
              </View>
            ) : (
              <Image
                source={{ uri: item.uri }}
                style={[styles.fpPhoto, item.uploading && styles.photoDim]}
                resizeMode="contain"
              />
            )}

            {item.uploading && (
              <View style={styles.progressOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.progressPct}>{item.progress}%</Text>
                {item.totalBytes > 0 && (
                  <Text style={styles.progressBytes}>{fmtBytes(item.loadedBytes)} / {fmtBytes(item.totalBytes)}</Text>
                )}
              </View>
            )}

            {item.serverKey && !item.uploading && (
              <View style={styles.doneIndicator}>
                <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                <Text style={styles.doneText}>Uploaded</Text>
              </View>
            )}

            {item.error && !item.uploading && (
              <TouchableOpacity style={styles.errorOverlay} onPress={() => retryUpload(item.id)}>
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{item.error} — tap to retry</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => removePhoto(item.id)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add photo buttons */}
        <View style={styles.addBtnsRow}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={takePhoto} style={styles.addPhotoBtn}>
              <Ionicons name="camera" size={26} color="#2563eb" />
              <Text style={styles.addPhotoBtnText}>Camera</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={pickImage} style={styles.addPhotoBtn}>
            <Ionicons name="images" size={26} color="#2563eb" />
            <Text style={styles.addPhotoBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {doneCount < 2 && (
          <Text style={styles.photoRequirement}>
            Add at least {2 - doneCount} more floor plan photo{2 - doneCount > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* ── Area Measurements ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="resize" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Area Measurements</Text>
        </View>
        <View style={styles.tabs}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab as any)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {activeTab === 'floor' && renderFloors()}
        {activeTab === 'door' && renderDoors()}
        {activeTab === 'window' && renderWindows()}
        {activeTab === 'wall' && renderWalls()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1 },

  // Floorplan photos
  photoBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  photoBadgeText: { fontSize: 12, color: '#1d4ed8', fontWeight: '700' },
  photoHint: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  uploadProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 12 },
  uploadProgressText: { fontSize: 13, color: '#1d4ed8' },
  fpPhotoWrap: { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  fpPhoto: { width: '100%', height: 260, borderRadius: 12 },
  photoDim: { opacity: 0.5 },
  heicPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 140 },
  heicText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  progressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  progressPct: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  progressBytes: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  doneIndicator: { position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  doneText: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  errorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
  removeBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 14 },
  addBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  addPhotoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14 },
  addPhotoBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  photoRequirement: { fontSize: 12, color: '#9ca3af', marginTop: 10, textAlign: 'center' },

  // Measurements
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' },
  activeTab: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 12, color: '#374151' },
  activeTabText: { color: '#fff', fontWeight: '600' },
  rowCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  half: { flex: 1 },
  third: { flex: 1 },
  label: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  areaBox: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  areaLabel: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  addBtnText: { fontSize: 14, color: '#374151' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  totalLabel: { fontSize: 14, color: '#fff' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
});
