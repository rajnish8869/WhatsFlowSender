import React, { useEffect, useState, useRef } from 'react';
import { LogEntry } from '../types';
import { logger } from '../utils/logger';
import { Terminal, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

export const DebugConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((log) => {
      setLogs(prev => [...prev, log]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all active:scale-95 border border-gray-700"
      >
        <Terminal size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-gray-950 border-t border-gray-800 shadow-2xl flex flex-col max-h-[40vh] transition-all duration-300 ease-in-out">
      <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 text-gray-300">
          <Terminal size={16} />
          <span className="text-xs font-mono font-bold">SYSTEM LOGS</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLogs([])} className="p-1 text-gray-400 hover:text-red-400">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-white">
            <ChevronDown size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 bg-black/90 backdrop-blur-sm">
        {logs.length === 0 && (
          <div className="text-gray-600 italic">No logs yet...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-gray-500 shrink-0">
              [{log.timestamp.toLocaleTimeString().split(' ')[0]}]
            </span>
            <span className={`${getLogColor(log.type)} break-all`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};