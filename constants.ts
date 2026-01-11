import { Contact } from "./types";

export const INITIAL_MESSAGE =
  "Hello {name}! \n\nI wanted to reach out regarding our latest update. Let me know if you're interested.";

export const APP_NAME = "WhatsFlow";

export const ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const STORAGE_KEY = "whatsflow_state_v1";
