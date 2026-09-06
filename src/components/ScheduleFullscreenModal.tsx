import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  X, 
  Check, 
  Repeat, 
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { ReminderIntervalType } from '../types';

interface ScheduleFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateMode: 'weekdays' | 'specific_date';
  weekDays: number[];
  date: string;
  time: string;
  repeatInterval: ReminderIntervalType;
  intervalDays: number;
  onSave: (data: {
    dateMode: 'weekdays' | 'specific_date';
    weekDays: number[];
    date: string;
    time: string;
    repeatInterval: ReminderIntervalType;
    intervalDays: number;
  }) => void;
}

const WEEKDAYS = [
  { id: 1, short: 'Пн', label: 'Понедельник' },
  { id: 2, short: 'Вт', label: 'Вторник' },
  { id: 3, short: 'Ср', label: 'Среда' },
  { id: 4, short: 'Чт', label: 'Четверг' },
  { id: 5, short: 'Пт', label: 'Пятница' },
  { id: 6, short: 'Сб', label: 'Суббота' },
  { id: 7, short: 'Вс', label: 'Воскресенье' },
];

const TIME_PRESETS = [
  { time: '09:00', label: 'Утро' },
  { time: '13:00', label: 'Обед' },
  { time: '18:30', label: 'К ужину' },
  { time: '20:00', label: 'Вечер' },
  { time: '21:30', label: 'Перед сном' },
];

