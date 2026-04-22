import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
} from 'react-native';
import {supabase} from './lib/supabase';

export default function Progress({profile, session, onBack}: any) {
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      console.log('🔍 Fetching stats for ID:', session?.user?.id);
      const {data, error} = await supabase.rpc('get_subject_wise_stats', {
        p_student_id: session?.user?.id,
      });

      if (error) {
        console.error('❌ RPC Error:', error.message);
      } else {
        console.log('📊 Stats received:', data?.length, 'subjects');
        setSubjectStats(data || []);
      }
    } catch (err) {
      console.error('❌ Catch Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };

    // 2. Register the listener
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    if (session?.user?.id) {
      fetchStats();
    }
    return () => backHandler.remove();
  }, [session?.user?.id, onBack]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{marginTop: 10, color: '#757575'}}>
          Loading Progress...
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#F5F5F5'}}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <Text style={styles.sectionTitle}>Course Analytics</Text>

        {subjectStats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No subjects found for your profile.
            </Text>
            <Text style={styles.emptySubText}>
              Check if Course, Year, and Semester match in DB.
            </Text>
          </View>
        ) : (
          subjectStats.map(item => {
            // 1. Core Data
            const attended = item.attended_count || 0;
            const held = item.total_held || 0;

            // 2. Logic Calculations
            const percentage =
              held === 0 ? 100 : Math.round((attended / held) * 100);
            const isSafe = percentage >= 75;

            // 3. Dynamic Styling
            // Gray if no sessions held, Green if >= 75%, Red if below
            const progressColor =
              held === 0 ? '#E0E0E0' : isSafe ? '#4CAF50' : '#F44336';
            const badgeBg =
              held === 0 ? '#F5F5F5' : isSafe ? '#E8F5E9' : '#FFEBEE';

            return (
              <View key={item.subject_id.toString()} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{flex: 1}}>
                    <Text style={styles.subjectName}>{item.subject_name}</Text>
                    <Text style={styles.subjectType}>{item.subject_type}</Text>
                  </View>

                  {/* Update: Badge color is now dynamic */}
                  <View style={[styles.badge, {backgroundColor: badgeBg}]}>
                    <Text style={[styles.badgeText, {color: progressColor}]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.statText}>
                  Attended: {attended} / {held} Sessions
                </Text>

                <View style={styles.progressBg}>
                  {/* Update: Progress bar color is now dynamic */}
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  scrollContainer: {padding: 20, paddingBottom: 100},
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subjectName: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  subjectType: {fontSize: 12, color: '#757575', textTransform: 'uppercase'},
  badge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8},
  badgeText: {fontSize: 14, fontWeight: 'bold'},
  statText: {fontSize: 13, color: '#616161', marginBottom: 8},
  progressBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 4},
  emptyContainer: {marginTop: 50, alignItems: 'center'},
  emptyText: {fontSize: 16, color: '#999', fontWeight: 'bold'},
  emptySubText: {fontSize: 12, color: '#BBB', marginTop: 5},
});
