import React, { useState } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Trash2, ArrowRight, Smartphone, Search } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

export const InputView: React.FC<Props> = ({ state, dispatch }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const seenNumbers = new Set<string>(state.contacts.map(c => c.number));

      for (const contact of result.contacts) {
        // Strict filtering: Must have phones, must have a number, length check
        if (contact.phones && contact.phones.length > 0) {
          for (const phoneObj of contact.phones) {
            const rawNumber = phoneObj.number || '';
            const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
            
            // Basic WhatsApp validation heuristic: Number exists and has sufficient length
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
        // Always Append for native import in this flow
        const finalList = [...state.contacts, ...newContacts];
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(`Imported ${newContacts.length} contacts from device`);
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

  // Filter logic
  const filteredContacts = state.contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.number.includes(searchQuery)
  );

  const hasContacts = state.contacts.length > 0;

  return (
    <div className="h-full flex flex-col animate-fade-in relative bg-zinc-50 dark:bg-zinc-950">
      
      {hasContacts ? (
        // --- LIST VIEW (Default if contacts exist) ---
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
                filteredContacts.map((contact) => (
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
        </div>
      ) : (
        // --- EMPTY STATE (Import View) ---
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl max-w-sm w-full">
                <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-50 dark:ring-emerald-500/20">
                    <Smartphone size={32} className="text-emerald-600 dark:text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">Load Contacts</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
                    Import contacts from your device to begin. We automatically filter for valid phone numbers suitable for WhatsApp.
                </p>
                <Button 
                    size="xl" 
                    fullWidth 
                    onClick={handleNativeImport} 
                    isLoading={isProcessing}
                    className="shadow-emerald-500/20"
                >
                    <Smartphone size={20} className="mr-2" /> Import from Device
                </Button>
            </div>
        </div>
      )}

      {/* Fixed Bottom Action */}
      {hasContacts && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent z-10">
          <div className="flex gap-3">
             <Button 
                fullWidth 
                variant="danger"
                size="xl"
                onClick={() => { if(confirm('Clear all contacts?')) dispatch({ type: 'CLEAR_CONTACTS' }); }}
                className="flex-[0.3]"
             >
                <Trash2 size={20} />
             </Button>
             
             <Button 
               fullWidth 
               size="xl" 
               onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
               className="shadow-xl shadow-emerald-500/20 flex-1"
             >
               Compose Message <ArrowRight size={20} className="ml-2" />
             </Button>
          </div>
        </div>
      )}
    </div>
  );
};