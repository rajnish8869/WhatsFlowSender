import React, { useEffect, useState, useRef } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Play, Pause, Square, ExternalLink, RefreshCw, Send, Check, AlertCircle } from 'lucide-react';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

export const LiveRunner: React.FC<Props> = ({ state, dispatch }) => {
  // Start paused to prevent accidental loops on app restore
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isWaitingForReturn, setIsWaitingForReturn] = useState(false);
  const [manualTriggerNeeded, setManualTriggerNeeded] = useState(false);
  
  // Refs to track state inside event listeners
  const currentIndexRef = useRef(state.currentContactIndex);
  const isRunningRef = useRef(isRunning);
  const isWaitingForReturnRef = useRef(isWaitingForReturn);

  // Sync refs
  useEffect(() => { currentIndexRef.current = state.currentContactIndex; }, [state.currentContactIndex]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isWaitingForReturnRef.current = isWaitingForReturn; }, [isWaitingForReturn]);

  const total = state.contacts.length;
  const current = state.contacts[state.currentContactIndex];
  const progress = total > 0 ? (state.currentContactIndex / total) * 100 : 0;

  // --- AUTOMATION CORE ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Logic: If visible AND we were waiting for user to return AND we are currently "running"
      if (document.visibilityState === 'visible' && isWaitingForReturnRef.current && isRunningRef.current) {
        logger.info('App focused. Resuming flow...');
        
        // 1. Mark previous contact as sent
        dispatch({ 
          type: 'UPDATE_CONTACT_STATUS', 
          payload: { index: currentIndexRef.current, status: 'sent' } 
        });

        setIsWaitingForReturn(false);
        setManualTriggerNeeded(false);

        // 2. Start countdown for next contact
        let timer = state.config.delay;
        setCountdown(timer);
        
        const interval = setInterval(() => {
          timer -= 0.1;
          setCountdown(Math.max(0, parseFloat(timer.toFixed(1))));
          
          if (timer <= 0) {
            clearInterval(interval);
            setCountdown(0);
            
            // 3. Move index. The effect downstream will trigger the open.
            const nextIndex = currentIndexRef.current + 1;
            if (nextIndex < total) {
              dispatch({ type: 'NEXT_CONTACT' });
            } else {
              setIsRunning(false);
              dispatch({ type: 'SET_STEP', payload: 'summary' });
            }
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [total, state.config.delay]);

  // --- TRIGGER LOGIC ---
  useEffect(() => {
    // Only trigger if running, NOT waiting, countdown done, and valid contact
    // This runs when `state.currentContactIndex` updates after the countdown
    if (isRunning && !isWaitingForReturn && current && countdown === 0 && !manualTriggerNeeded) {
      attemptOpen(current);
    }
  }, [state.currentContactIndex, isRunning, isWaitingForReturn, countdown]); 

  const attemptOpen = (contact: Contact) => {
    const msg = state.messageTemplate.replace(/{name}/g, contact.name);
    
    try {
      if (state.attachment) {
         if (navigator.share && navigator.canShare({ files: [state.attachment.file] })) {
           navigator.share({ files: [state.attachment.file], text: msg })
             .then(() => setIsWaitingForReturn(true))
             .catch((err) => {
               logger.error('Share failed/cancelled');
               setIsRunning(false); // Pause on error
             });
         } else {
           setManualTriggerNeeded(true); // Fallback to manual
         }
      } else {
         // Text Mode
         const url = `https://wa.me/${contact.number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
         
         // Try to open window. Note: This might block in some browsers if not user-initiated.
         const win = window.open(url, '_blank');
         
         if (win) {
            setIsWaitingForReturn(true);
         } else {
            // Popup blocked or failed
            console.warn("Auto-open blocked, requesting manual interaction");
            setManualTriggerNeeded(true);
         }
      }
    } catch (e) {
      logger.error('Error opening target');
      setManualTriggerNeeded(true);
    }
  };

  const manualOpen = () => {
    if (current) {
        setManualTriggerNeeded(false); // Reset flag
        // Force the open
        const msg = state.messageTemplate.replace(/{name}/g, current.name);
        const url = `https://wa.me/${current.number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        setIsWaitingForReturn(true);
        setIsRunning(true); // Ensure we stay running
    }
  };

  const toggleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      setIsWaitingForReturn(false);
      setCountdown(0);
      setManualTriggerNeeded(false);
    } else {
      setIsRunning(true);
      // If we are starting fresh (index 0 or resumed), we might need to trigger immediately if not waiting
      if (!isWaitingForReturn && countdown === 0) {
         // attemptOpen will be triggered by useEffect if conditions met
      }
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 overflow-hidden">
       
       {/* Background Pulse */}
       {isRunning && !manualTriggerNeeded && (
         <div className="absolute inset-0 bg-emerald-500/5 animate-pulse z-0 pointer-events-none" />
       )}

       {/* Main Content Area */}
       <div className="flex-1 flex flex-col items-center justify-center z-10 p-6 w-full overflow-y-auto custom-scrollbar">
          
          {/* Status Ring / Countdown */}
          <div className="relative mb-8 group flex-none">
             {/* Ring SVG - Responsive sizing */}
             <svg className="w-56 h-56 sm:w-64 sm:h-64 transform -rotate-90 drop-shadow-2xl">
                <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-200 dark:text-zinc-900" />
                <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="12" fill="transparent" 
                  className={`transition-all duration-500 ease-linear ${isRunning ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-700'}`}
                  strokeDasharray="283%" /* approximate for 45% radius if using percentage based calc, simplified: */
                  // Reverting to specific px calculation for reliability with viewbox
                />
                {/* Standard ViewBox SVG implementation for better control */}
             </svg>
             {/* Proper SVG Implementation for Resizing */}
             <div className="absolute inset-0">
               <svg viewBox="0 0 256 256" className="w-full h-full transform -rotate-90">
                  <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-zinc-200 dark:text-zinc-900" />
                  <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="16" fill="transparent" 
                    className={`transition-all duration-500 ease-linear ${isRunning ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-700'}`}
                    strokeDasharray={691} 
                    strokeDashoffset={691 - (691 * progress) / 100} 
                    strokeLinecap="round"
                  />
               </svg>
             </div>
             
             {/* Center Content */}
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                {countdown > 0 ? (
                  <div className="text-5xl font-black text-emerald-500 font-mono animate-bounce">{countdown}s</div>
                ) : (
                  <>
                    <span className={`text-6xl font-black ${isRunning ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600'}`}>
                        {state.currentContactIndex + 1}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-widest text-xs mt-2">OF {total}</span>
                  </>
                )}
             </div>
          </div>

          {/* Current Contact Card */}
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl flex-none">
             {/* Dynamic Header Stripe */}
             <div className={`absolute top-0 left-0 right-0 h-1.5 ${manualTriggerNeeded ? 'bg-amber-500 animate-pulse' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} />
             
             <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 truncate">{current?.name}</h3>
             <p className="text-emerald-600 dark:text-emerald-400 font-mono text-lg font-medium">{current?.number}</p>
             
             {/* State Messages */}
             <div className="mt-6 h-12 flex items-center justify-center">
                {manualTriggerNeeded ? (
                   <Button onClick={manualOpen} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-amber-500/50">
                      <ExternalLink size={16} className="mr-2" /> Open WhatsApp Manually
                   </Button>
                ) : isWaitingForReturn ? (
                   <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-full">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                      <span className="text-xs font-bold uppercase tracking-wide">Waiting for Return</span>
                   </div>
                ) : isRunning && countdown > 0 ? (
                    <span className="text-zinc-400 text-sm italic">Preparing next contact...</span>
                ) : !isRunning && (
                    <span className="text-zinc-400 text-sm">Paused</span>
                )}
             </div>
          </div>

       </div>

       {/* Control Deck */}
       <div className="p-6 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-20 pb-8 safe-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-4 mb-6">
             <div className="flex-1 h-14 bg-zinc-100 dark:bg-zinc-950 rounded-2xl flex items-center px-4 justify-between border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Auto-Delay</span>
                <div className="flex items-center gap-3">
                   <button 
                     onClick={() => dispatch({ type: 'UPDATE_CONFIG', payload: { delay: Math.max(0.5, state.config.delay - 0.5) }})} 
                     className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-zinc-500 hover:text-emerald-500 shadow-sm transition-colors text-lg font-medium"
                   >-</button>
                   <span className="text-base font-mono font-bold text-zinc-900 dark:text-white w-10 text-center">{state.config.delay}s</span>
                   <button 
                     onClick={() => dispatch({ type: 'UPDATE_CONFIG', payload: { delay: state.config.delay + 0.5 }})} 
                     className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-zinc-500 hover:text-emerald-500 shadow-sm transition-colors text-lg font-medium"
                   >+</button>
                </div>
             </div>
          </div>

          <div className="flex gap-3">
             {isRunning ? (
               <Button onClick={toggleRun} fullWidth size="xl" variant="secondary" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20">
                  <Pause size={24} className="mr-2 fill-current" /> Pause
               </Button>
             ) : (
               <Button onClick={toggleRun} fullWidth size="xl" className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30">
                  <Play size={24} className="mr-2 fill-current" /> 
                  {state.currentContactIndex === 0 ? 'Start Auto-Run' : 'Resume Run'}
               </Button>
             )}
             
             {!isRunning && (
               <Button onClick={() => { if(confirm("Cancel current run and return to editor?")) dispatch({ type: 'SET_STEP', payload: 'compose' })}} size="xl" variant="ghost" className="aspect-square px-0 w-16">
                 <Square size={20} className="fill-zinc-400" />
               </Button>
             )}
          </div>
       </div>
    </div>
  );
};