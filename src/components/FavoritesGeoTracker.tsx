import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../useAppState';
import { 
  Star, MapPin, Navigation, Bell, Clock, Plus, Trash2, 
  Check, RefreshCw, AlertCircle, ShoppingBag, Radio, Compass, X, 
  ChevronRight, History, Sliders, CheckCircle2, Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../App';
import { 
  calculateDistanceMeters, 
  calculateItemStats, 
  cleanProductName,
  ItemPurchaseStats 
} from '../utils/geoFavorites';
import { mergeShoppingItems } from '../utils/supermarket';
import { StoreLocation, ShoppingItem, FavoriteProductConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FavoritesGeoTrackerProps {
  state: ReturnType<typeof useAppState>;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'favorites' | 'geo';
}

export default function FavoritesGeoTracker({
  state,
  isOpen,
  onClose,
  defaultTab = 'favorites'
}: FavoritesGeoTrackerProps) {
  const {
    fridge, setFridge,
    grains, setGrains,
    spices, setSpices,
    shoppingList, setShoppingList,
    purchaseEvents,
    recordPurchaseEvent,
    stores, setStores,
    geoReminderEnabled, setGeoReminderEnabled,
    favoriteConfigs, setFavoriteConfigs,
    setActiveGeoAlert
  } = state;

  const [activeTab, setActiveTab] = useState<'favorites' | 'geo'>(defaultTab);
  const [newFavName, setNewFavName] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [editingIntervalItem, setEditingIntervalItem] = useState<string | null>(null);
  const [tempInterval, setTempInterval] = useState<string>('4');
  const [justAddedMap, setJustAddedMap] = useState<Record<string, boolean>>({});

  // GPS state
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // New store form
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreRadius, setNewStoreRadius] = useState<number>(200);

  // Fetch current GPS location
  const refreshLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Геолокация не поддерживается вашим браузером');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('Доступ к геолокации запрещен в настройках');
        } else {
          setGpsError('Не удалось определить координаты');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      refreshLocation();
    }
  }, [isOpen]);

  // Collect all favorite items:
  // 1) From Inventory (isPermanent === true in fridge, grains, spices)
  // 2) From favoriteConfigs
  const allFavoriteNames = useMemo(() => {
    const names = new Set<string>();
    
    (fridge || []).forEach(item => {
      if (item.isPermanent && item.name.trim()) names.add(item.name.trim());
    });
    (grains || []).forEach(item => {
      if (item.isPermanent && item.name.trim()) names.add(item.name.trim());
    });
    (spices || []).forEach(item => {
      if (item.isPermanent && item.name.trim()) names.add(item.name.trim());
    });
    (favoriteConfigs || []).forEach(conf => {
      if (conf.name.trim()) names.add(conf.name.trim());
    });

    // Default favorites if totally empty
    if (names.size === 0) {
      names.add('Молоко');
      names.add('Яйца');
    }

    return Array.from(names);
  }, [fridge, grains, spices, favoriteConfigs]);

  // Calculate statistics for each favorite item
  const favoriteStats = useMemo(() => {
    return allFavoriteNames.map(name => {
      const config = (favoriteConfigs || []).find(c => cleanProductName(c.name) === cleanProductName(name));
      const stats = calculateItemStats(name, purchaseEvents || [], config?.customIntervalDays);
      
      const inShopping = (shoppingList || []).some(
        s => cleanProductName(s.name) === cleanProductName(name) && !s.checked
      );

      return {
        ...stats,
        inShoppingList: inShopping,
        config
      };
    }).sort((a, b) => {
      // Sort: due items first, then soon, then ok
      const order = { due: 0, soon: 1, ok: 2, unknown: 3 };
      return order[a.status] - order[b.status];
    });
  }, [allFavoriteNames, purchaseEvents, favoriteConfigs, shoppingList]);

  // Add new favorite product
  const handleAddFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFavName.trim();
    if (!trimmed) return;

    // Check if already in favoriteConfigs
    const exists = favoriteConfigs.some(c => cleanProductName(c.name) === cleanProductName(trimmed));
    if (!exists) {
      setFavoriteConfigs(prev => [
        ...(prev || []),
        { id: uuidv4(), name: trimmed, customIntervalDays: 4 }
      ]);
    }
    // Also record an added event if not exists
    recordPurchaseEvent(trimmed, 'added');
    setNewFavName('');
  };

  // Remove from favorites
  const handleRemoveFavorite = (itemName: string) => {
    const target = cleanProductName(itemName);
    // Remove from favoriteConfigs
    setFavoriteConfigs(prev => (prev || []).filter(c => cleanProductName(c.name) !== target));
    // Unmark permanent in fridge/grains/spices
    setFridge(prev => (prev || []).map(i => cleanProductName(i.name) === target ? { ...i, isPermanent: false } : i));
    setGrains(prev => (prev || []).map(i => cleanProductName(i.name) === target ? { ...i, isPermanent: false } : i));
    setSpices(prev => (prev || []).map(i => cleanProductName(i.name) === target ? { ...i, isPermanent: false } : i));
  };

  // Quick add to shopping list
  const handleQuickAddToShopping = (itemName: string) => {
    const newItem: ShoppingItem = {
      id: uuidv4(),
      name: itemName,
      quantity: '1 шт',
      checked: false,
      isManual: true
    };
    setShoppingList(prev => mergeShoppingItems(prev || [], [newItem]));
    recordPurchaseEvent(itemName, 'added');

    setJustAddedMap(prev => ({ ...prev, [itemName]: true }));
    setTimeout(() => {
      setJustAddedMap(prev => ({ ...prev, [itemName]: false }));
    }, 2000);
  };

  // Save custom interval
  const handleSaveInterval = (itemName: string) => {
    const days = parseInt(tempInterval, 10);
    if (!isNaN(days) && days > 0) {
      setFavoriteConfigs(prev => {
        const existing = (prev || []).find(c => cleanProductName(c.name) === cleanProductName(itemName));
        if (existing) {
          return prev.map(c => c.id === existing.id ? { ...c, customIntervalDays: days } : c);
        } else {
          return [...(prev || []), { id: uuidv4(), name: itemName, customIntervalDays: days }];
        }
      });
    }
    setEditingIntervalItem(null);
  };

  // Add new store
  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    const lat = currentCoords ? currentCoords.lat : 55.7558;
    const lng = currentCoords ? currentCoords.lng : 37.6173;

    const newStore: StoreLocation = {
      id: uuidv4(),
      name: newStoreName.trim(),
      latitude: lat,
      longitude: lng,
      radiusMeters: newStoreRadius,
      address: newStoreAddress.trim() || (currentCoords ? 'По текущим координатам GPS' : 'Супермаркет')
    };

    setStores(prev => [...(prev || []), newStore]);
    setNewStoreName('');
    setNewStoreAddress('');
    setShowAddStore(false);
  };

  // Update store location to current GPS
  const handleSetStoreToCurrentLocation = (storeId: string) => {
    if (!currentCoords) {
      refreshLocation();
      return;
    }
    setStores(prev => (prev || []).map(s => 
      s.id === storeId 
        ? { ...s, latitude: currentCoords.lat, longitude: currentCoords.lng, address: 'Сохранено по текущему GPS' } 
        : s
    ));
  };

  // Delete store
  const handleDeleteStore = (storeId: string) => {
    setStores(prev => (prev || []).filter(s => s.id !== storeId));
  };

  // Simulate entering a store
  const handleSimulateArrival = (store: StoreLocation) => {
    // Collect needed items (status 'due' or 'soon' or already in shopping list)
    const needed = favoriteStats
      .filter(f => f.status === 'due' || f.status === 'soon' || f.inShoppingList)
      .map(f => f.itemName);

    const itemsToNotify = needed.length > 0 ? needed : favoriteStats.slice(0, 3).map(f => f.itemName);

    setActiveGeoAlert({
      store,
      neededItems: itemsToNotify,
      distanceMeters: Math.floor(Math.random() * 40 + 20) // e.g. 35m
    });

    // Also trigger browser notification if allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`📍 Вы рядом с ${store.name}!`, {
          body: `Пора купить избранные продукты: ${itemsToNotify.join(', ')}`,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.error(e);
      }
    }

    onClose();
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('Culinara AI', {
          body: 'Гео-напоминания о покупках успешно активированы!'
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Star size={20} className="fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Избранное и гео-напоминания
              </h2>
              <p className="text-xs text-stone-500">
                Анализ интервалов покупок и напоминания у магазинов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-stone-200 bg-white p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
              activeTab === 'favorites'
                ? "bg-stone-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
            )}
          >
            <Star size={16} className={activeTab === 'favorites' ? "fill-amber-400 text-amber-400" : ""} />
            Избранные продукты ({favoriteStats.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('geo')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
              activeTab === 'geo'
                ? "bg-stone-900 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
            )}
          >
            <MapPin size={16} className={activeTab === 'geo' ? "text-emerald-400" : ""} />
            Гео-напоминания ({stores.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {activeTab === 'favorites' && (
            <div className="space-y-4">
              {/* Add to favorites form */}
              <form onSubmit={handleAddFavorite} className="flex gap-2">
                <input
                  type="text"
                  value={newFavName}
                  onChange={(e) => setNewFavName(e.target.value)}
                  placeholder="Добавить продукт в избранное..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!newFavName.trim()}
                  className="px-4 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={16} />
                  Добавить
                </button>
              </form>

              {/* Informative banner */}
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Как считается интервал: </span>
                  приложение фиксирует, как часто вы добавляете продукт в список покупок и отмечаете «куплено». Система вычисляет средний цикл и подскажет, когда пора пополнить запасы!
                </div>
              </div>

              {/* Favorite products list */}
              <div className="space-y-3">
                {favoriteStats.map((item) => {
                  const isExpanded = expandedHistory === item.itemName;
                  const isEditing = editingIntervalItem === item.itemName;
                  const isJustAdded = !!justAddedMap[item.itemName];

                  return (
                    <div
                      key={item.itemName}
                      className="border border-stone-200/90 bg-stone-50/40 rounded-2xl p-3.5 hover:border-stone-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Star size={17} className="fill-amber-400 text-amber-500 shrink-0" />
                            <span className="font-bold text-stone-900 text-base truncate">
                              {item.itemName}
                            </span>

                            {/* Status badge */}
                            {item.status === 'due' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                                Пора купить!
                              </span>
                            )}
                            {item.status === 'soon' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                Скоро купить
                              </span>
                            )}
                            {item.status === 'ok' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                В запасе
                              </span>
                            )}
                          </div>

                          {/* Stats description */}
                          <div className="mt-2 text-xs text-stone-600 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1 font-medium text-stone-800">
                                <Clock size={13} className="text-stone-400" />
                                Интервал: ~{item.averageIntervalDays} дн.
                              </span>
                              <span>•</span>
                              <span>Добавлено: {item.addCount} раз</span>
                              <span>•</span>
                              <span>Куплено: {item.boughtCount} раз</span>
                            </div>

                            {item.daysSinceLastBought !== null ? (
                              <div className="text-[11px] text-stone-500">
                                Последняя покупка: {item.daysSinceLastBought === 0 ? 'сегодня' : `${item.daysSinceLastBought} дн. назад`}
                                {item.daysUntilNextRecommended !== null && item.daysUntilNextRecommended > 0 && (
                                  <span className="text-stone-700 font-medium"> (до пополнения ~{item.daysUntilNextRecommended} дн.)</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-stone-400">
                                Еще не отмечалось как купленное (базовый цикл: {item.averageIntervalDays} дн.)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickAddToShopping(item.itemName)}
                            disabled={isJustAdded}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs",
                              item.inShoppingList
                                ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            )}
                            title="Добавить в список покупок"
                          >
                            {isJustAdded ? (
                              <>
                                <Check size={14} className="text-emerald-300" />
                                Добавлено
                              </>
                            ) : item.inShoppingList ? (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                В списке
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                В покупки
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveFavorite(item.itemName)}
                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Убрать из избранного"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Interval modifier drawer */}
                      {isEditing ? (
                        <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-center gap-2">
                          <span className="text-xs text-stone-600">Желаемый цикл (дней):</span>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={tempInterval}
                            onChange={(e) => setTempInterval(e.target.value)}
                            className="w-16 px-2 py-1 border border-stone-300 rounded-lg text-xs text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInterval(item.itemName)}
                            className="px-2.5 py-1 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800"
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIntervalItem(null)}
                            className="px-2 py-1 text-stone-500 text-xs hover:text-stone-800"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : null}

                      {/* Expandable History & Config controls */}
                      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIntervalItem(item.itemName);
                            setTempInterval(String(item.averageIntervalDays));
                          }}
                          className="hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders size={12} />
                          Настроить интервал вручную
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedHistory(isExpanded ? null : item.itemName)}
                          className="hover:text-stone-900 flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <History size={12} />
                          {isExpanded ? 'Скрыть историю' : `История событий (${item.history.length})`}
                        </button>
                      </div>

                      {/* Expanded history list */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 pt-2 border-t border-stone-200/60 space-y-1 text-[11px]"
                          >
                            {item.history.length === 0 ? (
                              <div className="text-stone-400 italic">Событий пока нет</div>
                            ) : (
                              item.history.slice().reverse().map((ev) => (
                                <div key={ev.id} className="flex items-center justify-between py-1 text-stone-600">
                                  <span className="flex items-center gap-1.5">
                                    {ev.type === 'bought' ? (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    )}
                                    {ev.type === 'bought' ? 'Куплено и отмечено' : 'Добавлено в список'}
                                  </span>
                                  <span className="text-stone-400">
                                    {new Date(ev.timestamp).toLocaleDateString('ru-RU', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'geo' && (
            <div className="space-y-4">
              {/* Geolocation master switch card */}
              <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Radio size={16} className={geoReminderEnabled ? "text-emerald-400 animate-pulse" : "text-stone-500"} />
                    Гео-отслеживание приближения
                  </div>
                  <p className="text-xs text-stone-400">
                    Напоминать об избранных покупках при приближении к магазину
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGeoReminderEnabled(!geoReminderEnabled)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                    geoReminderEnabled ? "bg-emerald-500" : "bg-stone-700"
                  )}
                >
                  <span
                    className={cn(
                      "block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md",
                      geoReminderEnabled ? "translate-x-6" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Current GPS Status Card */}
              <div className="border border-stone-200 bg-stone-50/70 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Compass size={15} className="text-emerald-600" />
                    Текущая геопозиция
                  </span>
                  <button
                    type="button"
                    onClick={refreshLocation}
                    disabled={gpsLoading}
                    className="text-stone-600 hover:text-stone-900 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                  >
                    <RefreshCw size={12} className={gpsLoading ? "animate-spin" : ""} />
                    {gpsLoading ? "Определение..." : "Обновить GPS"}
                  </button>
                </div>

                {currentCoords ? (
                  <div className="text-xs text-stone-600 bg-white border border-stone-200/80 rounded-xl p-2.5 flex items-center justify-between">
                    <div>
                      <div>Широта: <span className="font-mono text-stone-900">{currentCoords.lat.toFixed(5)}</span></div>
                      <div>Долгота: <span className="font-mono text-stone-900">{currentCoords.lng.toFixed(5)}</span></div>
                    </div>
                    {currentCoords.accuracy && (
                      <span className="text-[10px] px-2 py-1 rounded-md bg-stone-100 text-stone-600">
                        ±{Math.round(currentCoords.accuracy)} м
                      </span>
                    )}
                  </div>
                ) : gpsError ? (
                  <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    {gpsError}
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 italic">
                    Нажмите «Обновить GPS», чтобы привязать ваш магазин
                  </div>
                )}

                {/* Browser push notification permission button */}
                {'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 text-xs font-semibold rounded-xl border border-amber-300/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bell size={14} className="text-amber-600" />
                    Разрешить системные уведомления в браузере
                  </button>
                )}
              </div>

              {/* Stores Header & Add Button */}
              <div className="flex items-center justify-between pt-1">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <Store size={16} className="text-stone-700" />
                  Мои магазины ({stores.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddStore(!showAddStore)}
                  className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={14} />
                  Добавить магазин
                </button>
              </div>

              {/* Add Store Form */}
              <AnimatePresence>
                {showAddStore && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSaveStore}
                    className="border border-stone-200 bg-stone-50 rounded-2xl p-3.5 space-y-3"
                  >
                    <div className="font-semibold text-xs text-stone-800">Новый магазин для напоминаний</div>
                    <div>
                      <label className="text-[11px] text-stone-600 block mb-1">Название магазина</label>
                      <input
                        type="text"
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        placeholder="Например: ВкусВилл, Пятерочка, Магнит..."
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-800 focus:outline-none focus:border-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-600 block mb-1">Адрес или заметка (необязательно)</label>
                      <input
                        type="text"
                        value={newStoreAddress}
                        onChange={(e) => setNewStoreAddress(e.target.value)}
                        placeholder="ул. Ленина, 12 или 'Супермаркет у дома'"
                        className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-800 focus:outline-none focus:border-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-600 block mb-1">Радиус срабатывания напоминания</label>
                      <div className="flex gap-2">
                        {[100, 200, 300, 500].map((radius) => (
                          <button
                            key={radius}
                            type="button"
                            onClick={() => setNewStoreRadius(radius)}
                            className={cn(
                              "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                              newStoreRadius === radius
                                ? "bg-stone-900 text-white border-stone-900"
                                : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                            )}
                          >
                            {radius} м
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddStore(false)}
                        className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={!newStoreName.trim()}
                        className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        Сохранить магазин
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Stores list */}
              <div className="space-y-3">
                {stores.map((store) => {
                  const distance = currentCoords
                    ? calculateDistanceMeters(currentCoords.lat, currentCoords.lng, store.latitude, store.longitude)
                    : null;
                  const isNearby = distance !== null && distance <= store.radiusMeters;

                  return (
                    <div
                      key={store.id}
                      className={cn(
                        "border rounded-2xl p-3.5 transition-all space-y-2.5",
                        isNearby
                          ? "border-emerald-300 bg-emerald-50/40 shadow-xs"
                          : "border-stone-200 bg-stone-50/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 text-sm">{store.name}</span>
                            {isNearby && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-pulse">
                                Вы рядом ({distance} м)!
                              </span>
                            )}
                          </div>
                          {store.address && (
                            <p className="text-xs text-stone-500 mt-0.5">{store.address}</p>
                          )}
                          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-2">
                            <span>Радиус: {store.radiusMeters} м</span>
                            {distance !== null && !isNearby && (
                              <span>• Расстояние: {distance > 1000 ? `${(distance / 1000).toFixed(1)} км` : `${distance} м`}</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStore(store.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Удалить магазин"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Store action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
                        {currentCoords && (
                          <button
                            type="button"
                            onClick={() => handleSetStoreToCurrentLocation(store.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-[11px] font-medium hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin size={12} className="text-emerald-600" />
                            Привязать к текущему GPS
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSimulateArrival(store)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer shadow-xs ml-auto"
                        >
                          <Navigation size={12} />
                          🧪 Протестировать напоминание
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between text-xs text-stone-500">
          <span>Данные синхронизируются автоматически</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </motion.div>
    </div>
  );
}
