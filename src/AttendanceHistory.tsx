import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import {
  ArrowLeft,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';

// Mock Data (Replace with supabase.from('attendance').select() later)
const MOCK_HISTORY = [
  {
    id: '1',
    date: '1 Dec 2024',
    subject: 'Data Structures',
    status: 'present',
    time: '9:15 AM',
  },
  {
    id: '2',
    date: '30 Nov 2024',
    subject: 'Algorithms',
    status: 'absent',
    time: '-',
  },
  {
    id: '3',
    date: '29 Nov 2024',
    subject: 'Operating Systems',
    status: 'present',
    time: '2:05 PM',
  },
  {
    id: '4',
    date: '28 Nov 2024',
    subject: 'Data Structures',
    status: 'present',
    time: '9:14 AM',
  },
  {
    id: '5',
    date: '27 Nov 2024',
    subject: 'Database Mgmt',
    status: 'present',
    time: '10:22 AM',
  },
];

export default function AttendanceHistory({ onBack }: any) {
  const [filter, setFilter] = useState<'All' | 'Present' | 'Absent'>('All');

  // Logic: Calculate Stats
  const total = MOCK_HISTORY.length;
  const present = MOCK_HISTORY.filter(r => r.status === 'present').length;
  const absent = total - present;
  const percentage = Math.round((present / total) * 100);

  // Logic: Filter List
  const displayedList =
    filter === 'All'
      ? MOCK_HISTORY
      : MOCK_HISTORY.filter(
          r => r.status.toLowerCase() === filter.toLowerCase(),
        );

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.subject}>{item.subject}</Text>
          <View style={styles.row}>
            <Calendar size={14} color="#757575" />
            <Text style={styles.date}>
              {item.date} • {item.time}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.pill,
            item.status === 'present' ? styles.pillGreen : styles.pillRed,
          ]}
        >
          <Text
            style={[
              styles.pillText,
              item.status === 'present' ? styles.textGreen : styles.textRed,
            ]}
          >
            {item.status === 'present' ? 'Present' : 'Absent'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance History</Text>
        <TouchableOpacity
          onPress={() => setFilter(filter === 'All' ? 'Absent' : 'All')}
        >
          <Filter color="#FFF" size={24} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{total}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Present</Text>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {present}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Absent</Text>
          <Text style={[styles.statValue, { color: '#F44336' }]}>{absent}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>%</Text>
          <Text style={[styles.statValue, { color: '#2196F3' }]}>
            {percentage}%
          </Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={displayedList}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  statsContainer: { flexDirection: 'row', padding: 15, gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: { color: '#757575', fontSize: 12, marginBottom: 5 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  list: { padding: 15 },
  card: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  subject: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  date: { fontSize: 14, color: '#757575' },

  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  pillGreen: { backgroundColor: '#E8F5E9' },
  pillRed: { backgroundColor: '#FFEBEE' },
  pillText: { fontSize: 12, fontWeight: 'bold' },
  textGreen: { color: '#4CAF50' },
  textRed: { color: '#F44336' },
});
