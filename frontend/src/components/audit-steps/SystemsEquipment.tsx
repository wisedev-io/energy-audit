import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HistoryTextInput from '../HistoryTextInput';

export default function SystemsEquipment({ data, updateData, embedded }: any) {
  const [formData, setFormData] = useState({
    heat_desc: data.heat_desc || '',
    heat_note: data.heat_note || '',
    hotw_desc: data.hotw_desc || '',
    hotw_note: data.hotw_note || '',
    light_desc: data.light_desc || '',
    light_note: data.light_note || '',
    light_kw: data.light_kw || '',
    cool_desc: data.cool_desc || '',
    cool_note: data.cool_note || '',
    cool_kw: data.cool_kw || '',
    vent_desc: data.vent_desc || '',
    vent_note: data.vent_note || '',
    water_desc: data.water_desc || '',
    water_note: data.water_note || '',
    appl_desc: data.appl_desc || '',
    appl_note: data.appl_note || '',
    electric_reason: data.electric_reason || '',
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateData(newData);
  };

  const systems = [
    {
      icon: 'flame', color: '#ea580c', title: 'Heating System',
      desc: 'heat_desc', note: 'heat_note',
      descPlaceholder: "e.g., Gaz qozoni, Elektr qozon, Markaziy isitish…",
    },
    {
      icon: 'water', color: '#2563eb', title: 'Hot Water System',
      desc: 'hotw_desc', note: 'hotw_note',
      descPlaceholder: "e.g., Gaz suv isitgich, Elektr boiler, Gelio…",
    },
    {
      icon: 'snow', color: '#06b6d4', title: 'Cooling System',
      desc: 'cool_desc', note: 'cool_note',
      descPlaceholder: "e.g., Split konditsioner, Ventilyator, Yo'q…",
    },
    {
      icon: 'bulb', color: '#eab308', title: 'Lighting',
      desc: 'light_desc', note: 'light_note',
      descPlaceholder: "e.g., LED, Lyuminestent, Aralash…",
    },
    {
      icon: 'git-branch', color: '#a855f7', title: 'Ventilation',
      desc: 'vent_desc', note: 'vent_note',
      descPlaceholder: "e.g., Tabiiy, Mexanik, HVAC…",
    },
    {
      icon: 'water-outline', color: '#0891b2', title: 'Water Supply',
      desc: 'water_desc', note: 'water_note',
      descPlaceholder: "e.g., Markaziy suv ta'minoti, Quduq…",
    },
  ];

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      {systems.map(({ icon, color, title, desc, note, descPlaceholder }) => (
        <View key={desc} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name={icon as any} size={20} color={color} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <HistoryTextInput
            fieldKey={desc}
            label="Type"
            value={(formData as any)[desc]}
            onChangeText={(v) => handleChange(desc, v)}
            placeholder={descPlaceholder}
          />
          <HistoryTextInput
            fieldKey={note}
            label="Note"
            value={(formData as any)[note]}
            onChangeText={(v) => handleChange(note, v)}
            placeholder="Additional notes..."
            multiline
          />
        </View>
      ))}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={20} color="#eab308" />
          <Text style={styles.sectionTitle}>Extra Details</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lighting Power kW</Text>
          <TextInput style={styles.input} value={formData.light_kw} onChangeText={(v) => handleChange('light_kw', v)} placeholder="0.0" keyboardType="decimal-pad" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cooling Power kW</Text>
          <TextInput style={styles.input} value={formData.cool_kw} onChangeText={(v) => handleChange('cool_kw', v)} placeholder="0.0" keyboardType="decimal-pad" />
        </View>
        <HistoryTextInput
          fieldKey="appl_desc"
          label="Appliances Description"
          value={formData.appl_desc}
          onChangeText={(v) => handleChange('appl_desc', v)}
          placeholder="Main appliances..."
          multiline
        />
        <HistoryTextInput
          fieldKey="appl_note"
          label="Appliances Note"
          value={formData.appl_note}
          onChangeText={(v) => handleChange('appl_note', v)}
          placeholder="Notes..."
          multiline
        />
        <HistoryTextInput
          fieldKey="electric_reason"
          label="Electricity Usage Reason"
          value={formData.electric_reason}
          onChangeText={(v) => handleChange('electric_reason', v)}
          placeholder="Main reason for electricity use..."
          multiline
        />
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
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827' },
  multiline: { height: 80, textAlignVertical: 'top' },
});
