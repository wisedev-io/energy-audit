import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

export default function BoilerSolar({ data, updateData, embedded }: any) {
  const [formData, setFormData] = useState({
    ariston_count: data.ariston_count || '1',
    ariston_kW: data.ariston_kW || '2',
    fes_kw: data.fes_kw || '10',
    grid: data.grid || 'on-grid',
    gelio_l: data.gelio_l || '200',
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateData(newData);
  };

  const aristonKw = parseFloat(formData.ariston_kW) || 2;
  const aristonCnt = parseFloat(formData.ariston_count) || 1;
  const aristonDay = aristonKw * aristonCnt * 3;
  const aristonMonth = aristonDay * 30;
  const aristonYear = aristonDay * 365;

  const fesKw = parseFloat(formData.fes_kw) || 10;
  const fesKwh = fesKw * 1460;
  const fesMln = parseFloat((fesKw * 2.5).toFixed(1));
  const fesSom = fesKwh * 1200;
  const fesPayb = (fesMln * 1e6 / fesSom).toFixed(1);

  const gelioL = parseInt(formData.gelio_l) || 200;
  const gelioConfigs: Record<number, any> = {
    100: { inv: 4.5, kwh: 1800, som: 2160000 },
    150: { inv: 5.8, kwh: 2400, som: 2880000 },
    200: { inv: 7.2, kwh: 3000, som: 3600000 },
    300: { inv: 9.5, kwh: 4200, som: 5040000 },
  };
  const gelio = gelioConfigs[gelioL] || gelioConfigs[200];

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="water" size={20} color="#2563eb" /><Text style={styles.sectionTitle}>Ariston (Electric Boiler)</Text></View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Count (ariston_count)</Text>
            <TextInput style={styles.input} value={formData.ariston_count} onChangeText={(v) => handleChange('ariston_count', v)} placeholder="1" keyboardType="numeric" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Power kW (ariston_kW)</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.ariston_kW} onValueChange={(v) => handleChange('ariston_kW', v)}>
                <Picker.Item label="1.5 kW" value="1.5" />
                <Picker.Item label="2.0 kW" value="2" />
                <Picker.Item label="2.5 kW" value="2.5" />
                <Picker.Item label="3.0 kW" value="3" />
              </Picker>
            </View>
          </View>
        </View>
        <View style={[styles.resultBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Daily:</Text><Text style={styles.resultValue}>{aristonDay.toFixed(2)} kWh</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Monthly:</Text><Text style={styles.resultValue}>{aristonMonth.toFixed(2)} kWh</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Yearly:</Text><Text style={styles.resultValue}>{aristonYear.toFixed(2)} kWh</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="sunny" size={20} color="#eab308" /><Text style={styles.sectionTitle}>FES Solar System</Text></View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Capacity kW (fes_kw)</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={formData.fes_kw} onValueChange={(v) => handleChange('fes_kw', v)}>
              {['5','10','15','20','25','30'].map(v => <Picker.Item key={v} label={`${v} kW`} value={v} />)}
            </Picker>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Grid Type (grid)</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={formData.grid} onValueChange={(v) => handleChange('grid', v)}>
              <Picker.Item label="On-Grid" value="on-grid" />
              <Picker.Item label="Off-Grid" value="off-grid" />
              <Picker.Item label="Hybrid" value="hybrid" />
            </Picker>
          </View>
        </View>
        <View style={[styles.resultBox, { backgroundColor: '#fef9c3', borderColor: '#fbbf24' }]}>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Annual Production:</Text><Text style={styles.resultValue}>{fesKwh.toLocaleString()} kWh</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Investment:</Text><Text style={styles.resultValue}>{fesMln} mln so'm</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Annual Savings:</Text><Text style={styles.resultValue}>{(fesSom/1e6).toFixed(2)} mln so'm</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Payback:</Text><Text style={styles.resultValue}>{fesPayb} years</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sunny" size={20} color="#ea580c" />
          <Ionicons name="water" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Gelio (Solar Hot Water)</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tank Size Liters (gelio_l)</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={formData.gelio_l} onValueChange={(v) => handleChange('gelio_l', v)}>
              <Picker.Item label="100 L" value="100" />
              <Picker.Item label="150 L" value="150" />
              <Picker.Item label="200 L" value="200" />
              <Picker.Item label="300 L" value="300" />
            </Picker>
          </View>
        </View>
        <View style={[styles.resultBox, { backgroundColor: '#d1fae5', borderColor: '#86efac' }]}>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Investment:</Text><Text style={styles.resultValue}>{gelio.inv} mln so'm</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Annual kWh Savings:</Text><Text style={styles.resultValue}>{gelio.kwh.toLocaleString()} kWh</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Annual Money Savings:</Text><Text style={styles.resultValue}>{(gelio.som/1e6).toFixed(2)} mln so'm</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Payback:</Text><Text style={styles.resultValue}>{(gelio.inv*1e6/gelio.som).toFixed(1)} years</Text></View>
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  pickerContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  half: { flex: 1 },
  resultBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resultLabel: { fontSize: 13, color: '#6b7280' },
  resultValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
});
