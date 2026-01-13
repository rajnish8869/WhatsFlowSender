import React, { useReducer, useEffect, useCallback, useRef } from "react";
import { AppState, Action, AppStep, Contact } from "./types";
import { InputView } from "./components/InputView";
import { ComposeView } from "./components/ComposeView";
import { LiveRunner } from "./components/LiveRunner";
import { SessionMode } from "./components/SessionMode";
import { SummaryView } from "./components/SummaryView";
import { logger } from "./utils/logger";
import { STORAGE_KEY, INITIAL_MESSAGE } from "./constants";
import { Moon, Sun, ChevronLeft } from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

const initialState: AppState = {
  step: "input",
  contacts: [],
  messageTemplate: INITIAL_MESSAGE,
  templates: [],
  defaultCountryCode: "",
  theme: "dark",
  currentContactIndex: -1,
  attachment: null,
  config: {
    delay: 1.5,
    autoAdvance: true,
    batchSize: 50,
  },
  isLoadingContacts: false,
  permissionStatus: "unknown",
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "IMPORT_CONTACTS":
      return { ...state, contacts: action.payload };
    case "CLEAR_CONTACTS":
      return { ...state, contacts: [], currentContactIndex: -1 };
    case "SET_MESSAGE":
      return { ...state, messageTemplate: action.payload };
    case "SAVE_TEMPLATE":
      if (state.templates.includes(action.payload)) return state;
      return { ...state, templates: [...state.templates, action.payload] };
    case "DELETE_TEMPLATE":
      return {
        ...state,
        templates: state.templates.filter((_, i) => i !== action.payload),
      };
    case "SET_DEFAULT_COUNTRY_CODE":
      return { ...state, defaultCountryCode: action.payload };
    case "SET_ATTACHMENT":
      return { ...state, attachment: action.payload };
    case "UPDATE_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };
    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "light" ? "dark" : "light" };

    case "SET_LOADING_CONTACTS":
      return { ...state, isLoadingContacts: action.payload };
    case "SET_PERMISSION_STATUS":
      return { ...state, permissionStatus: action.payload };

    case "TOGGLE_CONTACT_SELECTION": {
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload ? { ...c, selected: !c.selected } : c
        ),
      };
    }

    case "TOGGLE_ALL_SELECTION": {
      return {
        ...state,
        contacts: state.contacts.map((c) => ({
          ...c,
          selected: action.payload,
        })),
      };
    }

    // Runner Logic
    case "UPDATE_CONTACT_STATUS": {
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.id
            ? { ...c, status: action.payload.status }
            : c
        ),
      };
    }
    case "NEXT_CONTACT":
      return { ...state, currentContactIndex: state.currentContactIndex + 1 };
    case "SET_CONTACT_INDEX":
      return { ...state, currentContactIndex: action.payload };
    case "RESET_RUNNER":
      return {
        ...state,
        currentContactIndex: -1,
        contacts: state.contacts.map((c) => ({ ...c, status: "pending" })),
      };

    case "LOAD_STATE":
      const { attachment, isLoadingContacts, permissionStatus, ...rest } =
        action.payload;
      const mergedConfig = {
        ...state.config,
        ...(action.payload.config || {}),
      };
      // Ensure templates is an array and country code is string if loading from old state
      const templates = Array.isArray(action.payload.templates) ? action.payload.templates : [];
      const defaultCountryCode = action.payload.defaultCountryCode || "";
      
      return { ...state, ...rest, templates, defaultCountryCode, config: mergedConfig, attachment: null };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Use ref to track current step for event listeners without re-binding
  const stepRef = useRef(state.step);

  useEffect(() => {
    stepRef.current = state.step;
  }, [state.step]);

  // Persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: "LOAD_STATE", payload: parsed });
      }
    } catch (e) {
      logger.error("Failed to load saved state.");
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const { attachment, isLoadingContacts, ...stateToPersist } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state]);

  // Automatic Contact Import Logic
  const fetchContacts = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      logger.info("Web environment detected. Native contacts skipped.");
      dispatch({ type: "SET_PERMISSION_STATUS", payload: "granted" });
      return;
    }

    dispatch({ type: "SET_LOADING_CONTACTS", payload: true });

    try {
      // check permissions first
      const permStatus = await Contacts.checkPermissions();

      if (permStatus.contacts !== "granted") {
        const request = await Contacts.requestPermissions();
        if (request.contacts !== "granted") {
          dispatch({ type: "SET_PERMISSION_STATUS", payload: "denied" });
          dispatch({ type: "SET_LOADING_CONTACTS", payload: false });
          return;
        }
      }

      dispatch({ type: "SET_PERMISSION_STATUS", payload: "granted" });

      // Fetch
      const result = await Contacts.getContacts({
        projection: { name: true, phones: true },
      });

      const newContacts: Contact[] = [];
      const seenNumbers = new Set<string>();

      // Logic: Iterate all contacts. For each phone number found:
      // 1. Clean it (remove non-digits).
      // 2. Check if this number has already been seen (Global deduplication).
      // 3. If seen, SKIP it (Prioritizes the first contact/number encountered).
      // 4. If not seen, add to list and mark as seen.

      for (const contact of result.contacts) {
        if (contact.phones && contact.phones.length > 0) {
          for (const phoneObj of contact.phones) {
            const rawNumber = phoneObj.number || "";
            const cleanNumber = rawNumber.replace(/[^0-9]/g, "");

            // Basic validation: ensure number is long enough to be valid
            if (cleanNumber.length > 6) {
              if (seenNumbers.has(cleanNumber)) {
                // Duplicate number detected.
                // Even if name is different, we skip to keep the first one.
                continue;
              }

              seenNumbers.add(cleanNumber);

              newContacts.push({
                // Use the cleaned phone number as the unique id for each entry.
                // This ensures each phone number (even multiple per contact) gets a distinct id
                id: cleanNumber,
                name: contact.name?.display || "Unknown",
                number: cleanNumber,
                status: "pending",
                selected: false,
              });
            }
          }
        }
      }

      if (newContacts.length > 0) {
        // Sort alphabetically by name for better UX
        newContacts.sort((a, b) => a.name.localeCompare(b.name));
        dispatch({ type: "IMPORT_CONTACTS", payload: newContacts });
        logger.success(`Synced ${newContacts.length} unique contacts`);
      } else {
        logger.warning("No valid contacts found on device.");
      }
    } catch (e) {
      logger.error("Contact sync failed.");
      console.error(e);
      dispatch({ type: "SET_PERMISSION_STATUS", payload: "denied" });
    } finally {
      dispatch({ type: "SET_LOADING_CONTACTS", payload: false });
    }
  }, []);

  // Run once on mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#09090b");
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#ffffff");
    }
  }, [state.theme]);

  const handleBack = () => {
    if (state.step === "compose")
      dispatch({ type: "SET_STEP", payload: "input" });
    if (state.step === "running" || state.step === "manual") {
      if (confirm("Stop running session and go back to editor?")) {
        dispatch({ type: "SET_STEP", payload: "compose" });
      }
    }
    if (state.step === "summary")
      dispatch({ type: "SET_STEP", payload: "input" });
  };

  // Hardware Back Button (Android) handling via Capacitor App plugin
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", () => {
      // Use ref to check current step, ensuring listener isn't re-bound repeatedly
      const currentStep = stepRef.current;

      // Mirror the same behavior as the header back button
      if (currentStep === "compose") {
        dispatch({ type: "SET_STEP", payload: "input" });
        return;
      }

      if (currentStep === "running" || currentStep === "manual") {
        if (confirm("Stop running session and go back to editor?")) {
          dispatch({ type: "SET_STEP", payload: "compose" });
        }
        return;
      }

      if (currentStep === "summary") {
        dispatch({ type: "SET_STEP", payload: "input" });
        return;
      }

      // Default: if on input (root), let system handle (will minimize app)
    });

    return () => {
      listener.remove();
    };
  }, []);

  const renderStep = () => {
    switch (state.step) {
      case "input":
        return (
          <InputView
            state={state}
            dispatch={dispatch}
            onRetryLoad={fetchContacts}
          />
        );
      case "compose":
        return <ComposeView state={state} dispatch={dispatch} />;
      case "running":
        return <LiveRunner state={state} dispatch={dispatch} />;
      case "manual":
        return <SessionMode appState={state} dispatch={dispatch} />;
      case "summary":
        return <SummaryView state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  };

  const steps: AppStep[] = ["input", "compose", "running"];
  const displayStep = state.step === "manual" ? "running" : state.step;
  const currentStepIndex = steps.indexOf(displayStep as AppStep);

  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white flex justify-center font-sans overflow-hidden transition-colors duration-300">
      <div className="w-full max-w-md h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 border-x border-zinc-200 dark:border-zinc-800 relative shadow-2xl safe-top safe-bottom">
        {/* Header */}
        <header className="flex-none px-4 py-4 flex justify-between items-center z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-900 sticky top-0">
          <div className="flex items-center gap-3">
            {state.step !== "input" ? (
              <button
                onClick={handleBack}
                className="p-1.5 -ml-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white dark:text-zinc-950 font-bold text-lg shadow-lg shadow-emerald-500/20">
                W
              </div>
            )}
            <h1 className="text-lg font-bold tracking-tight">
              WhatsFlow{" "}
              <span className="text-emerald-500 text-xs uppercase tracking-widest ml-1 font-extrabold">
                {state.step === "manual"
                  ? "Manual"
                  : state.step === "running"
                  ? "Auto"
                  : ""}
              </span>
            </h1>
          </div>

          <button
            onClick={() => dispatch({ type: "TOGGLE_THEME" })}
            className="p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          >
            {state.theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </header>

        {/* Progress Indicator */}
        {state.step !== "summary" && (
          <div className="flex-none px-6 py-4 flex items-center justify-between bg-white dark:bg-zinc-950 z-20">
            {steps.map((s, idx) => (
              <div
                key={s}
                className="flex flex-col items-center gap-2 flex-1 relative group cursor-default"
              >
                <div
                  className={`w-full h-1 rounded-full absolute top-3 -z-10 ${
                    idx < currentStepIndex
                      ? "bg-emerald-500"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  } ${
                    idx === steps.length - 1 ? "hidden" : ""
                  } left-1/2 scale-x-110 transition-colors duration-500`}
                />

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10 ${
                    idx <= currentStepIndex
                      ? "bg-white dark:bg-zinc-950 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/20 scale-110"
                      : "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
                    idx <= currentStepIndex
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {s === "running" && state.step === "manual" ? "Manual" : s}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          {renderStep()}
        </main>
      </div>
    </div>
  );
}
