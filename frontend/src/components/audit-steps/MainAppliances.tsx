import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const APPLIANCE_PRESETS = [
  { name: "Muzlatgich",          w: '150',  hrs: '24'  },
  { name: "Kir yuvish mashinasi", w: '2000', hrs: '1'   },
  { name: "Televizor",           w: '150',  hrs: '5'   },
  { name: "Konditsioner",        w: '1500', hrs: '8'   },
  { name: "Mikroto'lqin pech",   w: '1200', hrs: '0.5' },
  { name: "Elektr choynak",      w: '2000', hrs: '0.5' },
  { name: "Suv isitgich",        w: '2000', hrs: '2'   },
  { name: "Dazmol",              w: '2000', hrs: '0.5' },
  { name: "Changyutgich",        w: '1500', hrs: '0.5' },
  { name: "Chiroqlar",           w: '100',  hrs: '8'   },
];

export default function MainAppliances({ data, updateData, embedded }: any) {
  const [appliances, setAppliances] = useState(
    data.appliances_list || [{ name: '', w: '', n: '1', hrs: '' }]
  );

  const calcPower = (a: any) => ((parseFloat(a.w)||0) * (parseFloat(a.n)||1) * (parseFloat(a.hrs)||0)) / 1000;

  const addFromPreset = (preset: typeof APPLIANCE_PRESETS[0]) => {
    if (appliances.length >= 10) return;
    const newA = [...appliances, { name: preset.name, w: preset.w, n: '1', hrs: preset.hrs }];
    setAppliances(newA);
    const out: any = { appliances_list: newA };
    newA.forEach((a: any, i: number) => {
      out[`apl${i+1}_name`] = a.name;
      out[`apl${i+1}_w`] = a.w;
      out[`apl${i+1}_n`] = a.n;
      out[`apl${i+1}_hrs`] = a.hrs;
    });
    updateData(out);
  };

  const update = (index: number, field: string, value: string) => {
    const newA = [...appliances];
    newA[index] = { ...newA[index], [field]: value };
    setAppliances(newA);
    const out: any = { appliances_list: newA };
    newA.forEach((a: any, i: number) => {
      out[`apl${i+1}_name`] = a.name;
      out[`apl${i+1}_w`] = a.w;
      out[`apl${i+1}_n`] = a.n;
      out[`apl${i+1}_hrs`] = a.hrs;
    });
    updateData(out);
  };

  const addAppliance = () => {
    if (appliances.length >= 10) return;
    const newA = [...appliances, { name: '', w: '', n: '1', hrs: '' }];
    setAppliances(newA);
    const out: any = { appliances_list: newA };
    newA.forEach((a: any, i: number) => {
      out[`apl${i+1}_name`] = a.name;
      out[`apl${i+1}_w`] = a.w;
      out[`apl${i+1}_n`] = a.n;
      out[`apl${i+1}_hrs`] = a.hrs;
    });
    updateData(out);
  };

  const deleteAppliance = (index: number) => {
    if (appliances.length <= 1) return;
    const newA = appliances.filter((_: any, i: number) => i !== index);
    setAppliances(newA);
    const out: any = { appliances_list: newA };
    newA.forEach((a: any, i: number) => {
      out[`apl${i+1}_name`] = a.name;
      out[`apl${i+1}_w`] = a.w;
      out[`apl${i+1}_n`] = a.n;
      out[`apl${i+1}_hrs`] = a.hrs;
    });
    updateData(out);
  };

  const totalKwh = appliances.reduce((s: number, a: any) => s + calcPower(a), 0);
  const maxKwh = Math.max(...appliances.map((a: any) => calcPower(a)), 0.001);
  const atMax = appliances.length >= 10;

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>

      {/* Preset chips */}
      <View style={styles.presetsSection}>
        <Text style={styles.presetsLabel}>Quick add</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {APPLIANCE_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.name}
              onPress={() => addFromPreset(preset)}
              disabled={atMax}
              style={[styles.chip, atMax && styles.chipDisabled]}
            >
              <Text style={[styles.chipText, atMax && styles.chipTextDisabled]}>{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Appliance rows */}
      <View style={styles.section}>
        {appliances.map((a: any, index: number) => {
          const kwh = calcPower(a);
          const barPct = totalKwh > 0 ? kwh / totalKwh : 0;
          return (
            <View key={index} style={styles.rowCard}>
              {/* Main input row */}
              <View style={styles.inputRow}>
                {/* Index circle */}
                <View style={styles.indexCircle}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>

                {/* Name */}
                <View style={{ flex: 2, marginRight: 6 }}>
                  <Text style={styles.colLabel}>&nbsp;</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={a.name}
                    onChangeText={(v) => update(index, 'name', v)}
                    placeholder="Nomi"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {/* W */}
                <View style={{ flex: 1, marginRight: 4 }}>
                  <Text style={styles.colLabel}>W</Text>
                  <TextInput
                    style={styles.cellInput}
                    value={a.w}
                    onChangeText={(v) => update(index, 'w', v)}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {/* n */}
                <View style={{ flex: 0.6, marginRight: 4 }}>
                  <Text style={styles.colLabel}>n</Text>
                  <TextInput
                    style={styles.cellInput}
                    value={a.n}
                    onChangeText={(v) => update(index, 'n', v)}
                    placeholder="1"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {/* h/d */}
                <View style={{ flex: 0.8, marginRight: 4 }}>
                  <Text style={styles.colLabel}>h/d</Text>
                  <TextInput
                    style={styles.cellInput}
                    value={a.hrs}
                    onChangeText={(v) => update(index, 'hrs', v)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {/* kWh/d result */}
                <View style={{ flex: 0.9, marginRight: 4 }}>
                  <Text style={styles.colLabel}>kWh/d</Text>
                  <Text style={styles.kwhValue}>{kwh.toFixed(2)}</Text>
                </View>

                {/* Trash */}
                {appliances.length > 1 ? (
                  <TouchableOpacity onPress={() => deleteAppliance(index)} style={styles.trashBtn}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.trashBtn} />
                )}
              </View>

              {/* Progress bar */}
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round(barPct * 100)}%` }]} />
              </View>
            </View>
          );
        })}

        {/* Add button */}
        <TouchableOpacity
          onPress={addAppliance}
          disabled={atMax}
          style={[styles.addBtn, atMax && styles.addBtnDisabled]}
        >
          <Ionicons name="add-circle" size={20} color={atMax ? '#9ca3af' : '#2563eb'} />
          <Text style={[styles.addBtnText, atMax && styles.addBtnTextDisabled]}>
            {atMax ? 'Max 10 reached' : 'Add appliance'}
          </Text>
        </TouchableOpacity>

        {/* Total bar */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total Daily:</Text>
          <Text style={styles.totalValue}>{totalKwh.toFixed(2)} kWh</Text>
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Presets
  presetsSection: { marginBottom: 12 },
  presetsLabel: { fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2563eb', backgroundColor: '#fff' },
  chipDisabled: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  chipText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  chipTextDisabled: { color: '#9ca3af' },

  // Section / rows
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  rowCard: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },

  indexCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 6, marginTop: 14 },
  indexText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  colLabel: { fontSize: 10, color: '#6b7280', marginBottom: 3, textAlign: 'center' },

  nameInput: { borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingVertical: 5, paddingHorizontal: 2, fontSize: 13, color: '#111827' },
  cellInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 5, fontSize: 12, textAlign: 'center' },

  kwhValue: { fontSize: 13, color: '#2563eb', fontWeight: '700', textAlign: 'center', paddingVertical: 5 },

  trashBtn: { width: 28, alignItems: 'center', justifyContent: 'center', marginTop: 14 },

  barTrack: { height: 3, backgroundColor: '#e5e7eb', borderRadius: 2, marginTop: 6 },
  barFill: { height: 3, backgroundColor: '#2563eb', borderRadius: 2 },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 14, color: '#374151' },
  addBtnTextDisabled: { color: '#9ca3af' },

  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12 },
  totalLabel: { fontSize: 14, color: '#fff', fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
});
