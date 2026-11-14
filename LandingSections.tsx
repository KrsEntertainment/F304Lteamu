import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Sparkles,
  Tv,
  Film,
  Users,
  ShieldCheck,
  Zap,
  Volume2,
  Star,
  Check,
  ChevronDown,
  ArrowRight,
  Clapperboard,
  Heart,
  Smartphone,
} from 'lucide-react';
import { STUDIO_FAQS, STUDIO_PLANS, STUDIO_TESTIMONIALS } from '../data/initialData';

export const RevealBlock: React.FC<{
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}> = ({ children, className = '', delayMs = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`reveal-section ${visible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

interface LandingSectionsProps {
  totalReleases: number;
  totalActors: number;
  totalEpisodes: number;
  onStartWatching: () => void;
  onNotify: (msg: string) => void;
}

export const LandingSections: React.FC<LandingSectionsProps> = ({
  totalReleases,
  totalActors,
  totalEpisodes,
  onStartWatching,
  onNotify,
}) => {
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plus');
  const [emailInput, setEmailInput] = useState('');

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    onNotify(`Вы подписаны на премьеры F304Lteam (${emailInput.trim()})`);
    setEmailInput('');
  };

  return (
    <div className="space-y-24 sm:space-y-32 pt-16 pb-12">
      {/* ------------------------------------------------------------------- */}
      {/* 1. SOCIAL PROOF & STUDIO METRICS STRIP                              */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#13141C] via-[#17121A] to-[#13141C] p-6 sm:p-10">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#E50914]/15 blur-3xl" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-md space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ff4d56]">
                Независимое кино нового уровня
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                Студия F304Lteam в цифрах и кадрах
              </h2>
              <p className="text-sm text-zinc-400">
                Собственный стриминг без посредников — напрямую от съёмочной группы на ваш экран.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 flex-1">
              {[
                { value: `${totalReleases}+`, label: 'Оригинальных релизов' },
                { value: `${totalEpisodes}+`, label: 'Эпизодов в 4K HDR' },
                { value: `${totalActors}`, label: 'Актёров и авторов' },
                { value: '9.1', label: 'Средний рейтинг зрителей' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/8 bg-black/35 p-4 text-center sm:text-left"
                >
                  <div className="font-display text-2xl sm:text-3xl font-black text-white">
                    {stat.value}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 2. FEATURES & PRODUCT SHOWCASE                                      */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E50914]/30 bg-[#E50914]/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#ff4d56]">
            <Sparkles className="h-3 w-3" />
            Технологии кинотеатра
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Создано для полного погружения в кино F304Lteam
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Мы объединили эстетику большого кинозала, молниеносный плеер и живую экосистему
            студии — от трейлеров до профилей актёров и новостей со съёмочной площадки.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Play,
              title: 'Киноплеер 4K HDR без рекламы',
              desc: 'Мгновенный запуск фильмов, серий и официальных трейлеров с выбором скорости, перемоткой ±10 сек и полноэкранным кино-режимом.',
            },
            {
              icon: Tv,
              title: 'Сериалы сезон за сезоном',
              desc: 'Удобная навигация по сезонам, кнопка «Следующая серия» прямо в плеере и автоматическое сохранение момента остановки.',
            },
            {
              icon: Users,
              title: 'Единая база актёров и ролей',
              desc: 'Узнавайте, кто сыграл вашего любимого героя, открывайте профиль артиста и переходите ко всем фильмам с его участием в один клик.',
            },
            {
              icon: Clapperboard,
              title: 'Новости и тизеры от создателей',
              desc: 'Эксклюзивные кадры бэкстейджа, анонсы новых сезонов, открытые кастинги и видеоматериалы прямо из павильонов F304Lteam.',
            },
            {
              icon: Smartphone,
              title: 'Идеально на любом экране',
              desc: 'Адаптивный мобильный и десктопный интерфейс без установки тяжёлых приложений — просто откройте сайт и начните просмотр.',
            },
            {
              icon: Heart,
              title: 'Персональный «Мой список»',
              desc: 'Отмечайте грядущие премьеры и любимые сериалы, чтобы они всегда были под рукой в персональной полке на главной странице.',
            },
          ].map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-3xl border border-white/8 bg-[#12131A]/90 hover:border-[#E50914]/40 hover:bg-[#171824] p-6 sm:p-7 transition-all duration-300"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E50914]/25 bg-[#E50914]/12 text-[#ff4d56] group-hover:scale-110 group-hover:bg-[#E50914] group-hover:text-white transition-all duration-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-white mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 3. BENEFITS / STUDIO PRODUCTION SHOWCASE                            */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#14151E] via-[#0F1016] to-[#190C11] p-6 sm:p-10 lg:p-12 overflow-hidden relative">
          <div className="lg:col-span-6 space-y-6">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
              Философия F304Lteam
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              Кино, которое чувствуешь каждой клеткой
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Мы не гонимся за шаблонным конвейером. Каждый проект F304Lteam — это авторская
              режиссура, анаморфотная картинка, глубокий оригинальный саунд-дизайн и актёры,
              которым веришь с первой секунды.
            </p>

            <div className="space-y-3 pt-2">
              {[
                {
                  icon: Film,
                  title: 'Честный кинотеатральный цвет и свет',
                  sub: 'Съёмка в киноформате с акцентом на натурный свет и 35-мм атмосферу.',
                },
                {
                  icon: Volume2,
                  title: 'Авторский саундтрек под каждый эпизод',
                  sub: 'Собственные композиторы создают уникальное звучание каждой вселенной.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Ноль преролов и всплывающих баннеров',
                  sub: 'Ничто не прерывает кульминационную сцену — только вы и история.',
                },
              ].map((b, i) => {
                const Icon = b.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3.5 rounded-2xl border border-white/8 bg-black/30 p-3.5"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E50914]/15 text-[#ff4d56]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{b.title}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">{b.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
              <img
                src="/images/news-backstage.jpg"
                alt="Съёмочная площадка F304Lteam"
                className="w-full h-[320px] sm:h-[420px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 rounded bg-[#E50914] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                    <Zap className="h-3 w-3" />
                    ORIGINALS PRODUCTION
                  </span>
                  <p className="font-display text-lg font-bold text-white mt-1.5">
                    Павильон №4 • Съёмки 2025
                  </p>
                  <p className="text-xs text-zinc-300">
                    За кулисами флагманских сериалов студии F304Lteam
                  </p>
                </div>
                <button
                  onClick={onStartWatching}
                  className="shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-white text-black hover:bg-[#E50914] hover:text-white transition-all shadow-lg cursor-pointer"
                  aria-label="Смотреть премьеру"
                >
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 4. VIEWER TESTIMONIALS                                              */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
              Сообщество киноманов
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
              Отзывы зрителей F304Lteam
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>
              <strong className="text-white">4.9 / 5</strong> на основе оценок зрителей
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STUDIO_TESTIMONIALS.map((rev) => (
            <div
              key={rev.id}
              className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#12131B] p-6 space-y-5 hover:border-white/20 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="rounded-md bg-white/5 border border-white/8 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                    «{rev.movieRef}»
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-200">«{rev.text}»</p>
              </div>

              <div className="pt-4 border-t border-white/8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#E50914] to-amber-500 font-display text-xs font-bold text-white">
                  {rev.author.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{rev.author}</p>
                  <p className="text-xs text-zinc-400">{rev.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 5. MEMBERSHIP / ACCESS PLANS                                        */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div id="pricing" className="scroll-mt-24 text-center max-w-2xl mx-auto space-y-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
            Поддержка и доступ
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
            Выберите свой формат просмотра
          </h2>
          <p className="text-sm sm:text-base text-zinc-400">
            Смотрите открытый каталог бесплатно или поддержите независимое кино F304Lteam и
            получайте ранние премьеры в 4K HDR.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-[#12131B] p-1">
            <button
              onClick={() => setYearlyBilling(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                !yearlyBilling ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Помесячно
            </button>
            <button
              onClick={() => setYearlyBilling(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                yearlyBilling ? 'bg-[#E50914] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              На год
              <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px]">
                -25%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {STUDIO_PLANS.map((plan) => {
            const price = yearlyBilling ? plan.yearlyPrice : plan.monthlyPrice;
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl border p-7 transition-all duration-300 ${
                  plan.highlighted
                    ? 'border-[#E50914]/65 bg-gradient-to-b from-[#1E1016] via-[#14141D] to-[#111219] shadow-[0_24px_60px_rgba(229,9,20,0.2)]'
                    : 'border-white/10 bg-[#12131B] hover:border-white/20'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E50914] px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-5">
                  <div>
                    {!plan.highlighted && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                        {plan.badge}
                      </span>
                    )}
                    <h3 className="font-display text-xl font-bold text-white mt-1">
                      {plan.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-black text-white">
                      {price === 0 ? '0 ₽' : `${price} ₽`}
                    </span>
                    {price > 0 && <span className="text-xs text-zinc-400">/ мес</span>}
                  </div>

                  <ul className="space-y-2.5 pt-2 border-t border-white/10">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-200">
                        <Check className="h-4 w-4 text-[#E50914] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    if (plan.id === 'free') {
                      onStartWatching();
                    } else {
                      onNotify(`Тариф «${plan.name}» выбран! Добро пожаловать в клуб F304Lteam`);
                    }
                  }}
                  className={`mt-8 w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 cursor-pointer ${
                    plan.highlighted
                      ? 'bg-[#E50914] hover:bg-[#ff1c28] text-white shadow-[0_10px_30px_rgba(229,9,20,0.4)]'
                      : isSelected
                        ? 'bg-white text-black'
                        : 'border border-white/15 bg-white/8 hover:bg-white/15 text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 6. FAQ ACCORDION                                                    */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div id="faq" className="scroll-mt-24 text-center space-y-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
            Вопросы и ответы
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
            Частые вопросы о платформе
          </h2>
        </div>

        <div className="space-y-3">
          {STUDIO_FAQS.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-colors ${
                  isOpen
                    ? 'border-[#E50914]/45 bg-[#151621]'
                    : 'border-white/10 bg-[#111219] hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 text-left cursor-pointer"
                >
                  <span className="font-semibold text-sm sm:text-base text-white">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-[#E50914]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm text-zinc-300 leading-relaxed border-t border-white/8 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </RevealBlock>

      {/* ------------------------------------------------------------------- */}
      {/* 7. FINAL CONVERSION CTA                                             */}
      {/* ------------------------------------------------------------------- */}
      <RevealBlock className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#E50914]/35 bg-gradient-to-br from-[#230A0E] via-[#12121A] to-[#0B0C11] p-8 sm:p-14 text-center">
          <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-[36rem] rounded-full bg-[#E50914]/25 blur-[90px] animate-ambient" />

          <div className="relative z-10 mx-auto max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-200">
              <Sparkles className="h-3.5 w-3.5 text-[#E50914]" />
              Премьеры прямо на экране
            </span>
            <h2 className="font-display text-2xl sm:text-5xl font-black text-white leading-tight">
              Не пропусти следующий релиз F304Lteam
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Начни смотреть флагманский сериал прямо сейчас или оставь email, чтобы первым
              узнавать о новых сериях, кастингах и закрытых показах студии.
            </p>

            <form
              onSubmit={handleSubscribeSubmit}
              className="mx-auto flex max-w-md flex-col sm:flex-row gap-2.5 pt-2"
            >
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Ваш email для анонсов премьер"
                className="flex-1 rounded-2xl border border-white/15 bg-black/50 px-4 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E50914] hover:bg-[#ff1c28] px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_32px_rgba(229,9,20,0.45)] transition-all active:scale-95 cursor-pointer"
              >
                Подписаться
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="pt-2">
              <button
                onClick={onStartWatching}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Play className="h-4 w-4 text-[#E50914] fill-[#E50914]" />
                Или перейти сразу к просмотру каталога
              </button>
            </div>
          </div>
        </div>
      </RevealBlock>
    </div>
  );
};