export function ScheduleFullscreenModal({
  isOpen,
  onClose,
  dateMode: initialDateMode,
  weekDays: initialWeekDays,
  date: initialDate,
  time: initialTime,
  repeatInterval: initialRepeatInterval,
  intervalDays: initialIntervalDays,
  onSave
}: ScheduleFullscreenModalProps) {
  const [currentDateMode, setCurrentDateMode] = useState<'weekdays' | 'specific_date'>(initialDateMode);
  const [currentWeekDays, setCurrentWeekDays] = useState<number[]>(initialWeekDays || [1, 3, 5]);
  const [currentDate, setCurrentDate] = useState<string>(initialDate || '');
  const [currentTime, setCurrentTime] = useState<string>(initialTime || '18:30');
  const [currentRepeatInterval, setCurrentRepeatInterval] = useState<ReminderIntervalType>(initialRepeatInterval || 'weekly');
  const [currentIntervalDays, setCurrentIntervalDays] = useState<number>(initialIntervalDays || 3);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentDateMode(initialDateMode);
      setCurrentWeekDays(initialWeekDays && initialWeekDays.length > 0 ? initialWeekDays : [1, 3, 5]);
      setCurrentDate(initialDate || new Date().toISOString().split('T')[0]);
      setCurrentTime(initialTime || '18:30');
      setCurrentRepeatInterval(initialRepeatInterval || 'weekly');
      setCurrentIntervalDays(initialIntervalDays || 3);
    }
  }, [isOpen, initialDateMode, initialWeekDays, initialDate, initialTime, initialRepeatInterval, initialIntervalDays]);

  if (!isOpen) return null;

  const toggleWeekday = (id: number) => {
    setCurrentWeekDays(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(d => d !== id);
      } else {
        return [...prev, id].sort((a, b) => a - b);
      }
    });
  };

  const handleApply = () => {
    onSave({
      dateMode: currentDateMode,
      weekDays: currentWeekDays.length > 0 ? currentWeekDays : [1],
      date: currentDate,
      time: currentTime,
      repeatInterval: currentRepeatInterval,
      intervalDays: currentIntervalDays,
    });
    onClose();
  };

  // Helper date buttons
  const setQuickDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const setNextSaturday = () => {
    const d = new Date();
    const currentDay = d.getDay(); // 0 is Sunday, 6 is Saturday
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSaturday);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  // Schedule Summary Text
  const getSummaryText = () => {
    let whenStr = '';
    if (currentDateMode === 'weekdays') {
      if (currentWeekDays.length === 7) {
        whenStr = 'Каждый день';
      } else if (currentWeekDays.length === 5 && [1, 2, 3, 4, 5].every(d => currentWeekDays.includes(d))) {
        whenStr = 'По будням (Пн-Пт)';
      } else if (currentWeekDays.length === 2 && [6, 7].every(d => currentWeekDays.includes(d))) {
        whenStr = 'По выходным (Сб-Вс)';
      } else {
        whenStr = currentWeekDays
          .map(id => WEEKDAYS.find(w => w.id === id)?.short)
          .filter(Boolean)
          .join(', ');
      }
    } else {
      if (currentDate) {
        const d = new Date(currentDate);
        whenStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      } else {
        whenStr = 'Выбранная дата';
      }
    }

    const intervalMap: Record<ReminderIntervalType, string> = {
      weekly: 'еженедельно',
      daily: 'каждый день',
      custom_days: `каждые ${currentIntervalDays} дн.`,
      none: 'однократно',
    };

    return `${whenStr} в ${currentTime} • ${intervalMap[currentRepeatInterval]}`;
  };

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-stone-900/60 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* 1. ВЕРХНЯЯ ПАНЕЛЬ */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm p-3 sm:p-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
              title="Назад к напоминанию"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 leading-tight flex items-center gap-1.5 truncate">
                <Calendar size={16} className="text-blue-600 shrink-0" />
                <span>Настройка расписания</span>
              </h2>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Выберите дни, время и интервал для напоминания
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Check size={15} />
              <span>Применить</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ОСНОВНОЙ КОНТЕНТ (СКРОЛЛ) */}
      <div className="flex-1 w-full bg-stone-50 overflow-y-auto no-scrollbar p-3.5 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          
          {/* БЛОК 1: КОГДА НАПОМИНАТЬ */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                <CalendarDays size={16} className="text-blue-600" />
                <span>Когда напоминать</span>
              </span>

              <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => setCurrentDateMode('weekdays')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentDateMode === 'weekdays'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  По дням недели
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDateMode('specific_date')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentDateMode === 'specific_date'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Календарная дата
                </button>
              </div>
            </div>

            {currentDateMode === 'weekdays' ? (
              <div className="space-y-3">
                {/* Быстрые пресеты дней недели */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-stone-400 mr-1 flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Быстрый выбор:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentWeekDays([1, 2, 3, 4, 5])}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Будни (Пн-Пт)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentWeekDays([6, 7])}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Выходные (Сб-Вс)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentWeekDays([1, 2, 3, 4, 5, 6, 7])}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Все дни
                  </button>
                </div>

                {/* Сетка дней недели */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
                  {WEEKDAYS.map((day) => {
                    const isSelected = currentWeekDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleWeekday(day.id)}
                        className={`h-12 sm:h-14 rounded-2xl text-xs sm:text-sm font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        <span className="text-xs sm:text-sm">{day.short}</span>
                        <span className={`text-[9px] font-normal ${isSelected ? 'text-blue-100' : 'text-stone-400'} hidden sm:block`}>
                          {day.label.slice(0, 3)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Быстрые пресеты дат */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-stone-400 mr-1 flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Быстрый выбор:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickDate(0)}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(1)}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Завтра
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(2)}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Послезавтра
                  </button>
                  <button
                    type="button"
                    onClick={setNextSaturday}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    В субботу
                  </button>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Выберите конкретный день:
                  </label>
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="w-full sm:w-auto min-w-[220px] px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* БЛОК 2: ВРЕМЯ НАПОМИНАНИЯ */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                <span>Время напоминания</span>
              </span>
              <span className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-lg border border-stone-200">
                {currentTime}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={currentTime}
                  onChange={(e) => setCurrentTime(e.target.value)}
                  className="px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base sm:text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 text-stone-900"
                />
                <span className="text-xs text-stone-500">
                  Уведомление сработает в указанное время
                </span>
              </div>

              {/* Быстрый выбор времени */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1.5 flex items-center gap-1">
                  <Sparkles size={12} />
                  <span>Популярные интервалы:</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setCurrentTime(preset.time)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        currentTime === preset.time
                          ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="font-mono font-bold">{preset.time}</span>
                      <span className="text-[10px] opacity-80">({preset.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* БЛОК 3: ИНТЕРВАЛ ПОВТОРЕНИЯ */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                <Repeat size={16} className="text-blue-600" />
                <span>Интервал повторения</span>
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'weekly', label: 'Еженедельно', desc: 'В выбранные дни' },
                  { id: 'daily', label: 'Каждый день', desc: 'Ежедневный вызов' },
                  { id: 'custom_days', label: 'Каждые N дней', desc: 'Свой интервал' },
                  { id: 'none', label: 'Однократно', desc: 'Один раз' },
                ].map((item) => {
                  const isSelected = currentRepeatInterval === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentRepeatInterval(item.id as ReminderIntervalType)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className="text-[10px] text-stone-500 mt-1">{item.desc}</span>
                    </button>
                  );
                })}
              </div>

              {currentRepeatInterval === 'custom_days' && (
                <div className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                    <span>Повторять каждые:</span>
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[11px]">
                      {currentIntervalDays} {currentIntervalDays === 1 ? 'день' : currentIntervalDays < 5 ? 'дня' : 'дней'}
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[2, 3, 4, 5, 7, 10, 14].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setCurrentIntervalDays(days)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          currentIntervalDays === days
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {days} дн.
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 3. НИЖНЯЯ ПАНЕЛЬ С СВОДКОЙ И КНОПКОЙ */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-xl p-3.5 sm:p-4 shrink-0">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
              <Calendar size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                Настроенное расписание:
              </div>
              <div className="text-xs font-bold text-stone-900 truncate">
                {getSummaryText()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <Check size={16} />
            <span>Применить расписание</span>
          </button>
        </div>
      </div>
    </div>
  );
}
