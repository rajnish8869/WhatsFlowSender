export interface Contact {
  id: string;
  name: string;
  number: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  timestamp?: number;
  selected?: boolean;
}

export interface Attachment {
  name: string;
  type: string;
  previewUrl: string;
  file: File;
}

export interface AutomationConfig {
  delay: number; // Seconds to wait before auto-opening next
  autoAdvance: boolean; // If true, opens next number on app focus
  batchSize: number;
}

export type AppStep = 'input' | 'compose' | 'running' | 'manual' | 'summary';

export interface AppState {
  step: AppStep;
  contacts: Contact[];
  messageTemplate: string;
  templates: string[]; // List of saved message templates
  defaultCountryCode: string; // e.g., "1" or "91"
  theme: 'light' | 'dark';
  currentContactIndex: number;
  attachment: Attachment | null;
  config: AutomationConfig;
  isLoadingContacts: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export type Action =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'IMPORT_CONTACTS'; payload: Contact[] }
  | { type: 'CLEAR_CONTACTS' }
  | { type: 'UPDATE_CONTACT_STATUS'; payload: { id: string; status: Contact['status'] } }
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'SAVE_TEMPLATE'; payload: string }
  | { type: 'DELETE_TEMPLATE'; payload: number } // Index
  | { type: 'SET_DEFAULT_COUNTRY_CODE'; payload: string }
  | { type: 'SET_ATTACHMENT'; payload: Attachment | null }
  | { type: 'UPDATE_CONFIG'; payload: Partial<AutomationConfig> }
  | { type: 'TOGGLE_THEME' }
  | { type: 'NEXT_CONTACT' }
  | { type: 'SET_CONTACT_INDEX'; payload: number }
  | { type: 'RESET_RUNNER' }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SET_LOADING_CONTACTS'; payload: boolean }
  | { type: 'SET_PERMISSION_STATUS'; payload: AppState['permissionStatus'] }
  | { type: 'TOGGLE_CONTACT_SELECTION'; payload: string } // ID
  | { type: 'TOGGLE_ALL_SELECTION'; payload: boolean }; // Select all or none

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}