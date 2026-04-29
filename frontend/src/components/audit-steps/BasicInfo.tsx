import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import DatePickerField, { toDDMMYYYY } from '../DatePickerField';

function normaliseDate(value: string): string {
  if (!value) return toDDMMYYYY(new Date());
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return value;
  const ym = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ym) return `${ym[3]}.${ym[2]}.${ym[1]}`;
  return value;
}

function parseCaseNo(editCase: string): string {
  const m = editCase?.match(/^EA-([^_]+)/);
  return m ? m[1] : '';
}

// District / city options keyed by region value
const REGION_CITIES: Record<string, string[]> = {
  'Toshkent shahri': [
    'Yunusobod tumani', 'Yakkasaroy tumani', 'Mirobod tumani', 'Shayxontohur tumani',
    'Olmazor tumani', 'Chilonzor tumani', 'Sergeli tumani', 'Uchtepa tumani',
    'Yashnobod tumani', 'Bektemir tumani',
  ],
  'Toshkent viloyati': [
    'Toshkent tumani', 'Bekobod', "Bo'ka", 'Chinoz', 'Qibray', 'Ohangaron',
    "Oqqo'rg'on", 'Zangiota', 'Yuqorichirchiq', 'Quyi Chirchiq', "O'rta Chirchiq",
    "Bo'stonliq", 'Parkent', 'Piskent', "Uyg'ur", 'Angren', 'Chirchiq', 'Olmaliq',
  ],
  'Andijon viloyati': [
    'Andijon shahri', 'Asaka', 'Baliqchi', "Bo'ston", 'Buloqboshi', "Xo'jaobod",
    'Izboskan', 'Jalaquduq', 'Marhamat', "Oltinko'l", 'Paxtaobod', "Qo'rg'ontepa",
    'Shahrixon', "Ulug'nor",
  ],
  "Farg'ona viloyati": [
    "Farg'ona shahri", 'Beshariqi', "Bog'dod", "Dang'ara", 'Furqat', 'Hamza',
    "Ko'shtepa", "Marg'ilon", "O'zbekiston tumani", "Qo'qon", 'Quva', 'Rishton',
    "So'x", 'Toshloq', "Uchko'prik", 'Yozyovon',
  ],
  'Namangan viloyati': [
    'Namangan shahri', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Narbuta',
    'Norin', 'Pop', "To'raqo'rg'on", 'Uychi', "Yangiqo'rg'on",
  ],
  'Samarqand viloyati': [
    'Samarqand shahri', "Bulung'ur", 'Ishtixon', 'Jomboy', "Kattaqo'rg'on",
    'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq', "Qo'shrabot", 'Urgut',
  ],
  'Buxoro viloyati': [
    'Buxoro shahri', "G'ijduvon", 'Jondor', 'Kogon', 'Olot', 'Peshku',
    "Qorako'l", 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent',
  ],
  'Xorazm viloyati': [
    'Urganch shahri', "Bog'ot", 'Gurlan', 'Hazorasp', 'Xiva', "Qo'shko'pir",
    'Shovot', "Tuproqqal'a", 'Urganch tumani', 'Yangibozor', 'Yangiariq',
  ],
  'Qashqadaryo viloyati': [
    'Qarshi shahri', 'Chiroqchi', 'Dehqonobod', "G'uzor", 'Kasbi', 'Kitob',
    "Ko'kdala", 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Shahrisabz', "Yakkabog'",
  ],
  'Surxondaryo viloyati': [
    'Termiz shahri', 'Angor', 'Bandixon', 'Boysun', 'Denov', "Jarqo'rg'on",
    'Muzrabot', 'Oltinsoy', 'Qiziriq', "Qumqo'rg'on", 'Sariosiyo', 'Sherobod',
    "Sho'rchi", 'Uzun',
  ],
  'Navoiy viloyati': [
    'Navoiy shahri', 'Karmana', 'Konimex', 'Navbahor', 'Nurota', 'Qiziltepa',
    'Tomdi', 'Uchquduq', 'Xatirchi', 'Zarafshon',
  ],
  'Jizzax viloyati': [
    'Jizzax shahri', 'Arnasoy', 'Baxmal', "Do'stlik", 'Forish', "G'allaorol",
    "Mirzacho'l", 'Paxtakor', 'Yangiobod', 'Zarbdor', 'Zomin',
  ],
  'Sirdaryo viloyati': [
    'Guliston shahri', 'Boyovut', 'Mirzaobod', 'Oqoltin', 'Sardoba',
    'Sayxunobod', 'Shirin', 'Xovos',
  ],
  "Qoraqalpog'iston": [
    'Nukus shahri', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikkala', 'Kegeyli',
    "Mo'ynoq", 'Nukus tumani', "Qanliko'l", "Qo'ng'irot", 'Shumanay',
    "Taxtako'pir", "To'rtko'l", "Xo'jayli",
  ],
};

const RESIDENTS = Array.from({ length: 60 }, (_, i) => String(i + 1));

