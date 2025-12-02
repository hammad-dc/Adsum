import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvxqrroiiuyxtygvlvib.supabase.co'; // Paste URL here
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eHFycm9paXV5eHR5Z3ZsdmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTg1NTIsImV4cCI6MjA4MDE3NDU1Mn0.xbHWlDj1ZcHbtPduH0CEmNrHLrz9DSTWz3koF2Lj52c'; // Paste Key here

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Tells Supabase to stop using resources when app is in background
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});