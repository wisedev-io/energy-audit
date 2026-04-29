import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhotoItem } from './Photos';

export default function Review({ data }: any) {
  const photoItems = data.photoItems as Record<string, PhotoItem[]> | undefined;
  let totalPhotos = 0, uploadedPhotos = 0, uploadingPhotos = 0;
  if (photoItems) {
    Object.values(photoItems).flat().forEach(item => {
      totalPhotos++;
      if (item.serverKey) uploadedPhotos++;
      if (item.uploading) uploadingPhotos++;
    });
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review & Submit</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Basic Info</Text>
          <Text style={styles.summaryText}>Owner: {data.owner || '—'}</Text>
          <Text style={styles.summaryText}>Auditor: {data.aud_name || '—'}</Text>
          <Text style={styles.summaryText}>Date: {data.aud_date || '—'}</Text>
          <Text style={styles.summaryText}>Region: {data.region || '—'}</Text>
          <Text style={styles.summaryText}>Address: {data.street} {data.house}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Building</Text>
          <Text style={styles.summaryText}>Area: {data.area_total || '—'} m²</Text>
          <Text style={styles.summaryText}>Floors: {data.floors || '—'}</Text>
          <Text style={styles.summaryText}>Rooms: {data.rooms || '—'}</Text>
          <Text style={styles.summaryText}>Year Built: {data.yr_built || '—'}</Text>
          <Text style={styles.summaryText}>Wall: {data.wall_mat || '—'}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Solar & Energy</Text>
          <Text style={styles.summaryText}>FES: {data.fes_kw || '10'} kW ({data.grid || 'on-grid'})</Text>
          <Text style={styles.summaryText}>Gelio: {data.gelio_l || '200'} L</Text>
          <Text style={styles.summaryText}>Ariston: {data.ariston_count || '1'} × {data.ariston_kW || '2'} kW</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Measurements</Text>
          <Text style={styles.summaryText}>Room 1: {data.r1_temp || '—'}°C / {data.r1_hum || '—'}% / {data.r1_lux || '—'} lux</Text>
          <Text style={styles.summaryText}>Room 2: {data.r2_temp || '—'}°C / {data.r2_hum || '—'}% / {data.r2_lux || '—'} lux</Text>
        </View>

        <View style={[styles.summaryCard, uploadingPhotos > 0 && styles.cardWarning]}>
          <Text style={styles.summaryTitle}>Photos</Text>
          <Text style={styles.summaryText}>
            {uploadedPhotos}/{totalPhotos} uploaded
            {uploadingPhotos > 0 ? ` (${uploadingPhotos} still uploading…)` : ''}
          </Text>
          {uploadingPhotos > 0 && (
            <Text style={styles.uploadingNote}>Wait for uploads to finish before submitting.</Text>
          )}
        </View>

        <View style={[styles.infoBox, uploadingPhotos > 0 && styles.infoBoxWarn]}>
          <Ionicons
            name={uploadingPhotos > 0 ? 'warning' : 'checkmark-circle'}
            size={18}
            color={uploadingPhotos > 0 ? '#d97706' : '#10b981'}
          />
          <Text style={[styles.infoText, uploadingPhotos > 0 && styles.infoTextWarn]}>
            {uploadingPhotos > 0
              ? 'Wait for all photos to finish uploading, then tap Submit.'
              : 'All photos ready. Tap Submit below to generate reports.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  summaryCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardWarning: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  summaryText: { fontSize: 13, color: '#374151', marginBottom: 3 },
  uploadingNote: { fontSize: 12, color: '#d97706', marginTop: 4, fontWeight: '500' },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 14, marginTop: 4 },
  infoBoxWarn: { backgroundColor: '#fffbeb', borderColor: '#fbbf24' },
  infoText: { flex: 1, fontSize: 13, color: '#15803d', lineHeight: 18 },
  infoTextWarn: { color: '#92400e' },
});
