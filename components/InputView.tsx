import React, { useState } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { Trash2, ArrowRight, Smartphone, Search, CheckCircle2 } from 'lucide-react';
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
      // Create a set of existing numbers to prevent duplicates
      const seenNumbers = new Set<string>(state.contacts.map(c => c.number));

      for (const contact of result.contacts) {
        // Strict filtering: Must have phones, must have a number
        if (contact.phones && contact.phones.length > 0) {
          for (const phoneObj of contact.phones) {
            const rawNumber = phoneObj.number || '';
            const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
            
            // Heuristic: Valid length and not already added
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
        const finalList = [...state.contacts, ...newContacts];
        dispatch({ type: 'IMPORT_CONTACTS', payload: finalList });
        logger.success(`Imported ${newContacts.length} contacts`);
      } else {
        logger.warning('No new valid contacts found.');
      }
    } catch (e) {
      console.error(e);
      logger.error('Failed to access contacts');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeContact = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent row selection
    const updated = state.contacts.filter(c => c.id !== id);
    dispatch({ type: 'IMPORT_CONTACTS', payload: updated });
    // If we removed the selected contact, reset selection
    if (state.contacts[state.currentContactIndex]?.id === id) {
       dispatch({ type: 'SET_CONTACT_INDEX', payload: -1 });
    }
  };

  const toggleSelection = (index: number) => {
    // If clicking the same one, deselect. Otherwise select new one.
    const newIndex = state.currentContactIndex === index ? -1 : index;
    dispatch({ type: 'SET_CONTACT_INDEX', payload: newIndex });
  };

  // Filter logic
  const filteredContacts = state.contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.number.includes(searchQuery)
  );

  const hasContacts = state.contacts.length > 0;
  const selectedContact = state.currentContactIndex >= 0 ? state.contacts[state.currentContactIndex] : null;

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
              <p className="text-xs text-zinc-500 mb-2">Select a contact below to start sending from that point.</p>
              
              <div className="relative mt-2">
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
                filteredContacts.map((contact, idx) => {
                  // Find the actual index in the main state.contacts array to ensure selection maps correctly even when filtered
                  const actualIndex = state.contacts.findIndex(c => c.id === contact.id);
                  const isSelected = actualIndex === state.currentContactIndex;
                  
                  return (
                    <div 
                      key={contact.id} 
                      onClick={() => toggleSelection(actualIndex)}
                      className={`flex items-center justify-between p-3 border rounded-xl shadow-sm transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800'
                      }`}
                    >
                       <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${
                             isSelected 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                          }`}>
                             {isSelected ? <CheckCircle2 size={20} /> : contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                             <p className={`font-semibold truncate text-sm ${isSelected ? 'text-emerald-900 dark:text-emerald-100' : 'text-zinc-900 dark:text-white'}`}>
                               {contact.name}
                             </p>
                             <p className="text-xs text-zinc-500 font-mono truncate">{contact.number}</p>
                          </div>
                       </div>
                       <button 
                          onClick={(e) => removeContact(e, contact.id)} 
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors z-10"
                       >
                          <Trash2 size={16} />
                       </button>
                    </div>
                  );
                })
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
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent z-20">
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
               {selectedContact 
                 ? <span>Compose for <span className="font-bold">{selectedContact.name}</span></span>
                 : "Compose Message"
               } <ArrowRight size={20} className="ml-2" />
             </Button>
          </div>
        </div>
      )}
    </div>
  );
};