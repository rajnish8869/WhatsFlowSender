import React, { useState, useEffect } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Upload, Trash2, ArrowRight, FileText, CheckCircle2, X, Smartphone, List, UserMinus } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

type ViewMode = 'input' | 'summary' | 'list';

export const InputView: React.FC<Props> = ({ state, dispatch }) => {
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(state.contacts.length > 0 ? 'summary' : 'input');

  // Automatically switch to input if contacts are cleared
  useEffect(() => {
    if (state.contacts.length === 0 && viewMode !== 'input') {
      setViewMode('input');
    }
  }, [state.contacts.length]);

  const isAppendMode = state.contacts.length > 0;

  const processInput = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = rawInput.split(/\r?\n/);
      const newContacts: Contact[] = [];
      const seenNumbers = new Set<string>(
        isAppendMode ? state.contacts.map(c => c.number) : []
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
        const finalList = isAppendMode ? [...state.contacts, ...newContacts] : newContacts;
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(isAppendMode ? `Added ${newContacts.length} new contacts` : `Imported ${newContacts.length} unique contacts`);
        setRawInput('');
        setViewMode('summary');
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
        projection: { name: true, phones: true },
      });

      const newContacts: Contact[] = [];
      const seenNumbers = new Set<string>(
         isAppendMode ? state.contacts.map(c => c.number) : []
      );

      for (const contact of result.contacts) {
        if (contact.phones && contact.phones.length > 0) {
          for (const phoneObj of contact.phones) {
            const rawNumber = phoneObj.number || '';
            const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
            
            if (cleanNumber.length > 6 && !seenNumbers.has(cleanNumber)) {
               seenNumbers.add(cleanNumber);
               newContacts.push({
                 id: crypto.randomUUID(),
                 // Use safe navigation for name.display as per plugin spec
                 name: contact.name?.display || 'Unknown',
                 number: cleanNumber,
                 status: 'pending'
               });
            }
          }
        }
      }

      if (newContacts.length > 0) {
        const finalList = isAppendMode ? [...state.contacts, ...newContacts] : newContacts;
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(`Imported ${newContacts.length} contacts from device`);
        setViewMode('summary');
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

  const removeContact = (id: string) => {
    const updated = state.contacts.filter(c => c.id !== id);
    dispatch({ type: 'IMPORT_CONTACTS', payload: updated });
  };

  // Render logic
  const renderContent = () => {
    if (viewMode === 'list') {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-lg animate-fade-in">
           <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-zinc-900 dark:text-white">Contact List ({state.contacts.length})</h3>
              <Button size="sm" variant="ghost" onClick={() => setViewMode('summary')}>
                <X size={16} />
              </Button>
           </div>
           <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {state.contacts.map((contact, idx) => (
                <div key={contact.id} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors group">
                   <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xs font-mono text-zinc-400 w-6 shrink-0">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 truncate">{contact.name}</p>
                        <p className="text-xs text-zinc-500 font-mono truncate">{contact.number}</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => removeContact(contact.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                   >
                     <UserMinus size={16} />
                   </button>
                </div>
              ))}
           </div>
        </div>
      );
    }

    if (viewMode === 'input') {
      return (
         <div className="relative group flex flex-col min-h-[300px] flex-1 animate-fade-in">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-30 transition duration-1000 group-hover:opacity-50" />
             <div className="relative flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <textarea 
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`John Doe, 1234567890\nJane Smith, 9876543210\n+15550009999`}
                  className="flex-1 w-full p-4 bg-transparent text-zinc-900 dark:text-zinc-200 font-mono text-sm focus:outline-none resize-none custom-scrollbar placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  spellCheck={false}
                  autoFocus={isAppendMode}
                />
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                   <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={handleNativeImport} isLoading={isProcessing}>
                        <Smartphone size={16} className="mr-2" /> <span className="hidden sm:inline">Import</span> Phone
                      </Button>
                   </div>
                   <div className="flex gap-2">
                      {isAppendMode && (
                        <Button size="sm" variant="ghost" onClick={() => setViewMode('summary')}>
                          <X size={16} className="mr-2" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" onClick={processInput} isLoading={isProcessing} disabled={!rawInput.trim()}>
                        <Upload size={16} className="mr-2" /> {isAppendMode ? 'Append' : 'Parse List'}
                      </Button>
                   </div>
                </div>
             </div>
         </div>
      );
    }

    // Summary Mode
    return (
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-slide-up relative overflow-hidden shadow-lg min-h-[300px]">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
         
         <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6 ring-4 ring-emerald-50 dark:ring-emerald-500/20">
           <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-500" />
         </div>
         
         <h3 className="text-4xl font-black text-zinc-900 dark:text-white mb-2">{state.contacts.length}</h3>
         <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Contacts Ready</p>
         
         <div className="mt-8 grid grid-cols-2 gap-3 z-10 w-full max-w-xs">
            <Button variant="danger" size="sm" onClick={() => dispatch({ type: 'CLEAR_CONTACTS' })}>
              <Trash2 size={16} className="mr-2" /> Clear
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setViewMode('list')}>
               <List size={16} className="mr-2" /> View
            </Button>
            <Button variant="primary" size="sm" className="col-span-2" onClick={() => { setViewMode('input'); setRawInput(''); }}>
               <FileText size={16} className="mr-2" /> Add More
            </Button>
         </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-24">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            {viewMode === 'input' && isAppendMode ? 'Add More Contacts' : 'Target Audience'}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            {viewMode === 'list' 
              ? 'Review and manage your recipient list.' 
              : 'Paste your list or import from phone. Supports CSV and Text.'}
          </p>
        </div>
        
        {renderContent()}
      </div>

      {viewMode !== 'input' && viewMode !== 'list' && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent z-20">
          <Button 
            fullWidth 
            size="xl" 
            disabled={!isAppendMode} 
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
            className={isAppendMode ? "shadow-xl shadow-emerald-500/20" : ""}
          >
            Next Step <ArrowRight size={20} className="ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};