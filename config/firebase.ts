import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyCXX8I21MDAN2bFbJ0jcTcagjpL8cxrq2g',
  authDomain: 'cloud---homolog.firebaseapp.com',
  projectId: 'cloud---homolog',
  storageBucket: 'cloud---homolog.firebasestorage.app',
  messagingSenderId: '807635388333',
  appId: '1:807635388333:web:c200dab7ab043b50780324',
  measurementId: 'G-2C5HN7VYD5',
};

const app = initializeApp(firebaseConfig);

function getAuthInstance() {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw e;
  }
}

export const auth = getAuthInstance();
