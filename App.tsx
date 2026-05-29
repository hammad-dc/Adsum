import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {Session} from '@supabase/supabase-js';
import {supabase} from './src/lib/supabase';

import Auth from './src/Auth';
import StudentDashboard from './src/StudentDashboard';
import TeacherDashboard from './src/TeacherDashboard';
import StartSession from './src/StartSession';
import MarkAttendance from './src/MarkAttendance';
import AddNewClass from './src/AddNewClass';
import AttendanceHistory from './src/AttendanceHistory';
import Profile from './src/Profile';
import ManualOverride from './src/ManualOverride';
import AcademicReports from './src/AcademicReport';
import {SafeAreaProvider} from 'react-native-safe-area-context';

function MainApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [dashboardTab, setDashboardTab] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({data: {session}}) => {
      checkUserRole(session);
    });

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserRole(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // NEW: Fetch Real Role from DB
  const checkUserRole = async (session: Session | null) => {
    if (!session) {
      setSession(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setUserRole(data.role);
      } else {
        setUserRole('student');
      }
      // if (data) setUserRole(data.role);
      // else setUserRole('student'); // Default fallback

      setSession(session);
    } catch (e) {
      console.error('Role fetch error:', e);
    } finally {
      setLoading(false);
      setCurrentScreen('dashboard'); // Reset nav
      setSelectedData(null);
    }
  };

  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );

  if (!session) return <Auth />;

  // helper to go back home
  const goHome = () => {
    setCurrentScreen('dashboard');
    setSelectedData(null);
  };

  // --- TEACHER FLOW ---
  if (userRole === 'teacher') {
    const handleReportBack = (targetTab: string = 'dashboard') => {
      setDashboardTab(targetTab); // 🎯 Sets the state for the dashboard
      setCurrentScreen(null); // Swaps back to TeacherDashboard
    };

    if (currentScreen === 'academic-reports') {
      return (
        <AcademicReports
          teacherId={session.user.id}
          onBack={handleReportBack}
        />
      );
    }
    if (currentScreen === 'add-class')
      return (
        <AddNewClass
          onBack={goHome}
          onClassCreated={() => {
            // You might need a ref or a shared state to trigger fetchClasses here
            goHome();
          }}
          params={selectedData} // ✅ FIX: Pass the subject data here
        />
      );

    if (currentScreen === 'start-session' && selectedData) {
      return <StartSession classSession={selectedData} onBack={goHome} />;
    }

    if (currentScreen === 'profile')
      return <Profile session={session} role="Faculty" onBack={goHome} />;

    return (
      <TeacherDashboard
        initialTab={dashboardTab}
        teacher={{
          id: session.user.id, // ✅ CRITICAL: Add this line!
          name: session.user.user_metadata?.name || 'Faculty Member',
          email: session.user.email,
        }}
        onNavigate={(screen: string, data: any) => {
          if (data) setSelectedData(data); // 🎯 This saves the subject info
          setCurrentScreen(screen);
        }}
        onSelectClass={(data: any) => {
          setSelectedData(data);
          setCurrentScreen('start-session');
        }}
      />
    );
  }

  // --- STUDENT FLOW ---
  if (currentScreen === 'mark-attendance' && selectedData) {
    return (
      <MarkAttendance
        classSession={selectedData}
        onBack={goHome}
        onSuccess={goHome}
      />
    );
  }
  if (currentScreen === 'history') return <AttendanceHistory onBack={goHome} />;
  if (currentScreen === 'profile')
    return <Profile session={session} role="Student" onBack={goHome} />;

  return (
    <StudentDashboard
      session={session}
      onNavigate={(screen: string, data: any) => {
        if (data) setSelectedData(data);
        setCurrentScreen(screen);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

// 🎯 This is your new Root Component
export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
