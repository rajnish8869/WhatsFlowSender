import React, { useState } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Upload, Trash2, ArrowRight, FileText, CheckCircle2, X, Smartphone, Search, User, Plus } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Process pasted text or input
  const processInput = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = rawInput.split(/\r?\n/);
      const newContacts: Contact[] = [];
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
        projection: { name: true, phones: true },
      });

      const newContacts: Contact[] = [];
      const seenNumbers = new Set<string>(
         isAdding ? state.contacts.map(c => c.number) : []
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
                 name: contact.name?.display || 'Unknown',
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
        logger.warning('No new contacts found.');
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

  const hasContacts = state.contacts.length > 0;
  const showList = hasContacts && !isAdding;

  // Filter logic
  const filteredContacts = state.contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.number.includes(searchQuery)
  );

  return (
    <div className="h-full flex flex-col animate-fade-in relative bg-zinc-50 dark:bg-zinc-950">
      
      {showList ? (
        // --- LIST VIEW ---
        <div className="flex-1 flex flex-col h-full overflow-hidden">
           <div className="flex-none px-6 pt-6 pb-2">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center justify-between">
                <span>Recipients</span>
                <span className="text-sm font-medium px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400">
                  {state.contacts.length}
                </span>
              </h2>
              
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or number..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
                />
              </div>
           </div>

           <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-10 text-zinc-400">
                  <p>No contacts match your search.</p>
                </div>
              ) : (
                filteredContacts.map((contact, idx) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold shrink-0">
                           {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                           <p className="font-semibold text-zinc-900 dark:text-white truncate text-sm">{contact.name}</p>
                           <p className="text-xs text-zinc-500 font-mono truncate">{contact.number}</p>
                        </div>
                     </div>
                     <button onClick={() => removeContact(contact.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={16} />
                     </button>
                  </div>
                ))
              )}
              {/* Spacer for bottom button */}
              <div className="h-24" />
           </div>

           <div className="absolute bottom-24 right-6 left-6 flex justify-end pointer-events-none">
              <button 
                onClick={() => { setIsAdding(true); setRawInput(''); }}
                className="pointer-events-auto bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl rounded-full px-5 py-3 font-bold flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Plus size={20} /> Add
              </button>
           </div>
        </div>
      ) : (
        // --- INPUT VIEW ---
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-24">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
              {isAdding && hasContacts ? 'Add More Contacts' : 'Target Audience'}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
              Paste your list below or import directly from your phone's address book.
            </p>
          </div>

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
                   <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={handleNativeImport} isLoading={isProcessing}>
                        <Smartphone size={16} className="mr-2" /> Import
                      </Button>
                   </div>
                   <div className="flex gap-2">
                      {isAdding && hasContacts && (
                        <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                          Cancel
                        </Button>
                      )}
                      <Button size="sm" onClick={processInput} isLoading={isProcessing} disabled={!rawInput.trim()}>
                        <Upload size={16} className="mr-2" /> {isAdding ? 'Append' : 'Parse'}
                      </Button>
                   </div>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Fixed Bottom Action */}
      {!isAdding && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent z-10">
          <div className="flex gap-3">
             {hasContacts && (
                <Button 
                   fullWidth 
                   variant="danger"
                   size="xl"
                   onClick={() => { if(confirm('Clear all contacts?')) dispatch({ type: 'CLEAR_CONTACTS' }); }}
                   className="flex-[0.3]"
                >
                   <Trash2 size={20} />
                </Button>
             )}
             <Button 
               fullWidth 
               size="xl" 
               disabled={!hasContacts} 
               onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
               className={hasContacts ? "shadow-xl shadow-emerald-500/20 flex-1" : "flex-1"}
             >
               Compose Message <ArrowRight size={20} className="ml-2" />
             </Button>
          </div>
        </div>
      )}
    </div>
  );
};