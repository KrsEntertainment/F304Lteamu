import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, CloudOff, Loader2, RefreshCw, Server, UploadCloud, XCircle } from 'lucide-react';
import {
  api,
  getAdminToken,
  getApiBase,
  getUserId,
  setAdminToken,
  setApiBase,
} from '../utils/api';
import { pushData } from '../utils/sync';
import { StudioData } from '../types';

interface ServerSyncPanelProps {
  data: StudioData;
  onNotify: (msg: string) => void;
  onReload?: () => void;
}

export const ServerSyncPanel: React.FC<ServerSyncPanelProps> = ({
  data,
  onNotify,
  onReload,
}) => {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [token, setToken] = useState(getAdminToken());
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<{ updatedAt?: number; uptime?: number }>({});
  const [pushing, setPushing] = useState(false);

  const runCheck = async () => {
    setStatus('checking');
    setMessage('');
    try {
      const health = await api.health();
      setDetails({ updatedAt: health.updatedAt, uptime: health.uptimeSeconds });
      if (token.trim()) {
        await api.checkAdmin();
        setStatus('ok');
        if (!health.hasData) {
          await pushData(data);
          setMessage('Сервер был пуст — текущий каталог загружен на него. Теперь его видят все устройства.');
        } else {
          setMessage('Сервер доступен, токен админки принят. Данные синхронизируются.');
        }
      } else {
        setStatus('ok');
        setMessage('Сервер доступен. Для записи каталога введите токен админки.');
      }
    } catch (err) {
      setStatus('fail');
      setMessage(err instanceof Error ? err.message : 'Сервер не отвечает');
    }
  };

  useEffect(() => {
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setApiBase(apiBase.trim());
    setAdminToken(token.trim());
    await runCheck();
    onNotify('Настройки сервера сохранены');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#E50914]/15 p-2.5 text-[#E50914]">
            <Server className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-white">
              Общий сервер данных
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Каталог, актёры, новости, загруженные файлы, «Мой список» и прогресс просмотра
              хранятся на сервере. Все устройства видят одно и то же.
            </p>
          </div>
          <div className="shrink-0">
            {status === 'checking' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                <Loader2 className="h-3 w-3 animate-spin" /> Проверка
              </span>
            )}
            {status === 'ok' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <Cloud className="h-3 w-3" /> Онлайн
              </span>
            )}
            {status === 'fail' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E50914]/15 px-2.5 py-1 text-[11px] font-semibold text-[#E50914]">
                <CloudOff className="h-3 w-3" /> Офлайн
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Адрес API
            </span>
            <input
              value={apiBase}
              onChange={(e) => setApiBaseState(e.target.value)}
              placeholder="https://f304lteam-api.onrender.com  (пусто = тот же домен)"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090D] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#E50914]/60"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Если сайт и API на одном домене — оставьте поле пустым.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Токен админки
            </span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="выводится сервером при первом запуске"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090D] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#E50914]/60"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Нужен для записи контента и загрузки файлов. У зрителей его нет.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#F6121D] transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Сохранить и проверить
            </button>
            <button
              type="button"
              onClick={runCheck}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Проверить связь
            </button>
            <button
              type="button"
              disabled={pushing}
              onClick={async () => {
                setPushing(true);
                try {
                  await pushData(data);
                  await runCheck();
                  onNotify('Текущий каталог отправлен на сервер');
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Не удалось отправить данные');
                } finally {
                  setPushing(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
            >
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Отправить каталог на сервер
            </button>
            {onReload && (
              <button
                type="button"
                onClick={onReload}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <Cloud className="h-4 w-4" /> Перечитать с сервера
              </button>
            )}
          </div>

          {message && (
            <p
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
                status === 'fail'
                  ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#FF8A90]'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {status === 'fail' ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <h4 className="font-display text-sm font-bold text-white">Служебная информация</h4>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">ID этого устройства</dt>
            <dd className="font-mono text-zinc-300 truncate">{getUserId()}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Версия данных</dt>
            <dd className="font-mono text-zinc-300">
              {details.updatedAt
                ? new Date(details.updatedAt).toLocaleString('ru-RU')
                : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Аптайм сервера</dt>
            <dd className="font-mono text-zinc-300">
              {details.uptime !== undefined ? `${Math.round(details.uptime / 60)} мин` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Режим</dt>
            <dd className="font-mono text-zinc-300">
              {apiBase ? 'внешний API' : 'тот же домен'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
