/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import DeviceSimulator from './components/DeviceSimulator';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import LoginPage from './components/LoginPage';
import { CampaignStore } from './utils/store';
import { 
  Smartphone, Sliders, Sun, Moon, Info, ShieldCheck, 
  HelpCircle, AlertTriangle, Coins, Users, Heart, X,
  ArrowRight, ArrowLeft, Lock, Copy, Check, ExternalLink
} from 'lucide-react';

export default function App() {
  // Master Switch: 'login' | 'user' | 'admin'
  const [activePanel, setActivePanel] = useState<'login' | 'user' | 'admin'>(() => {
    CampaignStore.initialize();
    
    const params = new URLSearchParams(window.location.search);
    const panel = params.get('panel');
    if (panel === 'admin') return 'admin';
    if (panel === 'user') return 'user';

    if (CampaignStore.isAdminAuthenticated) return 'admin';
    if (CampaignStore.currentUser) return 'user';
    return 'login';
  });

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [dbStateTrigger, setDbStateTrigger] = useState<number>(0);

  useEffect(() => {
    // If user opens a refer link on this workspace, redirect to the production copy link
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('ref');
    const targetBase = 'https://sitecopy-ai-365634036726.asia-southeast1.run.app';
    if (code && !window.location.hostname.includes('sitecopy-ai-365634036726')) {
      window.location.href = `${targetBase}?code=${code}`;
    }
  }, []);

  useEffect(() => {
    // Initialise simulation Database stores 
    CampaignStore.initialize();
  }, [dbStateTrigger]);

  useEffect(() => {
    // Periodically check if 12 o'clock midnight has passed to reset today's earnings
    const interval = setInterval(() => {
      if (CampaignStore.currentUser) {
        if (CampaignStore.checkAndResetTodayEarnings(CampaignStore.currentUser)) {
          CampaignStore.saveSession();
          handleRefreshWorkspace();
        }
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setThemeMode(t => t === 'light' ? 'dark' : 'light');
  };

  const handleRefreshWorkspace = () => {
    setDbStateTrigger(t => t + 1);
  };

  const handleSwitchPanel = (panel: 'login' | 'user' | 'admin') => {
    setActivePanel(panel);
    const url = new URL(window.location.href);
    if (panel === 'login') {
      url.searchParams.delete('panel');
    } else {
      url.searchParams.set('panel', panel);
    }
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 relative overflow-x-hidden ${
      themeMode === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-slate-50 text-zinc-900'
    }`}>

      {/* --- UNIFIED LOGIN & AUTHENTICATION PORTAL --- */}
      {activePanel === 'login' && (
        <LoginPage 
          theme={themeMode} 
          toggleTheme={toggleTheme}
          onLoginSuccess={(panel) => handleSwitchPanel(panel)} 
        />
      )}

      {/* --- WORKSPACE 1: ISOLATED SIMULATOR EXPERIENCE --- */}
      {activePanel === 'user' && (
        <div className="flex-1 flex flex-col h-dvh sm:h-auto sm:min-h-screen relative bg-slate-100 dark:bg-zinc-950 overflow-hidden">
          <main className="flex-1 flex items-center justify-center w-full h-full relative overflow-hidden">
            <DeviceSimulator theme={themeMode}>
              <UserPanel 
                theme={themeMode} 
                refreshAdminDb={handleRefreshWorkspace} 
                onLogout={() => handleSwitchPanel('login')}
              />
            </DeviceSimulator>
          </main>
        </div>
      )}

      {/* --- WORKSPACE 2: ISOLATED ADMIN CONTROL CENTRE --- */}
      {activePanel === 'admin' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <main className="flex-1 flex flex-col animate-fade-in relative">
            <AdminPanel 
              theme={themeMode} 
              triggerRefresh={handleRefreshWorkspace} 
              onLogout={() => handleSwitchPanel('login')}
            />
          </main>
        </div>
      )}

    </div>
  );
}
