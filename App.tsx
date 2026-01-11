import React, { useReducer, useEffect } from 'react';
import { AppState, Action, AppStep } from './types';
import { InputView } from './components/InputView';
import { ComposeView } from './components/ComposeView';
import { LiveRunner } from './components/LiveRunner';
import { SummaryView } from './components/SummaryView';
import { logger } from './utils/logger';
import { STORAGE_KEY, INITIAL_MESSAGE } from './constants';
import { Moon, Sun, ChevronLeft } from 'lucide-react';

const initialState: AppState = {
  step: 'input',
  contacts: [],
  messageTemplate: INITIAL_MESSAGE,
  theme: 'dark',
  currentContactIndex: 0,
  attachment: null,
  config: {
    delay: 1.5,
    autoAdvance: true,
    batchSize: 50
  }
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.payload };
    case 'IMPORT_CONTACTS': return { ...state, contacts: action.payload };
    case 'CLEAR_CONTACTS': return { ...state, contacts: [], currentContactIndex: 0 };
    case 'SET_MESSAGE': return { ...state, messageTemplate: action.payload };
    case 'SET_ATTACHMENT': return { ...state, attachment: action.payload };
    case 'UPDATE_CONFIG': return { ...state, config: { ...state.config, ...action.payload } };
    case 'TOGGLE_THEME': return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    
    // Runner Logic
    case 'UPDATE_CONTACT_STATUS': {
      const newContacts = [...state.contacts];
      if (newContacts[action.payload.index]) {
        newContacts[action.payload.index] = { ...newContacts[action.payload.index], status: action.payload.status };
      }
      return { ...state, contacts: newContacts };
    }
    case 'NEXT_CONTACT': return { ...state, currentContactIndex: state.currentContactIndex + 1 };
    case 'RESET_RUNNER': 
      return { 
        ...state, 
        currentContactIndex: 0, 
        contacts: state.contacts.map(c => ({ ...c, status: 'pending' })) 
      };

    case 'LOAD_STATE': 
      const { attachment, ...rest } = action.payload;
      const mergedConfig = { ...state.config, ...(action.payload.config || {}) };
      return { ...state, ...rest, config: mergedConfig, attachment: null }; 
    default: return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: 'LOAD_STATE', payload: JSON.parse(saved) });
    } catch (e) { logger.error('Failed to load saved state.'); }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const { attachment, ...stateToPersist } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state]);

  // Theme Class
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#09090b');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
    }
  }, [state.theme]);

  const handleBack = () => {
    if (state.step === 'compose') dispatch({ type: 'SET_STEP', payload: 'input' });
    if (state.step === 'running') {
      if(confirm("Stop running session and go back to editor?")) {
        dispatch({ type: 'SET_STEP', payload: 'compose' });
      }
    }
    if (state.step === 'summary') dispatch({ type: 'SET_STEP', payload: 'input' });
  };

  const renderStep = () => {
    switch (state.step) {
      case 'input': return <InputView state={state} dispatch={dispatch} />;
      case 'compose': return <ComposeView state={state} dispatch={dispatch} />;
      case 'running': return <LiveRunner state={state} dispatch={dispatch} />;
      case 'summary': return <SummaryView state={state} dispatch={dispatch} />;
      default: return null;
    }
  };

  const steps: AppStep[] = ['input', 'compose', 'running'];
  const currentStepIndex = steps.indexOf(state.step);

  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white flex justify-center font-sans overflow-hidden transition-colors duration-300">
      {/* 
        Container using 100dvh for proper mobile height 
        Using 'flex flex-col' to strictly stack header -> progress -> content
      */}
      <div className="w-full max-w-md h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 border-x border-zinc-200 dark:border-zinc-800 relative shadow-2xl safe-top safe-bottom">
        
        {/* Header - Fixed Height */}
        <header className="flex-none px-4 py-4 flex justify-between items-center z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-900 sticky top-0">
          <div className="flex items-center gap-3">
             {state.step !== 'input' ? (
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
            <h1 className="text-lg font-bold tracking-tight">WhatsFlow <span className="text-emerald-500 text-xs uppercase tracking-widest ml-1 font-extrabold">Auto</span></h1>
          </div>
          
          <button 
              onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
              className="p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          >
              {state.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </header>

        {/* Progress Indicator - Fixed Height */}
        {state.step !== 'summary' && (
          <div className="flex-none px-6 py-4 flex items-center justify-between bg-white dark:bg-zinc-950 z-20">
            {steps.map((s, idx) => (
              <div key={s} className="flex flex-col items-center gap-2 flex-1 relative group cursor-default">
                <div className={`w-full h-1 rounded-full absolute top-3 -z-10 ${
                  idx < currentStepIndex ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'
                } ${idx === steps.length - 1 ? 'hidden' : ''} left-1/2 scale-x-110 transition-colors duration-500`} />
                
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10 ${
                  idx <= currentStepIndex 
                  ? 'bg-white dark:bg-zinc-950 border-emerald-500 text-emerald-500 shadow-lg shadow-emerald-500/20 scale-110' 
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
                  idx <= currentStepIndex ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600'
                }`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Main Content - Flex Grow with scrolling enabled INSIDE */}
        <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
           {renderStep()}
        </main>

      </div>
    </div>
  );
}