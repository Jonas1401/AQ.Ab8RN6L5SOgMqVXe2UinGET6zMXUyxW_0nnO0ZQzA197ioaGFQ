/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarUrl: string;
  role: 'driver' | 'admin' | 'operator';
  online?: boolean;
  lastActive?: number;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string; // 'ship' | 'truck' | 'calendar' | 'store'
  color: string; // e.g. '#3b82f6' for cyan, '#f97316' for orange, etc.
  unreadCount: number;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string; // Base64 or URL
  audioDuration?: number; // in seconds
  createdAt: number;
  replyTo?: {
    messageId: string;
    userName: string;
    text: string;
  } | null;
  edited?: boolean;
  isFolguistaCandidate?: boolean;
  candidateName?: string;
  candidateCnh?: string;
  candidatePhoto?: string;
  candidatePhone?: string;
  likes?: string[];
}

export interface PinnedMessage {
  text: string;
  channelId: string;
}
