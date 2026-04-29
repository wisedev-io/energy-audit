import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Accepts DD.MM.YYYY or legacy YYYY-MM-DD
function parseValue(value: string): Date {
  if (!value) return new Date();
  const dm = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dm) return new Date(+dm[3], +dm[2] - 1, +dm[1]);
  const ym = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ym) return new Date(+ym[1], +ym[2] - 1, +ym[3]);
  return new Date();
}

interface Props {
  label: string;
  value: string;
  onChange: (date: string) => void;
}

export default function DatePickerField({ label, value, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  const today = new Date();
  const selected = value ? parseValue(value) : null;

  const [viewYear, setViewYear] = useState(
    () => (selected ?? today).getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    () => (selected ?? today).getMonth()
  );

  const openPicker = () => {
    const d = value ? parseValue(value) : today;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setVisible(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSelect = (day: number) => {
    onChange(toDDMMYYYY(new Date(viewYear, viewMonth, day)));
    setVisible(false);
  };

  // Build calendar grid (Monday-first)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // 0=Mon
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const isSelected = (day: number) =>
    !!selected &&
    day === selected.getDate() &&
    viewMonth === selected.getMonth() &&
    viewYear === selected.getFullYear();

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.inputBtn} onPress={openPicker} activeOpacity={0.7}>
        <Text style={[styles.inputBtnText, !value && styles.placeholder]}>
          {value || 'Select date'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#2563eb" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity style={styles.modal} activeOpacity={1} onPress={() => {}}>
            {/* Month / year navigation */}
            <View style={styles.nav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.navTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.row}>
              {DAYS.map(d => (
                <Text key={d} style={styles.dayLabel}>{d}</Text>
              ))}
            </View>

            {/* Date grid */}
            <View style={styles.grid}>
              {cells.map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.cell}
                  onPress={() => day !== null && handleSelect(day)}
                  disabled={day === null}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.cellInner,
                    day !== null && isSelected(day) && styles.cellSelected,
                    day !== null && isToday(day) && !isSelected(day) && styles.cellToday,
                  ]}>
                    <Text style={[
                      styles.cellText,
                      day !== null && isSelected(day) && styles.cellTextSel,
                      day !== null && isToday(day) && !isSelected(day) && styles.cellTextToday,
                    ]}>
                      {day ?? ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Today shortcut */}
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => { onChange(toDDMMYYYY(today)); setVisible(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="today-outline" size={16} color="#2563eb" />
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  inputBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputBtnText: { fontSize: 15, color: '#111827' },
  placeholder: { color: '#9ca3af' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 6 },
  navTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  row: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    paddingBottom: 4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 2,
  },
  cellInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: '#2563eb' },
  cellToday: { backgroundColor: '#dbeafe' },
  cellText: { fontSize: 14, color: '#111827' },
  cellTextSel: { color: '#fff', fontWeight: '700' },
  cellTextToday: { color: '#2563eb', fontWeight: '700' },

  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },
  todayBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
