import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {ArrowLeft, Calendar, Filter} from 'lucide-react-native';
import {supabase} from './lib/supabase';

export default function AttendanceHistory({onBack}: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Present' | 'Absent'>('All');
  const [stats, setStats] = useState({attended: 0, total: 0});
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistoryAndStats(); // Re-runs your DB queries
    setRefreshing(false);
  };

  // --- 1. Fetch Real History from Supabase ---
  const fetchHistoryAndStats = async () => {
    try {
      const {
        data: {user},
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch History List
      const {data: histData} = await supabase
        .from('attendance')
        .select('*, sessions(class_name, room_number, created_at)')
        .eq('student_id', user.id)
        .order('marked_at', {ascending: false});

      // 2. Fetch Real Stats (Dynamic Denominator)
      const {data: statsData} = await supabase.rpc('get_student_stats', {
        p_student_id: user.id, // 🎯 Matches our new RPC parameter
      });

      setHistory(histData || []);
      if (statsData?.[0]) {
        const attended = parseInt(statsData[0].attended_count) || 0;
        const total = parseInt(statsData[0].total_possible_count) || 0;

        // 🎯 SAFETY: If attended is higher than total (like 3/0),
        // we fix it to 3/3 for the UI.
        setStats({
          attended: attended,
          total: attended > total ? attended : total,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndStats();
  }, []);

  // --- 2. Calculate Real Stats ---
  const totalHeld = stats.total;
  const presentCount = stats.attended;
  const absentCount = totalHeld - presentCount;
  const percentage =
    totalHeld > 0 ? Math.round((presentCount / totalHeld) * 100) : 100;

  // --- 3. Filter List ---
  const displayedList =
    filter === 'All'
      ? history
      : history.filter(r => r.status.toLowerCase() === filter.toLowerCase());

  const renderItem = ({item}: any) => {
    // Robust Date Formatting
    const rawDate = item.marked_at || item.created_at;
    const dateObj = new Date(rawDate);
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Get Class Name from the joined 'sessions' table
    // If it was an ad-hoc class without a name, fallback to "Unknown"
    const className = item.sessions?.class_name || 'Unknown Class';
    const status = item.status === 'present';

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{flex: 1}}>
            <Text style={styles.subject} numberOfLines={1}>
              {className}
            </Text>
            <View style={styles.row}>
              <Calendar size={14} color="#757575" />
              <Text style={styles.date}>
                {dateStr} • {timeStr}
              </Text>
            </View>
          </View>

          {/* 🟢/🔴 Dynamic Pill */}
          <View
            style={[styles.pill, status ? styles.pillGreen : styles.pillRed]}>
            <Text
              style={[
                styles.pillText,
                status ? styles.textGreen : styles.textRed,
              ]}>
              {status ? 'Present' : 'Absent'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance History</Text>
        <TouchableOpacity
          onPress={() => setFilter(filter === 'All' ? 'Present' : 'All')}>
          <Filter color="#FFF" size={24} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{totalHeld}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Present</Text>
          <Text style={[styles.statValue, {color: '#4CAF50'}]}>
            {presentCount}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Absent</Text>
          <Text style={[styles.statValue, {color: '#F44336'}]}>
            {absentCount}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>%</Text>
          <Text style={[styles.statValue, {color: '#2196F3'}]}>
            {percentage}%
          </Text>
        </View>
      </View>

      {/* List */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#2196F3" style={{marginTop: 20}} />
        ) : (
          <FlatList
            data={displayedList}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{paddingBottom: 20}}
            ListEmptyComponent={
              <Text style={{textAlign: 'center', color: '#999', marginTop: 50}}>
                No attendance records found yet.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {color: '#FFF', fontSize: 20, fontWeight: 'bold'},

  statsContainer: {flexDirection: 'row', padding: 15, gap: 10},
  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: {color: '#757575', fontSize: 12, marginBottom: 5},
  statValue: {fontSize: 20, fontWeight: 'bold', color: '#333'},

  content: {flex: 1, paddingHorizontal: 15},
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
  row: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4},
  subject: {fontSize: 16, fontWeight: 'bold', color: '#212121'},
  date: {fontSize: 14, color: '#757575'},

  pill: {paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20},
  pillGreen: {backgroundColor: '#E8F5E9'},
  pillRed: {backgroundColor: '#FFEBEE'},
  pillText: {fontSize: 12, fontWeight: 'bold'},
  textGreen: {color: '#4CAF50'},
  textRed: {color: '#F44336'},
});
