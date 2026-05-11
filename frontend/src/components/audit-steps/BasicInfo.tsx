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
    'Bektemir tumani', 'Chilonzor tumani', 'Mirobod tumani', 'Olmazor tumani',
    'Sergeli tumani', 'Shayxontohur tumani', 'Uchtepa tumani', 'Yakkasaroy tumani',
    'Yashnobod tumani', 'Yunusobod tumani',
  ],
  'Toshkent viloyati': [
    'Angren shahri', 'Bekobod shahri', 'Chirchiq shahri', 'Ohangaron shahri', 'Olmaliq shahri',
    "Bo'ka tumani", "Bo'stonliq tumani", 'Chinoz tumani', "Oqqo'rg'on tumani", 'Parkent tumani',
    'Piskent tumani', 'Qibray tumani', 'Toshkent tumani', "Uyg'ur tumani",
    'Yuqorichirchiq tumani', "O'rta Chirchiq tumani", 'Quyi Chirchiq tumani', 'Zangiota tumani',
  ],
  'Andijon viloyati': [
    'Andijon shahri', 'Asaka shahri',
    'Baliqchi tumani', "Bo'ston tumani", 'Buloqboshi tumani', "Xo'jaobod tumani",
    'Izboskan tumani', 'Jalaquduq tumani', 'Marhamat tumani', "Oltinko'l tumani",
    'Paxtaobod tumani', "Qo'rg'ontepa tumani", 'Shahrixon tumani', "Ulug'nor tumani",
  ],
  "Farg'ona viloyati": [
    "Farg'ona shahri", "Marg'ilon shahri", "Qo'qon shahri",
    'Beshariqi tumani', "Bog'dod tumani", "Dang'ara tumani", 'Furqat tumani', 'Hamza tumani',
    "Ko'shtepa tumani", 'Oltiariq tumani', "O'zbekiston tumani", 'Quva tumani', 'Rishton tumani',
    "So'x tumani", 'Toshloq tumani', "Uchko'prik tumani", 'Yozyovon tumani',
  ],
  'Namangan viloyati': [
    'Namangan shahri',
    'Chortoq tumani', 'Chust tumani', 'Kosonsoy tumani', 'Mingbuloq tumani',
    'Narbuta tumani', 'Norin tumani', 'Pop tumani', "To'raqo'rg'on tumani",
    'Uychi tumani', "Yangiqo'rg'on tumani",
  ],
  'Samarqand viloyati': [
    'Samarqand shahri', "Kattaqo'rg'on shahri",
    "Bulung'ur tumani", 'Ishtixon tumani', 'Jomboy tumani', "Kattaqo'rg'on tumani",
    'Narpay tumani', 'Nurobod tumani', 'Oqdaryo tumani', 'Paxtachi tumani',
    'Pastdarg\'om tumani', 'Payariq tumani', "Qo'shrabot tumani", 'Tayloq tumani', 'Urgut tumani',
  ],
  'Buxoro viloyati': [
    'Buxoro shahri', 'Kogon shahri',
    "G'ijduvon tumani", 'Jondor tumani', 'Kogon tumani', 'Olot tumani', 'Peshku tumani',
    "Qorako'l tumani", 'Qorovulbozor tumani', 'Romitan tumani', 'Shofirkon tumani', 'Vobkent tumani',
  ],
  'Xorazm viloyati': [
    'Urganch shahri', 'Xiva shahri',
    "Bog'ot tumani", 'Gurlan tumani', 'Hazorasp tumani', "Qo'shko'pir tumani",
    'Shovot tumani', "Tuproqqal'a tumani", 'Urganch tumani', 'Yangibozor tumani', 'Yangiariq tumani',
  ],
  'Qashqadaryo viloyati': [
    'Qarshi shahri', 'Shahrisabz shahri',
    'Chiroqchi tumani', 'Dehqonobod tumani', "G'uzor tumani", 'Kasbi tumani',
    'Kitob tumani', "Ko'kdala tumani", 'Mirishkor tumani', 'Muborak tumani',
    'Nishon tumani', 'Qamashi tumani', "Yakkabog' tumani",
  ],
  'Surxondaryo viloyati': [
    'Termiz shahri',
    'Angor tumani', 'Bandixon tumani', 'Boysun tumani', 'Denov tumani',
    "Jarqo'rg'on tumani", 'Muzrabot tumani', 'Oltinsoy tumani', 'Qiziriq tumani',
    "Qumqo'rg'on tumani", 'Sariosiyo tumani', 'Sherobod tumani', "Sho'rchi tumani", 'Uzun tumani',
  ],
  'Navoiy viloyati': [
    'Navoiy shahri', 'Zarafshon shahri',
    'Karmana tumani', 'Konimex tumani', 'Navbahor tumani', 'Nurota tumani',
    'Qiziltepa tumani', 'Tomdi tumani', 'Uchquduq tumani', 'Xatirchi tumani',
  ],
  'Jizzax viloyati': [
    'Jizzax shahri',
    'Arnasoy tumani', 'Baxmal tumani', "Do'stlik tumani", 'Forish tumani',
    "G'allaorol tumani", "Mirzacho'l tumani", 'Paxtakor tumani', 'Yangiobod tumani',
    'Zarbdor tumani', 'Zomin tumani',
  ],
  'Sirdaryo viloyati': [
    'Guliston shahri', 'Shirin shahri',
    'Boyovut tumani', 'Mirzaobod tumani', 'Oqoltin tumani', 'Sardoba tumani',
    'Sayxunobod tumani', 'Sirdaryo tumani', 'Xovos tumani',
  ],
  "Qoraqalpog'iston Respublikasi": [
    'Nukus shahri', "Qo'ng'irot shahri",
    'Amudaryo tumani', 'Beruniy tumani', "Bo'zatov tumani", 'Chimboy tumani',
    'Ellikkala tumani', 'Kegeyli tumani', "Mo'ynoq tumani", 'Nukus tumani',
    "Qanliko'l tumani", "Qo'ng'irot tumani", 'Shumanay tumani',
    "Taxtako'pir tumani", "To'rtko'l tumani", "Xo'jayli tumani",
  ],
};

