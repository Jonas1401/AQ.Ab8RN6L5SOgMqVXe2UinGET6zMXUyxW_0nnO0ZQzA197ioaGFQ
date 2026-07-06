/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarUrl: string;
  role: 'driver' | 'admin' | 'operator';
  email?: string;
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
  userEmail?: string;
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
  isComercioAd?: boolean;
  businessName?: string;
  businessPhone?: string;
  isSticker?: boolean;
}

export interface PinnedMessage {
  text: string;
  channelId: string;
}

export interface OrganizerEvent {
  id: string;
  userId: string;
  title: string;
  date: string;
  time: string;
  description: string;
  createdAt: number;
}

export interface OrganizerNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
  color?: string; // Hex or bg class
}

export interface OrganizerChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface OrganizerChecklist {
  id: string;
  userId: string;
  title: string;
  items: OrganizerChecklistItem[];
  createdAt: number;
}

export interface TravelTicket {
  id: string;
  userId: string;
  title: string;
  date: string;
  imageUrl: string; // Base64 high-resolution representation of the ticket
  description?: string;
  createdAt: number;
}

