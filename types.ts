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

export type AppStep = 'input' | 'compose' | 'running' | 'summary';

export interface AppState {
  step: AppStep;
  contacts: Contact[];
  messageTemplate: string;
  theme: 'light' | 'dark';
  currentContactIndex: number;
  attachment: Attachment | null;
  config: AutomationConfig;
}

export type Action =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'IMPORT_CONTACTS'; payload: Contact[] }
  | { type: 'CLEAR_CONTACTS' }
  | { type: 'UPDATE_CONTACT_STATUS'; payload: { index: number; status: Contact['status'] } }
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'SET_ATTACHMENT'; payload: Attachment | null }
  | { type: 'UPDATE_CONFIG'; payload: Partial<AutomationConfig> }
  | { type: 'TOGGLE_THEME' }
  | { type: 'NEXT_CONTACT' }
  | { type: 'RESET_RUNNER' } // Resets index to 0 and status to pending
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}