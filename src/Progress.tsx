import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  SafeAreaView,
} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {supabase} from './lib/supabase';

export default function Progress({profile, session, onBack}: any) {
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]); // Store logs locally
  const [trendData, setTrendData] = useState<{label: string; pct: number}[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'7D' | '30D' | 'Semester'>('30D');
  const [isLive, setIsLive] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const studentId = session?.user?.id;
      if (!studentId || !profile?.course) return;

      // Numerator: sessions this student actually has an attendance row for
      // (this table only ever gets a row on a successful mark â€” there is no
      // explicit "absent" row).
      const {data: attendanceLogs, error: logError} = await supabase
        .from('attendance')
        .select('status, session_id')
        .eq('student_id', studentId);

      if (logError) throw logError;

      const attendedSessionIds = new Set(
        (attendanceLogs || [])
          .filter(a => a.status === 'present')
          .map(a => a.session_id),
      );

      // Denominator: every session that matched this student's cohort, whether
      // they marked it or not. This mirrors StudentDashboard's heatmap logic â€”
      // without this, missed sessions silently vanish instead of counting against %.
      const {data: cohortSessions, error: sessError} = await supabase
        .from('sessions')
        .select('id, created_at, subjects(id, name, type)')
        .eq('target_course', profile.course)
        .eq('target_year', profile.year)
        .eq('target_semester', profile.semester)
        .or(`target_batch.eq.ALL,target_batch.eq.${profile.batch || 'NONE'}`); // Safe fallback

      if (sessError) throw sessError;

      const subjStatsMap: Record<string, any> = {};
      const enrichedLogs: any[] = [];

      (cohortSessions || []).forEach((s: any) => {
        const subj = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects;
        if (!subj) return;

        if (!subjStatsMap[subj.id]) {
          subjStatsMap[subj.id] = {
            subject_id: subj.id,
            subject_name: subj.name || 'Subject',
            subject_type: subj.type || 'Theory',
            attended_count: 0,
            total_held: 0,
          };
        }
        subjStatsMap[subj.id].total_held++;

        const wasPresent = attendedSessionIds.has(s.id);
        if (wasPresent) subjStatsMap[subj.id].attended_count++;

        enrichedLogs.push({
          status: wasPresent ? 'present' : 'absent',
          session_id: s.id,
          created_at: s.created_at,
        });
      });

      enrichedLogs.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      // Per-subject "classes needed to reach 75%" and consecutive-attend messaging
      const subjectsWithGoals = Object.values(subjStatsMap).map((s: any) => {
        const pct =
          s.total_held > 0
            ? Math.round((s.attended_count / s.total_held) * 100)
            : 0;
        const neededConsecutive =
          pct < 75
            ? Math.max(
                0,
                Math.ceil((0.75 * s.total_held - s.attended_count) / 0.25),
              )
            : 0;
        return {...s, pct, neededConsecutive};
      });

      setSubjectStats(subjectsWithGoals);
      setAllLogs(enrichedLogs);
    } catch (err) {
      console.error('Error fetching dynamic progress stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, profile]);

  useEffect(() => {
    buildTrendData(allLogs, activeTab);
  }, [activeTab, allLogs]);

  const buildTrendData = (logs: any[], timeframe: string) => {
    if (!logs || logs.length === 0) {
      setTrendData([
        {label: 'Start', pct: 0},
        {label: 'Now', pct: 0},
      ]);
      return;
    }

    const now = new Date();
    let filterDays = 30;
    if (timeframe === '7D') filterDays = 7;
    if (timeframe === 'Semester') filterDays = 120;

    const cutoff = new Date();
    cutoff.setDate(now.getDate() - filterDays);

    const filteredLogs = logs.filter(
      item => new Date(item.created_at) >= cutoff,
    );
    if (filteredLogs.length === 0) {
      setTrendData([
        {label: 'Prev', pct: 0},
        {label: 'Now', pct: 0},
      ]);
      return;
    }

    // Per-period rate (bucketed by session, in chronological order) rather than a cumulative
    // running average, so a genuine recent dip is visible instead of smoothed away.
    const points = filteredLogs.map(log => ({
      label: new Date(log.created_at).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      pct: log.status === 'present' ? 100 : 0,
    }));

    // Collapse to ~6 evenly spaced markers showing a rolling window average around each point,
    // which reads as a trend line without hiding recent swings the way a global cumulative does.
    const windowSize = Math.max(1, Math.floor(filteredLogs.length / 6));
    const collapsed: {label: string; pct: number}[] = [];
    for (let i = 0; i < filteredLogs.length; i += windowSize) {
      const chunk = filteredLogs.slice(i, i + windowSize);
      const present = chunk.filter(c => c.status === 'present').length;
      collapsed.push({
        label: new Date(chunk[chunk.length - 1].created_at).toLocaleDateString(
          [],
          {month: 'short', day: 'numeric'},
        ),
        pct: Math.round((present / chunk.length) * 100),
      });
    }
    setTrendData(collapsed.length > 0 ? collapsed : points);
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (onBack) {
          onBack();
          return true;
        }
        return false;
      },
    );
    if (session?.user?.id) fetchStats();
    return () => backHandler.remove();
  }, [session?.user?.id, onBack, activeTab, fetchStats]);

  // Realtime: refresh the moment this student's own attendance changes (e.g. right after
  // marking present in a live session), instead of waiting for a manual pull-to-refresh.
  useEffect(() => {
    const studentId = session?.user?.id;
    if (!studentId) return;

    const channel = supabase
      .channel(`student-progress-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          fetchStats();
        },
      )
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchStats]);

  const generateSvgPath = (
    points: {pct: number}[],
    width = 300,
    height = 80,
  ) => {
    if (!points || points.length === 0) return 'M0 70 L300 70';
    if (points.length === 1) {
      const y = height - 10 - (points[0].pct / 100) * (height - 20);
      return `M0 ${y} L300 ${y}`;
    }
    const step = width / (points.length - 1);
    return points
      .map((pt, idx) => {
        const x = idx * step;
        const y = height - 10 - (pt.pct / 100) * (height - 20);
        return `${idx === 0 ? 'M' : 'L'}${Math.round(x)} ${Math.round(y)}`;
      })
      .join(' ');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{marginTop: 10, color: '#64748B'}}>
          Calculating your progress...
        </Text>
      </View>
    );
  }

  const totalAttended = subjectStats.reduce(
    (acc, curr) => acc + (curr.attended_count || 0),
    0,
  );
  const totalHeld = subjectStats.reduce(
    (acc, curr) => acc + (curr.total_held || 0),
    0,
  );
  const overallPercentage =
    totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : 0;
  const missedClasses = Math.max(0, totalHeld - totalAttended);
  const classesNeededTo75 = Math.max(
    0,
    Math.ceil((0.75 * totalHeld - totalAttended) / 0.25),
  );
  const activeSubjectsCount = subjectStats.length;

  const svgPath = generateSvgPath(trendData);
  const lastPointPct =
    trendData.length > 0 ? trendData[trendData.length - 1].pct : 0;
  const lastPointY = 80 - 10 - (lastPointPct / 100) * 60;

  // Add this helper function inside your component, before the return()
  const renderAttendanceStatus = (attendedCount: number, totalHeld: number) => {
    if (totalHeld === 0) return null; // Hide if no classes have happened yet

    const currentPct = (attendedCount / totalHeld) * 100;
    const classesNeededTo75 = Math.ceil(
      (0.75 * totalHeld - attendedCount) / 0.25,
    );

    if (currentPct >= 75) {
      // 1. THE SAFE ZONE (Bunk Meter)
      const safeToSkip = Math.floor((attendedCount - 0.75 * totalHeld) / 0.75);

      if (safeToSkip > 0) {
        return (
          <Text style={{color: '#4CAF50', fontSize: 13, marginTop: 4}}>
            ✓ Safe Zone: You can comfortably miss {safeToSkip} upcoming{' '}
            {safeToSkip === 1 ? 'class' : 'classes'}.
          </Text>
        );
      } else {
        return (
          <Text style={{color: '#4CAF50', fontSize: 13, marginTop: 4}}>
            ✓ On Track: You are exactly at the 75% threshold.
          </Text>
        );
      }
    } else {
      // 2. THE REALITY CAP (Hopeless Zone)
      if (classesNeededTo75 > 15) {
        return (
          <Text
            style={{
              color: '#F44336',
              fontSize: 13,
              marginTop: 4,
              fontWeight: 'bold',
            }}>
            ⚠️ Critical: Attendance is severely low.
          </Text>
        );
      }
      // 3. THE RECOVERY GOAL (Actionable Zone)
      else {
        return (
          <Text style={{color: '#FF9800', fontSize: 13, marginTop: 4}}>
            🎯 Recovery Goal: Attend {classesNeededTo75} consecutive classes to
            reach 75%.
          </Text>
        );
      }
    }
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#F8FAFC'}}>
      <ScrollView
        contentContainerStyle={{padding: 16, paddingBottom: 100}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchStats();
            }}
            colors={['#2563EB']}
          />
        }>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Progress</Text>
            <Text style={styles.subtitle}>
              Track your attendance and stay on course.
            </Text>
          </View>
          <View style={styles.liveChip}>
            <View
              style={[
                styles.liveDot,
                {backgroundColor: isLive ? '#16A34A' : '#94A3B8'},
              ]}
            />
            <Text style={styles.liveChipText}>
              {isLive ? 'Live' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Overall Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>Overall Attendance</Text>
              <View style={styles.pctRow}>
                <Text style={styles.bigPct}>{overallPercentage}%</Text>
                {overallPercentage < 75 && totalHeld > 0 && (
                  <View style={styles.riskBadge}>
                    <Text style={styles.riskBadgeText}>âš ï¸ AT RISK</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardSubText}>
                {totalAttended} / {totalHeld} attended
              </Text>
              <Text style={styles.requiredText}>Required: 75%</Text>
            </View>
            <View
              style={[
                styles.gauge,
                {
                  borderColor: overallPercentage < 75 ? '#FEE2E2' : '#DCFCE7',
                  borderTopColor:
                    overallPercentage < 75 ? '#EF4444' : '#16A34A',
                },
              ]}>
              <Text
                style={[
                  styles.gaugePct,
                  {color: overallPercentage < 75 ? '#EF4444' : '#16A34A'},
                ]}>
                {overallPercentage}%
              </Text>
              <Text style={styles.gaugeSub}>attended</Text>
            </View>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(overallPercentage, 100)}%`,
                  backgroundColor:
                    overallPercentage < 75 ? '#EF4444' : '#16A34A',
                },
              ]}
            />
          </View>
          {overallPercentage < 75 && totalHeld > 0 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                âš ï¸ You must attend {classesNeededTo75} more classes to reach
                75%.
              </Text>
            </View>
          )}
        </View>

        {/* Quick stat row */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <View style={[styles.quickDot, {backgroundColor: '#16A34A'}]} />
            <Text style={styles.quickStatVal}>{totalAttended}</Text>
            <Text style={styles.quickStatLabel}>Attended</Text>
          </View>
          <View style={styles.quickStat}>
            <View style={[styles.quickDot, {backgroundColor: '#EF4444'}]} />
            <Text style={styles.quickStatVal}>{missedClasses}</Text>
            <Text style={styles.quickStatLabel}>Missed</Text>
          </View>
          <View style={styles.quickStat}>
            <View style={[styles.quickDot, {backgroundColor: '#2563EB'}]} />
            <Text style={styles.quickStatVal}>{activeSubjectsCount}</Text>
            <Text style={styles.quickStatLabel}>Active Subjects</Text>
          </View>
        </View>

        {/* Trend */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>Attendance Trend</Text>
            </View>
            <View style={styles.tabGroup}>
              {(['7D', '30D', 'Semester'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabBtn,
                    activeTab === tab && styles.tabBtnActive,
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.chartContainer}>
            <Svg height="80" width="100%" viewBox="0 0 300 80">
              <Path
                d={svgPath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              <Circle cx="300" cy={lastPointY} r="4" fill="#2563EB" />
            </Svg>
            <View style={styles.chartLabels}>
              {trendData.map((pt, i) => (
                <Text key={i} style={styles.chartLabel}>
                  {pt.label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Goal card */}
        <View style={styles.goalCard}>
          <Text style={{fontSize: 18}}>ðŸŽ¯</Text>
          <View style={{flex: 1, marginLeft: 10}}>
            <Text style={styles.goalTitle}>75% Requirement</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                gap: 8,
              }}>
              <Text style={styles.goalCurrent}>
                Current: {overallPercentage}%
              </Text>
              <Text style={{color: '#94A3B8'}}>â†’</Text>
              <Text style={styles.goalTarget}>Target: 75%</Text>
            </View>
            {overallPercentage < 75 && totalHeld > 0 && (
              <Text style={styles.goalMilestone}>
                Next milestone: attend {classesNeededTo75} more classes
              </Text>
            )}
          </View>
        </View>

        {/* Subject-wise */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Subject-wise Attendance</Text>
        </View>
        {subjectStats.length === 0 && (
          <View style={{alignItems: 'center', marginTop: 20}}>
            <Text style={{color: '#64748B', fontWeight: 'bold'}}>
              No subjects found for your profile.
            </Text>
            <Text style={{color: '#94A3B8', fontSize: 12, marginTop: 4}}>
              Check if Course, Year, and Semester match in DB.
            </Text>
          </View>
        )}
        {subjectStats.map(item => (
          <View key={item.subject_id.toString()} style={styles.subjectCard}>
            <View style={styles.cardHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.subjName}>{item.subject_name}</Text>
                <Text style={styles.subjType}>{item.subject_type}</Text>
                <Text style={styles.subjAttended}>
                  {item.attended_count} / {item.total_held} attended
                </Text>
              </View>
              <View
                style={[
                  styles.subjBadge,
                  {
                    backgroundColor:
                      item.total_held === 0
                        ? '#F1F5F9'
                        : item.pct < 75
                        ? '#FEE2E2'
                        : '#DCFCE7',
                  },
                ]}>
                <Text
                  style={[
                    styles.subjBadgeText,
                    {
                      color:
                        item.total_held === 0
                          ? '#64748B'
                          : item.pct < 75
                          ? '#EF4444'
                          : '#16A34A',
                    },
                  ]}>
                  {item.total_held === 0 ? 'N/A' : `${item.pct}%`}
                </Text>
              </View>
            </View>
            <View style={styles.subjBarBg}>
              <View
                style={[
                  styles.subjBarFill,
                  {
                    width: `${item.pct}%`,
                    backgroundColor: item.pct < 75 ? '#EF4444' : '#16A34A',
                  },
                ]}
              />
            </View>
            {renderAttendanceStatus(item.attended_count, item.total_held)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  title: {fontSize: 24, fontWeight: '700', color: '#0F172A'},
  subtitle: {fontSize: 12, color: '#64748B'},
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveDot: {width: 7, height: 7, borderRadius: 4},
  liveChipText: {fontSize: 10, fontWeight: '700', color: '#334155'},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {fontSize: 12, color: '#64748B', fontWeight: '500'},
  pctRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4},
  bigPct: {fontSize: 32, fontWeight: '800', color: '#0F172A'},
  riskBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  riskBadgeText: {fontSize: 10, fontWeight: '700', color: '#EF4444'},
  cardSubText: {fontSize: 12, color: '#64748B', marginTop: 2},
  requiredText: {fontSize: 10, color: '#94A3B8', marginTop: 2},
  gauge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugePct: {fontSize: 12, fontWeight: '700'},
  gaugeSub: {fontSize: 8, color: '#94A3B8'},
  barBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: {height: '100%'},
  warningBanner: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {fontSize: 11, color: '#DC2626'},
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickStat: {alignItems: 'center', flex: 1},
  quickDot: {width: 8, height: 8, borderRadius: 4, marginBottom: 4},
  quickStatVal: {fontSize: 16, fontWeight: '800', color: '#0F172A'},
  quickStatLabel: {fontSize: 10, color: '#64748B'},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: '#0F172A'},
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  tabBtn: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6},
  tabBtnActive: {backgroundColor: '#2563EB'},
  tabText: {fontSize: 10, fontWeight: '600', color: '#64748B'},
  tabTextActive: {color: '#FFF'},
  chartContainer: {
    height: 100,
    width: '100%',
    justifyContent: 'center',
    marginTop: 10,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chartLabel: {fontSize: 10, color: '#94A3B8'},
  goalCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  goalTitle: {fontSize: 12, fontWeight: '700', color: '#1E40AF'},
  goalCurrent: {fontSize: 11, color: '#1E3A8A', fontWeight: '600'},
  goalTarget: {fontSize: 11, color: '#1E3A8A', fontWeight: '700'},
  goalMilestone: {fontSize: 10, color: '#2563EB', marginTop: 6},
  subjectCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjName: {fontSize: 13, fontWeight: '700', color: '#0F172A'},
  subjType: {fontSize: 10, color: '#94A3B8', marginTop: 1},
  subjAttended: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  subjBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8},
  subjBadgeText: {fontSize: 11, fontWeight: '700'},
  subjBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  subjBarFill: {height: '100%'},
  subjWarning: {fontSize: 9, color: '#DC2626', marginTop: 6},
});
