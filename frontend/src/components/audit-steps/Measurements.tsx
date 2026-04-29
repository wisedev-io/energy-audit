import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const BASE_URL = 'http://157.180.28.98:5050';

interface MeasPhoto {
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

export default function Measurements({ data, updateData }: any) {
  const [formData, setFormData] = useState({
    r1_temp: data.r1_temp || '',
    r1_hum: data.r1_hum || '',
    r1_lux: data.r1_lux || '',
    r2_temp: data.r2_temp || '',
    r2_hum: data.r2_hum || '',
    r2_lux: data.r2_lux || '',
    u1_temp: data.u1_temp || '21',
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateData(newData);
  };

  // ── Harorat & Namlik photos ───────────────────────────────────────────────
  const [thPhotos, setThPhotos] = useState<MeasPhoto[]>(() => {
    const existing: any[] = data.photoItems?.temphum || [];
    return existing.map((item: any) => ({
      id: item.id || makeId(), uri: item.uri || '',
      fileName: item.fileName, mimeType: item.mimeType, serverKey: item.serverKey,
      progress: 0, uploading: false, totalBytes: 0, loadedBytes: 0,
    }));
  });

  // ── Yorug'lik o'lchovi photos ─────────────────────────────────────────────
  const [luxPhotos, setLuxPhotos] = useState<MeasPhoto[]>(() => {
    const existing: any[] = data.photoItems?.lux || [];
    return existing.map((item: any) => ({
      id: item.id || makeId(), uri: item.uri || '',
      fileName: item.fileName, mimeType: item.mimeType, serverKey: item.serverKey,
      progress: 0, uploading: false, totalBytes: 0, loadedBytes: 0,
    }));
  });

  const thXhrRefs = useRef<Record<string, XMLHttpRequest>>({});
  const luxXhrRefs = useRef<Record<string, XMLHttpRequest>>({});
  const thRef = useRef<MeasPhoto[]>(thPhotos);
  const luxRef = useRef<MeasPhoto[]>(luxPhotos);
  useEffect(() => { thRef.current = thPhotos; }, [thPhotos]);
  useEffect(() => { luxRef.current = luxPhotos; }, [luxPhotos]);

  const notifyMeas = (th: MeasPhoto[], lux: MeasPhoto[]) => {
    updateData({ photoItems: { ...(data.photoItems || {}), temphum: th, lux } });
  };

  useEffect(() => {
    const thList = [...thPhotos];
    let changed = false;
    thList.forEach((item, idx) => {
      if (!item.serverKey && !item.uploading && item.uri) { changed = true; startUpload('th', thList, idx); }
    });
    if (changed) setThPhotos([...thList]);

    const lxList = [...luxPhotos];
    let lxChanged = false;
    lxList.forEach((item, idx) => {
      if (!item.serverKey && !item.uploading && item.uri) { lxChanged = true; startUpload('lux', lxList, idx); }
    });
    if (lxChanged) setLuxPhotos([...lxList]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startUpload = (section: 'th' | 'lux', list: MeasPhoto[], idx: number) => {
    const item = list[idx];
    if (!item || item.uploading || item.serverKey) return;
    const xhrRefs = section === 'th' ? thXhrRefs : luxXhrRefs;
    const setPhotos = section === 'th' ? setThPhotos : setLuxPhotos;
    const xhrKey = item.id;
    const xhr = new XMLHttpRequest();
    xhrRefs.current[xhrKey] = xhr;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      setPhotos(prev => {
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
          if (section === 'th') {
            setThPhotos(prev => {
              const nl = [...prev];
              const i = nl.findIndex(p => p.id === item.id);
              if (i < 0) return prev;
              nl[i] = { ...nl[i], serverKey: json.key, progress: 100, uploading: false };
              notifyMeas(nl, luxRef.current);
              return nl;
            });
          } else {
            setLuxPhotos(prev => {
              const nl = [...prev];
              const i = nl.findIndex(p => p.id === item.id);
              if (i < 0) return prev;
              nl[i] = { ...nl[i], serverKey: json.key, progress: 100, uploading: false };
              notifyMeas(thRef.current, nl);
              return nl;
            });
          }
        } else { markError(section, item.id, 'Upload failed'); }
      } catch { markError(section, item.id, 'Server error'); }
    };

    xhr.onerror = () => { delete xhrRefs.current[xhrKey]; markError(section, item.id, 'Network error'); };

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
      }).catch(() => markError(section, item.id, 'Failed to read image'));
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: item.uri, name: filename, type: mimeType } as any);
      xhr.send(fd);
    }
  };

  const markError = (section: 'th' | 'lux', id: string, error: string) => {
    const setPhotos = section === 'th' ? setThPhotos : setLuxPhotos;
    setPhotos(prev => {
      const nl = [...prev];
      const i = nl.findIndex(p => p.id === id);
      if (i < 0) return prev;
      nl[i] = { ...nl[i], uploading: false, progress: 0, error };
      return nl;
    });
  };

  const retryUpload = (section: 'th' | 'lux', id: string) => {
    const setPhotos = section === 'th' ? setThPhotos : setLuxPhotos;
    setPhotos(prev => {
      const nl = [...prev];
      const idx = nl.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      nl[idx] = { ...nl[idx], error: undefined, uploading: false, serverKey: undefined, progress: 0 };
      startUpload(section, nl, idx);
      return nl;
    });
  };

  const addPhotos = (section: 'th' | 'lux', assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    const setPhotos = section === 'th' ? setThPhotos : setLuxPhotos;
    const otherRef = section === 'th' ? luxRef : thRef;
    setPhotos(prev => {
      const newItems: MeasPhoto[] = assets.map(a => {
        const isHeic = a.mimeType?.includes('heic') || a.fileName?.toLowerCase().endsWith('.heic');
        const displayUri = (Platform.OS === 'web' && isHeic)
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>'
          : a.uri;
        return { id: makeId(), uri: displayUri, fileName: a.fileName, mimeType: a.mimeType, progress: 0, uploading: false, totalBytes: 0, loadedBytes: 0, _originalUri: a.uri } as any;
      });
      const updated = [...prev, ...newItems];
      newItems.forEach((_, offset) => startUpload(section, updated, prev.length + offset));
      if (section === 'th') notifyMeas(updated, otherRef.current);
      else notifyMeas(otherRef.current, updated);
      return updated;
    });
  };

  const removePhoto = (section: 'th' | 'lux', id: string) => {
    const xhrRefs = section === 'th' ? thXhrRefs : luxXhrRefs;
    const setPhotos = section === 'th' ? setThPhotos : setLuxPhotos;
    const otherRef = section === 'th' ? luxRef : thRef;
    xhrRefs.current[id]?.abort();
    delete xhrRefs.current[id];
    setPhotos(prev => {
      const updated = prev.filter(p => p.id !== id);
      if (section === 'th') notifyMeas(updated, otherRef.current);
      else notifyMeas(otherRef.current, updated);
      return updated;
    });
  };

  const pickImage = async (section: 'th' | 'lux') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9 });
    if (!result.canceled) addPhotos(section, result.assets.map(a => ({ uri: a.uri, fileName: a.fileName ?? undefined, mimeType: a.mimeType ?? undefined })));
  };

  const takePhoto = async (section: 'th' | 'lux') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) addPhotos(section, [{ uri: result.assets[0].uri, fileName: result.assets[0].fileName ?? undefined, mimeType: result.assets[0].mimeType ?? undefined }]);
  };

  const rooms = [
    { label: 'Room 1 (Living Room)', prefix: 'r1' },
    { label: 'Room 2 (Bedroom)', prefix: 'r2' },
  ];

  const renderPhotoSection = (section: 'th' | 'lux', title: string, icon: string) => {
    const photos = section === 'th' ? thPhotos : luxPhotos;
    const uploadingCount = photos.filter(p => p.uploading).length;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon as any} size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>{title}</Text>
          {uploadingCount > 0 && <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 8 }} />}
        </View>

        {photos.map((item) => (
          <View key={item.id} style={styles.photoWrap}>
            {item.uri.startsWith('data:image/svg') ? (
              <View style={[styles.photo, styles.heicPlaceholder]}>
                <Ionicons name="image-outline" size={36} color="#9ca3af" />
                <Text style={styles.heicText}>HEIC</Text>
              </View>
            ) : (
              <Image source={{ uri: item.uri }} style={[styles.photo, item.uploading && styles.photoDim]} resizeMode="contain" />
            )}
            {item.uploading && (
              <View style={styles.progressOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.progressPct}>{item.progress}%</Text>
                {item.totalBytes > 0 && <Text style={styles.progressBytes}>{fmtBytes(item.loadedBytes)} / {fmtBytes(item.totalBytes)}</Text>}
              </View>
            )}
            {item.serverKey && !item.uploading && (
              <View style={styles.doneIndicator}>
                <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                <Text style={styles.doneText}>Uploaded</Text>
              </View>
            )}
            {item.error && !item.uploading && (
              <TouchableOpacity style={styles.errorOverlay} onPress={() => retryUpload(section, item.id)}>
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{item.error} — tap to retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => removePhoto(section, item.id)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addBtnsRow}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={() => takePhoto(section)} style={styles.addPhotoBtn}>
              <Ionicons name="camera" size={26} color="#2563eb" />
              <Text style={styles.addPhotoBtnText}>Camera</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => pickImage(section)} style={styles.addPhotoBtn}>
            <Ionicons name="images" size={26} color="#2563eb" />
            <Text style={styles.addPhotoBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color="#2563eb" />
        <Text style={styles.infoText}>
          Enter measurements for 2 rooms. Rooms 3 & 4 are auto-generated with ±5 variation in the report.
        </Text>
      </View>

      {rooms.map(({ label, prefix }) => (
        <View key={prefix} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="thermometer" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>{label}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.third}>
              <Text style={styles.label}>Temp °C ({prefix}_temp)</Text>
              <TextInput
                style={styles.input}
                value={(formData as any)[`${prefix}_temp`]}
                onChangeText={(v) => handleChange(`${prefix}_temp`, v)}
                placeholder="22.0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.label}>Humidity % ({prefix}_hum)</Text>
              <TextInput
                style={styles.input}
                value={(formData as any)[`${prefix}_hum`]}
                onChangeText={(v) => handleChange(`${prefix}_hum`, v)}
                placeholder="50"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.label}>Light lux ({prefix}_lux)</Text>
              <TextInput
                style={styles.input}
                value={(formData as any)[`${prefix}_lux`]}
                onChangeText={(v) => handleChange(`${prefix}_lux`, v)}
                placeholder="300"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="snow" size={20} color="#06b6d4" />
          <Text style={styles.sectionTitle}>U-value Reference Temperature</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Outside Temperature °C (u1_temp)</Text>
          <TextInput
            style={styles.input}
            value={formData.u1_temp}
            onChangeText={(v) => handleChange('u1_temp', v)}
            placeholder="21"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.autoBox}>
          <Text style={styles.autoText}>
            U-values (wall, window, roof, floor) are auto-generated near standard norms ±0.35 by the backend.
          </Text>
        </View>
      </View>

      {renderPhotoSection('th', 'Harorat & Namlik rasmlari', 'thermometer')}
      {renderPhotoSection('lux', "Yorug'lik o'lchovi rasmlari", 'sunny')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 20 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  third: { flex: 1 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 11, color: '#6b7280', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  autoBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, padding: 12 },
  autoText: { fontSize: 12, color: '#166534', lineHeight: 18 },
  // Photo styles
  photoWrap: { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  photo: { width: '100%', height: 220, borderRadius: 12 },
  photoDim: { opacity: 0.5 },
  heicPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 120 },
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
});
