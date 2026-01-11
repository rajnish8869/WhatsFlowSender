import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Contact } from '../types';
import { Button } from './ui/Button';
import { logger } from '../utils/logger';
import { 
  X, Send, SkipForward, Check, Phone, Share2, MessageSquare, List, Search
} from 'lucide-react';

interface SessionModeProps {
  appState: AppState;
  dispatch: React.Dispatch<any>;
}

export const SessionMode: React.FC<SessionModeProps> = ({ appState, dispatch }) => {
  const [showList, setShowList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const activeContacts = useMemo(() => appState.contacts, [appState.contacts]);
  const currentContact = activeContacts[appState.currentContactIndex];
  
  // Calculate progress relative to total list
  const progress = activeContacts.length > 0 ? ((appState.currentContactIndex) / activeContacts.length) * 100 : 100;
  
  // Auto-redirect to summary if done
  useEffect(() => {
    if (appState.currentContactIndex >= activeContacts.length) {
        dispatch({ type: 'SET_STEP', payload: 'summary' });
    }
  }, [appState.currentContactIndex, activeContacts.length, dispatch]);

  const handleSendText = () => {
    if (!currentContact) return;
    const msg = appState.messageTemplate.replace(/{name}/g, currentContact.name);
    const url = `https://wa.me/${currentContact.number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    logger.info(`Opening WhatsApp for ${currentContact.name}`);
    window.open(url, '_blank');
  };

  const handleShareFile = async () => {
    if (!currentContact || !appState.attachment) return;
    
    const msg = appState.messageTemplate.replace(/{name}/g, currentContact.name);
    
    if (navigator.share && navigator.canShare({ files: [appState.attachment.file] })) {
       try {
         await navigator.share({
           files: [appState.attachment.file],
           text: msg,
         });
         logger.success('Opened share sheet');
       } catch (err) {
         logger.error('Share cancelled or failed');
       }
    } else {
       logger.error('File sharing is not supported on this device/browser');
       alert('Native file sharing is not supported in this environment.');
    }
  };

  const next = (status: Contact['status']) => {
    if (!currentContact) return;
    dispatch({ type: 'UPDATE_CONTACT_STATUS', payload: { index: appState.currentContactIndex, status } });
    dispatch({ type: 'NEXT_CONTACT' });
  };

  const jumpTo = (index: number) => {
    dispatch({ type: 'SET_CONTACT_INDEX', payload: index });
    setShowList(false);
  };

  // Guard against null currentContact during transition
  if (!currentContact) {
      return null;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in relative pb-8">
        
        {/* Contact List Drawer/Modal */}
        {showList && (
           <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-900">
                 <h3 className="font-bold text-lg">Select Contact</h3>
                 <button onClick={() => setShowList(false)} className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full">
                    <X size={20} />
                 </button>
              </div>
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                   <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter..."
                      className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none"
                   />
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                 {activeContacts.map((c, idx) => {
                    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.number.includes(searchQuery)) return null;
                    const isActive = idx === appState.currentContactIndex;
                    return (
                      <button 
                        key={c.id} 
                        onClick={() => jumpTo(idx)}
                        className={`w-full flex items-center p-3 rounded-xl border transition-all ${
                           isActive 
                             ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                             : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                        }`}
                      >
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${isActive ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                            {idx + 1}
                         </div>
                         <div className="text-left flex-1 min-w-0">
                            <p className={`font-medium text-sm truncate ${isActive ? 'text-emerald-900 dark:text-emerald-200' : 'text-zinc-900 dark:text-white'}`}>{c.name}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-xs text-zinc-500 font-mono truncate">{c.number}</p>
                               {c.status === 'sent' && <Check size={12} className="text-emerald-500" />}
                            </div>
                         </div>
                      </button>
                    );
                 })}
              </div>
           </div>
        )}

        {/* Progress Strip */}
        <div className="absolute -top-6 -left-6 -right-6 h-1 bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Top Controls */}
        <div className="flex items-center justify-between mb-4">
            <button onClick={() => confirm('Exit session?') && dispatch({ type: 'SET_STEP', payload: 'compose' })} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={24} />
            </button>
            <div className="flex gap-2">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                  {appState.currentContactIndex + 1} / {activeContacts.length}
              </div>
              <button onClick={() => setShowList(true)} className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1">
                 <List size={14} /> <span className="text-xs font-bold">List</span>
              </button>
            </div>
            <div className="w-8" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center py-4 overflow-y-auto custom-scrollbar">
            <div className="relative w-full">
                {/* Decoration Card Behind */}
                <div className="absolute top-4 left-4 right-4 bottom-[-10px] bg-zinc-50 dark:bg-zinc-800 rounded-[2.5rem] scale-95 opacity-50 -z-10" />
                
                {/* Main Card */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl shadow-zinc-200/50 dark:shadow-none flex flex-col items-center text-center">
                    
                    {/* Avatar */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/20 flex items-center justify-center mb-5 shadow-inner ring-4 ring-white dark:ring-zinc-900">
                        <span className="text-3xl font-bold text-primary-700 dark:text-primary-300">
                            {currentContact.name.charAt(0).toUpperCase()}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 line-clamp-1 break-all px-2">
                        {currentContact.name}
                    </h2>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm font-mono mb-4">
                        <Phone size={12} />
                        {currentContact.number}
                    </div>

                    {/* Attachment Indicator */}
                    {appState.attachment && (
                      <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-100 dark:border-blue-800">
                         <Share2 size={12} />
                         <span>Including {appState.attachment.type.startsWith('image/') ? 'Image' : 'File'}</span>
                      </div>
                    )}

                    {/* Message Preview */}
                    <div className="w-full bg-zinc-50 dark:bg-black/40 rounded-2xl p-4 text-left mb-2 relative group border border-zinc-100 dark:border-zinc-800/50">
                        <div className="absolute -top-2.5 left-4 px-1.5 bg-white dark:bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Preview
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                            {appState.messageTemplate.replace(/{name}/g, currentContact.name)}
                        </p>
                    </div>

                    {/* Disclaimer for File Sharing */}
                    {appState.attachment && (
                        <p className="text-[10px] text-zinc-400 mt-2 max-w-xs leading-tight">
                          Note: You must select <strong>WhatsApp</strong> & then the contact <strong>{currentContact.name}</strong> manually when sharing files.
                        </p>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto space-y-3 pt-4">
            
            {appState.attachment ? (
              <div className="space-y-3">
                 <Button 
                    onClick={handleShareFile} 
                    size="xl" 
                    fullWidth 
                    className="bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 shadow-lg border-none"
                  >
                    <Share2 size={24} className="mr-2" /> Share File & Text
                  </Button>
                  <Button 
                    onClick={handleSendText} 
                    size="lg" 
                    fullWidth 
                    variant="secondary"
                    className="bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200"
                  >
                    <MessageSquare size={18} className="mr-2" /> Send Text Only
                  </Button>
              </div>
            ) : (
              <Button 
                  onClick={handleSendText} 
                  size="xl" 
                  fullWidth 
                  className="bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-green-500/20 shadow-lg border-none"
              >
                  <Send size={24} className="mr-2" /> Open WhatsApp
              </Button>
            )}
            
            <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => next('skipped')} variant="secondary" size="lg" className="rounded-2xl">
                    <SkipForward size={20} className="mr-2 text-zinc-400" /> Skip
                </Button>
                <Button onClick={() => next('sent')} variant="primary" size="lg" className="bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 rounded-2xl shadow-none">
                    <Check size={20} className="mr-2" /> Mark Sent
                </Button>
            </div>
        </div>
    </div>
  );
};