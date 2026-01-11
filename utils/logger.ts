import { LogEntry } from '../types';

type LogListener = (entry: LogEntry) => void;

class LoggerService {
  private listeners: LogListener[] = [];
  private logs: LogEntry[] = [];

  subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(entry: LogEntry) {
    this.logs.push(entry);
    this.listeners.forEach(l => l(entry));
    // Keep console sync
    const style = entry.type === 'error' ? 'color: red' : 'color: green';
    console.log(`%c[${entry.type.toUpperCase()}] ${entry.message}`, style);
  }

  log(message: string, type: LogEntry['type'] = 'info') {
    this.notify({
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date()
    });
  }

  info(msg: string) { this.log(msg, 'info'); }
  success(msg: string) { this.log(msg, 'success'); }
  error(msg: string) { this.log(msg, 'error'); }
  warning(msg: string) { this.log(msg, 'warning'); }
  
  getHistory() { return this.logs; }
}

export const logger = new LoggerService();