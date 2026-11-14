import React from 'react';
import { AlertTriangle, CheckCheck, CloudOff, Loader2, RefreshCw } from 'lucide-react';

interface ServerSyncBarProps {
  online: boolean;
  syncing: boolean;
  saveState: 'saved' | 'saving' | 'unsaved';
  onRefresh: () => void;
}

/**
 * Индикатор состояния данных в левом нижнем углу.
 * Три состояния важны для админа:
 *   saved   — правки лежат в общей базе, их видят все устройства;
 *   saving  — идёт отправка;
 *   unsaved — правка есть только в этом браузере (нет токена или сеть).
 */
export const ServerSyncBar: React.FC<ServerSyncBarProps> = ({
  online,
  syncing,
  saveState,
  onRefresh,
}) => {
  const view =
    saveState === 'saving' || syncing
      ? {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Сохранение…',
          cls: 'border-white/15 bg-black/70 text-zinc-300',
          hint: 'Отправляем изменения в общую базу',
        }
      : saveState === 'unsaved'
        ? {
            icon: <AlertTriangle className="h-3 w-3" />,
            text: 'Только на этом устройстве',
            cls: 'border-[#E50914]/40 bg-[#E50914]/15 text-[#FF8A90]',
            hint: 'Правки не ушли в общую базу: нет токена записи или сеть недоступна',
          }
        : online
          ? {
              icon: <CheckCheck className="h-3 w-3" />,
              text: 'Сохранено везде',
              cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
              hint: 'Данные в общей базе — их видят все устройства',
            }
          : {
              icon: <CloudOff className="h-3 w-3" />,
              text: 'Нет связи',
              cls: 'border-white/15 bg-black/70 text-zinc-400',
              hint: 'Общая база недоступна — показаны локальные данные',
            };

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[95]">
      <div
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl ${view.cls}`}
        title={view.hint}
      >
        {view.icon}
        <span className="hidden sm:inline">{view.text}</span>
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
