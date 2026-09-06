import React from 'react';
import { useAppState } from '../useAppState';
import { Bell, MapPin, Clock, Check, X, ArrowRight, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface ActiveReminderAlertModalProps {
  state: ReturnType<typeof useAppState>;
}

export default function ActiveReminderAlertModal({ state }: ActiveReminderAlertModalProps) {
  const { activeReminderAlert, setActiveReminderAlert, shoppingList, setShoppingList, recordPurchaseEvent } = state;
  const navigate = useNavigate();

  if (!activeReminderAlert) return null;

  const { reminder, items, distanceMeters } = activeReminderAlert;
  const isGeo = reminder.type === 'geo';

  const handleDismiss = () => {
    setActiveReminderAlert(null);
  };

  const handleGoToShopping = () => {
    setActiveReminderAlert(null);
    navigate('/shopping');
  };

  const handleSnooze = () => {
    // Snooze by recording trigger time
    setActiveReminderAlert(null);
  };

  const toggleItemChecked = (itemName: string) => {
    setShoppingList(prev => (prev || []).map(i => {
      if (i.name.toLowerCase() === itemName.toLowerCase()) {
        const next = !i.checked;
        if (next) {
          recordPurchaseEvent(i.name, 'bought');
        }
        return { ...i, checked: next };
      }
      return i;
    }));
  };

  return (
    <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-xs z-60 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Шапка оповещения */}
        <div className={
          isGeo 
            ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 relative"
            : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 sm:p-5 relative"
        }>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              {isGeo ? <MapPin size={24} className="animate-bounce" /> : <Clock size={24} className="animate-pulse" />}
            </div>
            <div className="min-w-0 pr-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                <Bell size={12} />
                {isGeo ? 'Гео-напоминание по приближению' : 'Напоминание по расписанию'}
              </div>
              <h3 className="text-base sm:text-lg font-bold truncate leading-snug">
                {isGeo ? `Вы рядом с «${reminder.storeName || 'магазином'}»` : reminder.title}
              </h3>
              <p className="text-xs text-white/80">
                {isGeo 
                  ? `Расстояние ~${distanceMeters || reminder.radiusMeters || 200} м ${reminder.address ? `• ${reminder.address}` : ''}`
                  : `Запланированное время: ${reminder.time}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Список товаров */}
        <div className="p-4 sm:p-5 space-y-3.5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
              Не забудьте купить ({items.length}):
            </h4>
            <p className="text-xs text-stone-500">
              Вы можете отметить купленные товары прямо здесь:
            </p>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto no-scrollbar">
            {items.map(name => {
              const currentItem = (shoppingList || []).find(s => s.name.toLowerCase() === name.toLowerCase());
              const isChecked = currentItem?.checked || false;

              return (
                <div
                  key={name}
                  onClick={() => toggleItemChecked(name)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                    isChecked 
                      ? 'bg-emerald-50/70 border-emerald-200 text-stone-400 line-through' 
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                  }`}
                >
                  <span className="font-semibold">{name}</span>
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                    isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-white'
                  }`}>
                    {isChecked && <Check size={12} />}
                  </div>
                </div>
              );
            })}
          </div>

          {reminder.notes && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900">
              <span className="font-bold">Заметка:</span> {reminder.notes}
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSnooze}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Отложить на 15 мин
            </button>
            <button
              type="button"
              onClick={handleGoToShopping}
              className="flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <ShoppingCart size={14} />
              <span>К покупкам</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
