import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fieldHistory } from '../utils/fieldHistory';

interface Props {
  fieldKey: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export default function HistoryTextInput({ fieldKey, label, value, onChangeText, placeholder, multiline }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const handleFocus = async () => {
    const history = await fieldHistory.get(fieldKey);
    setSuggestions(history);
    setOpen(true);
  };

  const handleBlur = () => {
    // Delay so a tap on a suggestion fires before the list hides
    setTimeout(() => setOpen(false), 200);
    if (value.trim()) fieldHistory.add(fieldKey, value.trim());
  };

  const pick = (v: string) => {
    onChangeText(v);
    setOpen(false);
    fieldHistory.add(fieldKey, v);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
      />
      {open && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <Text style={styles.dropdownHeader}>Recent</Text>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => pick(s)} style={styles.item}>
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text style={styles.itemText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  dropdownHeader: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  itemText: { fontSize: 14, color: '#374151', flex: 1 },
  multiline: { height: 80, textAlignVertical: 'top' },
});
