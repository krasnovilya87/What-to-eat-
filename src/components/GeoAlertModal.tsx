import React from 'react';
import { useAppState } from '../useAppState';
import { StoreLocation, ShoppingItem } from '../types';
import { MapPin, ShoppingBag, Plus, Check, X, ArrowRight, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mergeShoppingItems } from '../utils/supermarket';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

interface GeoAlertModalProps {
  state: ReturnType<typeof useAppState>;
}

export default function GeoAlertModal({ state }: GeoAlertModalProps) {
  const { activeGeoAlert, setActiveGeoAlert, shoppingList, setShoppingList, recordPurchaseEvent } = state;
  const navigate = useNavigate();

  if (!activeGeoAlert) return null;

  const { store, neededItems, distanceMeters } = activeGeoAlert;

  const handleAddAllToShopping = () => {
    const newItems: ShoppingItem[] = neededItems.map(name => ({
      id: uuidv4(),
      name,
      quantity: '1 шт',
      checked: false,
      isManual: true
    }));

    setShoppingList(prev => mergeShoppingItems(prev || [], newItems));
    neededItems.forEach(item => recordPurchaseEvent(item, 'added'));
    setActiveGeoAlert(null);
    navigate('/shopping');
  };

  const handleOpenShopping = () => {
    setActiveGeoAlert(null);
    navigate('/shopping');
  };

  const handleDismiss = () => {
    setActiveGeoAlert(null);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Header with store info */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 backdrop-blur-xs">
              <MapPin size={22} className="text-emerald-200" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                <Bell size={12} className="animate-bounce" />
                Гео-напоминание
              </div>
              <h3 className="text-lg font-bold truncate leading-snug">
                Вы рядом с «{store.name}»
              </h3>
              <p className="text-xs text-emerald-100">
                Расстояние ~{distanceMeters} м {store.address ? `• ${store.address}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content with needed products */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-stone-800">
              Рекомендуется пополнить запасы:
            </h4>
            <p className="text-xs text-stone-500">
              По рассчитанному циклу потребления этих продуктов сейчас может не хватать дома:
            </p>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
            {neededItems.length > 0 ? (
              neededItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {item}
                  </span>
                  <span className="text-xs text-stone-400">Пора купить</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-stone-500 italic p-3 text-center bg-stone-50 rounded-xl">
                Все избранные продукты сейчас в достатке! Проверьте общий список покупок.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            {neededItems.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllToShopping}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={18} />
                Добавить всё в список покупок (+{neededItems.length})
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenShopping}
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag size={15} />
                Перейти в покупки
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2.5 px-4 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
