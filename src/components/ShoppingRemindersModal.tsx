import React, { useState } from 'react';
import { useAppState } from '../useAppState';
import { 
  Bell, Clock, MapPin, Calendar, Plus, Trash2, Edit2, Check, X, 
  Compass, AlertCircle, Play, Store, ChevronRight, Star, Search, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../App';
import { ShoppingReminder, ReminderType, ReminderIntervalType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cleanProductName } from '../utils/geoFavorites';
import { StoreFullscreenMapModal } from './StoreFullscreenMapModal';
import { ScheduleFullscreenModal } from './ScheduleFullscreenModal';

interface ShoppingRemindersModalProps {
  state: ReturnType<typeof useAppState>;
  isOpen: boolean;
  onClose: () => void;
}

export const POPULAR_CHAINS = [
  { name: 'Пятёрочка', defaultRadius: 200 },
  { name: 'ВкусВилл', defaultRadius: 250 },
  { name: 'Перекрёсток', defaultRadius: 300 },
  { name: 'Магнит', defaultRadius: 200 },
  { name: 'Лента', defaultRadius: 500 },
  { name: 'Ашан', defaultRadius: 500 },
];

const WEEKDAYS = [
  { id: 1, short: 'Пн', label: 'Понедельник' },
  { id: 2, short: 'Вт', label: 'Вторник' },
  { id: 3, short: 'Ср', label: 'Среда' },
  { id: 4, short: 'Чт', label: 'Четверг' },
  { id: 5, short: 'Пт', label: 'Пятница' },
  { id: 6, short: 'Сб', label: 'Суббота' },
  { id: 7, short: 'Вс', label: 'Воскресенье' },
];

export default function ShoppingRemindersModal({ state, isOpen, onClose }: ShoppingRemindersModalProps) {
  const { 
    reminders, 
    addReminder, 
    updateReminder, 
    deleteReminder, 
    toggleReminder,
    shoppingList,
    setActiveReminderAlert,
    fridge,
    grains,
    spices,
    favoriteConfigs,
    purchases,
    purchaseEvents
  } = state;

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Notification status
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Form State
  const [formType, setFormType] = useState<ReminderType>('schedule');
  const [formTitle, setFormTitle] = useState('');
  
  // Schedule Form State
  const [formDateMode, setFormDateMode] = useState<'weekdays' | 'specific_date'>('weekdays');
  const [formWeekDays, setFormWeekDays] = useState<number[]>([1, 3, 5]);
  const [formDate, setFormDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [formTime, setFormTime] = useState('18:30');
  const [formRepeatInterval, setFormRepeatInterval] = useState<ReminderIntervalType>('weekly');
  const [formIntervalDays, setFormIntervalDays] = useState<number>(3);

  // Geo Form State
  const [formStoreName, setFormStoreName] = useState('Супермаркет у дома');
  const [formAddress, setFormAddress] = useState('ул. Ленина, д. 10');
  const [formLatitude, setFormLatitude] = useState<string>('55.7558');
  const [formLongitude, setFormLongitude] = useState<string>('37.6173');
  const [formRadiusMeters, setFormRadiusMeters] = useState<number>(250);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMapFullscreenOpen, setIsMapFullscreenOpen] = useState(false);
  const [isScheduleFullscreenOpen, setIsScheduleFullscreenOpen] = useState(false);

  const getScheduleSummaryText = () => {
    if (formDateMode === 'weekdays') {
      if (formWeekDays.length === 7) {
        return `Каждый день в ${formTime}`;
      } else if (formWeekDays.length === 5 && [1, 2, 3, 4, 5].every(d => formWeekDays.includes(d))) {
        return `По будням в ${formTime}`;
      } else if (formWeekDays.length === 2 && [6, 7].every(d => formWeekDays.includes(d))) {
        return `По выходным в ${formTime}`;
      } else {
        const daysStr = formWeekDays
          .map(id => WEEKDAYS.find(w => w.id === id)?.short)
          .filter(Boolean)
          .join(', ');
        return `${daysStr || 'Дни'} в ${formTime}`;
      }
    } else {
      if (formDate) {
        const d = new Date(formDate);
        const dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return `${dateStr} в ${formTime}`;
      }
      return `В ${formTime}`;
    }
  };

  // Items & Notes State
  const [formRemindAll, setFormRemindAll] = useState(true);
  const [formRemindFavorites, setFormRemindFavorites] = useState(false);
  const [formRemindSpecific, setFormRemindSpecific] = useState(false);
  const [formSelectedItems, setFormSelectedItems] = useState<string[]>([]);
  const [isItemsSelectorOpen, setIsItemsSelectorOpen] = useState(false);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');
  const [customItemInput, setCustomItemInput] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const favoriteItems = React.useMemo(() => {
    const names = new Set<string>();
    (fridge || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (grains || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (spices || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (favoriteConfigs || []).forEach(c => c.name?.trim() && names.add(c.name.trim()));
    (shoppingList || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    if (names.size === 0) {
      names.add('Молоко');
      names.add('Яйца');
    }
    return Array.from(names);
  }, [fridge, grains, spices, favoriteConfigs, shoppingList]);

  // Вычисление заканчивающихся избранных продуктов согласно графика покупок и интервалов
  const expiringFavoritesInfo = React.useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Карта запасов в холодильнике, бакалее, специях
    const inventoryMap = new Map<string, { quantity?: string; daysLeft?: number }>();
    [...(fridge || []), ...(grains || []), ...(spices || [])].forEach(item => {
      const clean = cleanProductName(item.name);
      if (clean) {
        inventoryMap.set(clean, { quantity: item.quantity, daysLeft: item.daysLeft });
      }
    });

    return favoriteItems.map(name => {
      const cleanTarget = cleanProductName(name);
      const events: number[] = [];

      (purchases || []).forEach(p => {
        (p.items || []).forEach(it => {
          const itClean = cleanProductName(it.name);
          if (itClean.includes(cleanTarget) || cleanTarget.includes(itClean)) {
            events.push(p.timestamp);
          }
        });
      });

      (purchaseEvents || []).forEach(ev => {
        if (ev.type === 'bought') {
          const evClean = cleanProductName(ev.itemName);
          if (evClean.includes(cleanTarget) || cleanTarget.includes(evClean)) {
            events.push(ev.timestamp);
          }
        }
      });

      events.sort((a, b) => a - b);

      // Рассчитываем средний интервал по графику
      let avgIntervalDays = 4;
      const favCfg = (favoriteConfigs || []).find(c => cleanProductName(c.name) === cleanTarget);
      if (favCfg?.customIntervalDays && favCfg.customIntervalDays > 0) {
        avgIntervalDays = favCfg.customIntervalDays;
      } else if (events.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < events.length; i++) {
          const diff = (events[i] - events[i - 1]) / dayMs;
          if (diff > 0) intervals.push(diff);
        }
        if (intervals.length > 0) {
          avgIntervalDays = Math.max(1, Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length));
        }
      }

      const lastBought = events.length > 0 ? events[events.length - 1] : null;
      const daysSinceLast = lastBought ? Math.max(0, Math.floor((now - lastBought) / dayMs)) : null;

      // Проверка текущего запаса
      const invItem = inventoryMap.get(cleanTarget);
      const isInvZeroOrLow = invItem && (
        invItem.quantity === '0' ||
        invItem.quantity?.toLowerCase().includes('нет') ||
        invItem.quantity?.toLowerCase().includes('мало') ||
        (invItem.daysLeft !== undefined && invItem.daysLeft <= 1)
      );

      // Дней до следующей покупки по графику
      const daysRemaining = daysSinceLast !== null ? (avgIntervalDays - daysSinceLast) : 0;
      const isExpiring = daysRemaining <= 1 || Boolean(isInvZeroOrLow) || daysSinceLast === null;

      let statusText = '';
      if (daysSinceLast === null) {
        statusText = 'По графику пора пополнить';
      } else if (daysRemaining <= 0) {
        statusText = `Интервал ~${avgIntervalDays} дн. (куплено ${daysSinceLast} дн. назад) — пора пополнить`;
      } else if (daysRemaining === 1) {
        statusText = `Интервал ~${avgIntervalDays} дн. — подходит к концу через ~1 дн.`;
      } else {
        statusText = `Интервал ~${avgIntervalDays} дн. — в запасе ещё ~${daysRemaining} дн.`;
      }

      return {
        name,
        avgIntervalDays,
        daysSinceLast,
        daysRemaining,
        isExpiring,
        statusText
      };
    });
  }, [favoriteItems, purchases, purchaseEvents, fridge, grains, spices, favoriteConfigs]);

  // Заканчивающиеся избранные продукты, определенные графиком
  const expiringFavorites = React.useMemo(() => {
    const list = expiringFavoritesInfo.filter(f => f.isExpiring);
    if (list.length === 0 && expiringFavoritesInfo.length > 0) {
      const sorted = [...expiringFavoritesInfo].sort((a, b) => a.daysRemaining - b.daysRemaining);
      return [sorted[0]];
    }
    return list;
  }, [expiringFavoritesInfo]);

  if (!isOpen) return null;

  const pendingItems = (shoppingList || []).filter(item => !item.checked);

  // Request browser notification permission
  const handleRequestNotif = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Get current device GPS position
  const handleGetDeviceCoords = () => {
    if (!navigator.geolocation) {
      setGpsError('Геолокация не поддерживается вашим браузером');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLatitude(pos.coords.latitude.toFixed(6));
        setFormLongitude(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('Доступ к геолокации запрещен в браузере');
        } else {
          setGpsError('Не удалось определить координаты');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Pre-fill form when editing
  const startEdit = (rem: ShoppingReminder) => {
    setEditingId(rem.id);
    setFormType(rem.type);
    setFormTitle(rem.title);
    setFormDateMode(rem.dateMode || 'weekdays');
    setFormWeekDays(rem.weekDays || [1]);
    setFormDate(rem.date || new Date().toISOString().split('T')[0]);
    setFormTime(rem.time || '18:00');
    setFormRepeatInterval(rem.repeatInterval || 'none');
    setFormIntervalDays(rem.intervalDays || 3);
    setFormStoreName(rem.storeName || '');
    setFormAddress(rem.address || '');
    setFormLatitude(rem.latitude ? String(rem.latitude) : '55.7558');
    setFormLongitude(rem.longitude ? String(rem.longitude) : '37.6173');
    setFormRadiusMeters(rem.radiusMeters || 250);
    setFormRemindAll(rem.remindAllPendingItems !== false);
    setFormRemindFavorites(Boolean(rem.remindFavorites));
    const hasSpecific = Boolean(rem.selectedItems && rem.selectedItems.length > 0);
    setFormRemindSpecific(hasSpecific);
    setFormSelectedItems(rem.selectedItems || []);
    setIsItemsSelectorOpen(false);
    setSelectorSearchQuery('');
    setCustomItemInput('');
    setFormNotes(rem.notes || '');
    setMode('create');
  };

  // Reset form to create new
  const startCreate = (type: ReminderType = 'schedule') => {
    setEditingId(null);
    setFormType(type);
    setFormTitle(type === 'schedule' ? 'Зайти за продуктами к ужину' : 'Супермаркет по пути');
    setFormDateMode('weekdays');
    setFormWeekDays([1, 3, 5]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDate(tomorrow.toISOString().split('T')[0]);
    setFormTime('18:30');
    setFormRepeatInterval(type === 'schedule' ? 'weekly' : 'none');
    setFormIntervalDays(3);
    setFormStoreName('Супермаркет у дома');
    setFormAddress('Ближайший магазин');
    setFormLatitude('55.7558');
    setFormLongitude('37.6173');
    setFormRadiusMeters(250);
    setFormRemindAll(true);
    setFormRemindFavorites(false);
    setFormRemindSpecific(false);
    setFormSelectedItems([]);
    setIsItemsSelectorOpen(false);
    setSelectorSearchQuery('');
    setCustomItemInput('');
    setFormNotes('');
    setGpsError(null);
    setMode('create');
  };

  // Save Reminder
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim() || (formType === 'schedule' ? 'Напоминание о покупках' : `Рядом с «${formStoreName}»`);

    const reminderData: ShoppingReminder = {
      id: editingId || uuidv4(),
      type: formType,
      enabled: true,
      title,
      // Schedule fields
      dateMode: formType === 'schedule' ? formDateMode : undefined,
      date: formType === 'schedule' && formDateMode === 'specific_date' ? formDate : undefined,
      weekDays: formType === 'schedule' && formDateMode === 'weekdays' ? formWeekDays : undefined,
      time: formTime,
      repeatInterval: formType === 'schedule' ? formRepeatInterval : 'none',
      intervalDays: formType === 'schedule' && formRepeatInterval === 'custom_days' ? formIntervalDays : undefined,
      // Geo fields
      storeName: formStoreName ? formStoreName.trim() : undefined,
      address: formAddress ? formAddress.trim() : undefined,
      latitude: parseFloat(formLatitude) || 55.7558,
      longitude: parseFloat(formLongitude) || 37.6173,
      radiusMeters: formRadiusMeters,
      // Content
      remindAllPendingItems: formRemindAll,
      remindFavorites: formRemindFavorites,
      selectedItems: formRemindSpecific && formSelectedItems.length > 0 ? formSelectedItems : undefined,
      notes: formNotes.trim() || undefined,
      lastTriggeredAt: undefined
    };

    if (editingId) {
      updateReminder(reminderData);
    } else {
      addReminder(reminderData);
    }

    setMode('list');
    setEditingId(null);
  };

  // Trigger immediate test simulation
  const handleSimulateAlert = (reminder: ShoppingReminder) => {
    let items: string[] = [];
    if (reminder.remindAllPendingItems) {
      items.push(...pendingItems.map(p => p.name));
    }
    if (reminder.remindFavorites) {
      items.push(...expiringFavorites.map(f => f.name));
    }
    if (reminder.selectedItems && reminder.selectedItems.length > 0) {
      items.push(...reminder.selectedItems);
    }
    items = Array.from(new Set(items));
    if (items.length === 0) {
      items = ['Молоко 3.2%', 'Хлеб пшеничный', 'Яйца С0'];
    }

    setActiveReminderAlert({
      reminder,
      items,
      distanceMeters: reminder.type === 'geo' ? Math.round((reminder.radiusMeters || 200) * 0.7) : undefined
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = reminder.type === 'geo' 
          ? `📍 Вы рядом с «${reminder.storeName || 'магазином'}»!` 
          : `⏰ Напоминание: ${reminder.title}`;
        new Notification(title, {
          body: `Не забудьте купить: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}`,
          icon: '/favicon.ico'
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Toggle day of week in schedule
  const toggleWeekday = (dayId: number) => {
    setFormWeekDays(prev => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(d => d !== dayId);
      } else {
        return [...prev, dayId].sort();
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
      >
        {/* Шапка модального окна */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                Напоминания о покупках
              </h3>
              
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Статус браузерных push-уведомлений */}
        {notifPermission !== 'granted' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>
                {notifPermission === 'denied'
                  ? 'Уведомления отключены в браузере. Включите их для всплывающих оповещений.'
                  : 'Включите уведомления, чтобы получать сигналы при приближении или вовремя.'}
              </span>
            </div>
            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={handleRequestNotif}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap cursor-pointer transition-colors shadow-xs"
              >
                Включить
              </button>
            )}
          </div>
        )}

        {/* Переключатель режима: Список / Создать */}
        <div className="px-4 pt-3 pb-2 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/50">
          <div className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('list'); setEditingId(null); }}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                mode === 'list'
                  ? "bg-white text-stone-900 shadow-xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              Активные ({reminders.length})
            </button>
            <button
              type="button"
              onClick={() => startCreate('schedule')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                mode === 'create'
                  ? "bg-white text-stone-900 shadow-xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              <Plus size={13} />
              {editingId ? 'Редактирование' : 'Новое'}
            </button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar flex-1 space-y-4">
          {mode === 'list' ? (
            reminders.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-14 h-14 mx-auto bg-stone-100 rounded-3xl flex items-center justify-center text-stone-400">
                  <Bell size={26} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-800">
                    У вас пока нет напоминаний
                  </h4>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                    Создайте напоминание по расписанию (конкретный день, время, интервал) или настройте геолокацию при приближении к магазину.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => startCreate('schedule')}
                    className="bg-stone-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs hover:bg-stone-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Clock size={14} />
                    По расписанию
                  </button>
                  <button
                    type="button"
                    onClick={() => startCreate('geo')}
                    className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <MapPin size={14} />
                    По геолокации
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map(rem => {
                  const isGeo = rem.type === 'geo';
                  return (
                    <div
                      key={rem.id}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border transition-all relative overflow-hidden",
                        rem.enabled 
                          ? (isGeo ? "bg-emerald-50/40 border-emerald-200/80" : "bg-blue-50/40 border-blue-200/80")
                          : "bg-stone-50 border-stone-200 opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                            isGeo 
                              ? (rem.enabled ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-500")
                              : (rem.enabled ? "bg-blue-600 text-white" : "bg-stone-200 text-stone-500")
                          )}>
                            {isGeo ? <MapPin size={18} /> : <Clock size={18} />}
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-stone-900 leading-snug">
                              {rem.title}
                            </h4>

                            {/* Параметры напоминания */}
                            <div className="text-xs text-stone-600 space-y-0.5">
                              {isGeo ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-stone-800">
                                    Магазин: «{rem.storeName || 'Магазин'}»
                                  </span>
                                  {rem.address && (
                                    <span className="text-stone-500">• {rem.address}</span>
                                  )}
                                  <span className="bg-white/80 border border-stone-200 px-1.5 py-0.2 rounded text-[11px] font-medium text-emerald-800">
                                    Радиус: {rem.radiusMeters || 250} м
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* День / Дни недели */}
                                  <span className="font-semibold text-stone-800">
                                    {rem.dateMode === 'specific_date' 
                                      ? `Дата: ${rem.date || 'Любая'}`
                                      : `Дни: ${(rem.weekDays || []).map(d => WEEKDAYS.find(w => w.id === d)?.short).filter(Boolean).join(', ') || 'Ежедневно'}`
                                    }
                                  </span>
                                  <span>в {rem.time}</span>
                                  {/* Интервал */}
                                  <span className="bg-white/80 border border-stone-200 px-1.5 py-0.2 rounded text-[11px] font-medium text-blue-800">
                                    {rem.repeatInterval === 'daily' && 'Каждый день'}
                                    {rem.repeatInterval === 'weekly' && 'Еженедельно'}
                                    {rem.repeatInterval === 'custom_days' && `Каждые ${rem.intervalDays || 3} дн.`}
                                    {rem.repeatInterval === 'none' && 'Однократно'}
                                  </span>
                                </div>
                              )}

                              {/* Список товаров или заметки */}
                              <div className="text-[11px] text-stone-500 pt-0.5 space-y-0.5">
                                {rem.remindAllPendingItems && (
                                  <div>📦 Все некупленные товары ({pendingItems.length} шт.)</div>
                                )}
                                {rem.remindFavorites && (
                                  <div className="flex items-center gap-1 text-stone-700 font-medium">
                                    <Star size={11} className="text-amber-500 fill-amber-400 shrink-0" />
                                    <span>Заканчивающиеся избранные продукты ({expiringFavorites.length} шт.)</span>
                                  </div>
                                )}
                                {rem.selectedItems && rem.selectedItems.length > 0 && (
                                  <div>
                                    <span className="font-medium text-stone-700">Определённые товары ({rem.selectedItems.length} шт.): </span>
                                    <span>{rem.selectedItems.join(', ')}</span>
                                  </div>
                                )}
                                {rem.notes && <span className="italic block mt-0.5 text-stone-600">💬 {rem.notes}</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Переключатель активности */}
                        <button
                          type="button"
                          onClick={() => toggleReminder(rem.id)}
                          className={cn(
                            "w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0",
                            rem.enabled ? "bg-stone-900" : "bg-stone-300"
                          )}
                          title={rem.enabled ? "Отключить напоминание" : "Включить напоминание"}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full bg-white transition-transform shadow-xs",
                            rem.enabled ? "translate-x-5" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      {/* Нижняя панель действий для карточки */}
                      <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSimulateAlert(rem)}
                          className="text-xs font-bold text-stone-800 hover:text-stone-950 bg-white/80 hover:bg-white border border-stone-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Протестировать всплывающее оповещение прямо сейчас"
                        >
                          <Play size={12} className="text-amber-600 fill-amber-600" />
                          <span>Тест оповещения</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(rem)}
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                            title="Редактировать"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteReminder(rem.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ФОРМА СОЗДАНИЯ / РЕДАКТИРОВАНИЯ НАПОМИНАНИЯ */
            <form onSubmit={handleSave} className="space-y-4">
              {/* 1. САМЫЙ ВЕРХНИЙ БЛОК: ЧТО НАПОМНИТЬ КУПИТЬ */}
              <div className="space-y-2 p-3 bg-stone-50/80 rounded-2xl border border-stone-200/80">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wide">
                  Напомнить купить:
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formRemindAll}
                      onChange={(e) => setFormRemindAll(e.target.checked)}
                      className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                    />
                    <span>
                      Все некупленные товары из списка покупок 
                      <strong className="ml-1 text-stone-900">({pendingItems.length} шт.)</strong>
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formRemindFavorites}
                      onChange={(e) => setFormRemindFavorites(e.target.checked)}
                      className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <Star size={13} className="text-amber-500 fill-amber-400 shrink-0" />
                      <span>
                        Заканчивающиеся избранные продукты
                        <strong className="ml-1 text-stone-900">({expiringFavorites.length} шт.)</strong>
                      </span>
                    </span>
                  </label>

                  {/* Пункт 3: Определённые товары (при нажатии открывает всплывающее окно со всем перечнем) */}
                  <div className="pt-0.5">
                    <label 
                      onClick={() => {
                        setFormRemindSpecific(true);
                        setIsItemsSelectorOpen(true);
                      }}
                      className="flex items-center gap-2.5 text-xs font-medium text-stone-800 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={formRemindSpecific}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = e.target.checked;
                          setFormRemindSpecific(next);
                          if (next) {
                            setIsItemsSelectorOpen(true);
                          }
                        }}
                        className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag size={13} className="text-stone-700 shrink-0" />
                        <span>Определённые товары</span>
                        {formSelectedItems.length > 0 ? (
                          <strong className="text-stone-900">({formSelectedItems.length} шт.)</strong>
                        ) : null}
                      </span>
                    </label>

                    {/* Отображение выбранных конкретных товаров */}
                    {formRemindSpecific && formSelectedItems.length > 0 && (
                      <div className="ml-6 mt-1.5 flex flex-wrap gap-1.5">
                        {formSelectedItems.map(name => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-stone-200 text-stone-800 px-2 py-0.5 rounded-full shadow-2xs"
                          >
                            <span 
                              onClick={() => setIsItemsSelectorOpen(true)}
                              className="truncate max-w-[140px] cursor-pointer hover:underline"
                            >
                              {name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormSelectedItems(prev => prev.filter(n => n !== name));
                              }}
                              className="text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                              title="Удалить"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. ВЫБОР ТИПА: РАСПИСАНИЕ ИЛИ ГЕОЛОКАЦИЯ (без второстепенного текста) */}
              <div>
                <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">
                  Тип напоминания
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('schedule');
                      setIsScheduleFullscreenOpen(true);
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer",
                      formType === 'schedule'
                        ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 shadow-xs"
                        : "bg-white border-stone-200 hover:bg-stone-50 text-stone-600"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      formType === 'schedule' ? "bg-blue-600 text-white" : "bg-stone-100 text-stone-500"
                    )}>
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">
                        По расписанию
                      </div>
                      {formType === 'schedule' && (
                        <div className="text-[10px] text-blue-700 truncate font-medium">
                          {getScheduleSummaryText()}
                        </div>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('geo');
                      setIsMapFullscreenOpen(true);
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer",
                      formType === 'geo'
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs"
                        : "bg-white border-stone-200 hover:bg-stone-50 text-stone-600"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      formType === 'geo' ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"
                    )}>
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">
                        По приближению
                      </div>
                      {formType === 'geo' && formStoreName && (
                        <div className="text-[10px] text-emerald-700 truncate font-medium">
                          {formStoreName} • {formRadiusMeters >= 1000 ? `${(formRadiusMeters/1000).toFixed(1)} км` : `${formRadiusMeters} м`}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Название напоминания */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Название напоминания
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={formType === 'schedule' ? 'Например: Зайти за продуктами к ужину' : 'Например: Супермаркет у дома'}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                  required
                />
              </div>

              {/* Заметки */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Заметка или комментарий (опционально):
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Например: Взять эко-пакет, проверить бонусы"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Кнопки сохранения / отмены */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => { setMode('list'); setEditingId(null); }}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{editingId ? 'Сохранить изменения' : 'Создать напоминание'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Футер модального окна */}
        <div className="p-3.5 sm:p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span className="text-[11px]">
            {reminders.filter(r => r.enabled).length} из {reminders.length} напоминаний активны
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-stone-800 hover:text-stone-950 px-3 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        {/* Модальное окно выбора определённых товаров из списка покупок */}
        <AnimatePresence>
          {isItemsSelectorOpen && (
            <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
              >
                {/* Шапка окна выбора */}
                <div className="p-4 bg-stone-50 border-b border-stone-200/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
                      <ShoppingBag size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 leading-tight">
                        Определённые товары
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Весь перечень из списка покупок ({shoppingList.length} поз.)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsItemsSelectorOpen(false)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Поиск и быстрые действия */}
                <div className="p-3 bg-white border-b border-stone-100 space-y-2 shrink-0">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={selectorSearchQuery}
                      onChange={(e) => setSelectorSearchQuery(e.target.value)}
                      placeholder="Поиск по списку покупок..."
                      className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                    {selectorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSelectorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="text-[11px] text-stone-500 font-medium">
                      Выбрано: <strong className="text-stone-900">{formSelectedItems.length}</strong> из {shoppingList.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allNames = Array.from(new Set(shoppingList.map(i => i.name.trim()).filter(Boolean)));
                          setFormSelectedItems(allNames);
                        }}
                        className="text-[11px] text-stone-600 hover:text-stone-900 font-medium hover:underline cursor-pointer"
                      >
                        Выбрать все
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormSelectedItems([])}
                        className="text-[11px] text-stone-500 hover:text-stone-800 font-medium hover:underline cursor-pointer"
                      >
                        Снять выбор
                      </button>
                    </div>
                  </div>
                </div>

                {/* Скроллируемый перечень списка покупок */}
                <div className="p-3 overflow-y-auto max-h-[48vh] space-y-1.5 flex-1">
                  {shoppingList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-stone-400 space-y-2">
                      <ShoppingBag size={28} className="mx-auto text-stone-300 stroke-1" />
                      <div>В списке покупок пока нет товаров</div>
                    </div>
                  ) : (
                    (() => {
                      const filtered = shoppingList.filter(item => 
                        !selectorSearchQuery || item.name.toLowerCase().includes(selectorSearchQuery.toLowerCase().trim())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="py-6 text-center text-xs text-stone-400">
                            Товары не найдены по запросу «{selectorSearchQuery}»
                          </div>
                        );
                      }

                      return filtered.map(item => {
                        const isSelected = formSelectedItems.includes(item.name);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                              isSelected
                                ? "bg-stone-900 text-white border-stone-900 shadow-2xs"
                                : "bg-stone-50 hover:bg-stone-100/80 border-stone-200/80 text-stone-800"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormSelectedItems(prev => Array.from(new Set([...prev, item.name])));
                                  } else {
                                    setFormSelectedItems(prev => prev.filter(n => n !== item.name));
                                  }
                                }}
                                className="w-4 h-4 rounded accent-stone-900 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className={cn("text-xs font-semibold truncate", isSelected ? "text-white" : "text-stone-900")}>
                                  {item.name}
                                </div>
                                {item.quantity && (
                                  <div className={cn("text-[10px]", isSelected ? "text-stone-300" : "text-stone-500")}>
                                    Количество: {item.quantity}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium",
                              isSelected 
                                ? "bg-white/20 text-white" 
                                : item.checked 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-stone-200/70 text-stone-700"
                            )}>
                              {item.checked ? 'Куплен' : 'В списке'}
                            </span>
                          </label>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Возможность добавить свой произвольный товар */}
                <div className="p-3 bg-stone-50 border-t border-stone-100 shrink-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customItemInput}
                      onChange={(e) => setCustomItemInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = customItemInput.trim();
                          if (val && !formSelectedItems.includes(val)) {
                            setFormSelectedItems(prev => [...prev, val]);
                            setCustomItemInput('');
                          }
                        }
                      }}
                      placeholder="Добавить другой товар..."
                      className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = customItemInput.trim();
                        if (val && !formSelectedItems.includes(val)) {
                          setFormSelectedItems(prev => [...prev, val]);
                          setCustomItemInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      + Добавить
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (formSelectedItems.length > 0) {
                          setFormRemindSpecific(true);
                        }
                        setIsItemsSelectorOpen(false);
                      }}
                      className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Готово {formSelectedItems.length > 0 ? `(${formSelectedItems.length} выбрано)` : ''}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Полноэкранная интерактивная карта магазина */}
      <StoreFullscreenMapModal
        isOpen={isMapFullscreenOpen}
        onClose={() => setIsMapFullscreenOpen(false)}
        latitude={parseFloat(formLatitude) || 55.7558}
        longitude={parseFloat(formLongitude) || 37.6173}
        radiusMeters={formRadiusMeters}
        storeName={formStoreName}
        address={formAddress}
        onSave={(data) => {
          setFormLatitude(String(data.latitude));
          setFormLongitude(String(data.longitude));
          setFormRadiusMeters(data.radiusMeters);
          setFormStoreName(data.storeName);
          setFormAddress(data.address);
        }}
      />

      {/* Полноэкранная настройка даты и времени по расписанию */}
      <ScheduleFullscreenModal
        isOpen={isScheduleFullscreenOpen}
        onClose={() => setIsScheduleFullscreenOpen(false)}
        dateMode={formDateMode}
        weekDays={formWeekDays}
        date={formDate}
        time={formTime}
        repeatInterval={formRepeatInterval}
        intervalDays={formIntervalDays}
        onSave={(data) => {
          setFormDateMode(data.dateMode);
          setFormWeekDays(data.weekDays);
          setFormDate(data.date);
          setFormTime(data.time);
          setFormRepeatInterval(data.repeatInterval);
          setFormIntervalDays(data.intervalDays);
        }}
      />
    </div>
  );
}
