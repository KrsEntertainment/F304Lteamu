import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Film, Upload, X, Link2, CheckCircle2, Loader2 } from 'lucide-react';
import {
  resolveMediaUrl,
  saveGalleryFile,
  isIdbRef,
  canUploadToServer,
} from '../utils/mediaStore';
import { assetUrl } from '../utils/asset';

export function useMediaUrl(ref?: string): string {
  const [resolved, setResolved] = useState<string>(() =>
    ref && !isIdbRef(ref) ? assetUrl(ref) : ''
  );

  useEffect(() => {
    let active = true;
    if (!ref) {
      setResolved('');
      return;
    }
    if (!isIdbRef(ref)) {
      setResolved(assetUrl(ref));
      return;
    }
    resolveMediaUrl(ref).then((url) => {
      if (active) setResolved(url);
    });
    return () => {
      active = false;
    };
  }, [ref]);

  return resolved;
}

interface MediaImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  srcRef?: string;
  fallbackLabel?: string;
}

export const MediaImg: React.FC<MediaImgProps> = ({
  srcRef,
  fallbackLabel = 'F304Lteam',
  className = '',
  alt = '',
  ...rest
}) => {
  const url = useMediaUrl(srcRef);
  const [errored, setErrored] = useState(false);
  const displayUrl = url;

  useEffect(() => {
    setErrored(false);
  }, [url]);

  if (!displayUrl || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#191A24] via-[#12131A] to-[#0B0B10] text-zinc-500 ${className}`}
      >
        <Film className="h-7 w-7 opacity-40 mb-1.5" />
        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 px-2 text-center">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={displayUrl}
      alt={alt}
      onError={() => setErrored(true)}
      className={className}
      loading="lazy"
      {...rest}
    />
  );
};

interface GalleryFilePickerProps {
  label: string;
  accept: 'image' | 'video';
  value: string;
  onChange: (newRef: string) => void;
  hint?: string;
  compact?: boolean;
}

export const GalleryFilePicker: React.FC<GalleryFilePickerProps> = ({
  label,
  accept,
  value,
  onChange,
  hint,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [fileMeta, setFileMeta] = useState<string>('');
  const resolvedPreview = useMediaUrl(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPercent(0);
    try {
      const savedRef = await saveGalleryFile(file, setUploadPercent);
      onChange(savedRef);
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const where = savedRef.startsWith('/uploads/') || savedRef.includes('/uploads/')
        ? 'в общее хранилище'
        : 'локально';
      setFileMeta(`${file.name} (${mb} МБ) — загружено ${where}`);
    } finally {
      setUploading(false);
      setUploadPercent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput((s) => !s)}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
        >
          <Link2 className="h-3 w-3" />
          {showUrlInput ? 'Скрыть ссылку' : 'Или URL'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept === 'image' ? 'image/*' : 'video/*'}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={`relative rounded-xl border border-white/10 bg-[#111218] overflow-hidden transition-colors hover:border-white/20 ${
          compact ? 'p-2.5' : 'p-3'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Preview Box */}
          <div
            className={`relative shrink-0 overflow-hidden rounded-lg bg-[#09090D] border border-white/10 flex items-center justify-center ${
              compact ? 'h-14 w-20' : 'h-20 w-32'
            }`}
          >
            {resolvedPreview ? (
              accept === 'image' ? (
                <img
                  src={resolvedPreview}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={resolvedPreview}
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              )
            ) : accept === 'image' ? (
              <ImageIcon className="h-5 w-5 text-zinc-600" />
            ) : (
              <Film className="h-5 w-5 text-zinc-600" />
            )}

            {resolvedPreview && (
              <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                OK
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E50914] hover:bg-[#ff1c28] px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading
                  ? uploadPercent !== null
                    ? `Загрузка ${uploadPercent}%`
                    : 'Загрузка...'
                  : accept === 'image'
                    ? 'Выбрать фото из галереи'
                    : 'Выбрать видео из галереи'}
              </button>

              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setFileMeta('');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-red-500/20 hover:border-red-500/40 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-red-300 transition-colors cursor-pointer"
                  title="Очистить файл"
                >
                  <X className="h-3.5 w-3.5" />
                  Убрать
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 truncate">
              {fileMeta
                ? fileMeta
                : value
                  ? isIdbRef(value)
                    ? 'Локальное медиа этого браузера (не видно на других устройствах)'
                    : value.includes('/uploads/')
                      ? 'В общем хранилище GitHub — видно на всех устройствах'
                      : value
                  : hint ||
                    (canUploadToServer()
                      ? accept === 'image'
                        ? 'JPG, PNG, WEBP — уедет на общий сервер, будет видно на всех устройствах'
                        : 'MP4, MOV, WEBM — уедет на общий сервер, будет видно на всех устройствах'
                      : accept === 'image'
                        ? 'JPG, PNG, WEBP из галереи (пока локально: введите токен сервера в админке)'
                        : 'MP4, MOV, WEBM из галереи (пока локально: введите токен сервера в админке)')}
            </p>
          </div>
        </div>

        {showUrlInput && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10">
            <input
              type="text"
              value={isIdbRef(value) ? '' : value}
              onChange={(e) => {
                setFileMeta('');
                onChange(e.target.value);
              }}
              placeholder={
                accept === 'image'
                  ? 'Вставьте прямую ссылку на изображение (https://...)'
                  : 'Вставьте прямую ссылку на MP4 видео (https://...)'
              }
              className="w-full rounded-lg border border-white/10 bg-[#09090D] px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
