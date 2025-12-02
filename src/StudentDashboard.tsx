import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Bell, Home, History, User, Clock, MapPin } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from './lib/supabase';

export default function StudentDashboard({ session, onNavigate }: any) {
  const [activeTab, setActiveTab] = useState('home');
  const [classes, setClasses] = useState<any[]>([]); // Real Data
  const [loading, setLoading] = useState(true);

  // --- 1. FETCH LIVE CLASSES ---
  const fetchLiveClasses = async () => {
    setLoading(true);
    try {
      // Fetch only ACTIVE sessions
      const { data, error } = await supabase
        .from('sessions')
        .select('*, subjects(*)') // Get session info + linked subject info
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error('Error fetching student classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveClasses();
  }, []);

  // --- Chart Calculations ---
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.87; // 87% (Static for now, will connect to history later)
  const strokeDashoffset = circumference * (1 - progress);

  const getStatusColor = (status: string) => {
    // Since we only fetch active classes, they are mostly 'ongoing'
    return { bg: '#4CAF50', text: '#FFFFFF', label: 'Ongoing' };
  };

  const renderContent = () => {
    if (activeTab === 'home') {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchLiveClasses}
              colors={['#2196F3']}
            />
          }
        >
          {/* Blue Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <View style={styles.userInfo}>
                <Image
                  source={{
                    uri:
                      'https://api.dicebear.com/9.x/avataaars/png?seed=' +
                      session.user.email,
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.userName}>Student</Text>
                  <Text style={styles.userId}>{session.user.email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.iconButton}>
                <Bell color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            {/* Attendance Summary Card */}
            <View style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Overall Attendance</Text>
                <Text style={styles.summaryPercent}>87%</Text>
                <Text style={styles.summarySub}>60 out of 69 classes</Text>
              </View>

              <View
                style={{
                  width: 100,
                  height: 100,
                  transform: [{ rotate: '-90deg' }],
                }}
              >
                <Svg width={size} height={size}>
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#E3F2FD"
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#2196F3"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
            </View>
          </View>

          {/* List Section */}
          <View style={styles.listSection}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {loading && <ActivityIndicator size="small" color="#2196F3" />}
            </View>

            {/* Empty State */}
            {!loading && classes.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#999' }}>
                  No active classes right now.
                </Text>
              </View>
            )}

            {/* Real Data List */}
            {classes.map(item => {
              const statusColors = getStatusColor('ongoing');

              // Smart Name Logic (Matches Teacher Dashboard)
              const displayName =
                item.class_name || item.subjects?.name || 'Untitled Class';
              const displayRoom = item.room_number || 'Room TBD';
              const timeString = new Date(item.created_at).toLocaleTimeString(
                [],
                { hour: '2-digit', minute: '2-digit' },
              );

              return (
                <View key={item.id} style={styles.classCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.className}>{displayName}</Text>
                      <View style={styles.metaRow}>
                        <Clock size={14} color="#757575" />
                        <Text style={styles.metaText}>{timeString}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <MapPin size={14} color="#757575" />
                        <Text style={styles.metaText}>{displayRoom}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusColors.text },
                        ]}
                      >
                        {statusColors.label}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.markButton}
                    onPress={() =>
                      onNavigate && onNavigate('mark-attendance', item)
                    }
                  >
                    <Text style={styles.markButtonText}>Mark Attendance</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text>Coming Soon</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      {renderContent()}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Home
            size={24}
            color={activeTab === 'home' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'home' && { color: '#2196F3' },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('history', null)}
        >
          <History
            size={24}
            color={activeTab === 'history' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'history' && { color: '#2196F3' },
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('profile', null)}
        >
          <User
            size={24}
            color={activeTab === 'profile' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'profile' && { color: '#2196F3' },
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerContainer: {
    backgroundColor: '#2196F3',
    paddingTop: 20,
    paddingBottom: 80,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  userId: { fontSize: 14, color: '#BBDEFB' },
  iconButton: { padding: 4 },

  summaryCard: {
    position: 'absolute',
    bottom: -50,
    left: 24,
    right: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  summaryLabel: { fontSize: 14, color: '#757575', marginBottom: 4 },
  summaryPercent: { fontSize: 36, fontWeight: 'bold', color: '#2196F3' },
  summarySub: { fontSize: 12, color: '#757575', marginTop: 4 },

  listSection: {
    marginTop: 70,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 16,
  },

  classCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: { fontSize: 14, color: '#757575' },

  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  markButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  markButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 10,
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, marginTop: 4, color: '#757575' },
});
