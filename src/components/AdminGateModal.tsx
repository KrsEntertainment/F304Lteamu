import React, { useEffect, useState } from 'react';
import { Lock, X, ShieldCheck, Delete, AlertTriangle } from 'lucide-react';

interface AdminGateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ADMIN_PASSCODE = '9086';

export const AdminGateModal: React.FC<AdminGateModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin('');
      setError(false);
    }
  }, [open]);

  const submitPin = (candidate: string) => {
    if (candidate === ADMIN_PASSCODE) {
      setError(false);
      onSuccess();
      setPin('');
    } else {
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 650);
    }
  };

  const appendDigit = (digit: string) => {
    if (pin.length >= 4 || error) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => submitPin(next), 120);
    }
  };

  const backspace = () => {
    setError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (/^[0-9]$/.test(e.key)) {
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        backspace();
      } else if (e.key === 'Enter' && pin.length === 4) {
        submitPin(pin);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pin, error]);

  if (!open) return null;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/88 backdrop-blur-xl p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl border bg-[#101118] p-7 shadow-[0_32px_90px_rgba(0,0,0,0.95)] animate-modal-in ${
          error ? 'border-[#E50914] animate-shake' : 'border-white/12'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
          aria-label="Закрыть вход"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2.5 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E50914]/35 bg-[#E50914]/15 shadow-[0_0_30px_rgba(229,9,20,0.28)]">
            <Lock className="h-6 w-6 text-[#E50914]" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#E50914]">
              F304Lteam • Закрытый доступ
            </p>
            <h2 className="font-display text-xl font-bold text-white mt-1">
              Студийная админка
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Введите 4-значный код доступа для управления каталогом, сериями, актёрами и новостями.
          </p>
        </div>

        {/* 4-dot PIN display */}
        <div className="flex items-center justify-center gap-3.5 mb-5">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`flex h-13 w-13 items-center justify-center rounded-2xl border font-mono text-xl font-bold transition-all ${
                  error
                    ? 'border-[#E50914] bg-[#E50914]/15 text-[#ff4d56]'
                    : filled
                      ? 'border-[#E50914]/70 bg-[#E50914]/15 text-white scale-105'
                      : 'border-white/10 bg-[#171822] text-zinc-600'
                }`}
              >
                {filled ? '•' : ''}
              </div>
            );
          })}
        </div>

        {/* Error status */}
        <div className="h-5 mb-4 flex items-center justify-center">
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ff4d56]">
              <AlertTriangle className="h-3.5 w-3.5" />
              Неверный код доступа
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
              Онлайн-режим • без внешней БД
            </span>
          )}
        </div>

        {/* Tactile Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              className="h-13 rounded-2xl border border-white/8 bg-[#171822] hover:bg-[#222434] hover:border-white/20 active:scale-95 font-mono text-lg font-bold text-white transition-all cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-13 rounded-2xl border border-white/8 bg-[#14151D] hover:bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            Сброс
          </button>
          <button
            type="button"
            onClick={() => appendDigit('0')}
            className="h-13 rounded-2xl border border-white/8 bg-[#171822] hover:bg-[#222434] hover:border-white/20 active:scale-95 font-mono text-lg font-bold text-white transition-all cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            className="flex h-13 items-center justify-center rounded-2xl border border-white/8 bg-[#14151D] hover:bg-white/10 text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Стереть"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
