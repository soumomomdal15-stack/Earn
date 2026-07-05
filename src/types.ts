/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserBalance {
  main: number;        // withrawable balance
  bonus: number;       // bonus coin rewards
  referral: number;    // direct referral income
  todayEarnings: number;
  totalEarnings: number;
  lastEarningDate?: string;
}

export type KYCStatus = 'None' | 'Pending' | 'Approved' | 'Rejected';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;
  referralCode: string;
  referredBy?: string;
  balances: UserBalance;
  streakDays: number;
  lastCheckIn?: string; // ISO date string
  userRank: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  isBanned: boolean;
  kycStatus: KYCStatus;
  deviceFingerprint: string;
  vipMember: boolean;
  vpnActive: boolean;
  password?: string;
  bannedReason?: string;
  createdAt: string;
}

export type TaskCategory = 
  | 'app_install' 
  | 'web_visit' 
  | 'youtube' 
  | 'telegram' 
  | 'quiz' 
  | 'scratch' 
  | 'spin' 
  | 'rating' 
  | 'watch_ad' 
  | 'social'
  | 'campaign';

export type VerificationType = 'auto' | 'timer' | 'screenshot' | 'manual' | 'ai_screenshot' | 'text_proof' | 'sdk_postback' | 'postback';

export interface Task {
  id: string;
  title: string;
  description: string;
  rewardAmount: number; // e.g. coins/Rupees
  category: TaskCategory;
  icon: string; // Lucide icon helper string or path
  url?: string; // link to task activity
  verificationMethod: VerificationType;
  verificationMethods?: VerificationType[];
  textProofPlaceholder?: string;
  timerSeconds?: number;
  dailyLimit: number;
  completionsToday: number;
  userMaxCompletions?: number;
  isActive: boolean;
  ratingAppId?: string;
  logoUrl?: string;
  quizQuestions?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
  sdkRequirements?: string[];
  tutorialVideoUrl?: string;
  tutorialImageUrl?: string;
  isAutoCommentEnabled?: boolean;
  autoCommentAppName?: string;
  autoCommentAppLink?: string;
  autoCommentInstruction?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  userEmail: string;
  taskId: string;
  taskTitle: string;
  rewardAmount: number;
  status: 'pending' | 'completed' | 'rejected';
  screenshotURL?: string;
  textProof?: string;
  completedAt: string;
}

export type PayoutMethod = 'upi' | 'paytm' | 'bank' | 'crypto';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  paymentMethod: PayoutMethod;
  paymentDetails: string; // e.g. UPI ID or account info
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt?: string;
  adminNote?: string;
  paymentProofURL?: string;
}

export interface ReferralRelationship {
  id: string;
  referrerId: string;
  refereeId: string;
  refereeName: string;
  refereeEmail: string;
  bonusEarned: number;
  status: 'pending' | 'completed'; // Pending until referee completes their first withdraw (gets ₹5 commission)
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 
    | 'task' 
    | 'daily_bonus' 
    | 'referral' 
    | 'withdraw_pending' 
    | 'withdraw_refund' 
    | 'withdraw_approve' 
    | 'scratch' 
    | 'spin' 
    | 'lucky_draw' 
    | 'promo_code' 
    | 'badge_reward'
    | 'vip_purchase';
  description: string;
  timestamp: string;
}

export type NotificationType = 'announcement' | 'alert' | 'update';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  targetUserId?: string; // Optional field for user-specific notification
  targetEmail?: string;  // Optional field for user-specific notification by email
}

export interface OfferwallConfig {
  id: string;
  name: string;
  multiplier: number;
  isActive: boolean;
  apiKey: string;
  callbackUrl: string;
  logoUrl?: string;
  redirectUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdConfig {
  id: string;
  bannerEnabled: boolean;
  interstitialEnabled: boolean;
  rewardedEnabled: boolean;
  rewardFrequency: number; // minutes or count
  admobBannerId: string;
  admobInterstitialId: string;
  admobRewardedId: string;
}

export interface AppSettings {
  appName: string;
  currencySymbol: string;
  pointsRate: number; // 1 currency symbol = X points/coins
  minWithdrawal: number;
  referralBonusFirstLevel: number;
  referralBonusSecondLevel: number;
  referralBonusThirdLevel: number;
  maintenanceMode: boolean;
  themeColor: string;
  customPostbackDomain?: string;
}

export interface PromoCode {
  id: string;
  code: string;
  rewardAmount: number;
  maxUses: number;
  useCount: number;
  claimedBy: string[]; // List of user UIDs who have already claimed this promo code
  createdAt: string;
  maxClaimsPerUser?: number;
}

