import React from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';

interface ServerSyncBarProps {
  online: boolean;
  syncing: boolean;
  onRefresh: () => void;
}

/**
 * Тонкий индикатор синхронизации под верхним меню.
 * Показывает, что данные идут с общего сервера, и даёт ручное обновление
 * (полезно, если не хочется ждать автоматический опрос).
 */
export const ServerSyncBar: React.FC<ServerSyncBarProps> = ({ online, syncing, onRefresh }) => {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[95]">
      <div
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl ${
          online
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
            : 'border-white/15 bg-black/70 text-zinc-400'
        }`}
        title={
          online
            ? 'Данные синхронизируются с общим сервером'
            : 'Сервер недоступен — показаны локальные данные'
        }
      >
        {syncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : online ? (
          <Cloud className="h-3 w-3" />
        ) : (
          <CloudOff className="h-3 w-3" />
        )}
        <span className="hidden sm:inline">
          {syncing ? 'Синхронизация…' : online ? 'Синхронизировано' : 'Локальные данные'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-0.5 rounded-full p-0.5 hover:bg-white/10 transition-colors"
          aria-label="Обновить данные с сервера"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
