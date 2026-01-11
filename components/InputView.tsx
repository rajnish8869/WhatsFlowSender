import React, { useState } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Upload, Trash2, ArrowRight, FileText, CheckCircle2, X, Smartphone } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

export const InputView: React.FC<Props> = ({ state, dispatch }) => {
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const processInput = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = rawInput.split(/\r?\n/);
      const newContacts: Contact[] = [];
      
      // If adding, start with existing numbers to prevent duplicates
      // If replacing (initial load), start empty
      const seenNumbers = new Set<string>(
        isAdding ? state.contacts.map(c => c.number) : []
      );

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        const parts = trimmed.split(/[,|\t;](.*)/s);
        let name = '';
        let number = '';

        if (parts.length >= 2) {
          name = parts[0].trim();
          number = parts[1].replace(/[^0-9]/g, '');
        } else {
          number = trimmed.replace(/[^0-9]/g, '');
          // Heuristic: skip if it looks like text but interpreted as number
          if (/[a-zA-Z]/.test(trimmed) && number.length < 5) return;
          name = `Contact ${number.slice(-4)}`;
        }

        if (number.length > 6 && !seenNumbers.has(number)) {
          seenNumbers.add(number);
          newContacts.push({
            id: crypto.randomUUID(),
            name: name || 'Friend',
            number,
            status: 'pending'
          });
        }
      });

      if (newContacts.length > 0) {
        // If adding, merge. If not, just use new list (which is effectively replacement)
        const finalList = isAdding ? [...state.contacts, ...newContacts] : newContacts;
        
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(isAdding ? `Added ${newContacts.length} new contacts` : `Imported ${newContacts.length} unique contacts`);
        setRawInput('');
        setIsAdding(false);
      } else {
        logger.warning('No valid new numbers found.');
      }
      setIsProcessing(false);
    }, 150);
  };

  const handleNativeImport = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert("This feature is only available on Android/iOS devices.");
      return;
    }

    setIsProcessing(true);
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        logger.error('Contacts permission denied');
        setIsProcessing(false);
        return;
      }

      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });

      const newContacts: Contact[] = [];
      const seenNumbers = new Set<string>(
         isAdding ? state.contacts.map(c => c.number) : []
      );

      for (const contact of result.contacts) {
        if (contact.phones && contact.phones.length > 0) {
          // Flatten all numbers for this contact
          for (const phoneObj of contact.phones) {
            const rawNumber = phoneObj.number || '';
            const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
            
            if (cleanNumber.length > 6 && !seenNumbers.has(cleanNumber)) {
               seenNumbers.add(cleanNumber);
               newContacts.push({
                 id: crypto.randomUUID(),
                 name: contact.displayName || contact.name?.display || 'Unknown',
                 number: cleanNumber,
                 status: 'pending'
               });
            }
          }
        }
      }

      if (newContacts.length > 0) {
        const finalList = isAdding ? [...state.contacts, ...newContacts] : newContacts;
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(`Imported ${newContacts.length} contacts from device`);
        setIsAdding(false);
      } else {
        logger.warning('No new contacts with valid numbers found.');
      }

    } catch (e) {
      console.error(e);
      logger.error('Failed to access contacts');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasContacts = state.contacts.length > 0;
  const showInput = !hasContacts || isAdding;

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-24">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            {isAdding ? 'Add More Contacts' : 'Target Audience'}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            Paste your list below or import directly from your phone's address book.
          </p>
        </div>

        {showInput ? (
           <div className="relative group flex flex-col min-h-[300px] flex-1">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-30 transition duration-1000 group-hover:opacity-50" />
             <div className="relative flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <textarea 
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`John Doe, 1234567890\nJane Smith, 9876543210\n+15550009999`}
                  className="flex-1 w-full p-4 bg-transparent text-zinc-900 dark:text-zinc-200 font-mono text-sm focus:outline-none resize-none custom-scrollbar placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  spellCheck={false}
                  autoFocus={isAdding}
                />
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                   
                   {/* Left side actions */}
                   <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={handleNativeImport} isLoading={isProcessing}>
                        <Smartphone size={16} className="mr-2" /> Import from Phone
                      </Button>
                   </div>

                   {/* Right side actions */}
                   <div className="flex gap-3">
                      {isAdding && (
                        <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                          <X size={16} className="mr-2" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" onClick={processInput} isLoading={isProcessing} disabled={!rawInput.trim()}>
                        <Upload size={16} className="mr-2" /> {isAdding ? 'Append' : 'Parse List'}
                      </Button>
                   </div>
                </div>
             </div>
           </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-slide-up relative overflow-hidden shadow-lg min-h-[300px]">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
             
             <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6 ring-4 ring-emerald-50 dark:ring-emerald-500/20">
               <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-500" />
             </div>
             
             <h3 className="text-4xl font-black text-zinc-900 dark:text-white mb-2">{state.contacts.length}</h3>
             <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Contacts Ready</p>
             
             <div className="mt-8 flex gap-3 z-10 w-full max-w-xs">
                <Button variant="danger" size="sm" fullWidth onClick={() => dispatch({ type: 'CLEAR_CONTACTS' })}>
                  <Trash2 size={16} className="mr-2" /> Clear
                </Button>
                <Button variant="secondary" size="sm" fullWidth onClick={() => { setIsAdding(true); setRawInput(''); }}>
                   <FileText size={16} className="mr-2" /> Add More
                </Button>
             </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action */}
      {!isAdding && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent">
          <Button 
            fullWidth 
            size="xl" 
            disabled={!hasContacts} 
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
            className={hasContacts ? "shadow-xl shadow-emerald-500/20" : ""}
          >
            Next Step <ArrowRight size={20} className="ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};