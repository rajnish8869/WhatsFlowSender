import { Contact } from './types';

export const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Alice Test', number: '1234567890', status: 'pending', selected: true },
  { id: '2', name: 'Bob Debug', number: '9876543210', status: 'pending', selected: true },
];

export const INITIAL_MESSAGE = "Hello {name}! \n\nI wanted to reach out regarding our latest update. Let me know if you're interested.";

export const APP_NAME = "WhatsFlow";

export const ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const STORAGE_KEY = "whatsflow_state_v1";