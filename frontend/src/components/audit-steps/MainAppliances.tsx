import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
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

export default function MainAppliances({ data, updateData }: any) {
  const [appliances, setAppliances] = useState(
    data.appliances_list || [{ name: '', w: '', n: '1', hrs: '' }]
  );

  const calcPower = (a: any) => ((parseFloat(a.w)||0) * (parseFloat(a.n)||1) * (parseFloat(a.hrs)||0)) / 1000;

  const applyPreset = (index: number, presetName: string) => {
    if (!presetName) return;
    const preset = APPLIANCE_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    const newA = [...appliances];
    newA[index] = { ...newA[index], name: preset.name, w: preset.w, hrs: preset.hrs };
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

  const total = appliances.reduce((s: number, a: any) => s + calcPower(a), 0).toFixed(2);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={20} color="#eab308" />
          <Text style={styles.sectionTitle}>Main Appliances (apl1..10)</Text>
        </View>
        {appliances.map((a: any, index: number) => (
          <View key={index} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Appliance {index+1}</Text>
              {appliances.length > 1 && <TouchableOpacity onPress={() => deleteAppliance(index)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quick Select</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue=""
                  onValueChange={(v) => v && applyPreset(index, String(v))}
                >
                  <Picker.Item label="— Tanlash (watt va soat avtomatik to'ladi) —" value="" />
                  {APPLIANCE_PRESETS.map(p => (
                    <Picker.Item key={p.name} label={`${p.name} (${p.w}W, ${p.hrs}h/day)`} value={p.name} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (apl{index+1}_name)</Text>
              <TextInput style={styles.input} value={a.name} onChangeText={(v) => update(index, 'name', v)} placeholder="e.g., Muzlatgich, Televizor, Konditsioner" />
            </View>
            <View style={styles.row}>
              <View style={styles.third}><Text style={styles.label}>Power W (apl{index+1}_w)</Text><TextInput style={styles.input} value={a.w} onChangeText={(v) => update(index, 'w', v)} placeholder="0" keyboardType="numeric" /></View>
              <View style={styles.third}><Text style={styles.label}>Count (apl{index+1}_n)</Text><TextInput style={styles.input} value={a.n} onChangeText={(v) => update(index, 'n', v)} placeholder="1" keyboardType="numeric" /></View>
              <View style={styles.third}><Text style={styles.label}>Hrs/day (apl{index+1}_hrs)</Text><TextInput style={styles.input} value={a.hrs} onChangeText={(v) => update(index, 'hrs', v)} placeholder="0" keyboardType="decimal-pad" /></View>
            </View>
            <View style={styles.resultBox}><Text style={styles.resultLabel}>Daily: {calcPower(a).toFixed(2)} kWh</Text></View>
          </View>
        ))}
        {appliances.length < 10 && (
          <TouchableOpacity onPress={addAppliance} style={styles.addBtn}>
            <Ionicons name="add-circle" size={20} color="#2563eb" /><Text style={styles.addBtnText}>Add Appliance (max 10)</Text>
          </TouchableOpacity>
        )}
        <View style={styles.totalBox}><Text style={styles.totalLabel}>Total Daily:</Text><Text style={styles.totalValue}>{total} kWh</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  inputGroup: { marginBottom: 10 },
  label: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  pickerContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  third: { flex: 1 },
  resultBox: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  resultLabel: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  addBtnText: { fontSize: 14, color: '#374151' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  totalLabel: { fontSize: 14, color: '#fff' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
});
