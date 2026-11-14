import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { StudioData } from '../types';
import {
  DATA_BRANCH,
  REPO_NAME,
  REPO_OWNER,
  buildState,
  downloadState,
  githubEditUrl,
  markPublished,
  pendingCount,
} from '../utils/publish';

interface PublishChangesPanelProps {
  data: StudioData;
  onNotify: (msg: string) => void;
  onPublished: () => void;
}

/**
 * Публикация без токена: готовим файл данных и заменяем его в GitHub
 * в два клика. Токены, приложения и настройки не нужны.
 */
export const PublishChangesPanel: React.FC<PublishChangesPanelProps> = ({
  data,
  onNotify,
  onPublished,
}) => {
  const [prepared, setPrepared] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const hasChanges = useMemo(() => pendingCount(data) > 0, [data]);

  const handlePrepare = () => {
    const state = buildState(data, 'studio catalog update');
    const json = JSON.stringify(state, null, 2) + '\n';
    setPrepared(json);
    try {
      navigator.clipboard.writeText(json);
      onNotify('Данные скопированы в буфер обмена');
    } catch {
      onNotify('Данные подготовлены — скопируйте их кнопкой ниже');
    }
    setStep(2);
  };

  const handleCopy = async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared);
      onNotify('JSON скопирован в буфер обмена');
    } catch {
      onNotify('Не удалось скопировать — выделите текст вручную');
    }
  };

  const handleMarkPublished = () => {
    markPublished(data);
    onPublished();
    onNotify('Отмечено как опубликованное — все устройства подхватят данные при обновлении');
    setStep(1);
    setPrepared(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-white">
              Опубликовать изменения (без токена)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Правки уже сохранены на этом устройстве. Чтобы их увидели все телефоны и
              компьютеры — замените файл данных в репозитории. GitHub сделает это от вашего
              имени, токен не нужен.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
              {hasChanges ? '● Есть неопубликованные изменения' : '✓ Всё опубликовано'}
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {/* шаг 1 */}
          <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E50914] text-[11px] font-bold text-white">
                1
              </span>
              <span className="text-sm font-semibold text-white">Подготовить данные</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrepare}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#F6121D] transition-colors"
              >
                <FileJson className="h-4 w-4" /> Подготовить и скопировать
              </button>
              <button
                type="button"
                onClick={() => downloadState(buildState(data, 'studio catalog update'))}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <Download className="h-4 w-4" /> Скачать state.json
              </button>
            </div>
          </li>

          {/* шаг 2 */}
          <li
            className={`rounded-xl border p-3.5 transition-colors ${
              step === 2 ? 'border-[#E50914]/40 bg-[#E50914]/5' : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E50914] text-[11px] font-bold text-white">
                2
              </span>
              <span className="text-sm font-semibold text-white">Вставить в GitHub</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
              1) Откроется страница файла — выделите всё (<kbd className="rounded bg-white/10 px-1">Ctrl</kbd>+
              <kbd className="rounded bg-white/10 px-1">A</kbd>) и вставьте (<kbd className="rounded bg-white/10 px-1">Ctrl</kbd>+
              <kbd className="rounded bg-white/10 px-1">V</kbd>) скопированный текст.
              2) Нажмите зелёную кнопку <strong className="text-white">Commit changes</strong>.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={githubEditUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Открыть файл в GitHub
              </a>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!prepared}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <Copy className="h-4 w-4" /> Скопировать ещё раз
              </button>
            </div>
          </li>

          {/* шаг 3 */}
          <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E50914] text-[11px] font-bold text-white">
                3
              </span>
              <span className="text-sm font-semibold text-white">Отметить как готово</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
              После «Commit changes» нажмите кнопку ниже, затем обновите сайт на других
              устройствах — они подтянут новые данные.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMarkPublished}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" /> Я нажал Commit — готово
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Перечитать с сервера
              </button>
            </div>
          </li>
        </ol>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Файл: <code className="text-zinc-200">{REPO_OWNER}/{REPO_NAME}</code> → ветка{' '}
          <code className="text-zinc-200">{DATA_BRANCH}</code> → <code className="text-zinc-200">data/state.json</code>.
          Загрузка больших видео и постеров без токена недоступна — используйте ссылки на файлы
          (поле «Или URL»).
        </p>
      </div>

      {prepared && (
        <div className="rounded-2xl border border-white/10 bg-[#0E0F16] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Готовый JSON (уже в буфере обмена)
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white"
            >
              <Copy className="h-3 w-3" /> копировать
            </button>
          </div>
          <textarea
            readOnly
            value={prepared}
            rows={8}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#09090D] p-3 font-mono text-[10px] leading-relaxed text-zinc-400"
          />
        </div>
      )}
    </div>
  );
};
