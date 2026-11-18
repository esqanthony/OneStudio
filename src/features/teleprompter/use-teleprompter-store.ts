import { create } from 'zustand';

import { documentsDir, readJson, writeJson } from '@/lib/json-file';
import { newId } from '@/lib/id';
import { File } from 'expo-file-system';

import { DEFAULT_SETTINGS, type Script, type TeleprompterSettings } from './types';

const scriptsFile = () => new File(documentsDir('teleprompter'), 'scripts.json');
const settingsFile = () => new File(documentsDir('teleprompter'), 'settings.json');

type TeleprompterStore = {
  loaded: boolean;
  scripts: Script[];
  settings: TeleprompterSettings;
  load: () => void;
  createScript: (body?: string) => Script;
  updateScript: (id: string, change: Partial<Pick<Script, 'title' | 'body'>>) => void;
  deleteScript: (id: string) => void;
  updateSettings: (change: Partial<TeleprompterSettings>) => void;
};

export const useTeleprompterStore = create<TeleprompterStore>((set, get) => ({
  loaded: false,
  scripts: [],
  settings: DEFAULT_SETTINGS,

  load: () => {
    if (get().loaded) return;
    set({
      loaded: true,
      scripts: readJson<Script[]>(scriptsFile(), []),
      settings: { ...DEFAULT_SETTINGS, ...readJson<Partial<TeleprompterSettings>>(settingsFile(), {}) },
    });
  },

  createScript: (body = '') => {
    const firstLine = body.trim().split('\n')[0]?.slice(0, 40);
    const script: Script = { id: newId(), title: firstLine || 'Untitled script', body, updatedAt: Date.now() };
    const scripts = [script, ...get().scripts];
    writeJson(scriptsFile(), scripts);
    set({ scripts });
    return script;
  },

  updateScript: (id, change) => {
    const scripts = get().scripts.map((s) => (s.id === id ? { ...s, ...change, updatedAt: Date.now() } : s));
    writeJson(scriptsFile(), scripts);
    set({ scripts });
  },

  deleteScript: (id) => {
    const scripts = get().scripts.filter((s) => s.id !== id);
    writeJson(scriptsFile(), scripts);
    set({ scripts });
  },

  updateSettings: (change) => {
    const settings = { ...get().settings, ...change };
    writeJson(settingsFile(), settings);
    set({ settings });
  },
}));
