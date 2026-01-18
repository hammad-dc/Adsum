import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  Clock,
  Bluetooth,
} from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function LiveAttendanceView({
  classSession,
  onBack,
  onManualOverride,
}: any) {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // --- 1. Fetch Initial Data ---
  const fetchAttendees = async () => {
    try {
      // Get all attendance records for this session + Student Profile info
      const { data, error } = await supabase
        .from('attendance')
        .select(
          `
          *,
          profiles:student_id (full_name, student_id, email) 
        `,
        )
        .eq('session_id', classSession.id)
        .order('marked_at', { ascending: false });

      if (error) throw error;
      setAttendees(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Subscribe to Real-Time Updates ---
  useEffect(() => {
    fetchAttendees();

    // Listen for NEW rows in 'attendance' table
    const subscription = supabase
      .channel('attendance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${classSession.id}`,
        },
        payload => {
          console.log('New student marked!', payload);
          // Refresh the list immediately
          fetchAttendees();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const filteredList = attendees.filter(
    item =>
      item.profiles?.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.profiles?.student_id
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const renderItem = ({ item }: any) => {
    const timeString = new Date(item.marked_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const name =
      item.profiles?.full_name ||
      item.profiles?.email?.split('@')[0] ||
      'Unknown';
    const studentId = item.profiles?.student_id || 'ID: --';

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/initials/png?seed=${name}&backgroundColor=2196F3&chars=2`,
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Text style={styles.name}>{name}</Text>
              {item.verification_method === 'bluetooth' && (
                <Bluetooth
                  size={14}
                  color="#2196F3"
                  style={{ marginLeft: 5 }}
                />
              )}
            </View>
            <Text style={styles.subText}>{studentId}</Text>
            <View style={[styles.row, { marginTop: 4 }]}>
              <Clock size={12} color="#757575" />
              <Text style={styles.timeText}>{timeString}</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <CheckCircle size={14} color="#FFF" />
            <Text style={styles.badgeText}>Verified</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.row}>
          <TouchableOpacity onPress={onBack}>
            <ArrowLeft color="#FFF" size={24} />
          </TouchableOpacity>
          <View style={{ marginLeft: 15 }}>
            <Text style={styles.headerTitle}>{classSession.name}</Text>
            <Text style={styles.headerSub}>{attendees.length} Present</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={20} color="#757575" />
          <TextInput
            placeholder="Search student..."
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* List */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#2196F3" />
        ) : (
          <FlatList
            data={filteredList}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Waiting for students...</Text>
            }
          />
        )}
      </View>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={onManualOverride}
        >
          <Text style={styles.manualText}>Manual Override</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#2196F3', padding: 20, paddingBottom: 15 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#BBDEFB', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 15,
    height: 45,
  },
  input: { flex: 1, marginLeft: 10, color: '#333' },

  content: { flex: 1, padding: 15 },
  card: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEE',
    marginRight: 15,
  },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subText: { color: '#757575', fontSize: 13 },
  timeText: { color: '#757575', fontSize: 12, marginLeft: 5 },

  badge: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' },

  footer: {
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#EEE',
  },
  manualButton: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  manualText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
});
