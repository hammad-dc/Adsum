import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  Modal,
  StatusBar,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  Calendar,
  Users,
  X,
  User,
  LayoutDashboard,
  Info,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';

export default function AcademicReports({teacherId, onBack}: any) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Detail View State
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (selectedSubject) {
        setSelectedSubject(null);
        return true;
      }
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, [selectedSubject]);

  const fetchReportData = async () => {
    try {
      const {data, error} = await supabase.rpc('get_teacher_subject_reports', {
        p_teacher_id: teacherId,
      });
      if (error) throw error;
      setReports(
        (data || []).sort(
          (a: any, b: any) =>
            (b.total_sessions_held > 0 ? 1 : -1) -
            (a.total_sessions_held > 0 ? 1 : -1),
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSessionHistory = async (subjectId: number) => {
    setLoadingHistory(true);
    try {
      const {data, error} = await supabase
        .from('sessions')
        .select(
          `
          id, created_at,closed_at, target_batch, 
          attendance(count)
        `,
        )
        .eq('subject_id', subjectId)
        .eq('is_active', false)
        .order('created_at', {ascending: false});

      if (error) throw error;
      setSessionHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleOpenDetails = (item: any) => {
    if (item.total_sessions_held > 0) {
      setSelectedSubject(item);
      fetchSessionHistory(item.subject_id);
    }
  };
  const renderSubjectReport = (item: any) => {
    const hasSessions = item.total_sessions_held > 0;
    const totalPossible =
      item.total_sessions_held * item.expected_students_per_class;
    const percentage =
      hasSessions && totalPossible > 0
        ? Math.round((item.total_presence_count / totalPossible) * 100)
        : 0;

    return (
      <TouchableOpacity
        key={item.subject_id}
        activeOpacity={hasSessions ? 0.7 : 1}
        onPress={() => handleOpenDetails(item)}
        style={[styles.reportCard, !hasSessions && styles.disabledCard]}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
            <Text
              style={[styles.subjectName, !hasSessions && styles.disabledText]}>
              {item.subject_name}
            </Text>
            <Text style={styles.subjectCode}>
              {item.subject_code} • {item.subject_type}
            </Text>
          </View>
          <View
            style={[
              styles.percentageBadge,
              {
                backgroundColor: !hasSessions
                  ? '#EEE'
                  : percentage < 75
                  ? '#FFEBEE'
                  : '#E3F2FD',
              },
            ]}>
            <Text
              style={[
                styles.percentageText,
                {
                  color: !hasSessions
                    ? '#999'
                    : percentage < 75
                    ? '#F44336'
                    : '#2196F3',
                },
              ]}>
              {hasSessions ? `${percentage}%` : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${percentage}%`,
                backgroundColor: !hasSessions
                  ? '#DDD'
                  : percentage < 75
                  ? '#F44336'
                  : '#4CAF50',
              },
            ]}
          />
        </View>

        {/* Explanation Label */}
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>
            {hasSessions
              ? `Avg. Attendance over ${item.total_sessions_held} sessions`
              : 'No sessions held yet'}
          </Text>
          {hasSessions && <ChevronRight size={16} color="#2196F3" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onBack('dashboard')}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Academic Reports</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchReportData} />
        }>
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : (
          reports.map(renderSubjectReport)
        )}
      </ScrollView>

      {/* Session History Modal */}
      <Modal
        visible={!!selectedSubject}
        animationType="slide"
        transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedSubject?.subject_name}
                </Text>
                <Text style={styles.modalSubtitle}>Session Creation Log</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSubject(null)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{padding: 20}}>
              {loadingHistory ? (
                <ActivityIndicator color="#2196F3" />
              ) : (
                sessionHistory.map((session, index) => (
                  <View key={session.id} style={styles.sessionRow}>
                    <View style={{marginBottom: 2}}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: 'bold',
                          color: '#999',
                          textTransform: 'uppercase',
                        }}>
                        Session Timing
                      </Text>

                      <View style={styles.sessionDateBox}>
                        <Calendar size={14} color="#757575" />
                        <Text style={styles.sessionDate}>
                          {new Date(session.created_at).toLocaleDateString(
                            'en-GB',
                          )}
                        </Text>

                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 8,
                          }}>
                          <Text style={{fontSize: 12, color: '#757575'}}>
                            {new Date(session.created_at).toLocaleTimeString(
                              [],
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                            {/* Only show the end time if the session is closed */}
                            {session.closed_at &&
                              ' - ' +
                                new Date(session.closed_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )}
                          </Text>
                          {!session.closed_at && (
                            <View
                              style={{
                                backgroundColor: '#FFEBEE',
                                paddingHorizontal: 4,
                                paddingVertical: 2,
                                borderRadius: 4,
                                marginLeft: 6,
                              }}>
                              <Text
                                style={{
                                  color: '#D32F2F',
                                  fontSize: 9,
                                  fontWeight: 'bold',
                                }}>
                                ONGOING
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.sessionStats}>
                      <Text style={styles.sessionBatch}>
                        {session.target_batch === 'ALL'
                          ? 'Theory'
                          : `Batch ${session.target_batch}`}
                      </Text>
                      <View style={styles.sessionCountBadge}>
                        <Users size={12} color="#2196F3" />
                        <Text style={styles.sessionCountText}>
                          {session.attendance?.[0]?.count || 0}/
                          {selectedSubject?.expected_students_per_class || 0}{' '}
                          Present
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Standard Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onBack('dashboard')}>
          <LayoutDashboard size={24} color="#757575" />
          <Text style={styles.navText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <FileText size={24} color="#2196F3" />
          <Text style={[styles.navText, {color: '#2196F3'}]}>Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onBack('profile')}>
          <User size={24} color="#757575" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 5,
  },
  headerTitle: {color: '#FFF', fontSize: 24, fontWeight: 'bold'},
  scrollContent: {padding: 20, paddingTop: 25},
  reportCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
  },
  disabledCard: {
    backgroundColor: '#FAFAFA',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  disabledText: {color: '#AAA'},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  subjectName: {fontSize: 17, fontWeight: 'bold', color: '#333'},
  subjectCode: {fontSize: 12, color: '#757575'},
  percentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {fontWeight: 'bold', fontSize: 13},
  progressContainer: {
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {height: '100%'},
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  labelText: {fontSize: 11, color: '#757575', fontStyle: 'italic'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  modalSubtitle: {fontSize: 12, color: '#2196F3', fontWeight: 'bold'},
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sessionDateBox: {flexDirection: 'row', alignItems: 'center', gap: 8},
  sessionDate: {fontSize: 14, color: '#333', fontWeight: '500'},
  sessionStats: {alignItems: 'flex-end'},
  sessionBatch: {fontSize: 12, color: '#757575', marginBottom: 4},
  sessionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sessionCountText: {fontSize: 11, color: '#2196F3', fontWeight: 'bold'},
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  navItem: {alignItems: 'center'},
  navText: {fontSize: 12, color: '#757575', marginTop: 4},
});