export default function BasicInfo({ data, updateData }: any) {
  const [formData, setFormData] = useState({
    case_number: data.case_number || parseCaseNo(data.edit_case || ''),
    aud_date: normaliseDate(data.aud_date),
    insp_date: normaliseDate(data.insp_date),
    region: data.region || '',
    city: data.city || '',
    mfy: data.mfy || '',
    street: data.street || '',
    house: data.house || '',
    lat: data.lat || '',
    lon: data.lon || '',
    owner: data.owner || '',
    owner_surname: data.owner_surname || '',
    residents: data.residents || '',
    elec_account: data.elec_account || '',
    gas_account: data.gas_account || '',
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    if (field === 'owner') {
      newData.owner_surname = value.split(' ')[0].toUpperCase();
    }
    if (field === 'region') {
      newData.city = '';
    }
    setFormData(newData);
    updateData(newData);
  };

  const cityOptions = formData.region ? (REGION_CITIES[formData.region] || []) : [];

  return (
    <ScrollView style={styles.container}>
      {/* ── Audit Information ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Audit Information</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Case Number (case_number)</Text>
          <TextInput
            style={styles.input}
            value={formData.case_number}
            onChangeText={(v) => handleChange('case_number', v)}
            placeholder="e.g., 2600001"
          />
        </View>
        <DatePickerField
          label="Audit Date"
          value={formData.aud_date}
          onChange={(v) => handleChange('aud_date', v)}
        />
        <DatePickerField
          label="Inspection Date"
          value={formData.insp_date}
          onChange={(v) => handleChange('insp_date', v)}
        />
      </View>

      {/* ── Location ────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Location</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Region (region)</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={formData.region} onValueChange={(v) => handleChange('region', v)}>
              <Picker.Item label="Select Region" value="" />
              <Picker.Item label="Toshkent shahri" value="Toshkent shahri" />
              <Picker.Item label="Toshkent viloyati" value="Toshkent viloyati" />
              <Picker.Item label="Andijon viloyati" value="Andijon viloyati" />
              <Picker.Item label="Samarqand viloyati" value="Samarqand viloyati" />
              <Picker.Item label="Buxoro viloyati" value="Buxoro viloyati" />
              <Picker.Item label="Farg'ona viloyati" value="Farg'ona viloyati" />
              <Picker.Item label="Namangan viloyati" value="Namangan viloyati" />
              <Picker.Item label="Qashqadaryo viloyati" value="Qashqadaryo viloyati" />
              <Picker.Item label="Surxondaryo viloyati" value="Surxondaryo viloyati" />
              <Picker.Item label="Xorazm viloyati" value="Xorazm viloyati" />
              <Picker.Item label="Navoiy viloyati" value="Navoiy viloyati" />
              <Picker.Item label="Jizzax viloyati" value="Jizzax viloyati" />
              <Picker.Item label="Sirdaryo viloyati" value="Sirdaryo viloyati" />
              <Picker.Item label="Qoraqalpog'iston" value="Qoraqalpog'iston" />
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>City / District (city)</Text>
          {cityOptions.length > 0 ? (
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.city} onValueChange={(v) => handleChange('city', v)}>
                <Picker.Item label="Select City / District" value="" />
                {cityOptions.map(c => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
            </View>
          ) : (
            <TextInput
              style={[styles.input, !formData.region && styles.inputDisabled]}
              value={formData.city}
              onChangeText={(v) => handleChange('city', v)}
              placeholder={formData.region ? 'City / District' : 'Select a region first'}
              editable={Boolean(formData.region)}
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>MFY / Neighborhood (mfy) — optional</Text>
          <TextInput
            style={styles.input}
            value={formData.mfy}
            onChangeText={(v) => handleChange('mfy', v)}
            placeholder="e.g., Chilonzor"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Street (street)</Text>
          <TextInput
            style={styles.input}
            value={formData.street}
            onChangeText={(v) => handleChange('street', v)}
            placeholder="Street name"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>House No (house)</Text>
          <TextInput
            style={styles.input}
            value={formData.house}
            onChangeText={(v) => handleChange('house', v)}
            placeholder="e.g., 12"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Latitude (lat)</Text>
            <TextInput style={styles.input} value={formData.lat} onChangeText={(v) => handleChange('lat', v)} placeholder="41.2995" keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Longitude (lon)</Text>
            <TextInput style={styles.input} value={formData.lon} onChangeText={(v) => handleChange('lon', v)} placeholder="69.2401" keyboardType="decimal-pad" />
          </View>
        </View>
      </View>

      {/* ── Owner Information ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Owner Information</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Owner Full Name (owner)</Text>
          <TextInput
            style={styles.input}
            value={formData.owner}
            onChangeText={(v) => handleChange('owner', v)}
            placeholder="e.g., Karimov Akmal Shavkatovich"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Residents (residents)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.residents}
              onValueChange={(v) => handleChange('residents', String(v))}
            >
              <Picker.Item label="Select" value="" />
              {RESIDENTS.map(n => <Picker.Item key={n} label={n} value={n} />)}
            </Picker>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Electricity Account (elec_account)</Text>
          <TextInput style={styles.input} value={formData.elec_account} onChangeText={(v) => handleChange('elec_account', v)} placeholder="Account number" keyboardType="numeric" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gas Account (gas_account)</Text>
          <TextInput style={styles.input} value={formData.gas_account} onChangeText={(v) => handleChange('gas_account', v)} placeholder="Account number" keyboardType="numeric" />
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
  inputDisabled: { opacity: 0.5 },
  pickerContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, marginBottom: 16 },
});
