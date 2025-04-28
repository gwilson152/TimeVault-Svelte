import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  current: 'dark' | 'light'; // The actual theme being applied (resolved from mode)
}

// Helper to get system preference
function getSystemPreference(): 'dark' | 'light' {
  if (!browser) return 'dark'; // Default to dark for SSR
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Initialize theme from localStorage or default to system
function getInitialTheme(): ThemeState {
  if (!browser) {
    return { mode: 'system', current: 'dark' };
  }
  
  const savedMode = localStorage.getItem('theme-mode') as ThemeMode || 'system';
  const current = savedMode === 'system' ? getSystemPreference() : savedMode;
  
  return { mode: savedMode, current };
}

function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeState>(getInitialTheme());

  return {
    subscribe,
    
    setMode: (mode: ThemeMode) => {
      if (!browser) return;
      
      const current = mode === 'system' ? getSystemPreference() : mode;
      localStorage.setItem('theme-mode', mode);
      
      update(state => ({ mode, current }));
      
      // Apply the theme to document
      document.documentElement.classList.remove('theme-dark', 'theme-light');
      document.documentElement.classList.add(`theme-${current}`);
    },
    
    toggle: () => {
      update(state => {
        const newMode = state.current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme-mode', newMode);
        
        // Apply the theme to document
        document.documentElement.classList.remove('theme-dark', 'theme-light');
        document.documentElement.classList.add(`theme-${newMode}`);
        
        return { mode: newMode, current: newMode };
      });
    },
    
    initialize: () => {
      if (!browser) return;
      
      // Set up listener for system preference changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        update(state => {
          if (state.mode !== 'system') return state;
          
          const newCurrent = getSystemPreference();
          document.documentElement.classList.remove('theme-dark', 'theme-light');
          document.documentElement.classList.add(`theme-${newCurrent}`);
          
          return { ...state, current: newCurrent };
        });
      };
      
      mediaQuery.addEventListener('change', handleChange);
      
      // Apply initial theme
      update(state => {
        document.documentElement.classList.add(`theme-${state.current}`);
        return state;
      });
    }
  };
}

export const themeStore = createThemeStore();