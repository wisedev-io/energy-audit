import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import HistoryTextInput from '../HistoryTextInput';

const YEAR = new Date().getFullYear();

const FLOORS   = Array.from({ length: 25 }, (_, i) => String(i + 1));
const ROOMS    = Array.from({ length: 20 }, (_, i) => String(i + 1));
const SECTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));
// Descending so most recent years appear first
const YR_BUILT = Array.from({ length: YEAR - 1919 }, (_, i) => String(YEAR - i));
const YR_RENOV = ["Yo'q", ...Array.from({ length: YEAR - 1949 }, (_, i) => String(YEAR - i))];
const WALL_THICK = ['12', '15', '20', '25', '30', '38', '40', '45', '50', '60', '80'];

export default function BuildingInfo({ data, updateData, embedded }: any) {
  const [formData, setFormData] = useState({
    floors: data.floors || '',
    rooms: data.rooms || '',
    sections: data.sections || '',
    area_total: data.area_total || '',
    heat_area: data.heat_area || '',
    yr_built: data.yr_built || '',
    yr_renov: data.yr_renov || '',
    wall_mat: data.wall_mat || '',
    wall_thick: data.wall_thick || '',
    wall_insul: data.wall_insul || '',
    roof_mat: data.roof_mat || '',
    floor_mat: data.floor_mat || '',
    floor_insul: data.floor_insul || '',
    basement_mat: data.basement_mat || '',
    basement_area: data.basement_area || '',
    win_mat: data.win_mat || '',
    win_layers: data.win_layers || '',
    door_mat: data.door_mat || '',
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateData(newData);
  };

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      {/* ── Building Structure ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="business" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Building Structure</Text>
        </View>

        {/* Floors / Rooms / Sections */}
        <View style={styles.row}>
          <View style={styles.third}>
            <Text style={styles.label}>Floors</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.floors} onValueChange={(v) => handleChange('floors', String(v))}>
                <Picker.Item label="—" value="" />
                {FLOORS.map(v => <Picker.Item key={v} label={v} value={v} />)}
              </Picker>
            </View>
          </View>
          <View style={styles.third}>
            <Text style={styles.label}>Rooms</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.rooms} onValueChange={(v) => handleChange('rooms', String(v))}>
                <Picker.Item label="—" value="" />
                {ROOMS.map(v => <Picker.Item key={v} label={v} value={v} />)}
              </Picker>
            </View>
          </View>
          <View style={styles.third}>
            <Text style={styles.label}>Sections</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.sections} onValueChange={(v) => handleChange('sections', String(v))}>
                <Picker.Item label="—" value="" />
                {SECTIONS.map(v => <Picker.Item key={v} label={v} value={v} />)}
              </Picker>
            </View>
          </View>
        </View>

        {/* Areas */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Total Area m²</Text>
            <TextInput style={styles.input} value={formData.area_total} onChangeText={(v) => handleChange('area_total', v)} placeholder="0.0" keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Heated Area m²</Text>
            <TextInput style={styles.input} value={formData.heat_area} onChangeText={(v) => handleChange('heat_area', v)} placeholder="0.0" keyboardType="decimal-pad" />
          </View>
        </View>

        {/* Year Built / Renovated */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Year Built</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.yr_built} onValueChange={(v) => handleChange('yr_built', String(v))}>
                <Picker.Item label="Select year" value="" />
                {YR_BUILT.map(v => <Picker.Item key={v} label={v} value={v} />)}
              </Picker>
            </View>
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Year Renovated</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.yr_renov} onValueChange={(v) => handleChange('yr_renov', String(v))}>
                <Picker.Item label="Select year" value="" />
                {YR_RENOV.map(v => <Picker.Item key={v} label={v} value={v} />)}
              </Picker>
            </View>
          </View>
        </View>
      </View>

      {/* ── Wall & Roof Materials ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="layers" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Wall & Roof Materials</Text>
        </View>

        <HistoryTextInput
          fieldKey="wall_mat"
          label="Wall Material"
          value={formData.wall_mat}
          onChangeText={(v) => handleChange('wall_mat', v)}
          placeholder="e.g., G'isht, Beton, Gazobeton…"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wall Thickness cm</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={formData.wall_thick} onValueChange={(v) => handleChange('wall_thick', String(v))}>
              <Picker.Item label="Select thickness" value="" />
              {WALL_THICK.map(v => <Picker.Item key={v} label={`${v} cm`} value={v} />)}
            </Picker>
          </View>
        </View>

        <HistoryTextInput
          fieldKey="wall_insul"
          label="Wall Insulation"
          value={formData.wall_insul}
          onChangeText={(v) => handleChange('wall_insul', v)}
          placeholder="e.g., Yo'q, Mineral jun, Penoplast…"
        />
        <HistoryTextInput
          fieldKey="roof_mat"
          label="Roof Material"
          value={formData.roof_mat}
          onChangeText={(v) => handleChange('roof_mat', v)}
          placeholder="e.g., Tekis tom, Shifer, Metall profil…"
        />
        <HistoryTextInput
          fieldKey="floor_mat"
          label="Floor Material"
          value={formData.floor_mat}
          onChangeText={(v) => handleChange('floor_mat', v)}
          placeholder="e.g., Beton, Yog'och, Keramika…"
        />
        <HistoryTextInput
          fieldKey="floor_insul"
          label="Floor Insulation"
          value={formData.floor_insul}
          onChangeText={(v) => handleChange('floor_insul', v)}
          placeholder="e.g., Yo'q, Penoplast, Mineral jun…"
        />
        <HistoryTextInput
          fieldKey="basement_mat"
          label="Basement Material"
          value={formData.basement_mat}
          onChangeText={(v) => handleChange('basement_mat', v)}
          placeholder="e.g., Yo'q"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Basement Area m²</Text>
          <TextInput style={styles.input} value={formData.basement_area} onChangeText={(v) => handleChange('basement_area', v)} placeholder="—" keyboardType="decimal-pad" />
        </View>
      </View>

      {/* ── Windows & Doors ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="expand" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Windows & Doors</Text>
        </View>
        <HistoryTextInput
          fieldKey="win_mat"
          label="Window Material"
          value={formData.win_mat}
          onChangeText={(v) => handleChange('win_mat', v)}
          placeholder="e.g., Plastik (PVC), Alyuminiy, Yog'och…"
        />
        <HistoryTextInput
          fieldKey="win_layers"
          label="Window Glazing Layers"
          value={formData.win_layers}
          onChangeText={(v) => handleChange('win_layers', v)}
          placeholder="e.g., 1, 2, 3"
        />
        <HistoryTextInput
          fieldKey="door_mat"
          label="Door Material"
          value={formData.door_mat}
          onChangeText={(v) => handleChange('door_mat', v)}
          placeholder="e.g., Metall, Yog'och, Plastik…"
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
  pickerContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  half: { flex: 1 },
  third: { flex: 1 },
});
