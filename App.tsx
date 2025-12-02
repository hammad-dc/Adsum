import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';

// --- IMPORT ALL SCREENS ---
import Auth from './src/Auth';
import StudentDashboard from './src/StudentDashboard';
import TeacherDashboard from './src/TeacherDashboard';
import StartSession from './src/StartSession';
import MarkAttendance from './src/MarkAttendance';
import AddNewClass from './src/AddNewClass';
import AttendanceHistory from './src/AttendanceHistory';
import Profile from './src/Profile';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Navigation State
  // options: 'dashboard', 'add-class', 'start-session', 'mark-attendance', 'history', 'profile'
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedData, setSelectedData] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // 1. If not logged in -> Show Login
  if (!session) {
    return <Auth />;
  }

  // 2. Determine Role
  const isTeacher = session.user.email?.toLowerCase().includes('teacher');

  // helper to go back home
  const goHome = () => {
    setCurrentScreen('dashboard');
    setSelectedData(null);
  };

  // -------------------------------------------
  // TEACHER FLOW
  // -------------------------------------------
  if (isTeacher) {
    // Screen: Create New Class
    if (currentScreen === 'add-class') {
      return (
        <AddNewClass
          onBack={goHome}
          onClassCreated={(newClass: any) => {
            console.log('New Class Created:', newClass);
            // In real app, we would refresh the dashboard list here
            goHome();
          }}
        />
      );
    }

    // Screen: Start Active Session
    if (currentScreen === 'start-session' && selectedData) {
      return <StartSession classSession={selectedData} onBack={goHome} />;
    }

    // Screen: Profile (Shared)
    if (currentScreen === 'profile') {
      return <Profile session={session} onBack={goHome} />;
    }

    // Default: Teacher Dashboard
    return (
      <TeacherDashboard
        teacher={{
          name: session.user.email?.split('@')[0],
          teacherId: 'T-100',
          profilePic:
            'https://api.dicebear.com/9.x/avataaars/png?seed=' +
            session.user.email,
        }}
        onNavigate={(screen: string) => setCurrentScreen(screen)}
        onSelectClass={(classData: any) => {
          setSelectedData(classData);
          setCurrentScreen('start-session');
        }}
      />
    );
  }

  // -------------------------------------------
  // STUDENT FLOW
  // -------------------------------------------

  // Screen: Mark Attendance
  if (currentScreen === 'mark-attendance' && selectedData) {
    return (
      <MarkAttendance
        classSession={selectedData}
        onBack={goHome}
        onSuccess={goHome}
      />
    );
  }

  // Screen: Attendance History
  if (currentScreen === 'history') {
    return <AttendanceHistory studentId={session.user.id} onBack={goHome} />;
  }

  // Screen: Profile (Shared)
  if (currentScreen === 'profile') {
    return <Profile session={session} onBack={goHome} />;
  }

  // Default: Student Dashboard
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
