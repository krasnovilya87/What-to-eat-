import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  TrendingUp, 
  Calendar, 
  Tag, 
  Clock, 
  HelpCircle,
  BarChart2,
  LineChart as LineChartIcon,
  ChevronDown,
  Edit3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { ReceiptPurchase, ProductPurchaseEvent, InventoryItem, ShoppingItem } from '../types';
import { cleanProductName } from '../utils/geoFavorites';

export type ChartTimeInterval = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ChartMetricView = 'frequency' | 'price' | 'interval';

interface KnownProductItem {
  name: string;
  lastPrice?: number;
  count: number;
}

export interface ChartProduct {
  id: string;
  name: string;
  color: string;
  price?: number; // указанная цена продукта
}

interface PurchaseChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: ReceiptPurchase[];
  purchaseEvents?: ProductPurchaseEvent[];
  fridge?: InventoryItem[];
  grains?: InventoryItem[];
  spices?: InventoryItem[];
  shoppingList?: ShoppingItem[];
}

const PALETTE = [
  '#059669', // изумрудный
  '#D97706', // янтарь
  '#2563EB', // сапфир
  '#DC2626', // терракотовый
  '#7C3AED', // фиолетовый
  '#0D9488', // морской / циан
  '#EA580C', // охра-оранжевый
  '#4F46E5', // индиго
];

