import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Gelio({ data }: any) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sunny" size={20} color="#ea580c" />
          <Text style={styles.sectionTitle}>Gelio & FES Summary</Text>
        </View>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <Text style={styles.infoText}>
            Gelio and FES Solar settings are configured in the previous step (Boiler & Solar).
            {'\n\n'}
            Current values:{'\n'}
            • FES: {data.fes_kw || '10'} kW ({data.grid || 'on-grid'}){'\n'}
            • Gelio tank: {data.gelio_l || '200'} L{'\n'}
            • Ariston: {data.ariston_count || '1'} × {data.ariston_kW || '2'} kW
          </Text>
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
  infoBox: { flexDirection: 'row', gap: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 16 },
  infoText: { flex: 1, fontSize: 14, color: '#1e40af', lineHeight: 22 },
});
