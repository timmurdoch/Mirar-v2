import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateQuestionKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

export function parseCheckboxValue(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export function stringifyCheckboxValue(values: string[]): string {
  return JSON.stringify(values);
}

// Role permission helpers
export type UserRole = 'auditor' | 'admin' | 'super_admin';

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canManageAllUsers(role: UserRole): boolean {
  return role === 'super_admin';
}

export function canConfigureQuestionnaire(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canExportData(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canDeleteFacilities(role: UserRole): boolean {
  return role === 'super_admin';
}

export function canViewChangeLogs(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

// Australian states for select options
export const AUSTRALIAN_STATES = [
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'WA', label: 'Western Australia' },
];