export default function PurchaseChartModal({
  isOpen,
  onClose,
  purchases = [],
  purchaseEvents = [],
  fridge = [],
  grains = [],
  spices = [],
  shoppingList = []
}: PurchaseChartModalProps) {
  // Выбранный интервал времени
  const [interval, setInterval] = useState<ChartTimeInterval>('week');
  // Режим метрики: частота покупок / динамика цен / интервалы в днях
  const [metricView, setMetricView] = useState<ChartMetricView>('frequency');
  
  // Состояние модального окна выбора продуктов за год
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Редактирование цены продукта прямо в карточке/чипе
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  // Список выбранных продуктов для отображения на графике
  const [selectedProducts, setSelectedProducts] = useState<ChartProduct[]>(() => {
    try {
      const saved = localStorage.getItem('purchase_chart_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    // По умолчанию предзаполняем популярные товары из чеков, если есть
    return [
      { id: 'p-milk', name: 'Молоко 3.2%', color: PALETTE[0], price: 92 },
      { id: 'p-chicken', name: 'Филе куриной грудки', color: PALETTE[1], price: 420 },
      { id: 'p-eggs', name: 'Яйца С0', color: PALETTE[2], price: 129 },
    ];
  });

  // Сохраняем выбранные продукты в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('purchase_chart_products', JSON.stringify(selectedProducts));
    } catch (e) {
      console.error(e);
    }
  }, [selectedProducts]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProductPickerOpen) {
          setIsProductPickerOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProductPickerOpen, onClose]);

  // Перечень всех продуктов за последний год из чеков, истории событий и текущих запасов
  const yearProductsList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      lastPrice?: number;
      count: number;
      lastDate?: string;
    }>();

    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

    // 1. Из чеков за последний год
    (purchases || []).forEach(receipt => {
      const rTime = receipt.timestamp || (receipt.date ? new Date(receipt.date).getTime() : 0);
      if (rTime && rTime < oneYearAgo) return;

      (receipt.items || []).forEach(item => {
        const key = cleanProductName(item.name);
        if (!key) return;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          if (item.price && !existing.lastPrice) existing.lastPrice = item.price;
          if (receipt.date && !existing.lastDate) existing.lastDate = receipt.date;
        } else {
          map.set(key, {
            name: item.name.trim(),
            lastPrice: item.price || undefined,
            count: 1,
            lastDate: receipt.date || undefined
          });
        }
      });
    });

    // 2. Из событий покупок (ProductPurchaseEvent) за год
    (purchaseEvents || []).forEach(evt => {
      if (evt.timestamp && evt.timestamp < oneYearAgo) return;
      const key = cleanProductName(evt.itemName);
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        if (evt.type === 'bought') existing.count += 1;
      } else {
        map.set(key, {
          name: evt.itemName.trim(),
          count: evt.type === 'bought' ? 1 : 0
        });
      }
    });

    // 3. Из холодильника, круп, специй, списка покупок
    const addFromName = (name?: string) => {
      if (!name) return;
      const key = cleanProductName(name);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { name: name.trim(), count: 0 });
      }
    };

    (fridge || []).forEach(i => addFromName(i.name));
    (grains || []).forEach(i => addFromName(i.name));
    (spices || []).forEach(i => addFromName(i.name));
    (shoppingList || []).forEach(i => addFromName(i.name));

    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [purchases, purchaseEvents, fridge, grains, spices, shoppingList]);

  // Фильтрация продуктов в перечне по поисковой строке
  const filteredYearProducts = useMemo(() => {
    const query = cleanProductName(pickerSearchQuery);
    if (!query) return yearProductsList;
    return yearProductsList.filter(item => cleanProductName(item.name).includes(query));
  }, [yearProductsList, pickerSearchQuery]);

  // Добавление продукта на график
  const handleAddProduct = (nameToAdd: string, priceToAdd?: number) => {
    const rawName = nameToAdd.trim();
    if (!rawName) return;

    const clean = cleanProductName(rawName);
    const existing = selectedProducts.find(p => cleanProductName(p.name) === clean);
    if (existing) {
      if (priceToAdd !== undefined) {
        setSelectedProducts(prev => prev.map(p => p.id === existing.id ? { ...p, price: priceToAdd } : p));
      }
      return;
    }

    let resolvedPrice: number | undefined = priceToAdd;
    if (resolvedPrice === undefined) {
      const known = yearProductsList.find(p => cleanProductName(p.name) === clean);
      if (known && known.lastPrice) {
        resolvedPrice = known.lastPrice;
      }
    }

    const nextColor = PALETTE[selectedProducts.length % PALETTE.length];
    const newProduct: ChartProduct = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      color: nextColor,
      price: resolvedPrice
    };

    setSelectedProducts(prev => [...prev, newProduct]);
  };

  const handleToggleYearProduct = (rawName: string, price?: number) => {
    const clean = cleanProductName(rawName);
    const existing = selectedProducts.find(p => cleanProductName(p.name) === clean);
    if (existing) {
      handleRemoveProduct(existing.id);
    } else {
      handleAddProduct(rawName, price);
    }
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleSavePriceEdit = (id: string) => {
    const pNum = parseFloat(editPriceValue);
    if (!isNaN(pNum) && pNum >= 0) {
      setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, price: pNum } : p));
    }
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  // Построение временных бакетов для выбранного интервала (Дни, Недели, Месяцы, Кварталы, Год)
  const chartData = useMemo(() => {
    if (selectedProducts.length === 0) return [];

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    interface BucketItem {
      key: string;
      label: string;
      startDate: number;
      endDate: number;
      [key: string]: string | number;
    }

    const buckets: BucketItem[] = [];

    if (interval === 'day') {
      // 14 дней с шагом в 1 день
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * dayMs);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + dayMs - 1;
        const key = d.toISOString().split('T')[0];
        const weekday = d.toLocaleDateString('ru-RU', { weekday: 'short' });
        const dayNum = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
        const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dayNum}`;
        buckets.push({ key, label, startDate: start, endDate: end });
      }
    } else if (interval === 'week') {
      // 8 недель
      for (let w = 7; w >= 0; w--) {
        const startW = new Date(now.getTime() - (w + 1) * 7 * dayMs);
        const endW = new Date(now.getTime() - w * 7 * dayMs);
        const key = `w-${w}`;
        const label = `${startW.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
        buckets.push({ key, label, startDate: startW.getTime(), endDate: endW.getTime() });
      }
    } else if (interval === 'month') {
      // 6 месяцев
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
        const key = `m-${d.getFullYear()}-${d.getMonth()}`;
        const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        buckets.push({ key, label, startDate: d.getTime(), endDate: nextMonth.getTime() - 1 });
      }
    } else if (interval === 'quarter') {
      // 4 квартала
      const currentQuarter = Math.floor(now.getMonth() / 3);
      for (let q = 3; q >= 0; q--) {
        const qOffset = currentQuarter - q;
        const qYear = now.getFullYear() + Math.floor(qOffset / 4);
        const qIndex = ((qOffset % 4) + 4) % 4;
        const startQ = new Date(qYear, qIndex * 3, 1);
        const endQ = new Date(qYear, (qIndex + 1) * 3, 1);
        const key = `q-${qYear}-${qIndex}`;
        const label = `Q${qIndex + 1} ${String(qYear).slice(-2)}`;
        buckets.push({ key, label, startDate: startQ.getTime(), endDate: endQ.getTime() - 1 });
      }
    } else if (interval === 'year') {
      // 3 года
      for (let y = 2; y >= 0; y--) {
        const yr = now.getFullYear() - y;
        const startY = new Date(yr, 0, 1);
        const endY = new Date(yr + 1, 0, 1);
        const key = `y-${yr}`;
        const label = `${yr} г.`;
        buckets.push({ key, label, startDate: startY.getTime(), endDate: endY.getTime() - 1 });
      }
    }

    // Извлекаем все покупки для каждого выбранного продукта
    // Для каждого продукта: список { timestamp, price, quantity }
    const productPurchasesMap = new Map<string, Array<{ timestamp: number; price?: number; quantity: number }>>();

    selectedProducts.forEach(prod => {
      const cleanTarget = cleanProductName(prod.name);
      const eventsList: Array<{ timestamp: number; price?: number; quantity: number }> = [];

      // 1. Из чеков
      (purchases || []).forEach(p => {
        (p.items || []).forEach(it => {
          const itemClean = cleanProductName(it.name);
          if (itemClean.includes(cleanTarget) || cleanTarget.includes(itemClean)) {
            // Парсинг количества, если указано
            let qty = 1;
            if (it.quantity) {
              const numMatch = it.quantity.match(/([\d.,]+)/);
              if (numMatch) {
                const parsed = parseFloat(numMatch[1].replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) qty = parsed;
              }
            }
            eventsList.push({
              timestamp: p.timestamp,
              price: it.price || prod.price,
              quantity: qty
            });
          }
        });
      });

      // 2. Из событий списка покупок
      (purchaseEvents || []).forEach(ev => {
        if (ev.type === 'bought') {
          const evClean = cleanProductName(ev.itemName);
          if (evClean.includes(cleanTarget) || cleanTarget.includes(evClean)) {
            eventsList.push({
              timestamp: ev.timestamp,
              price: prod.price,
              quantity: 1
            });
          }
        }
      });

      // Сортируем по времени возрастания
      eventsList.sort((a, b) => a.timestamp - b.timestamp);
      productPurchasesMap.set(prod.id, eventsList);
    });

    // Заполняем бакеты значениями
    return buckets.map(bucket => {
      const row: BucketItem = { ...bucket };

      selectedProducts.forEach(prod => {
        const events = productPurchasesMap.get(prod.id) || [];
        const inBucket = events.filter(e => e.timestamp >= bucket.startDate && e.timestamp <= bucket.endDate);

        // Частота (кол-во покупок / штук)
        const count = inBucket.reduce((sum, e) => sum + e.quantity, 0);
        row[`${prod.id}_count`] = count;

        // Цена: если была покупка в бакете — берем среднюю/последнюю цену, иначе указанную цену продукта
        if (inBucket.length > 0) {
          const prices = inBucket.map(e => e.price).filter((p): p is number => p !== undefined && p > 0);
          if (prices.length > 0) {
            row[`${prod.id}_price`] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
          } else {
            row[`${prod.id}_price`] = prod.price || 0;
          }
        } else {
          // Если не было покупки в бакете, показываем указанную цену пользователя (для непрерывности сравнения)
          row[`${prod.id}_price`] = prod.price || 0;
        }

        // Интервал (дней): вычисляем средний интервал между покупками
        if (inBucket.length > 1) {
          const first = inBucket[0].timestamp;
          const last = inBucket[inBucket.length - 1].timestamp;
          const days = Math.max(1, Math.round((last - first) / (dayMs * (inBucket.length - 1))));
          row[`${prod.id}_interval`] = days;
        } else if (inBucket.length === 1) {
          // Ищем расстояние от предыдущей покупки до этой
          const idx = events.findIndex(e => e.timestamp === inBucket[0].timestamp);
          if (idx > 0) {
            const diffDays = Math.round((inBucket[0].timestamp - events[idx - 1].timestamp) / dayMs);
            row[`${prod.id}_interval`] = diffDays;
          } else {
            row[`${prod.id}_interval`] = 0;
          }
        } else {
          row[`${prod.id}_interval`] = 0;
        }
      });

      return row;
    });
  }, [selectedProducts, interval, purchases, purchaseEvents]);

  // Сводка по каждому выбранному продукту: средний интервал, последняя покупка, средняя цена, факт. цена
  const productStats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    return selectedProducts.map(prod => {
      const cleanTarget = cleanProductName(prod.name);
      const events: Array<{ timestamp: number; price?: number }> = [];

      (purchases || []).forEach(p => {
        (p.items || []).forEach(it => {
          const itemClean = cleanProductName(it.name);
          if (itemClean.includes(cleanTarget) || cleanTarget.includes(itemClean)) {
            events.push({ timestamp: p.timestamp, price: it.price });
          }
        });
      });

      (purchaseEvents || []).forEach(ev => {
        if (ev.type === 'bought') {
          const evClean = cleanProductName(ev.itemName);
          if (evClean.includes(cleanTarget) || cleanTarget.includes(evClean)) {
            events.push({ timestamp: ev.timestamp, price: prod.price });
          }
        }
      });

      events.sort((a, b) => a.timestamp - b.timestamp);

      const totalCount = events.length;
      let avgIntervalDays: number | null = null;
      if (events.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < events.length; i++) {
          const diff = (events[i].timestamp - events[i - 1].timestamp) / dayMs;
          if (diff > 0) intervals.push(diff);
        }
        if (intervals.length > 0) {
          avgIntervalDays = Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10;
        }
      }

      const lastBought = events.length > 0 ? events[events.length - 1] : null;
      const daysSinceLast = lastBought ? Math.max(0, Math.floor((now - lastBought.timestamp) / dayMs)) : null;

      // Средняя фактическая цена
      const prices = events.map(e => e.price).filter((p): p is number => p !== undefined && p > 0);
      const avgActualPrice = prices.length > 0 
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) 
        : null;

      // Прогноз следующей покупки
      let nextExpectedDays: number | null = null;
      if (avgIntervalDays !== null && daysSinceLast !== null) {
        nextExpectedDays = Math.round(avgIntervalDays - daysSinceLast);
      }

      return {
        product: prod,
        totalCount,
        avgIntervalDays,
        daysSinceLast,
        lastBoughtDate: lastBought ? new Date(lastBought.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null,
        avgActualPrice,
        nextExpectedDays
      };
    });
  }, [selectedProducts, purchases, purchaseEvents]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh] my-auto"
      >
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-900">
              <TrendingUp size={20} className="text-amber-800" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                График покупок
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Контент */}
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* 1. Блок выбранных продуктов для графика */}
          <div className="bg-stone-50 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-stone-600">
              Выбрано для графика ({selectedProducts.length}):
            </div>

            {selectedProducts.length === 0 ? (
              <div className="text-xs text-stone-400 italic py-1">
                Нет выбранных продуктов. Нажмите «Добавить», чтобы выбрать из истории покупок.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-xs text-xs"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: prod.color }}
                    />
                    <span className="font-medium text-stone-900 max-w-[140px] sm:max-w-[200px] truncate">
                      {prod.name}
                    </span>

                    {/* Инлайн редактирование цены продукта */}
                    {editingPriceId === prod.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePriceEdit(prod.id);
                            if (e.key === 'Escape') setEditingPriceId(null);
                          }}
                          autoFocus
                          className="w-16 px-1.5 py-0.5 text-xs bg-stone-100 rounded focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePriceEdit(prod.id)}
                          className="text-emerald-700 hover:text-emerald-800 p-0.5 cursor-pointer"
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceId(prod.id);
                          setEditPriceValue(prod.price ? String(prod.price) : '');
                        }}
                        className="text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                        title="Нажмите, чтобы изменить указанную цену"
                      >
                        <span>{prod.price ? `${prod.price} ₽` : 'Указать цену'}</span>
                        <Edit3 size={10} className="text-stone-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(prod.id)}
                      className="text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer transition-colors"
                      title="Удалить из графика"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопка Добавить размещена под выбрано для графика */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsProductPickerOpen(true);
                  setPickerSearchQuery('');
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm active:scale-95"
              >
                <Plus size={16} />
                <span>Добавить</span>
              </button>
            </div>
          </div>

          {/* 2. Панель управления графиком (Интервалы и Режимы отображения) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
            {/* Переключение интервала времени: Дни, Недели, Месяцы, Кварталы, Год */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'day', label: 'Дни' },
                  { id: 'week', label: 'Недели' },
                  { id: 'month', label: 'Месяцы' },
                  { id: 'quarter', label: 'Кварталы' },
                  { id: 'year', label: 'Год' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setInterval(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none text-center ${
                    interval === item.id
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Режим метрики: Частота покупок / Динамика цен / Интервалы */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setMetricView('frequency')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none text-center ${
                  metricView === 'frequency'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Частота (шт/раз)
              </button>
              <button
                type="button"
                onClick={() => setMetricView('price')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none text-center ${
                  metricView === 'price'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Динамика цен (₽)
              </button>
              <button
                type="button"
                onClick={() => setMetricView('interval')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none text-center ${
                  metricView === 'interval'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Интервалы (дни)
              </button>
            </div>
          </div>

          {/* 3. Сам интерактивный график Recharts */}
          <div className="bg-stone-50/50 rounded-2xl p-4">
            {selectedProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-400">
                <LineChartIcon size={36} className="mb-2 stroke-1 text-stone-300" />
                <p className="text-sm font-medium text-stone-600">График пуст</p>
                <p className="text-xs text-stone-400 mt-1">
                  Нажмите «Добавить» выше, чтобы выбрать продукты из истории покупок
                </p>
              </div>
            ) : (
              <div className="w-full h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#78716c"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e7e5e4' }}
                    />
                    <YAxis
                      stroke="#78716c"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e7e5e4' }}
                      unit={metricView === 'price' ? ' ₽' : metricView === 'interval' ? ' д' : ''}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        return (
                          <div className="bg-stone-900 text-white text-xs rounded-xl p-3 shadow-xl space-y-1.5 min-w-[170px]">
                            <div className="font-bold text-stone-300 pb-1">
                              {label}
                            </div>
                            {payload.map((item, idx) => {
                              const prod = selectedProducts.find(p => item.dataKey?.toString().startsWith(p.id));
                              const name = prod ? prod.name : item.name;
                              const val = item.value;
                              let valStr = `${val}`;
                              if (metricView === 'price') valStr = `${val} ₽`;
                              else if (metricView === 'interval') valStr = `${val} дн.`;
                              else valStr = `${val} шт.`;

                              return (
                                <div key={idx} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 truncate max-w-[130px]">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-stone-200 truncate">{name}</span>
                                  </span>
                                  <span className="font-bold text-white shrink-0">{valStr}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val, entry) => {
                        const prod = selectedProducts.find(p => p.id === val);
                        return <span className="text-xs font-semibold text-stone-700">{prod ? prod.name : val}</span>;
                      }}
                    />

                    {selectedProducts.map((prod) => {
                      const dataKey = 
                        metricView === 'frequency' 
                          ? `${prod.id}_count` 
                          : metricView === 'price' 
                            ? `${prod.id}_price` 
                            : `${prod.id}_interval`;

                      return (
                        <Line
                          key={prod.id}
                          id={prod.id}
                          name={prod.id}
                          type="monotone"
                          dataKey={dataKey}
                          stroke={prod.color}
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: prod.color, strokeWidth: 1.5, stroke: '#ffffff' }}
                          activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 4. Сводка и аналитика по интервалам и ценам продуктов */}
          {productStats.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Аналитика интервалов и цен
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productStats.map(({ product, totalCount, avgIntervalDays, daysSinceLast, lastBoughtDate, avgActualPrice, nextExpectedDays }) => (
                  <div
                    key={product.id}
                    className="p-3.5 bg-white rounded-2xl shadow-2xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: product.color }}
                        />
                        <span className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                          {product.name}
                        </span>
                      </div>

                      {product.price ? (
                        <span className="text-xs font-extrabold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md shrink-0">
                          {product.price} ₽
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">Цена не указана</span>
                      )}
                    </div>

                    {/* Метрики интервалов */}
                    <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Интервал</span>
                        <span className="font-bold text-stone-800">
                          {avgIntervalDays !== null ? `каждые ${avgIntervalDays} дн.` : '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[10px]">Покупок</span>
                        <span className="font-bold text-stone-800">
                          {totalCount} {totalCount === 1 ? 'раз' : 'раза'}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[10px]">Крайняя</span>
                        <span className="font-bold text-stone-800">
                          {lastBoughtDate ? `${lastBoughtDate}` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Дополнительная строка: факт. цена и прогноз */}
                    <div className="text-[11px] text-stone-500 bg-stone-50 p-2 rounded-xl flex items-center justify-between">
                      <span>
                        Ср. цена в чеках: <strong className="text-stone-800">{avgActualPrice ? `${avgActualPrice} ₽` : '—'}</strong>
                      </span>
                      {nextExpectedDays !== null && (
                        <span className={nextExpectedDays <= 1 ? 'text-amber-800 font-bold' : 'text-stone-600'}>
                          {nextExpectedDays <= 0 ? 'Пора купить!' : `Купить через ~${nextExpectedDays} дн.`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </motion.div>

      {/* Модальное окно выбора продуктов за год */}
      <AnimatePresence>
        {isProductPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
            onClick={() => setIsProductPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col my-auto"
            >
              {/* Шапка перечня продуктов */}
              <div className="flex items-center justify-between px-5 py-4 bg-stone-50/80">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-stone-900">
                    Продукты за год
                  </h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-700">
                    {yearProductsList.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProductPickerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Поисковая строка в перечне продуктов */}
              <div className="p-4 bg-white">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pickerSearchQuery.trim()) {
                        e.preventDefault();
                        handleToggleYearProduct(pickerSearchQuery.trim());
                        setPickerSearchQuery('');
                      }
                    }}
                    autoFocus
                    placeholder="Поиск продуктов..."
                    className="w-full pl-9 pr-4 py-2.5 bg-stone-100 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                </div>
              </div>

              {/* Список продуктов */}
              <div className="overflow-y-auto no-scrollbar flex-1 px-4 pb-4 space-y-1.5">
                {/* Если пользователь ввел новый продукт, которого нет в перечне */}
                {pickerSearchQuery.trim() && !yearProductsList.some(p => cleanProductName(p.name) === cleanProductName(pickerSearchQuery)) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleYearProduct(pickerSearchQuery.trim());
                      setPickerSearchQuery('');
                    }}
                    className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 flex items-center justify-between transition-colors cursor-pointer text-left shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <Plus size={16} className="text-emerald-700" />
                      <span className="text-xs sm:text-sm font-semibold">
                        Добавить «{pickerSearchQuery.trim()}»
                      </span>
                    </div>
                  </button>
                )}

                {filteredYearProducts.length === 0 && !pickerSearchQuery.trim() ? (
                  <div className="text-center py-10 text-stone-400 text-xs">
                    История покупок за последний год пуста
                  </div>
                ) : filteredYearProducts.length === 0 ? (
                  <div className="text-center py-8 text-stone-400 text-xs">
                    Ничего не найдено
                  </div>
                ) : (
                  filteredYearProducts.map((item, idx) => {
                    const isSelected = selectedProducts.some(
                      (p) => cleanProductName(p.name) === cleanProductName(item.name)
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleYearProduct(item.name, item.lastPrice)}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-left shadow-2xs ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-950'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-stone-200/70 text-stone-400'
                            }`}
                          >
                            {isSelected ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold truncate">
                              {item.name}
                            </p>
                            {item.count > 1 && (
                              <p className="text-[11px] text-stone-400">
                                Куплено {item.count} раз
                              </p>
                            )}
                          </div>
                        </div>

                        {item.lastPrice !== undefined && item.lastPrice > 0 && (
                          <span className="text-xs font-bold text-stone-700 bg-white px-2 py-1 rounded-lg shadow-2xs shrink-0">
                            {item.lastPrice} ₽
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Нижняя панель с кнопкой Готово */}
              <div className="p-4 bg-stone-50 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500">
                  Выбрано для графика: {selectedProducts.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsProductPickerOpen(false)}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm active:scale-95"
                >
                  Готово
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
