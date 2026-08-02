import { Platform } from 'react-native';
import { create } from 'zustand';

// MMKV is not supported on web — use in-memory fallback
let storage: {
  getBoolean: (key: string) => boolean | undefined;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  set: (key: string, value: boolean | string | number) => void;
};

if (Platform.OS !== 'web') {
  // Dynamic require to avoid web bundling errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV();
} else {
  // In-memory fallback for web
  const memStore: Record<string, boolean | string | number> = {};
  storage = {
    getBoolean: (key) => memStore[key] as boolean | undefined,
    getString: (key) => memStore[key] as string | undefined,
    getNumber: (key) => memStore[key] as number | undefined,
    set: (key, value) => { memStore[key] = value; },
  };
}

export { storage };

interface SettingsState {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  defaultQuality: string;
  setDefaultQuality: (value: string) => void;
  concurrentDownloads: number;
  setConcurrentDownloads: (value: number) => void;
  theme: 'system' | 'light' | 'dark';
  setTheme: (value: 'system' | 'light' | 'dark') => void;
}

export const useSettings = create<SettingsState>((set) => ({
  hasSeenOnboarding: storage.getBoolean('hasSeenOnboarding') ?? false,
  setHasSeenOnboarding: (value: boolean) => {
    storage.set('hasSeenOnboarding', value);
    set({ hasSeenOnboarding: value });
  },
  defaultQuality: storage.getString('defaultQuality') ?? 'bestvideo+bestaudio/best',
  setDefaultQuality: (value: string) => {
    storage.set('defaultQuality', value);
    set({ defaultQuality: value });
  },
  concurrentDownloads: storage.getNumber('concurrentDownloads') ?? 2,
  setConcurrentDownloads: (value: number) => {
    storage.set('concurrentDownloads', value);
    set({ concurrentDownloads: value });
  },
  theme: (storage.getString('theme') as 'system' | 'light' | 'dark') ?? 'dark',
  setTheme: (value: 'system' | 'light' | 'dark') => {
    storage.set('theme', value);
    set({ theme: value });
  },
}));
