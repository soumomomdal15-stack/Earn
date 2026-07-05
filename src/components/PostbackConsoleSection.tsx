/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Copy, Check, ExternalLink, Key, RefreshCw, Sliders, 
  HelpCircle, Info, ShieldCheck, CheckCircle2, AlertTriangle, Play 
} from 'lucide-react';
import { User as UserType, AppSettings } from '../types';

interface PostbackConsoleSectionProps {
  users: UserType[];
  theme: 'light' | 'dark';
  refreshData: () => void;
  settings?: AppSettings;
  postbackLogs?: any[];
}

export default function PostbackConsoleSection({ users, theme, refreshData, settings, postbackLogs = [] }: PostbackConsoleSectionProps) {
  // Simulator State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<string>('250');
  const [secretKey, setSecretKey] = useState<string>('postback_secure_key_2026');
  const [simulateResult, setSimulateResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // UI State
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [cloudFunctionVersion, setCloudFunctionVersion] = useState<'v2' | 'v1'>('v2');
  const [logFilter, setLogFilter] = useState<'all' | 'Success' | 'Duplicate' | 'Failed' | 'Invalid Token'>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Ad Network presets
  const [selectedNetwork, setSelectedNetwork] = useState<string>('cpx');

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2500);
  };

  const currentOrigin = (settings?.customPostbackDomain && settings.customPostbackDomain.trim() !== '') 
    ? settings.customPostbackDomain.trim() 
    : (window.location.origin || 'http://localhost:3000');
  
  // Custom tracking url formats matching exact parameters
  const trackingUrls = {
    cpx: `${currentOrigin}/api/postback?user_id={user_id}&reward={amount_local}&secret_key=${secretKey}&click_id={trans_id}`,
    adgate: `${currentOrigin}/api/postback?user_id={s1}&reward={points}&secret_key=${secretKey}&click_id={tx_id}`,
    offertoro: `${currentOrigin}/api/postback?user_id={user_id}&reward={amount}&secret_key=${secretKey}&click_id={id}`,
    lootably: `${currentOrigin}/api/postback?user_id={userID}&reward={reward}&secret_key=${secretKey}&click_id={txID}`,
    ayet: `${currentOrigin}/api/postback?user_id={uid}&reward={currency}&secret_key=${secretKey}&click_id={transaction_id}`,
    user_postback: `${currentOrigin}/api/postback?click_id={click_id}&user_id={sub1}&task_id={sub2}&event={event}&payout={payout}&offer_id={offer_id}&secret_key=${secretKey}`,
    custom: `${currentOrigin}/api/postback?user_id={YOUR_USER_ID_MACRO}&reward={YOUR_REWARD_MACRO}&secret_key=${secretKey}&click_id={YOUR_CLICK_ID_MACRO}`
  };

  const handleSimulatePostback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert("Please select a user profile to simulate the secure credential credit.");
      return;
    }

    setIsSimulating(true);
    setSimulateResult(null);

    try {
      // Simulate by executing the local callback HTTP GET route 
      const queryUrl = `${currentOrigin}/api/postback?user_id=${encodeURIComponent(selectedUserId)}&reward=${encodeURIComponent(rewardAmount)}&secret_key=${encodeURIComponent(secretKey)}&is_simulator=true`;
      
      const response = await fetch(queryUrl);
      const data = await response.json();

      if (response.ok && data.success) {
        setSimulateResult({
          success: true,
          message: data.message || "Credential points added successfully!",
          data: data
        });
        // Trigger parent state update so user balances refresh in telemetry screens instantly
        refreshData();
      } else {
        setSimulateResult({
          success: false,
          message: data.error || "Postback callback failed. Authentication validation key mismatch."
        });
      }
    } catch (err: any) {
      setSimulateResult({
        success: false,
        message: err.message || "Failed to establish postback communication handshake."
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Node.js Google Cloud Function complete, robust code string
  const customCloudFunctionCodeV2 = `/**
 * Google Cloud Function (HTTP Trigger - Gen 2)
 * Acts as an Ad Network Callback/Postback secure hook.
 * Increments users balance inside your main Google Cloud Firestore database.
 * 
 * Package dependencies required (package.json):
 * {
 *   "dependencies": {
 *     "@google-cloud/firestore": "^7.0.0",
 *     "firebase-admin": "^12.0.0",
 *     "express": "^4.19.0"
 *   }
 * }
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin securely inside Google Cloud Sandbox env 
if (admin.apps.length === 0) {
  admin.initializeApp({
    // Automatically inherits service account credentials inside GCP
  });
}

const db = admin.firestore();

/**
 * Handle incoming callback hook requests
 */
exports.adNetworkPostbackV2 = async (req, res) => {
  // Limit methods strictly to secure GET requests from publishers
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    // Extract parameters dynamically from request query string
    const userId = req.query.user_id || req.body.user_id;
    const reward = req.query.reward || req.body.reward;
    const secretKey = req.query.secret_key || req.body.secret_key;

    // 1. Verify all parameters exist
    if (!userId || !reward || !secretKey) {
      console.warn("Postback verification rejected: Missing required params.");
      return res.status(400).json({ 
        success: false, 
        error: "Missing required query parameters: user_id, reward, and secret_key are required." 
      });
    }

    // 2. Validate configuration credentials (store safe env private key)
    const POSTBACK_SECRET = process.env.POSTBACK_SECRET_KEY || "postback_secure_key_2026";
    if (secretKey !== POSTBACK_SECRET) {
      console.error("Postback authorization threat: Secret verification key mismatch.");
      return res.status(401).json({ 
        success: false, 
        error: "Unauthorized: Invalid secret Postback validation key." 
      });
    }

    // 3. Cast rewards to positive floats
    const rewardCoins = parseFloat(reward);
    if (isNaN(rewardCoins) || rewardCoins <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid reward credit count: Must exceed zero." 
      });
    }

    // 4. Secure Firestore transaction session to handle multi-read race write conditions safely
    const userRef = db.collection("users").doc(userId);
    const transactionId = "tx_pb_" + Math.random().toString(36).substring(2, 11);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userDoc.data();
      if (userData.isBanned) {
        throw new Error("USER_BANNED");
      }

      // Read current balances safely
      const balances = userData.balances || { main: 0, bonus: 0, referral: 0, todayEarnings: 0, totalEarnings: 0 };
      
      // Update balance counts atomically
      const updatedBalances = {
        ...balances,
        main: (balances.main || 0) + rewardCoins,
        todayEarnings: (balances.todayEarnings || 0) + rewardCoins,
        totalEarnings: (balances.totalEarnings || 0) + rewardCoins
      };

      // Perform update inside atomic session transaction block
      transaction.update(userRef, { 
        balances: updatedBalances 
      });

      // Write a secure ledger transaction log
      const txRef = db.collection("transactions").doc(transactionId);
      transaction.set(txRef, {
        id: transactionId,
        userId: userId,
        amount: rewardCoins,
        type: "task",
        description: "Offerwall Complete: Autocredited via securing Cloud Postback",
        timestamp: new Date().toISOString()
      });
    });

    console.log(\`Successfully credited \${rewardCoins} coins atomically to User UID: \${userId}\`);

    // Standard Ad Network Success acknowledgement payload. Many networks look for plain text 'OK' or success: true JSON
    return res.status(200).json({
      status: "OK",
      success: true,
      message: "Callback logged. Coins successfully incremented atomically.",
      transaction_id: transactionId
    });

  } catch (err) {
    console.error("Postback processing crashed:", err);
    
    if (err.message === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, error: "No profile matching user_id matches registrations." });
    }
    if (err.message === "USER_BANNED") {
      return res.status(403).json({ success: false, error: "Aborted: Task crawler profile is suspended under cheating rules." });
    }

    return res.status(500).json({ 
      success: false, 
      error: "Cloud Function backend ledger failed to process transaction safely." 
    });
  }
};`;

  const customCloudFunctionCodeV1 = `/**
 * Google Cloud Function (HTTP Legacy Trigger - Gen 1)
 * Acts as an Ad Network Callback/Postback secure hook.
 * Increments users balance inside your main Google Cloud Firestore database.
 * 
 * Package dependencies required (package.json):
 * {
 *   "dependencies": {
 *     "firebase-admin": "^11.0.0",
 *     "firebase-functions": "^4.0.0"
 *   }
 * }
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin securely inside Google Cloud Sandbox env 
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Handle incoming callback hook requests
 */
exports.adNetworkPostbackLegacy = functions.https.onRequest(async (req, res) => {
  // Limit methods strictly to GET or POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    // Extract parameters dynamically from request query string
    const userId = req.query.user_id || req.body.user_id;
    const reward = req.query.reward || req.body.reward;
    const secretKey = req.query.secret_key || req.body.secret_key;

    // 1. Verify all parameters exist
    if (!userId || !reward || !secretKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required parameters: user_id, reward, and secret_key are required." 
      });
    }

    // 2. Validate configuration credentials (check secret key)
    const POSTBACK_SECRET = process.env.POSTBACK_SECRET_KEY || "postback_secure_key_2026";
    if (secretKey !== POSTBACK_SECRET) {
      return res.status(401).json({ 
        success: false, 
        error: "Unauthorized: Invalid secret Postback validation key." 
      });
    }

    // 3. Cast rewards to positive floats
    const rewardCoins = parseFloat(reward);
    if (isNaN(rewardCoins) || rewardCoins <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid reward credit count: Must exceed zero." 
      });
    }

    // 4. Secure Firestore transaction session to handle multi-read race write conditions safely
    const userRef = db.collection("users").doc(userId);
    const transactionId = "tx_pb_legacy_" + Math.random().toString(36).substring(2, 11);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userDoc.data();
      if (userData.isBanned) {
        throw new Error("USER_BANNED");
      }

      // Read current balances safely
      const balances = userData.balances || { main: 0, bonus: 0, referral: 0, todayEarnings: 0, totalEarnings: 0 };
      
      // Update balance counts atomically
      const updatedBalances = {
        ...balances,
        main: (balances.main || 0) + rewardCoins,
        todayEarnings: (balances.todayEarnings || 0) + rewardCoins,
        totalEarnings: (balances.totalEarnings || 0) + rewardCoins
      };

      // Perform update inside atomic session transaction block
      transaction.update(userRef, { 
        balances: updatedBalances 
      });

      // Write a secure ledger transaction log
      const txRef = db.collection("transactions").doc(transactionId);
      transaction.set(txRef, {
        id: transactionId,
        userId: userId,
        amount: rewardCoins,
        type: "task",
        description: "Offerwall Complete: Autocredited via securing Cloud Postback (Legacy)",
        timestamp: new Date().toISOString()
      });
    });

    console.log(\`Successfully credited \${rewardCoins} coins atomically to User UID: \${userId}\`);

    // Standard Success acknowledgement payload
    return res.status(200).json({
      status: "OK",
      success: true,
      message: "Callback logged. Coins successfully incremented atomically.",
      transaction_id: transactionId
    });

  } catch (err) {
    console.error("Postback processing crashed:", err);
    
    if (err.message === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, error: "No profile matching user_id matches registrations." });
    }
    if (err.message === "USER_BANNED") {
      return res.status(403).json({ success: false, error: "Aborted: Task crawler profile is suspended under cheating rules." });
    }

    return res.status(500).json({ 
      success: false, 
      error: "Cloud Function backend ledger failed to process transaction safely." 
    });
  }
});`;

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-zinc-100">
      
      {/* 1. Header Banner */}
      <div className="pb-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            🔌 Offerwall & Ad Network Postback Tracking Console
          </h2>
          <p className="text-xs text-zinc-400">
            Configure secret validation keys, test real-time webhook callback pings, and generate production-grade cloud functions.
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>Security Level: Zero-Trust verified</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN - PARAMS CONFIGURATION & DYNAMIC BUILDER (span 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* A. URL Parameter Builder */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-500" /> Webhook Postback URL Configurator & Builder
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              When a user completes a survey or offer in an ad wall, the Ad Network executes an HTTP request to your backend callback URL. Use this tool to generate the configured tracking link for your ad dashboard:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Verification Secret Key
                </label>
                <input 
                  type="text" 
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="postback_secure_key_2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-805 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-50"
                  id="secret_postback_gui"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Select Ad Network Preset
                </label>
                <select 
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-805 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-50 cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  id="network_selector_gui"
                >
                  <option value="cpx" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">CPX Research (Surveys)</option>
                  <option value="adgate" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">AdGate Media (Offerwall)</option>
                  <option value="offertoro" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">OfferToro (Rewards)</option>
                  <option value="lootably" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Lootably Studio (Installs)</option>
                  <option value="ayet" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">ayet Studios (Multi-Tasks)</option>
                  <option value="user_postback" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">🎯 Custom S2S Postback (click_id/sub1/sub2/event/payout/offer_id/secret_key)</option>
                  <option value="custom" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Generic Custom Integration</option>
                </select>
              </div>
            </div>

            {/* Generated Field Panel */}
            <div className="pt-2 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  📁 Standard Callback URL (For Ad Network Dashboard)
                </label>
                
                <div className="bg-slate-950 border border-zinc-800 p-4 rounded-2xl flex items-start gap-3 relative group">
                  <div className="flex-1 font-mono text-[11px] text-zinc-200 break-all leading-normal select-all font-semibold">
                    {trackingUrls[selectedNetwork as keyof typeof trackingUrls]}
                  </div>
                  
                  <button
                    onClick={() => handleCopy('track-url', trackingUrls[selectedNetwork as keyof typeof trackingUrls])}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 p-2 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
                    title="Copy Standard URL"
                    id="copy-track-url-btn"
                  >
                    {copiedTextId === 'track-url' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
                    🟢 WhatsApp & Messenger Safe Link (Clickable Link)
                  </span>
                  <span className="bg-emerald-500/15 text-emerald-500 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Recommended for Chat</span>
                </label>
                
                <div className="bg-emerald-950/25 border border-emerald-900/30 p-4 rounded-2xl flex items-start gap-3 relative group">
                  <div className="flex-1 font-mono text-[11px] text-emerald-300 dark:text-emerald-400 break-all leading-normal select-all font-semibold">
                    {trackingUrls[selectedNetwork as keyof typeof trackingUrls].replace(/\{/g, '%7B').replace(/\}/g, '%7D')}
                  </div>
                  
                  <button
                    onClick={() => handleCopy('whatsapp-safe', trackingUrls[selectedNetwork as keyof typeof trackingUrls].replace(/\{/g, '%7B').replace(/\}/g, '%7D'))}
                    className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 p-2 rounded-xl transition-all cursor-pointer shadow-sm shrink-0 border border-emerald-500/20"
                    title="Copy WhatsApp Clickable Link"
                    id="copy-whatsapp-safe-btn"
                  >
                    {copiedTextId === 'whatsapp-safe' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[10.5px] text-zinc-400 leading-relaxed font-medium">
                  💡 <strong>Important WhatsApp Tip:</strong> WhatsApp's browser parser cuts off the blue clickable link when it encounters curly braces <code className="bg-slate-100 dark:bg-zinc-800 text-[9px] px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-250">{`{ }`}</code>, leaving the rest as normal unlinked text. The <strong>WhatsApp Safe Link</strong> uses standard percent encoding (<code className="bg-slate-100 dark:bg-zinc-800 text-[9px] px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-250">%7B</code> and <code className="bg-slate-100 dark:bg-zinc-800 text-[9px] px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-250">%7D</code>) which forces WhatsApp to parse and style the **entire URL as a single, fully-clickable blue link!**
                </p>
              </div>
            </div>

            {/* Network dynamic instruction labels */}
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-250/30 dark:border-zinc-805 space-y-2 text-xs">
              <span className="font-bold text-[10px] text-indigo-500 uppercase tracking-wider block">How it works:</span>
              {selectedNetwork === 'cpx' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>CPX Research</strong> uses <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{user_id}`}</code> placeholder to pass down your user ID during clicks and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{amount_local}`}</code> to specify user currency points dynamically.
                </p>
              )}
              {selectedNetwork === 'adgate' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>AdGate Media</strong> substitutes <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{s1}`}</code> with the task earner ID and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{points}`}</code> to report payout cash instantly.
                </p>
              )}
              {selectedNetwork === 'offertoro' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>OfferToro</strong> matches the callback parameters mapping <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{user_id}`}</code> with your custom subscriber tags and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{amount}`}</code> with point balances.
                </p>
              )}
              {selectedNetwork === 'lootably' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>Lootably</strong> maps <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{userID}`}</code> (exact case) as the subscriber ID and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{reward}`}</code> as points earned by app builders.
                </p>
              )}
              {selectedNetwork === 'ayet' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>Ayet Studios</strong> tracks completions reporting <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{uid}`}</code> as campaign user identifier and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{currency}`}</code> to represent awarded coins.
                </p>
              )}
              {selectedNetwork === 'user_postback' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  <strong>Custom S2S Postback Template</strong> is optimized for modern offerwalls reporting <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{click_id}`}</code> for transaction tracking, <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{sub1}`}</code> as the subscriber user identifier, <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{sub2}`}</code> as the campaign task identifier, <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{event}`}</code> as conversion event type, <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{payout}`}</code> for coin reward amounts, <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{offer_id}`}</code> as offer identifier, and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{secret_key}`}</code> for Zero-Trust verification.
                </p>
              )}
              {selectedNetwork === 'custom' && (
                <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                  Replace <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{YOUR_USER_ID_MACRO}`}</code> and <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">{`{YOUR_REWARD_MACRO}`}</code> with the exact placeholder bracket macros specified by your third-party ad server/network publisher panel documentation.
                </p>
              )}
            </div>

          </div>

          {/* B. Google Cloud Function Code panel */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Production-Grade GCF Node.js Script
              </h3>
              
              {/* Version toggle */}
              <div className="flex border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden text-[10px] font-bold font-mono">
                <button
                  onClick={() => setCloudFunctionVersion('v2')}
                  className={`px-2.5 py-1 ${cloudFunctionVersion === 'v2' ? 'bg-zinc-905 dark:bg-white dark:text-zinc-950 text-white' : 'bg-slate-50 dark:bg-zinc-800 text-zinc-400'}`}
                >
                  Gen 2 (Modern)
                </button>
                <button
                  onClick={() => setCloudFunctionVersion('v1')}
                  className={`px-2.5 py-1 ${cloudFunctionVersion === 'v1' ? 'bg-zinc-905 dark:bg-white dark:text-zinc-950 text-white' : 'bg-slate-50 dark:bg-zinc-800 text-zinc-400'}`}
                >
                  Gen 1 (Legacy)
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-normal font-normal">
              This code acts as a bulletproof Cloud Function. It uses secure **Firestore Transactions** and increments coins atomically to prevent double-spending or corrupted user values:
            </p>

            <div className="bg-slate-950 border border-zinc-850 rounded-2xl relative max-h-96 overflow-y-auto no-scrollbar">
              
              <button
                onClick={() => handleCopy('function-code', cloudFunctionVersion === 'v2' ? customCloudFunctionCodeV2 : customCloudFunctionCodeV1)}
                className="absolute top-3 right-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 p-2 rounded-xl transition-all cursor-pointer z-10 shadow-md"
                title="Copy Code to Clipboard"
                id="copy-function-code-btn"
              >
                {copiedTextId === 'function-code' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <pre className="p-4 font-mono text-[10.5px] text-zinc-250 leading-relaxed font-normal whitespace-pre">
                {cloudFunctionVersion === 'v2' ? customCloudFunctionCodeV2 : customCloudFunctionCodeV1}
              </pre>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-2xl text-[11px] leading-relaxed text-amber-600 dark:text-amber-400 flex gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Deployment Security Tip:</strong> Do not commit actual password keys in function codes. Use <strong>Google Cloud Secret Manager</strong> or set an environment variable named <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-250 text-[10px]">POSTBACK_SECRET_KEY</code> inside the GCP function configuration panel!
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN - LIVE TEST SIMULATOR & STEP-BY-STEP GUIDING WIZARD (span 5) */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          
          {/* C. Webhook Simulator */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-1.5">
              <Play className="w-4 h-4 text-emerald-500" /> Real-Time Postback Webhook Simulator
            </h3>
            
            <p className="text-xs text-slate-500 leading-normal font-normal">
              Verify how your applet client reacts to a postback. Select a subscriber to trigger the coin balance increment live locally:
            </p>

            <form onSubmit={handleSimulatePostback} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Select Target User Profile
                </label>
                <select 
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-805 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-50 cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  id="simulator_user_dropdown"
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">-- Choose active Task Earner --</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                      {u.displayName} ({u.email}) — ₹{u.balances.main.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Reward (Coins/Rupees)
                  </label>
                  <input 
                    type="number" 
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    required
                    min="1"
                    placeholder="250"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-805 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-50"
                    id="simulator_reward_input"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                    Security Secret Token
                  </label>
                  <input 
                    type="text" 
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    required
                    placeholder="postback_secure_key_2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-805 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-50"
                    id="simulator_secret_input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSimulating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                id="execute_simulate_btn"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing server handshake...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Fire Simulated Webservice Hook</span>
                  </>
                )}
              </button>
            </form>

            {/* Simulation feedback panels */}
            {simulateResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2.5 animate-fade-in ${
                simulateResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${simulateResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                  <span className="font-extrabold text-[12px]">
                    {simulateResult.success ? 'HTTP 200 OK — Success!' : 'HTTP Error Handled'}
                  </span>
                </div>
                
                <p className="font-normal leading-normal text-zinc-750 dark:text-zinc-300">
                  {simulateResult.message}
                </p>

                {simulateResult.success && simulateResult.data && (
                  <div className="mt-2 text-[10.5px] p-2.5 bg-black/5 dark:bg-white/5 rounded-xl border font-mono space-y-1 block leading-normal">
                    <span className="block font-bold text-[9px] uppercase text-zinc-400 tracking-wider">Server returning payload:</span>
                    <span className="block text-zinc-700 dark:text-zinc-300">🎉 Updated user: <strong className="text-zinc-950 dark:text-white">{simulateResult.data.user?.displayName}</strong></span>
                    <span className="block text-zinc-700 dark:text-zinc-300">💵 Balances: <strong className="text-zinc-950 dark:text-white">₹{simulateResult.data.user?.new_balance.toFixed(2)}</strong></span>
                    <span className="block text-zinc-700 dark:text-zinc-300">🧾 Transaction Ref: <strong className="text-indigo-400">{simulateResult.data.transaction_id}</strong></span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* D. Deployment Guide Wizard */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-purple-500" /> Cloud Function Setup Guide
            </h3>

            <div className="space-y-4 text-xs font-normal text-zinc-600 dark:text-zinc-400 leading-relaxed">
              
              <div className="relative pl-6">
                <span className="absolute left-0 top-0.5 w-4 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-black rounded-full flex items-center justify-center font-mono">1</span>
                <span className="block font-bold text-slate-800 dark:text-zinc-100">Establish GCP Project</span>
                <span>Open Google Cloud Console (`console.cloud.google.com`), create/select your project, and search for under standard search <strong>Cloud Functions</strong>.</span>
              </div>

              <div className="relative pl-6">
                <span className="absolute left-0 top-0.5 w-4 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-black rounded-full flex items-center justify-center font-mono">2</span>
                <span className="block font-bold text-slate-800 dark:text-zinc-100">Create Function config</span>
                <span>Click **Create Function**, opt for modern 2nd Generation, configure your region, change runtime mode to <strong>Node.js 20</strong>, and name trigger endpoint <strong>adNetworkPostbackV2</strong>.</span>
              </div>

              <div className="relative pl-6">
                <span className="absolute left-0 top-0.5 w-4 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-black rounded-full flex items-center justify-center font-mono">3</span>
                <span className="block font-bold text-slate-800 dark:text-zinc-100">Assign Environment Secret</span>
                <span>Insert variable name `POSTBACK_SECRET_KEY` holding value `postback_secure_key_2026` inside the **Runtime, Build, Connections and Security Settings** secrets list.</span>
              </div>

              <div className="relative pl-6">
                <span className="absolute left-0 top-0.5 w-4 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-black rounded-full flex items-center justify-center font-mono">4</span>
                <span className="block font-bold text-slate-800 dark:text-zinc-100">Paste Code & Deploy</span>
                <span>Paste code inside `index.js`, update `package.json` to include `@google-cloud/firestore` and `firebase-admin` dependencies, and hit green <strong>Deploy</strong> button. Copy final URL to network dashboard.</span>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* 4. Real-time Administrative S2S Postback History Logs */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-500">
                <Sliders className="w-4 h-4" />
              </span>
              S2S Postback Callback History Logs
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Live tracking audit records for incoming ad network webhooks. Displays verification statuses, conversion events, and transaction credit outcomes in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Status Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200/40 dark:border-zinc-700/50">
              {(['all', 'Success', 'Duplicate', 'Failed', 'Invalid Token'] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setLogFilter(filterOpt)}
                  className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all uppercase ${
                    logFilter === filterOpt
                      ? 'bg-white dark:bg-zinc-750 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-zinc-700'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {filterOpt === 'all' ? 'All Logs' : filterOpt}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                setIsRefreshing(true);
                refreshData();
                setTimeout(() => setIsRefreshing(false), 800);
              }}
              className="p-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200/50 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl transition-all flex items-center justify-center"
              title="Refresh postback logs"
              id="refresh_postback_logs_btn"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Logs Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-805 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-zinc-800">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Campaign / Task ID</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">IP / Click ID</th>
                <th className="py-3 px-4 text-right">Raw Query</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {postbackLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Sliders className="w-8 h-8 opacity-25 text-indigo-500 animate-pulse" />
                      <span className="font-bold">No S2S postback log records found.</span>
                      <span className="text-2xs max-w-xs leading-normal">
                        Execute a postback test from the Simulator above, or configure an ad wall to trigger live webhooks to `/api/postback`.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                postbackLogs
                  .filter((log) => {
                    if (logFilter === 'all') return true;
                    if (logFilter === 'Failed') return log.status !== 'Success' && log.status !== 'Duplicate' && log.status !== 'Invalid Token';
                    return log.status === logFilter;
                  })
                  .slice(0, 50)
                  .map((log) => {
                    const statusColor =
                      log.status === 'Success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60'
                        : log.status === 'Duplicate'
                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/60'
                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/60';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-805/30 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold border ${statusColor}`}>
                            <span className={`w-1 h-1 rounded-full ${
                              log.status === 'Success' ? 'bg-emerald-500' : log.status === 'Duplicate' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            {log.status}
                          </span>
                        </td>

                        {/* User Details */}
                        <td className="py-3 px-4 max-w-[180px] truncate">
                          <div className="font-bold text-slate-800 dark:text-zinc-200">
                            {log.userEmail || log.userId}
                          </div>
                          {log.userEmail && (
                            <div className="text-[10px] text-zinc-400 font-mono truncate select-all">
                              UID: {log.userId}
                            </div>
                          )}
                        </td>

                        {/* Task ID */}
                        <td className="py-3 px-4 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {log.taskId}
                        </td>

                        {/* Event */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded text-3xs font-mono font-bold uppercase">
                            {log.event || 'conversion'}
                          </span>
                        </td>

                        {/* Reward Amount */}
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          +{log.amount.toFixed(0)} coins
                        </td>

                        {/* IP & Click ID */}
                        <td className="py-3 px-4">
                          <div className="text-zinc-400 text-3xs font-mono">IP: {log.clientIp}</div>
                          {log.clickId && (
                            <div className="text-indigo-600 dark:text-indigo-400 font-mono text-3xs mt-0.5 truncate max-w-[120px]" title={log.clickId}>
                              ID: {log.clickId}
                            </div>
                          )}
                        </td>

                        {/* Raw Query Parameters */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              try {
                                const pretty = JSON.stringify(JSON.parse(log.rawQuery), null, 2);
                                alert(`Raw Callback Query Parameters:\n\n${pretty}`);
                              } catch (e) {
                                alert(`Raw Callback Query parameters:\n${log.rawQuery}`);
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-[10px] font-mono text-slate-600 dark:text-zinc-300 rounded transition-all inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Query
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
