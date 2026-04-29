import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

export default function SystemsEquipment({ data, updateData }: any) {
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
      descOptions: [
        ['Gaz qozoni (Gas Boiler)', 'Gaz qozoni'],
        ['Elektr qozon (Electric Boiler)', 'Elektr qozon'],
        ['Markaziy isitish (Central Heating)', 'Markaziy isitish'],
        ["Individual radiatorlar", "Individual radiatorlar"],
        ["Pol isitish (Floor Heating)", "Pol isitish"],
        ["Yo'q (None)", "Yo'q"],
      ],
    },
    {
      icon: 'water', color: '#2563eb', title: 'Hot Water System',
      desc: 'hotw_desc', note: 'hotw_note',
      descOptions: [
        ['Gaz suv isitgich', 'Gaz suv isitgich'],
        ['Elektr boiler (Ariston)', 'Elektr boiler (Ariston)'],
        ['Quyosh suv isitgich (Gelio)', 'Quyosh suv isitgich (Gelio)'],
        ['Markaziy ta\'minot', "Markaziy ta'minot"],
        ["Kombinatsiyalangan", "Kombinatsiyalangan"],
        ["Yo'q", "Yo'q"],
      ],
    },
    {
      icon: 'snow', color: '#06b6d4', title: 'Cooling System',
      desc: 'cool_desc', note: 'cool_note',
      descOptions: [
        ['Split konditsioner', 'Split konditsioner'],
        ['Markaziy konditsioner', 'Markaziy konditsioner'],
        ['Ventilyator', 'Ventilyator'],
        ["Yo'q", "Yo'q"],
      ],
    },
    {
      icon: 'bulb', color: '#eab308', title: 'Lighting',
      desc: 'light_desc', note: 'light_note',
      descOptions: [
        ['LED', 'LED'],
        ['Lyuminestent (CFL)', 'Lyuminestent (CFL)'],
        ['Aralash (Mixed)', 'Aralash'],
        ['Oddiy (Incandescent)', 'Oddiy'],
      ],
    },
    {
      icon: 'git-branch', color: '#a855f7', title: 'Ventilation',
      desc: 'vent_desc', note: 'vent_note',
      descOptions: [
        ['Tabiiy (Natural)', 'Tabiiy'],
        ['Mexanik (Mechanical)', 'Mexanik'],
        ['HVAC', 'HVAC'],
        ['Chiqarish ventilyatori', 'Chiqarish ventilyatori'],
        ["Yo'q", "Yo'q"],
      ],
    },
    {
      icon: 'water-outline', color: '#0891b2', title: 'Water Supply',
      desc: 'water_desc', note: 'water_note',
      descOptions: [
        ['Markaziy suv ta\'minoti', "Markaziy suv ta'minoti"],
        ['Quduq (Well)', 'Quduq'],
        ['Aralash', 'Aralash'],
      ],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {systems.map(({ icon, color, title, desc, note, descOptions }) => (
        <View key={desc} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name={icon as any} size={20} color={color} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type ({desc})</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={(formData as any)[desc]} onValueChange={(v) => handleChange(desc, v)}>
                <Picker.Item label="Select" value="" />
                {descOptions.map(([label, value]) => (
                  <Picker.Item key={value} label={label} value={value} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Note ({note})</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={(formData as any)[note]}
              onChangeText={(v) => handleChange(note, v)}
              placeholder="Additional notes..."
              multiline
              numberOfLines={2}
            />
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={20} color="#eab308" />
          <Text style={styles.sectionTitle}>Extra Details</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lighting Power kW (light_kw)</Text>
          <TextInput style={styles.input} value={formData.light_kw} onChangeText={(v) => handleChange('light_kw', v)} placeholder="0.0" keyboardType="decimal-pad" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cooling Power kW (cool_kw)</Text>
          <TextInput style={styles.input} value={formData.cool_kw} onChangeText={(v) => handleChange('cool_kw', v)} placeholder="0.0" keyboardType="decimal-pad" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Appliances Description (appl_desc)</Text>
          <TextInput style={[styles.input, styles.multiline]} value={formData.appl_desc} onChangeText={(v) => handleChange('appl_desc', v)} placeholder="Main appliances..." multiline numberOfLines={2} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Appliances Note (appl_note)</Text>
          <TextInput style={[styles.input, styles.multiline]} value={formData.appl_note} onChangeText={(v) => handleChange('appl_note', v)} placeholder="Notes..." multiline numberOfLines={2} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Electricity Usage Reason (electric_reason)</Text>
          <TextInput style={[styles.input, styles.multiline]} value={formData.electric_reason} onChangeText={(v) => handleChange('electric_reason', v)} placeholder="Main reason for electricity use..." multiline numberOfLines={2} />
        </View>
      </View>
    </ScrollView>
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
  pickerContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
});
