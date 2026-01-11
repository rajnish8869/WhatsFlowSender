import React from 'react';
import { AppState } from '../types';
import { Button } from './ui/Button';
import { CheckCircle2, RotateCcw, Home } from 'lucide-react';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

export const SummaryView: React.FC<Props> = ({ state, dispatch }) => {
  const sent = state.contacts.filter(c => c.status === 'sent').length;
  
  return (
    <div className="h-full overflow-y-auto p-6 bg-white dark:bg-zinc-950 animate-fade-in text-center flex flex-col items-center justify-center">
       
       <div className="w-32 h-32 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-8 ring-1 ring-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
          <CheckCircle2 size={64} className="text-emerald-500" />
       </div>

       <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Mission Complete</h1>
       <p className="text-zinc-500 dark:text-zinc-400 mb-12 max-w-xs">All contacts in the queue have been processed.</p>

       <div className="w-full max-w-sm grid grid-cols-2 gap-4 mb-12">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
             <p className="text-4xl font-bold text-zinc-900 dark:text-white">{sent}</p>
             <p className="text-xs text-emerald-600 dark:text-emerald-500 uppercase font-bold tracking-wider mt-1">Sent</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
             <p className="text-4xl font-bold text-zinc-400 dark:text-zinc-500">{state.contacts.length - sent}</p>
             <p className="text-xs text-zinc-400 dark:text-zinc-600 uppercase font-bold tracking-wider mt-1">Failed/Skip</p>
          </div>
       </div>

       <div className="w-full max-w-sm space-y-3">
          <Button fullWidth size="xl" onClick={() => { dispatch({ type: 'RESET_RUNNER' }); dispatch({ type: 'SET_STEP', payload: 'running' }); }}>
             <RotateCcw size={20} className="mr-2" /> Restart Same List
          </Button>
          <Button fullWidth size="lg" variant="ghost" onClick={() => { dispatch({ type: 'CLEAR_CONTACTS' }); dispatch({ type: 'SET_STEP', payload: 'input' }); }}>
             <Home size={20} className="mr-2" /> New Campaign
          </Button>
       </div>

    </div>
  );
};