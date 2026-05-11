import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

const BASE_URL = 'http://157.180.28.98:5050';

const MONTHS = ['Yan','Feb','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];

interface BillPhoto {
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

function makeBillId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function fmtBytes(b: number) { return b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`; }

const emptyYear = () => MONTHS.map(() => ({ gas: '', elec: '', other: '' }));

function cleanNum(s: string): string {
  return s.trim().replace(',', '.').replace(/[^\d.]/g, '');
}

function fromStoredLists(data: any, yr: number) {
  if (data[`y${yr}`]) return data[`y${yr}`];
  const gasList = data[`gas_${yr}`];
  if (Array.isArray(gasList)) {
    return gasList.map((g: any, mi: number) => ({
      gas:   g != null && g !== 0 ? String(g) : '',
      elec:  data[`elec_${yr}`]?.[mi] != null && data[`elec_${yr}`][mi] !== 0 ? String(data[`elec_${yr}`][mi]) : '',
      other: data[`other_${yr}`]?.[mi] != null && data[`other_${yr}`][mi] !== 0 ? String(data[`other_${yr}`][mi]) : '',
    }));
  }
  return emptyYear();
}

export default function EnergyConsumption({ data, updateData, embedded }: any) {
  const [activeYear, setActiveYear] = useState(2025);
  const [y2023, setY2023] = useState(() => fromStoredLists(data, 2023));
  const [y2024, setY2024] = useState(() => fromStoredLists(data, 2024));
  const [y2025, setY2025] = useState(() => fromStoredLists(data, 2025));
  const [scanLoading, setScanLoading] = useState(false);

  // Always-current refs for use in async callbacks
  const y2023Ref = useRef(y2023);
  const y2024Ref = useRef(y2024);
  const y2025Ref = useRef(y2025);
  const activeYearRef = useRef(activeYear);
  useEffect(() => { y2023Ref.current = y2023; }, [y2023]);
  useEffect(() => { y2024Ref.current = y2024; }, [y2024]);
  useEffect(() => { y2025Ref.current = y2025; }, [y2025]);
  useEffect(() => { activeYearRef.current = activeYear; }, [activeYear]);

  // Keyboard navigation refs
  const inputRefs = useRef<Record<string, any>>({});
  const pendingFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocusRef.current) {
      const key = pendingFocusRef.current;
      setTimeout(() => { inputRefs.current[key]?.focus(); pendingFocusRef.current = null; }, 100);
    }
  }, [activeYear]);

  const navigateDown = (monthIdx: number, col: 'gas' | 'elec' | 'other') => {
    if (monthIdx < 11) {
      inputRefs.current[`${activeYear}_${monthIdx + 1}_${col}`]?.focus();
    } else if (activeYear < 2025) {
      pendingFocusRef.current = `${activeYear + 1}_0_${col}`;
      setActiveYear(activeYear + 1);
    } else {
      // End of 2025 December — cross to next column starting from 2023
      const nextCol = col === 'gas' ? 'elec' : col === 'elec' ? 'other' : null;
      if (nextCol) {
        pendingFocusRef.current = `2023_0_${nextCol}`;
        setActiveYear(2023);
      }
    }
  };

  // ── Bill photos (To'lov hujjatlari) ───────────────────────────────────────
  const [billPhotos, setBillPhotos] = useState<BillPhoto[]>(() => {
    const existing: any[] = data.photoItems?.bills || [];
    return existing.map((item: any) => ({
      id: item.id || makeBillId(),
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
  const billXhrRefs = useRef<Record<string, XMLHttpRequest>>({});

  const notifyBills = (photos: BillPhoto[]) => {
    updateData({ photoItems: { ...(data.photoItems || {}), bills: photos } });
  };

  useEffect(() => {
    const list = [...billPhotos];
    let changed = false;
    list.forEach((item, idx) => {
      if (!item.serverKey && !item.uploading && item.uri) {
        changed = true;
        startBillUpload(list, idx);
      }
    });
    if (changed) setBillPhotos([...list]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startBillUpload = (list: BillPhoto[], idx: number) => {
    const item = list[idx];
    if (!item || item.uploading || item.serverKey) return;
    const xhrKey = item.id;
    const xhr = new XMLHttpRequest();
    billXhrRefs.current[xhrKey] = xhr;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      setBillPhotos(prev => {
        const nl = [...prev];
        const i = nl.findIndex(p => p.id === item.id);
        if (i < 0) return prev;
        nl[i] = { ...nl[i], progress: Math.round((e.loaded / e.total) * 100), loadedBytes: e.loaded, totalBytes: e.total };
        return nl;
      });
    };

    xhr.onload = () => {
      delete billXhrRefs.current[xhrKey];
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.key) {
          setBillPhotos(prev => {
            const nl = [...prev];
            const i = nl.findIndex(p => p.id === item.id);
            if (i < 0) return prev;
            nl[i] = { ...nl[i], serverKey: json.key, progress: 100, uploading: false };
            notifyBills(nl);
            return nl;
          });
        } else { markBillError(item.id, 'Upload failed'); }
      } catch { markBillError(item.id, 'Server error'); }
    };

    xhr.onerror = () => { delete billXhrRefs.current[xhrKey]; markBillError(item.id, 'Network error'); };

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
      }).catch(() => markBillError(item.id, 'Failed to read image'));
    } else {
      const fd = new FormData();
      fd.append('photo', { uri: item.uri, name: filename, type: mimeType } as any);
      xhr.send(fd);
    }
  };

  const markBillError = (id: string, error: string) => {
    setBillPhotos(prev => {
      const nl = [...prev];
      const i = nl.findIndex(p => p.id === id);
      if (i < 0) return prev;
      nl[i] = { ...nl[i], uploading: false, progress: 0, error };
      return nl;
    });
  };

  const retryBillUpload = (id: string) => {
    setBillPhotos(prev => {
      const nl = [...prev];
      const idx = nl.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      nl[idx] = { ...nl[idx], error: undefined, uploading: false, serverKey: undefined, progress: 0 };
      startBillUpload(nl, idx);
      return nl;
    });
  };

  const addBillPhotos = (assets: Array<{ uri: string; fileName?: string; mimeType?: string }>) => {
    setBillPhotos(prev => {
      const newItems: BillPhoto[] = assets.map(a => {
        const isHeic = a.mimeType?.includes('heic') || a.fileName?.toLowerCase().endsWith('.heic');
        const displayUri = (Platform.OS === 'web' && isHeic)
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e5e7eb"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%236b7280">HEIC</text></svg>'
          : a.uri;
        return { id: makeBillId(), uri: displayUri, fileName: a.fileName, mimeType: a.mimeType, progress: 0, uploading: false, totalBytes: 0, loadedBytes: 0, _originalUri: a.uri } as any;
      });
      const updated = [...prev, ...newItems];
      newItems.forEach((_, offset) => startBillUpload(updated, prev.length + offset));
      notifyBills(updated);
      return updated;
    });
  };

  const removeBillPhoto = (id: string) => {
    billXhrRefs.current[id]?.abort();
    delete billXhrRefs.current[id];
    setBillPhotos(prev => {
      const updated = prev.filter(p => p.id !== id);
      notifyBills(updated);
      return updated;
    });
  };

  const pickBillImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9 });
    if (!result.canceled) addBillPhotos(result.assets.map(a => ({ uri: a.uri, fileName: a.fileName ?? undefined, mimeType: a.mimeType ?? undefined })));
  };

  const takeBillPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) addBillPhotos([{ uri: result.assets[0].uri, fileName: result.assets[0].fileName ?? undefined, mimeType: result.assets[0].mimeType ?? undefined }]);
  };

  // Apply a single OCR result to the year table (silent — caller shows the alert)
  const applyResult = (type: 'gas' | 'elec', year: number | null, monthData: Array<{ month: number; value: number }>) => {
    const targetYear = (year && [2023, 2024, 2025].includes(year)) ? year : activeYearRef.current;

    const applyToData = (prev: any[]) => {
      const nd = [...prev];
      monthData.forEach(({ month, value }) => {
        if (month >= 0 && month < 12) nd[month] = { ...nd[month], [type]: String(value) };
      });
      return nd;
    };

    let y23 = y2023Ref.current;
    let y24 = y2024Ref.current;
    let y25 = y2025Ref.current;

    if (targetYear === 2023) { y23 = applyToData(y23); setY2023(y23); }
    else if (targetYear === 2024) { y24 = applyToData(y24); setY2024(y24); }
    else { y25 = applyToData(y25); setY2025(y25); }

    const out: any = { y2023: y23, y2024: y24, y2025: y25 };
    [2023, 2024, 2025].forEach(yr => {
      const src = yr === 2023 ? y23 : yr === 2024 ? y24 : y25;
      src.forEach((m: any, mi: number) => {
        out[`gas_${yr}_${mi}`] = m.gas || '0';
        out[`elec_${yr}_${mi}`] = m.elec || '0';
        out[`other_${yr}_${mi}`] = m.other || '0';
      });
    });
    updateData(out);
  };

  // Scan all uploaded bill photos and auto-fill the table
  const handleScanBills = async () => {
    const keys = billPhotos.filter(p => !!p.serverKey).map(p => p.serverKey as string);
    if (keys.length === 0) return;
    setScanLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/scan-bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      const json = await res.json();
      if (!json.success) {
        Alert.alert('Error', json.error || 'Scan failed');
        return;
      }
      const results: any[] = json.results || [];
      let gasApplied = false, elecApplied = false;
      results.forEach((r: any) => {
        if (r.type && Array.isArray(r.data) && r.data.length > 0) {
          const yr = r.year && [2023, 2024, 2025].includes(r.year) ? r.year : null;
          applyResult(r.type, yr, r.data);
          if (r.type === 'gas') gasApplied = true;
          else elecApplied = true;
        }
      });
      if (gasApplied || elecApplied) {
        const filled = [gasApplied && 'Gas', elecApplied && 'Electricity'].filter(Boolean).join(' & ');
        Alert.alert('Done!', `${filled} data filled from ${keys.length} scanned bill${keys.length > 1 ? 's' : ''}.`);
      } else {
        Alert.alert('No data found', 'Could not extract values. Make sure the screenshots show bar charts with monthly values.');
      }
    } catch {
      Alert.alert('Error', 'Failed to scan bills. Check your connection.');
    } finally {
      setScanLoading(false);
    }
  };

  const billUploadingCount = billPhotos.filter(p => p.uploading).length;
  const billDoneCount = billPhotos.filter(p => !!p.serverKey).length;

  const current = activeYear === 2023 ? y2023 : activeYear === 2024 ? y2024 : y2025;
  const setCurrent = activeYear === 2023 ? setY2023 : activeYear === 2024 ? setY2024 : setY2025;

  const pushUpdate = (newData: any[], y23 = y2023, y24 = y2024, y25 = y2025) => {
    const out: any = { y2023: y23, y2024: y24, y2025: y25 };
    if (activeYear === 2023) out.y2023 = newData;
    if (activeYear === 2024) out.y2024 = newData;
    if (activeYear === 2025) out.y2025 = newData;
    [2023, 2024, 2025].forEach(yr => {
      const src = yr === 2023 ? out.y2023 : yr === 2024 ? out.y2024 : out.y2025;
      src.forEach((m: any, mi: number) => {
        out[`gas_${yr}_${mi}`] = m.gas || '0';
        out[`elec_${yr}_${mi}`] = m.elec || '0';
        out[`other_${yr}_${mi}`] = m.other || '0';
      });
    });
    updateData(out);
  };

  const updateMonth = (i: number, field: string, value: string) => {
    const newData = [...current];
    newData[i] = { ...newData[i], [field]: value };
    setCurrent(newData);
    pushUpdate(newData);
  };

  const applyPaste = (rows: string[], mode: 'all' | 'gas' | 'elec' | 'other' | 'gas_elec') => {
    const newData = [...current];
    rows.slice(0, 12).forEach((row, i) => {
      const cols = row.split('\t').map(cleanNum);
      if (mode === 'all') {
        if (cols[0] !== '') newData[i] = { ...newData[i], gas: cols[0] };
        if (cols[1] !== undefined && cols[1] !== '') newData[i] = { ...newData[i], elec: cols[1] };
        if (cols[2] !== undefined && cols[2] !== '') newData[i] = { ...newData[i], other: cols[2] };
      } else if (mode === 'gas_elec') {
        if (cols[0] !== '') newData[i] = { ...newData[i], gas: cols[0] };
        if (cols[1] !== undefined && cols[1] !== '') newData[i] = { ...newData[i], elec: cols[1] };
      } else {
        const val = cols[0];
        if (val !== '') newData[i] = { ...newData[i], [mode]: val };
      }
    });
    setCurrent(newData);
    pushUpdate(newData);
    Alert.alert('Pasted!', `Filled data for ${activeYear} from clipboard.`);
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text?.trim()) {
      Alert.alert('Clipboard empty', 'Copy a range from Excel or Google Sheets first.');
      return;
    }
    const rows = text.trim().split(/\r?\n/);
    const colCount = rows[0].split('\t').length;
    if (colCount >= 3) {
      applyPaste(rows, 'all');
    } else if (colCount === 2) {
      applyPaste(rows, 'gas_elec');
    } else {
      Alert.alert(
        'Paste into which column?',
        `${rows.length} rows detected`,
        [
          { text: 'Gas (m³)', onPress: () => applyPaste(rows, 'gas') },
          { text: 'Electricity (kWh)', onPress: () => applyPaste(rows, 'elec') },
          { text: 'Other', onPress: () => applyPaste(rows, 'other') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const totals = current.reduce((acc: any, m: any) => ({
    gas: acc.gas + (parseFloat(m.gas) || 0),
    elec: acc.elec + (parseFloat(m.elec) || 0),
    other: acc.other + (parseFloat(m.other) || 0),
  }), { gas: 0, elec: 0, other: 0 });

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>

      {/* ── To'lov hujjatlari ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>To'lov hujjatlari</Text>
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>{billDoneCount}/12</Text>
          </View>
        </View>
        <Text style={styles.photoHint}>
          Upload gas &amp; electricity bar chart screenshots, then press <Text style={{ fontWeight: '700' }}>Scan Bills</Text> to fill the table automatically.
        </Text>

        {billUploadingCount > 0 && (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.uploadProgressText}>Uploading {billUploadingCount} photo…</Text>
          </View>
        )}

        {billPhotos.map((item) => (
          <View key={item.id} style={styles.billPhotoWrap}>
            {item.uri.startsWith('data:image/svg') ? (
              <View style={[styles.billPhoto, styles.heicPlaceholder]}>
                <Ionicons name="image-outline" size={36} color="#9ca3af" />
                <Text style={styles.heicText}>HEIC</Text>
              </View>
            ) : (
              <Image
                source={{ uri: item.uri }}
                style={[styles.billPhoto, item.uploading && styles.photoDim]}
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
              <TouchableOpacity style={styles.errorOverlay} onPress={() => retryBillUpload(item.id)}>
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{item.error} — tap to retry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => removeBillPhoto(item.id)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addBtnsRow}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={takeBillPhoto} style={styles.addPhotoBtn}>
              <Ionicons name="camera" size={26} color="#2563eb" />
              <Text style={styles.addPhotoBtnText}>Camera</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={pickBillImage} style={styles.addPhotoBtn}>
            <Ionicons name="images" size={26} color="#2563eb" />
            <Text style={styles.addPhotoBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {billDoneCount > 0 && (
          <TouchableOpacity
            onPress={handleScanBills}
            style={[styles.scanBtn, scanLoading && styles.scanBtnDisabled]}
            disabled={scanLoading}
          >
            {scanLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="scan" size={20} color="#fff" />
            }
            <Text style={styles.scanBtnText}>
              {scanLoading ? 'Scanning…' : `Scan ${billDoneCount} Bill${billDoneCount > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Energy Consumption Table ───────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Energy Consumption</Text>
        </View>

        <View style={styles.yearTabs}>
          {[2023, 2024, 2025].map(y => (
            <TouchableOpacity key={y} onPress={() => setActiveYear(y)} style={[styles.yearTab, activeYear === y && styles.activeYearTab]}>
              <Text style={[styles.yearTabText, activeYear === y && styles.activeYearTabText]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handlePaste} style={styles.pasteButton}>
          <Ionicons name="clipboard" size={16} color="#2563eb" />
          <Text style={styles.pasteButtonText}>Paste from Excel / Google Sheets</Text>
        </TouchableOpacity>
        <Text style={styles.pasteHint}>Copy a range of cells (up to 12 rows × 3 cols: Gas, Elec, Other) then tap above</Text>

        <View style={styles.headerRow}>
          <Text style={[styles.colHeader, { flex: 1.2 }]}>Month</Text>
          <Text style={styles.colHeader}>Gas m³</Text>
          <Text style={styles.colHeader}>Elec kWh</Text>
          <Text style={styles.colHeader}>Other</Text>
        </View>

        {MONTHS.map((month, i) => (
          <View key={month} style={[styles.monthRow, i % 2 === 0 && styles.monthRowAlt]}>
            <Text style={styles.monthLabel}>{month}</Text>
            <TextInput
              ref={(r) => { inputRefs.current[`${activeYear}_${i}_gas`] = r; }}
              style={styles.monthInput}
              value={current[i].gas}
              onChangeText={(v) => updateMonth(i, 'gas', v)}
              placeholder="0"
              keyboardType="decimal-pad"
              selectTextOnFocus
              returnKeyType="next"
              onSubmitEditing={() => navigateDown(i, 'gas')}
              {...(Platform.OS === 'web' ? { onKeyDown: (e: any) => { if (e.key === 'Tab') { e.preventDefault(); navigateDown(i, 'gas'); } } } : {})}
            />
            <TextInput
              ref={(r) => { inputRefs.current[`${activeYear}_${i}_elec`] = r; }}
              style={styles.monthInput}
              value={current[i].elec}
              onChangeText={(v) => updateMonth(i, 'elec', v)}
              placeholder="0"
              keyboardType="decimal-pad"
              selectTextOnFocus
              returnKeyType="next"
              onSubmitEditing={() => navigateDown(i, 'elec')}
              {...(Platform.OS === 'web' ? { onKeyDown: (e: any) => { if (e.key === 'Tab') { e.preventDefault(); navigateDown(i, 'elec'); } } } : {})}
            />
            <TextInput
              ref={(r) => { inputRefs.current[`${activeYear}_${i}_other`] = r; }}
              style={styles.monthInput}
              value={current[i].other}
              onChangeText={(v) => updateMonth(i, 'other', v)}
              placeholder="0"
              keyboardType="decimal-pad"
              selectTextOnFocus
              returnKeyType="next"
              onSubmitEditing={() => navigateDown(i, 'other')}
              {...(Platform.OS === 'web' ? { onKeyDown: (e: any) => { if (e.key === 'Tab') { e.preventDefault(); navigateDown(i, 'other'); } } } : {})}
            />
          </View>
        ))}

        <View style={styles.totalBox}>
          <Text style={styles.totalTitle}>{activeYear} Totals</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}><Text style={styles.totalLabel}>Gas</Text><Text style={styles.totalValue}>{totals.gas.toFixed(0)} m³</Text></View>
            <View style={styles.totalItem}><Text style={styles.totalLabel}>Electricity</Text><Text style={styles.totalValue}>{totals.elec.toFixed(0)} kWh</Text></View>
            <View style={styles.totalItem}><Text style={styles.totalLabel}>Other</Text><Text style={styles.totalValue}>{totals.other.toFixed(0)}</Text></View>
          </View>
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1 },

  // Bill photos
  photoBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  photoBadgeText: { fontSize: 12, color: '#1d4ed8', fontWeight: '700' },
  photoHint: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },
  uploadProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 12 },
  uploadProgressText: { fontSize: 13, color: '#1d4ed8' },
  billPhotoWrap: { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  billPhoto: { width: '100%', height: 260, borderRadius: 12 },
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
  addBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 10 },
  addPhotoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14 },
  addPhotoBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16 },
  scanBtnDisabled: { opacity: 0.6 },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Table
  yearTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  yearTab: { flex: 1, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' },
  activeYearTab: { backgroundColor: '#2563eb' },
  yearTabText: { fontSize: 14, color: '#374151' },
  activeYearTabText: { color: '#fff', fontWeight: '600' },
  pasteButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  pasteButtonText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  pasteHint: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },
  headerRow: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 4 },
  colHeader: { flex: 1, fontSize: 10, color: '#6b7280', textAlign: 'center', fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 6 },
  monthRowAlt: { backgroundColor: '#f9fafb' },
  monthLabel: { flex: 1.2, fontSize: 12, color: '#374151', fontWeight: '500' },
  monthInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6, fontSize: 12, textAlign: 'center' },
  totalBox: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, marginTop: 12 },
  totalTitle: { fontSize: 13, color: '#fff', marginBottom: 10, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalItem: { alignItems: 'center' },
  totalLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});
