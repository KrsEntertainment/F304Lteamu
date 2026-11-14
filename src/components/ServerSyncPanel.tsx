import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  CloudOff,
  Database,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { getApiBase, getUserId } from '../utils/api';
import { hasPending, pingServer, pushData } from '../utils/sync';
import type { StudioData } from '../types';

interface ServerSyncPanelProps {
  data: StudioData;
  onPulled?: () => void;
}

type Status = 'checking' | 'ok' | 'fail';

/**
 * Панель общей базы. Никаких токенов, режимов и адресов:
 * адрес сервера известен сборке, право записи даёт PIN, который админ уже ввёл.
 * Здесь только показывается честный статус и кнопка «Отправить сейчас».
 */
export const ServerSyncPanel: React.FC<ServerSyncPanelProps> = ({ data, onPulled }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [storage, setStorage] = useState<string>('');
  const [backend, setBackend] = useState<string>('');
  const [persistent, setPersistent] = useState<boolean>(true);
  const [pending, setPending] = useState<boolean>(hasPending());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string>('');

  const check = useCallback(async () => {
    setStatus('checking');
    const res = await pingServer();
    if (res.ok) {
      setStatus('ok');
      setUpdatedAt(res.updatedAt || 0);
      setStorage(res.storage || '');
      setBackend(res.backend || '');
      setPersistent(res.storage ? res.storage === 'deno-kv' : true);
    } else {
      setStatus('fail');
    }
    setPending(hasPending());
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 20_000);
    return () => window.clearInterval(id);
  }, [check]);

  const sendNow = async () => {
    setSending(true);
    setMessage('');
    try {
      await pushData(data);
      setMessage('Правки сохранены в общей базе');
      setPending(false);
      setStatus('ok');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не удалось отправить правки');
      setPending(true);
    } finally {
      setSending(false);
    }
  };

  const refresh = async () => {
    setMessage('');
    onPulled?.();
    await check();
  };

  const dateLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {status === 'checking' ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            ) : status === 'ok' ? (
              <CheckCheck className="h-5 w-5 text-emerald-400" />
            ) : (
              <CloudOff className="h-5 w-5 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {status === 'checking'
                ? 'Проверяю общую базу…'
                : status === 'ok'
                  ? 'Общая база подключена'
                  : 'Нет связи с общей базой'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {status === 'ok'
                ? `${backend === 'github' ? 'Резервный канал записи. ' : ''}Данные обновлены: ${dateLabel}. Правки сразу видны на всех устройствах.`
                : status === 'fail'
                  ? 'Правки сохраняются в этом браузере и уйдут сами, как только связь вернётся.'
                  : 'Определяю адрес сервера автоматически.'}
            </p>
            {!persistent && status === 'ok' && (
              <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                Хранилище временное: база Deno KV ещё не подключена к приложению
                (console.deno.com → Databases → Provision Database → Deno KV → Assign).
                До этого правки живут только в памяти сервера.
              </p>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              {storage ? `Хранилище: ${storage} · ` : ''}
              {getApiBase() || 'тот же домен, что и сайт'} · профиль {getUserId().slice(0, 12)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void sendNow()}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Отправить правки сейчас
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Проверить связь
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              pending
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {pending ? (
              <>
                <AlertTriangle className="h-3 w-3" /> Есть неотправленные правки
              </>
            ) : (
              <>
                <CheckCheck className="h-3 w-3" /> Всё сохранено
              </>
            )}
          </span>
        </div>

        {message && (
          <p className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-zinc-300">
            {message}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database className="h-4 w-4 text-zinc-400" />
          Как это устроено
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
          <li>· Данные лежат в одном общем хранилище, а не в браузере.</li>
          <li>· Правка из админки уходит на сервер сразу после изменения.</li>
          <li>· Если интернета нет — правка ждёт в браузере и уходит сама.</li>
          <li>· Вход в админку по PIN и есть право на запись: токены не нужны.</li>
        </ul>
      </div>
    </div>
  );
};