const MANUAL_OPTION = '__manual__';

const RESIDENTS = Array.from({ length: 60 }, (_, i) => String(i + 1));

export default function BasicInfo({ data, updateData, embedded }: any) {
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

  const [cityManualMode, setCityManualMode] = useState<boolean>(() => {
    if (!data.city || !data.region) return false;
    const opts = REGION_CITIES[data.region] || [];
    return data.city.length > 0 && !opts.includes(data.city);
  });

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    if (field === 'owner') {
      newData.owner_surname = value.split(' ')[0].toUpperCase();
    }
    if (field === 'region') {
      newData.city = '';
      setCityManualMode(false);
    }
    setFormData(newData);
    updateData(newData);
  };

  const cityOptions = formData.region ? (REGION_CITIES[formData.region] || []) : [];

  const Wrapper: any = embedded ? View : ScrollView;
  return (
    <Wrapper style={styles.container}>
      {/* ── Audit Information ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text" size={20} color="#2563eb" />
          <Text style={styles.sectionTitle}>Audit Information</Text>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Case Number</Text>
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
          <Text style={styles.label}>Region</Text>
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
              <Picker.Item label="Qoraqalpog'iston Respublikasi" value="Qoraqalpog'iston Respublikasi" />
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>City / District</Text>
          {cityOptions.length > 0 ? (
            <>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={cityManualMode ? MANUAL_OPTION : formData.city}
                  onValueChange={(v) => {
                    if (v === MANUAL_OPTION) {
                      setCityManualMode(true);
                    } else if (v === '') {
                      setCityManualMode(false);
                      handleChange('city', '');
                    } else {
                      setCityManualMode(false);
                      handleChange('city', v);
                    }
                  }}
                >
                  <Picker.Item label="Select City / District" value="" />
                  {cityOptions.map(c => <Picker.Item key={c} label={c} value={c} />)}
                  <Picker.Item label="✎ Boshqa (Enter manually)" value={MANUAL_OPTION} />
                </Picker>
              </View>
              {cityManualMode && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={formData.city === MANUAL_OPTION ? '' : formData.city}
                  onChangeText={(v) => handleChange('city', v)}
                  placeholder="Shahar yoki tuman nomini kiriting..."
                />
              )}
            </>
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
          <Text style={styles.label}>MFY</Text>
          <TextInput
            style={styles.input}
            value={formData.mfy}
            onChangeText={(v) => handleChange('mfy', v)}
            placeholder="MFY"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Street</Text>
          <TextInput
            style={styles.input}
            value={formData.street}
            onChangeText={(v) => handleChange('street', v)}
            placeholder="Street name"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>House No</Text>
          <TextInput
            style={styles.input}
            value={formData.house}
            onChangeText={(v) => handleChange('house', v)}
            placeholder="e.g., 12"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Latitude</Text>
            <TextInput style={styles.input} value={formData.lat} onChangeText={(v) => handleChange('lat', v)} placeholder="41.2995" keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Longitude</Text>
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
          <Text style={styles.label}>Owner Full Name</Text>
          <TextInput
            style={styles.input}
            value={formData.owner}
            onChangeText={(v) => handleChange('owner', v)}
            placeholder="FISH"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Residents</Text>
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
          <Text style={styles.label}>Electricity Account</Text>
          <TextInput style={styles.input} value={formData.elec_account} onChangeText={(v) => handleChange('elec_account', v)} placeholder="Account number" keyboardType="numeric" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gas Account</Text>
          <TextInput style={styles.input} value={formData.gas_account} onChangeText={(v) => handleChange('gas_account', v)} placeholder="Account number" keyboardType="numeric" />
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
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827' },
  inputDisabled: { opacity: 0.5 },
  pickerContainer: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, marginBottom: 16 },
});
