import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {supabase} from './lib/supabase';

// ---- Types ----
type Bucket = {
  label: string;
  min: number;
  max: number;
  count: number;
  color: string;
};

const BUCKET_DEFS: Omit<Bucket, 'count'>[] = [
  {label: '90-100%', min: 90, max: 101, color: '#16A34A'},
  {label: '75-89%', min: 75, max: 90, color: '#2563EB'},
  {label: '60-74%', min: 60, max: 75, color: '#F59E0B'},
  {label: '<60%', min: 0, max: 60, color: '#EF4444'},
];

const TREND_WINDOWS: Record<string, number> = {
  '7D': 7,
  '30D': 30,
  Semester: 120,
};

export default function TeacherAnalytics({teacher}: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTrendTab, setActiveTrendTab] = useState<
    '7D' | '30D' | 'Semester'
  >('30D');
  const [isLive, setIsLive] = useState(false);

  // Metrics
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [avgAttendanceDelta, setAvgAttendanceDelta] = useState<number | null>(
    null,
  );
  const [absenteesToday, setAbsenteesToday] = useState(0);
  const [conductedSessions, setConductedSessions] = useState('0 / 0');

  // Lists
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [trendPoints, setTrendPoints] = useState<
    {label: string; pct: number}[]
  >([]);
  const [distribution, setDistribution] = useState<Bucket[]>([]);
  const [keyInsight, setKeyInsight] = useState(
    'Collect more attendance to unlock insights.',
  );
  const [bestSession, setBestSession] = useState<{
    day: string;
    pct: number;
  } | null>(null);
  const [worstSession, setWorstSession] = useState<{
    day: string;
    pct: number;
  } | null>(null);
  const [rawData, setRawData] = useState<{
    sessions: any[];
    attendance: any[];
    sessionRosterMap: Map<number, string[]>;
  } | null>(null);

  const sessionIdsRef = useRef<number[]>([]);
  const teacherIdRef = useRef<string | null>(null);

  const buildDistribution = (studentMap: Record<string, any>) => {
    const buckets: Bucket[] = BUCKET_DEFS.map(b => ({...b, count: 0}));
    Object.values(studentMap).forEach((st: any) => {
      const pct = st.total > 0 ? Math.round((st.present / st.total) * 100) : 0;
      const bucket =
        buckets.find(b => pct >= b.min && pct < b.max) ||
        buckets[buckets.length - 1];
      bucket.count += 1;
    });
    setDistribution(buckets);
  };

  const buildTrend = (
    sessionRosterMap: Map<number, string[]>,
    sessById: Map<number, any>,
    presentSet: Set<string>,
    windowKey: string,
  ) => {
    const days = TREND_WINDOWS[windowKey] ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const sessionStats: {present: number; total: number; date: Date}[] = [];
    sessionRosterMap.forEach((roster, sessId) => {
      const sess = sessById.get(sessId);
      if (!sess || roster.length === 0) return;
      const d = new Date(sess.created_at);
      if (d < cutoff) return;
      const present = roster.filter(sid =>
        presentSet.has(`${sessId}:${sid}`),
      ).length;
      sessionStats.push({present, total: roster.length, date: d});
    });

    const points = sessionStats
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(s => ({
        label: s.date.toLocaleDateString([], {month: 'short', day: 'numeric'}),
        pct: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      }));

    setTrendPoints(points.length > 0 ? points : [{label: 'No data', pct: 0}]);
  };

  const computeAll = (
    sessions: any[],
    attendance: any[],
    sessionRosterMap: Map<number, string[]>,
  ) => {
    const totalRosterSlots = Array.from(sessionRosterMap.values()).reduce(
      (sum, r) => sum + r.length,
      0,
    );
    if (totalRosterSlots === 0) {
      setAvgAttendance(0);
      setAtRiskStudents([]);
      setSubjectsList([]);
      setDistribution([]);
      setTrendPoints([]);
      return;
    }

    // present lookup: `${session_id}:${student_id}` -> true
    const presentSet = new Set(
      attendance
        .filter(a => a.status === 'present')
        .map(a => `${a.session_id}:${a.student_id}`),
    );
    const nameBySid = new Map<string, string>();
    attendance.forEach(a => {
      const profileObj = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      if (profileObj?.name) nameBySid.set(a.student_id, profileObj.name);
    });

    let totalPresentSlots = 0;
    sessionRosterMap.forEach((roster, sessId) => {
      roster.forEach(sid => {
        if (presentSet.has(`${sessId}:${sid}`)) totalPresentSlots++;
      });
    });
    setAvgAttendance(Math.round((totalPresentSlots / totalRosterSlots) * 100));

    // Period-over-period delta: last 28 days vs the 28 days before that (roster-based)
    const now = new Date();
    const cur28 = new Date();
    cur28.setDate(now.getDate() - 28);
    const prev56 = new Date();
    prev56.setDate(now.getDate() - 56);
    const sessById = new Map(sessions.map((s: any) => [s.id, s]));

    const periodPct = (start: Date, end: Date) => {
      let slots = 0,
        present = 0;
      sessionRosterMap.forEach((roster, sessId) => {
        const sess = sessById.get(sessId);
        if (!sess) return;
        const d = new Date(sess.created_at);
        if (d < start || d >= end) return;
        roster.forEach(sid => {
          slots++;
          if (presentSet.has(`${sessId}:${sid}`)) present++;
        });
      });
      return slots > 0 ? (present / slots) * 100 : null;
    };
    const curPct = periodPct(cur28, now);
    const prevPct = periodPct(prev56, cur28);
    setAvgAttendanceDelta(
      curPct !== null && prevPct !== null ? Math.round(curPct - prevPct) : null,
    );

    // Today's absentees (roster-based: anyone on today's session roster without a present row)
    const todayStr = new Date().toISOString().split('T')[0];
    let absentToday = 0;
    sessionRosterMap.forEach((roster, sessId) => {
      const sess = sessById.get(sessId);
      if (!sess?.created_at?.startsWith(todayStr)) return;
      roster.forEach(sid => {
        if (!presentSet.has(`${sessId}:${sid}`)) absentToday++;
      });
    });
    setAbsenteesToday(absentToday);

    // Per-student, and per-student-per-subject aggregation (roster-based)
    const studentMap: Record<string, any> = {};
    const studentSubjectMap: Record<
      string,
      Record<string, {name: string; present: number; total: number}>
    > = {};

    sessionRosterMap.forEach((roster, sessId) => {
      const sess = sessById.get(sessId);
      if (!sess) return;
      const subjObj = Array.isArray(sess.subjects)
        ? sess.subjects[0]
        : sess.subjects;
      roster.forEach(sid => {
        const wasPresent = presentSet.has(`${sessId}:${sid}`);
        const name = nameBySid.get(sid) || 'Student';
        if (!studentMap[sid]) studentMap[sid] = {name, total: 0, present: 0};
        studentMap[sid].total += 1;
        if (wasPresent) studentMap[sid].present += 1;

        if (subjObj) {
          if (!studentSubjectMap[sid]) studentSubjectMap[sid] = {};
          if (!studentSubjectMap[sid][subjObj.id])
            studentSubjectMap[sid][subjObj.id] = {
              name: subjObj.name,
              present: 0,
              total: 0,
            };
          studentSubjectMap[sid][subjObj.id].total += 1;
          if (wasPresent) studentSubjectMap[sid][subjObj.id].present += 1;
        }
      });
    });

    // Names: roster students who never marked present won't appear in `attendance`,
    // so nameBySid may be missing them â€” fall back to a short id if profile name unknown.
    const riskList = Object.entries(studentMap)
      .map(([sId, st]: [string, any]) => {
        const pct = Math.round((st.present / st.total) * 100);
        const riskySubjects = Object.values(studentSubjectMap[sId] || {})
          .filter(
            (sub: any) =>
              sub.total > 0 && Math.round((sub.present / sub.total) * 100) < 75,
          )
          .map((sub: any) => sub.name);
        return {
          name: st.name === 'Student' ? `Student ${sId.slice(0, 6)}` : st.name,
          pct,
          count: `${st.present} / ${st.total}`,
          missing: st.total - st.present,
          initials:
            st.name === 'Student'
              ? '??'
              : st.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase(),
          riskSubjects: riskySubjects.join(', ') || 'â€”',
        };
      })
      .filter(st => st.pct < 75)
      .sort((a, b) => a.pct - b.pct);

    setAtRiskStudents(riskList);
    setTotalStudents(Object.keys(studentMap).length);
    buildDistribution(studentMap);

    // Best & worst session (roster-based %)
    const sessionStats: Record<string, any> = {};
    sessionRosterMap.forEach((roster, sessId) => {
      const sess = sessById.get(sessId);
      if (!sess || roster.length === 0) return;
      const present = roster.filter(sid =>
        presentSet.has(`${sessId}:${sid}`),
      ).length;
      sessionStats[sessId] = {
        present,
        total: roster.length,
        date: new Date(sess.created_at).toLocaleDateString([], {
          weekday: 'short',
          hour: '2-digit',
        }),
      };
    });
    const sessList = Object.values(sessionStats).map((s: any) => ({
      day: s.date,
      pct: Math.round((s.present / s.total) * 100),
    }));
    if (sessList.length > 0) {
      sessList.sort((a: any, b: any) => b.pct - a.pct);
      setBestSession(sessList[0]);
      setWorstSession(sessList[sessList.length - 1]);
    }

    // Subject-wise (roster-based)
    const subjStatsMap: Record<string, any> = {};
    sessionRosterMap.forEach((roster, sessId) => {
      const sess = sessById.get(sessId);
      if (!sess) return;
      const subjObj = Array.isArray(sess.subjects)
        ? sess.subjects[0]
        : sess.subjects;
      if (!subjObj) return;
      if (!subjStatsMap[subjObj.id])
        subjStatsMap[subjObj.id] = {
          name: subjObj.name,
          totalLogs: 0,
          presentLogs: 0,
        };
      subjStatsMap[subjObj.id].totalLogs += roster.length;
      subjStatsMap[subjObj.id].presentLogs += roster.filter(sid =>
        presentSet.has(`${sessId}:${sid}`),
      ).length;
    });
    const colors = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
    const finalSubjects = Object.values(subjStatsMap)
      .map((st: any, idx) => {
        const pctVal =
          st.totalLogs > 0
            ? Math.round((st.presentLogs / st.totalLogs) * 100)
            : 0;
        return {
          name: st.name,
          pct: pctVal,
          count: `${st.presentLogs} / ${st.totalLogs}`,
          status: pctVal >= 75 ? 'On Track' : 'At Risk',
          color: colors[idx % colors.length],
        };
      })
      .filter((s: any) => s.count !== '0 / 0');
    setSubjectsList(finalSubjects);
    if (finalSubjects.length > 0) {
      const lowest = [...finalSubjects].sort(
        (a: any, b: any) => a.pct - b.pct,
      )[0];
      setKeyInsight(
        lowest.pct < 75
          ? `${lowest.name} is trailing at ${lowest.pct}% â€” lowest among your subjects.`
          : `${finalSubjects[0].name} has an overall attendance of ${finalSubjects[0].pct}%.`,
      );
    }

    buildTrend(sessionRosterMap, sessById, presentSet, activeTrendTab);
  };

  const fetchFullAnalytics = useCallback(async () => {
    try {
      const teacherId = teacher?.id;
      if (!teacherId) return;
      teacherIdRef.current = teacherId;

      const {data: sessions} = await supabase
        .from('sessions')
        .select(
          'id, subject_id, created_at, closed_at, target_batch, subjects(id, name, code, target_course, target_year, target_semester)',
        )
        .eq('teacher_id', teacherId)
        .order('created_at', {ascending: false});

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      setConductedSessions(
        `${sessions.filter(s => s.closed_at !== null).length} / ${
          sessions.length
        }`,
      );
      const sessionIds = sessions.map(s => s.id);
      sessionIdsRef.current = sessionIds;

      // Roster: fetch the full cohort roster once per unique (course, year, semester)
      // combo the teacher's subjects target, then filter per-session by target_batch.
      // Without this, "total" for a session collapses to "students who happened to mark",
      // which is always 100% since a missed session never produces a row at all.
      const cohortKey = (c: string, y: string, s: string) => `${c}|${y}|${s}`;
      const uniqueCohorts = new Map<
        string,
        {course: string; year: string; semester: string}
      >();
      sessions.forEach((s: any) => {
        const subj = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects;
        if (!subj) return;
        const key = cohortKey(
          subj.target_course,
          subj.target_year,
          subj.target_semester,
        );
        if (!uniqueCohorts.has(key)) {
          uniqueCohorts.set(key, {
            course: subj.target_course,
            year: subj.target_year,
            semester: subj.target_semester,
          });
        }
      });

      const cohortRosters = new Map<string, any[]>(); // key -> [{id, batch}]
      await Promise.all(
        Array.from(uniqueCohorts.entries()).map(async ([key, c]) => {
          const {data: roster} = await supabase
            .from('profiles')
            .select('id, batch')
            .eq('role', 'student')
            .eq('course', c.course)
            .eq('year', c.year)
            .eq('semester', c.semester);
          cohortRosters.set(key, roster || []);
        }),
      );

      // Per-session roster (list of student ids expected for that specific session)
      const sessionRosterMap = new Map<number, string[]>();
      sessions.forEach((s: any) => {
        const subj = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects;
        if (!subj) return;
        const key = cohortKey(
          subj.target_course,
          subj.target_year,
          subj.target_semester,
        );
        const fullRoster = cohortRosters.get(key) || [];
        const filtered =
          s.target_batch === 'ALL'
            ? fullRoster
            : fullRoster.filter((r: any) => r.batch === s.target_batch);
        sessionRosterMap.set(
          s.id,
          filtered.map((r: any) => r.id),
        );
      });

      const {data: attendance} = await supabase
        .from('attendance')
        .select('status, student_id, session_id, profiles(name), sessions!inner(teacher_id)')
        .eq('sessions.teacher_id', teacherId);

      setRawData({sessions, attendance: attendance || [], sessionRosterMap});
      computeAll(sessions, attendance || [], sessionRosterMap);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacher]);

  // Initial + trend-tab-change fetch
  useEffect(() => {
    fetchFullAnalytics();
  }, [teacher]);

  useEffect(() => {
    // re-bucket trend only, no full refetch needed if we cache â€” keep simple: light refetch
    if (rawData) {
      computeAll(
        rawData.sessions,
        rawData.attendance,
        rawData.sessionRosterMap,
      );
    }
  }, [activeTrendTab]);

  // Realtime: live tier. Only meaningfully "live" while at least one session today is open.
  // Subscribes to attendance inserts/updates across this teacher's known session ids and
  // patches state incrementally instead of a full refetch, so it stays cheap during a live class.
  useEffect(() => {
    const teacherId = teacher?.id;
    if (!teacherId) return;

    const channel = supabase
      .channel(`teacher-analytics-${teacherId}`)
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'attendance'},
        payload => {
          const row: any = payload.new || payload.old;
          if (!row || !sessionIdsRef.current.includes(row.session_id)) return;
          // A relevant attendance row changed â€” do a lightweight full refetch.
          // (Full server-side aggregation via RPC would let us avoid this refetch entirely.)
          fetchFullAnalytics();
        },
      )
      .subscribe(status => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacher, fetchFullAnalytics]);

  const generatePath = (pts: {pct: number}[]) => {
    if (pts.length === 0) return 'M0 70 L300 70';
    if (pts.length === 1)
      return `M0 ${80 - (pts[0].pct / 100) * 60} L300 ${
        80 - (pts[0].pct / 100) * 60
      }`;
    const step = 300 / (pts.length - 1);
    return pts
      .map(
        (pt, i) =>
          `${i === 0 ? 'M' : 'L'}${Math.round(i * step)} ${Math.round(
            80 - (pt.pct / 100) * 60,
          )}`,
      )
      .join(' ');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{marginTop: 10, color: '#64748B'}}>
          Crunching live data...
        </Text>
      </View>
    );
  }

  const maxDistCount = Math.max(1, ...distribution.map(b => b.count));

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#F8FAFC'}}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchFullAnalytics();
            }}
            colors={['#2563EB']}
          />
        }>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Analytics</Text>
            <Text style={styles.subtitle}>
              Track class performance dynamically.
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

        <View style={styles.grid2x2}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Students</Text>
            <Text style={styles.metricValue}>{totalStudents}</Text>
            <Text style={styles.metricSub}>Recorded entries</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Average Attendance</Text>
            <Text style={styles.metricValue}>{avgAttendance}%</Text>
            {avgAttendanceDelta !== null ? (
              <Text
                style={[
                  styles.metricSub,
                  {
                    color: avgAttendanceDelta >= 0 ? '#16A34A' : '#EF4444',
                    fontWeight: '700',
                  },
                ]}>
                {avgAttendanceDelta >= 0 ? 'â–²' : 'â–¼'}{' '}
                {Math.abs(avgAttendanceDelta)}% vs last 4 weeks
              </Text>
            ) : (
              <Text style={styles.metricSub}>Live Calculation</Text>
            )}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Absentees (Today)</Text>
            <Text style={styles.metricValue}>{absenteesToday}</Text>
            <Text style={[styles.metricSub, {color: '#EF4444'}]}>
              Missing today
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Sessions Conducted</Text>
            <Text style={styles.metricValue}>{conductedSessions}</Text>
            <Text style={styles.metricSub}>Closed / Total</Text>
          </View>
        </View>

        {subjectsList.length === 0 && (
          <Text
            style={{
              textAlign: 'center',
              color: '#64748B',
              marginTop: 10,
              marginBottom: 20,
            }}>
            No attendance data recorded yet.
          </Text>
        )}

        {subjectsList.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Class-wise Attendance</Text>
            {subjectsList.map((s, idx) => (
              <View key={idx} style={{marginBottom: 12}}>
                <View style={styles.flexRowBetween}>
                  <Text style={styles.subjectName}>{s.name}</Text>
                  <Text style={styles.subjectVal}>
                    {s.pct}% <Text style={styles.lightText}>({s.count})</Text>
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {width: `${s.pct}%`, backgroundColor: s.color},
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.flexRowBetween}>
            <Text style={styles.cardTitle}>Attendance Trend</Text>
            <View style={styles.tabGroup}>
              {(['7D', '30D', 'Semester'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTrendTab(tab)}
                  style={[
                    styles.tabBtn,
                    activeTrendTab === tab && styles.tabBtnActive,
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      activeTrendTab === tab && styles.tabTextActive,
                    ]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{height: 100, marginTop: 12}}>
            <Svg height="100%" width="100%" viewBox="0 0 300 80">
              <Path
                d={generatePath(trendPoints)}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              <Circle
                cx="300"
                cy={
                  trendPoints.length > 0
                    ? 80 - (trendPoints[trendPoints.length - 1].pct / 100) * 60
                    : 20
                }
                r="4"
                fill="#2563EB"
              />
            </Svg>
          </View>
        </View>

        {distribution.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Distribution</Text>
            {distribution.map((b, i) => (
              <View key={i} style={{marginBottom: 10}}>
                <View style={styles.flexRowBetween}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: b.color,
                      }}
                    />
                    <Text style={styles.subjectName}>{b.label}</Text>
                  </View>
                  <Text style={styles.subjectVal}>{b.count} students</Text>
                </View>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(b.count / maxDistCount) * 100}%`,
                        backgroundColor: b.color,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.insightCard}>
          <Text style={{fontSize: 18}}>ðŸ’¡</Text>
          <View style={{flex: 1, marginLeft: 8}}>
            <Text style={styles.insightTitle}>Key Insight</Text>
            <Text style={styles.insightText}>{keyInsight}</Text>
          </View>
        </View>

        {bestSession && worstSession && (
          <View style={styles.grid2x2}>
            <View style={[styles.metricCard, {backgroundColor: '#F0FDF4'}]}>
              <Text style={[styles.metricLabel, {color: '#166534'}]}>
                Highest Session
              </Text>
              <Text
                style={[styles.metricValue, {fontSize: 16, color: '#15803D'}]}>
                {bestSession.day}
              </Text>
              <Text style={{fontSize: 12, fontWeight: '700', color: '#16A34A'}}>
                {bestSession.pct}%
              </Text>
            </View>
            <View style={[styles.metricCard, {backgroundColor: '#FEF2F2'}]}>
              <Text style={[styles.metricLabel, {color: '#991B1B'}]}>
                Lowest Session
              </Text>
              <Text
                style={[styles.metricValue, {fontSize: 16, color: '#B91C1C'}]}>
                {worstSession.day}
              </Text>
              <Text style={{fontSize: 12, fontWeight: '700', color: '#DC2626'}}>
                {worstSession.pct}%
              </Text>
            </View>
          </View>
        )}

        {atRiskStudents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Students at Risk{' '}
              <Text style={styles.badgeCount}>
                {atRiskStudents.length} students
              </Text>
            </Text>
            {atRiskStudents.map((st, i) => (
              <View key={i} style={styles.studentRow}>
                <View style={styles.stAvatar}>
                  <Text style={styles.stAvatarText}>{st.initials}</Text>
                </View>
                <View style={{flex: 1, marginLeft: 8}}>
                  <Text style={styles.stName}>{st.name}</Text>
                  <Text style={styles.stSub}>
                    {st.count} ({st.pct}%) â€¢ Missing {st.missing}
                  </Text>
                  <Text
                    style={[styles.stSub, {color: '#EF4444', marginTop: 2}]}>
                    At risk in: {st.riskSubjects}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  container: {padding: 16, paddingBottom: 120},
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {fontSize: 22, fontWeight: '800', color: '#0F172A'},
  subtitle: {fontSize: 11, color: '#64748B'},
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
  grid2x2: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  metricCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {fontSize: 11, color: '#64748B'},
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  metricSub: {fontSize: 9, color: '#64748B'},
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  flexRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectName: {fontSize: 11, fontWeight: '600', color: '#334155'},
  subjectVal: {fontSize: 11, fontWeight: '700', color: '#0F172A'},
  lightText: {color: '#94A3B8', fontWeight: '400'},
  progressBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginTop: 4,
  },
  progressFill: {height: '100%', borderRadius: 3},
  insightCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  insightTitle: {fontSize: 11, fontWeight: '700', color: '#1E40AF'},
  insightText: {fontSize: 10, color: '#1E3A8A'},
  badgeCount: {
    fontSize: 10,
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stAvatarText: {fontSize: 10, fontWeight: '700', color: '#475569'},
  stName: {fontSize: 11, fontWeight: '600', color: '#0F172A'},
  stSub: {fontSize: 9, color: '#64748B'},
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
});
