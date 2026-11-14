import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  GitBranch,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { api, getAdminToken, getApiBase, getUserId, setAdminToken, setApiBase } from '../utils/api';
import { pushData, pullIfChanged } from '../utils/sync';
import {
  checkGhAccess,
  getBackendMode,
  getGhToken,
  readGhState,
  setBackendMode,
  setGhToken,
} from '../utils/githubStore';
import { StudioData } from '../types';

interface ServerSyncPanelProps {
  data: StudioData;
  onNotify: (msg: string) => void;
  onReload?: () => void;
}

type Status = 'idle' | 'checking' | 'ok' | 'fail';

export const ServerSyncPanel: React.FC<ServerSyncPanelProps> = ({
  data,
  onNotify,
  onReload,
}) => {
  const [mode, setMode] = useState<'github' | 'server'>(getBackendMode());
  const [ghToken, setGhTokenState] = useState(getGhToken());
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [token, setToken] = useState(getAdminToken());

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState('');
  const [remoteInfo, setRemoteInfo] = useState<{ updatedAt: number; items: number; users: number } | null>(
    null
  );
  // Какой из источников реально отдал данные (свой домен / CDN / raw)
  const [sourceName, setSourceName] = useState('');
  const [busy, setBusy] = useState(false);

  const checkGithub = async () => {
    setStatus('checking');
    setMessage('');
    try {
      const state = await readGhState(true);
      setSourceName(localStorage.getItem('f304lteam_state_source') || '—');
      setRemoteInfo({
        updatedAt: state.updatedAt,
        items: state.studioData?.catalog?.length || 0,
        users: Object.keys(state.lists).length,
      });
      if (ghToken.trim()) {
        const access = await checkGhAccess();
        setAccount(access.login);
        if (!access.canWrite) throw new Error('У токена нет права Contents: Read and write');
        setStatus('ok');
        setMessage(
          state.studioData
            ? 'Данные читаются из репозитория. Запись с этого устройства разрешена.'
            : 'Репозиторий доступен. Данных ещё нет — нажмите «Отправить каталог».'
        );
      } else {
        setStatus('ok');
        setMessage('Данные читаются из репозитория. Для записи вставьте GitHub-токен.');
      }
    } catch (err) {
      setStatus('fail');
      setMessage(err instanceof Error ? err.message : 'GitHub недоступен');
    }
  };

  const checkServer = async () => {
    setStatus('checking');
    setMessage('');
    try {
      const health = await api.health();
      setRemoteInfo({ updatedAt: health.updatedAt, items: 0, users: 0 });
      if (token.trim()) await api.checkAdmin();
      setStatus('ok');
      setMessage('Сервер доступен. Данные синхронизируются.');
    } catch (err) {
      setStatus('fail');
      setMessage(err instanceof Error ? err.message : 'Сервер не отвечает');
    }
  };

  const check = () => (mode === 'github' ? checkGithub() : checkServer());

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleSave = async () => {
    setBackendMode(mode);
    setGhToken(ghToken.trim());
    setApiBase(apiBase.trim());
    setAdminToken(token.trim());
    await check();
    onNotify('Настройки синхронизации сохранены');
  };

  const canWrite = mode === 'github' ? Boolean(ghToken.trim()) : Boolean(token.trim());

  return (
    <div className="space-y-6">
      {/* Главная проверка: без токена правки не уходят в общую базу */}
      {!canWrite && (
        <div className="rounded-2xl border border-[#E50914]/40 bg-[#E50914]/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E50914]" />
            <div>
              <p className="text-sm font-bold text-white">Запись отключена — правки не сохраняются</p>
              <p className="mt-1 text-xs leading-relaxed text-[#FFB4B8]">
                Без токена каталог меняется только в этом браузере: удалённые фильмы вернутся
                после перезагрузки страницы. Вставьте GitHub-токен ниже и нажмите
                «Сохранить и проверить».
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Выбор хранилища */}
      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <h3 className="font-display text-base font-bold text-white">Где хранить общие данные</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Один источник для всех устройств: телефон, ноутбук, планшет видят одно и то же.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              id: 'github' as const,
              icon: GitBranch,
              title: 'GitHub-репозиторий',
              text: 'Без серверов и оплаты. Данные в data/state.json, сайт на GitHub Pages.',
            },
            {
              id: 'server' as const,
              icon: Server,
              title: 'Свой API-сервер',
              text: 'server/index.mjs (Docker/Render/VPS). Нужен хостинг.',
            },
          ].map((option) => {
            const Icon = option.icon;
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-[#E50914]/60 bg-[#E50914]/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? 'text-[#E50914]' : 'text-zinc-400'}`} />
                  <span className="text-sm font-bold text-white">{option.title}</span>
                  {active && (
                    <span className="ml-auto rounded-full bg-[#E50914] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                      активен
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{option.text}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Настройки выбранного режима */}
      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#E50914]/15 p-2.5 text-[#E50914]">
            {mode === 'github' ? <GitBranch className="h-5 w-5" /> : <Server className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-white">
              {mode === 'github' ? 'GitHub: репозиторий как база данных' : 'Адрес API и токен'}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {mode === 'github'
                ? 'Чтение — из опубликованного state.json (быстро, без токена). Запись — через GitHub API с вашим токеном.'
                : 'Сервер отдаёт и сайт, и API. Укажите его адрес, если сайт открыт с другого домена.'}
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
                <CloudOff className="h-3 w-3" /> Ошибка
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {mode === 'github' ? (
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <KeyRound className="h-3.5 w-3.5" /> GitHub-токен (fine-grained)
              </span>
              <input
                value={ghToken}
                onChange={(e) => setGhTokenState(e.target.value)}
                type="password"
                placeholder="github_pat_..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090D] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#E50914]/60"
              />
              <span className="mt-1.5 block text-[11px] leading-relaxed text-zinc-500">
                Создать: GitHub → Settings → Developer settings → Personal access tokens →
                Fine-grained tokens → доступ только к репозиторию{' '}
                <code className="text-zinc-300">KrsEntertainment/F304Lteamu</code>, право{' '}
                <code className="text-zinc-300">Contents: Read and write</code>. Токен хранится
                только в этом браузере.
              </span>
            </label>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Адрес API
                </span>
                <input
                  value={apiBase}
                  onChange={(e) => setApiBaseState(e.target.value)}
                  placeholder="https://f304lteam-api.onrender.com (пусто = тот же домен)"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090D] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#E50914]/60"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Токен админки
                </span>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder="ADMIN_TOKEN сервера"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090D] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#E50914]/60"
                />
              </label>
            </>
          )}

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
              onClick={check}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Проверить связь
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await pushData(data);
                  await check();
                  onNotify('Каталог отправлен в репозиторий');
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Не удалось отправить данные');
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Отправить каталог
            </button>
            <button
              type="button"
              onClick={async () => {
                const remote = await pullIfChanged();
                if (remote) {
                  onNotify('Данные подтянуты из репозитория');
                  onReload ? onReload() : window.location.reload();
                } else {
                  onNotify('Новых данных в репозитории нет');
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <Cloud className="h-4 w-4" /> Перечитать
            </button>
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

      {/* Служебная информация */}
      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <h4 className="font-display text-sm font-bold text-white">Служебная информация</h4>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Режим</dt>
            <dd className="font-mono text-zinc-300">
              {mode === 'github' ? 'GitHub-репозиторий' : 'свой API'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">ID устройства</dt>
            <dd className="truncate font-mono text-zinc-300">{getUserId()}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Версия данных</dt>
            <dd className="font-mono text-zinc-300">
              {remoteInfo?.updatedAt
                ? new Date(remoteInfo.updatedAt).toLocaleString('ru-RU')
                : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Релизов в базе</dt>
            <dd className="font-mono text-zinc-300">
              {mode === 'github' ? remoteInfo?.items ?? '—' : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-zinc-500">Источник данных</dt>
            <dd className="font-mono text-emerald-300">{sourceName || '—'}</dd>
          </div>

          {account && (
            <div className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 sm:col-span-2">
              <dt className="text-zinc-500">GitHub-аккаунт</dt>
              <dd className="font-mono text-zinc-300">{account}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Устройства опрашивают данные каждые 30 секунд и при возврате на вкладку. Правки,
          сделанные здесь, применяются сразу; остальные устройства подхватят их автоматически.
        </p>
      </div>
    </div>
  );
};
