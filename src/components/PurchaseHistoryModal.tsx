import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Calendar, 
  Store, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  PieChart as PieIcon, 
  Receipt as ReceiptIcon,
  Search,
  Flame,
  Utensils,
  Activity,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  ComposedChart,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { ReceiptPurchase, ReceiptItem } from '../types';
import { cn } from '../App';
import { getItemMacros } from '../utils/macroEstimator';
import { computePeriodAnalytics, AnalyticsPeriod, BucketData } from '../utils/periodAnalytics';

interface PurchaseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: ReceiptPurchase[];
  onDeletePurchase: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Овощи и фрукты': '#059669', // emerald
  'Мясо и птица': '#B45309', // warm amber-brown
  'Рыба и морепродукты': '#0284C7', // ocean blue
  'Молочные продукты': '#4F46E5', // indigo
  'Хлеб и выпечка': '#D97706', // golden amber
  'Бакалея': '#7C3AED', // violet
  'Сладости и снеки': '#BE185D', // muted berry
  'Напитки': '#0D9488', // teal
  'Соусы и приправы': '#C2410C', // terracotta
  'Другое': '#78716C' // warm stone
};

const DEFAULT_COLOR = '#78716C';

export default function PurchaseHistoryModal({
  isOpen,
  onClose,
  purchases,
  onDeletePurchase
}: PurchaseHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'timeline' | 'categories'>('list');
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptToDelete, setReceiptToDelete] = useState<ReceiptPurchase | null>(null);
  
  // Переключение периода для аналитики и графика расходов / КБЖУ
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('week');
  const [chartMetric, setChartMetric] = useState<'all' | 'calories' | 'macros' | 'expenses'>('all');

  // Sorted purchases by date descending
  const sortedPurchases = useMemo(() => {
    return [...(purchases || [])].sort((a, b) => b.timestamp - a.timestamp);
  }, [purchases]);

  // Overall statistics
  const totalSpent = useMemo(() => {
    return sortedPurchases.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  }, [sortedPurchases]);

  const averageReceipt = useMemo(() => {
    if (sortedPurchases.length === 0) return 0;
    return Math.round(totalSpent / sortedPurchases.length);
  }, [totalSpent, sortedPurchases]);

  // Аналитика по периодам (Неделя, Месяц, Квартал, Год) с КБЖУ и расходами
  const periodAnalytics = useMemo(() => {
    return computePeriodAnalytics(sortedPurchases, analyticsPeriod);
  }, [sortedPurchases, analyticsPeriod]);

  // Data for Category breakdown graph & prices
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number; items: { name: string; price: number }[] }>();

    sortedPurchases.forEach(p => {
      (p.items || []).forEach(item => {
        const cat = item.category || 'Другое';
        if (!map.has(cat)) {
          map.set(cat, { name: cat, value: 0, count: 0, items: [] });
        }
        const entry = map.get(cat)!;
        const price = Number(item.price) || 0;
        entry.value += price;
        entry.count += 1;
        entry.items.push({ name: item.name, price });
      });
    });

    return Array.from(map.values())
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sortedPurchases]);

  // Filtered purchases by search query
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return sortedPurchases;
    const q = searchQuery.toLowerCase();
    return sortedPurchases.filter(p => {
      if (p.storeName.toLowerCase().includes(q)) return true;
      if (p.date.includes(q)) return true;
      return (p.items || []).some(item => item.name.toLowerCase().includes(q));
    });
  }, [sortedPurchases, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedReceiptId(prev => prev === id ? null : id);
  };

  const confirmDeleteReceipt = () => {
    if (receiptToDelete) {
      onDeletePurchase(receiptToDelete.id);
      setReceiptToDelete(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-y-auto no-scrollbar max-h-[88vh] sm:max-h-[90vh] my-auto"
      >
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-200/80 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-900 text-[#FAF0B2] flex items-center justify-center font-bold text-base shadow-xs">
              <ReceiptIcon size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-950 leading-tight">
                История покупок
              </h3>
              
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="Закрыть окно"
          >
            <X size={19} />
          </button>
        </div>

        {/* Сводные карточки метрик */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-stone-100/60 border-b border-stone-200/80">
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Всего расходов
            </span>
            <span className="text-base sm:text-lg font-extrabold text-stone-950 leading-tight tracking-tight mt-0.5 block">
              {totalSpent.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Чеков в базе
            </span>
            <span className="text-base sm:text-lg font-extrabold text-stone-950 leading-tight tracking-tight mt-0.5 block">
              {sortedPurchases.length} шт.
            </span>
          </div>

          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
              Средний чек
            </span>
            <span className="text-base sm:text-lg font-extrabold text-stone-950 leading-tight tracking-tight mt-0.5 block">
              {averageReceipt.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Переключатель вкладок */}
        <div className="flex border-b border-stone-200/80 bg-white px-3.5 sm:px-4 py-2 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'list'
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-950 hover:bg-stone-100"
            )}
          >
            <ReceiptIcon size={14} />
            <span>Чеки и товары</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'timeline'
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-950 hover:bg-stone-100"
            )}
          >
            <TrendingUp size={14} />
            <span>Расходы и КБЖУ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'categories'
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-950 hover:bg-stone-100"
            )}
          >
            <PieIcon size={14} />
            <span>По категориям</span>
          </button>
        </div>

        {/* Основной контент вкладок */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* ВКЛАДКА 1: ЧЕКИ И ТОВАРЫ */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* Поиск по чекам и товарам */}
              {sortedPurchases.length > 0 && (
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по магазину, товару или дате..."
                    className="w-full bg-stone-100/80 border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white focus:border-stone-400 transition-all shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {filteredPurchases.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  {searchQuery ? 'Ничего не найдено по запросу' : 'История покупок пуста. Добавьте первый чек с помощью кнопки «Добавить чек».'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredPurchases.map((purchase) => {
                    const isExpanded = expandedReceiptId === purchase.id;
                    const formattedDate = new Date(purchase.date || purchase.timestamp).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });

                    // Расчет суммарных калорий чека
                    const receiptCalories = (purchase.items || []).reduce(
                      (sum, it) => sum + getItemMacros(it).calories, 0
                    );

                    return (
                      <div
                        key={purchase.id}
                        className="border border-stone-200/80 rounded-2xl bg-white overflow-hidden shadow-2xs transition-all hover:border-stone-300"
                      >
                        {/* Заголовок чека */}
                        <div
                          onClick={() => toggleExpand(purchase.id)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-stone-50/70 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200/70 text-stone-800 flex items-center justify-center shrink-0">
                              <Store size={17} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-stone-900 truncate">
                                  {purchase.storeName}
                                </span>
                                <span className="text-[11px] text-stone-400 shrink-0">
                                  • {formattedDate}
                                </span>
                              </div>
                              <span className="text-xs text-stone-500 font-medium">
                                {(purchase.items || []).length} позиций
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <div className="text-sm sm:text-base font-extrabold text-stone-950 leading-tight">
                                {purchase.totalAmount.toLocaleString('ru-RU')} ₽
                              </div>
                              {receiptCalories > 0 && (
                                <div className="text-[10px] text-amber-800 font-semibold flex items-center justify-end gap-1 mt-0.5 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                                  <Flame size={10} className="text-amber-600" />
                                  <span>{receiptCalories.toLocaleString('ru-RU')} ккал</span>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToDelete(purchase);
                              }}
                              className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                              title="Удалить чек"
                            >
                              <Trash2 size={15} />
                            </button>

                            <div className="text-stone-400">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Раскрывающийся список купленных товаров */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-stone-100 bg-stone-50/50 divide-y divide-stone-100"
                            >
                              {(purchase.items || []).map((item) => {
                                const macros = getItemMacros(item);
                                return (
                                  <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                      {/* Цветная точка категории */}
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0 mt-1"
                                        style={{ backgroundColor: CATEGORY_COLORS[item.category || 'Другое'] || DEFAULT_COLOR }}
                                        title={item.category || 'Другое'}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-stone-900 truncate">
                                            {item.name}
                                          </span>
                                          {item.quantity && (
                                            <span className="text-stone-400 text-[11px] shrink-0 font-medium">
                                              ({item.quantity})
                                            </span>
                                          )}
                                        </div>
                                        {/* КБЖУ мелким шрифтом */}
                                        <div className="text-[10px] text-stone-500 flex items-center gap-1.5 tracking-tight mt-0.5 flex-wrap">
                                          <span className="text-stone-800 font-semibold">{macros.calories} к</span>
                                          <span className="text-stone-300">•</span>
                                          <span>{macros.protein}</span>
                                          <span className="text-stone-300">•</span>
                                          <span>{macros.fat}</span>
                                          <span className="text-stone-300">•</span>
                                          <span>{macros.carbs}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-bold text-stone-900 min-w-14 text-right">
                                        {Number(item.price).toLocaleString('ru-RU')} ₽
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: ГРАФИК РАСХОДОВ И КБЖУ С ПЕРЕКЛЮЧЕНИЕМ ПЕРИОДОВ */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* Шапка вкладки с переключателем периода (неделя, месяц, квартал, год) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    Расходы и КБЖУ
                  </h4>
                  <p className="text-xs text-stone-500">
                    Динамика трат и пищевая ценность купленных продуктов
                  </p>
                </div>

                {/* Переключатель периода: Неделя, Месяц, Квартал, Год */}
                <div className="inline-flex bg-stone-100 p-1 rounded-xl border border-stone-200/80 text-xs font-semibold shrink-0">
                  {([
                    { id: 'week', label: 'Неделя' },
                    { id: 'month', label: 'Месяц' },
                    { id: 'quarter', label: 'Квартал' },
                    { id: 'year', label: 'Год' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAnalyticsPeriod(id)}
                      className={cn(
                        "px-3 py-1 rounded-lg transition-all cursor-pointer select-none",
                        analyticsPeriod === id
                          ? "bg-white text-stone-950 shadow-xs font-bold"
                          : "text-stone-600 hover:text-stone-950"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Переключатель метрики графика */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setChartMetric('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5",
                    chartMetric === 'all'
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <Activity size={13} />
                  <span>Все метрики</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('calories')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5",
                    chartMetric === 'calories'
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <Flame size={13} className="text-amber-500" />
                  <span>Калории</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('macros')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5",
                    chartMetric === 'macros'
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <Utensils size={13} className="text-blue-500" />
                  <span>Линии БЖУ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('expenses')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5",
                    chartMetric === 'expenses'
                      ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <ReceiptIcon size={13} />
                  <span>Только расходы</span>
                </button>
              </div>

              {/* Сводные показатели за выбранный период */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-stone-500">
                    Расходы
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-stone-950 leading-tight block mt-0.5">
                    {periodAnalytics.summary.totalAmount.toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="block text-[10px] text-stone-400 mt-0.5">
                    ~{periodAnalytics.summary.avgDailySpent.toLocaleString('ru-RU')} ₽/день
                  </span>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-stone-500">
                    Калории
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-stone-950 leading-tight block mt-0.5">
                    {periodAnalytics.summary.totalCalories.toLocaleString('ru-RU')} ккал
                  </span>
                  <span className="block text-[10px] text-stone-400 mt-0.5">
                    ~{periodAnalytics.summary.avgDailyCalories.toLocaleString('ru-RU')} ккал/день
                  </span>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs col-span-2">
                  <span className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                    Баланс БЖУ
                  </span>
                  <div className="flex items-center gap-3 text-xs font-bold mt-1">
                    <span className="text-stone-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      Б: {periodAnalytics.summary.totalProtein.toLocaleString('ru-RU')}г
                    </span>
                    <span className="text-stone-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      Ж: {periodAnalytics.summary.totalFat.toLocaleString('ru-RU')}г
                    </span>
                    <span className="text-stone-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      У: {periodAnalytics.summary.totalCarbs.toLocaleString('ru-RU')}г
                    </span>
                  </div>
                </div>
              </div>

              {/* График за выбранный период */}
              {periodAnalytics.buckets.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  Нет данных о покупках за выбранный период.
                </div>
              ) : (
                <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartMetric === 'all' ? (
                        <ComposedChart data={periodAnalytics.buckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fontSize: 10, fill: '#1C1917' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                            tickFormatter={(val) => `${val}₽`}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 10, fill: '#D97706' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                            tickFormatter={(val) => `${val}`}
                          />
                          <YAxis 
                            yAxisId="macros"
                            hide
                            domain={[0, 'auto']}
                          />
                          <Tooltip
                            cursor={{ fill: '#F5F5F4' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as BucketData;
                                return (
                                  <div className="bg-stone-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1.5 min-w-44 border border-stone-800">
                                    <div className="font-bold text-stone-200 border-b border-stone-800 pb-1 flex justify-between items-center">
                                      <span>{data.label}</span>
                                      {data.receiptsCount > 0 && (
                                        <span className="text-[10px] text-stone-400 font-normal">
                                          {data.receiptsCount} {data.receiptsCount === 1 ? 'чек' : 'чека'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex justify-between gap-3 items-center">
                                      <span className="text-stone-300 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-xs bg-stone-300 inline-block" />
                                        Расходы:
                                      </span>
                                      <span className="font-bold text-white">{data.amount.toLocaleString('ru-RU')} ₽</span>
                                    </div>
                                    <div className="flex justify-between gap-3 items-center">
                                      <span className="text-amber-400 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                        Калории:
                                      </span>
                                      <span className="font-bold text-amber-300">{data.calories.toLocaleString('ru-RU')} ккал</span>
                                    </div>
                                    <div className="text-[11px] pt-1.5 border-t border-stone-800 space-y-1">
                                      <div className="flex justify-between gap-2 items-center">
                                        <span className="text-blue-400 flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                          Белки:
                                        </span>
                                        <span className="font-semibold text-blue-200">{data.protein} г</span>
                                      </div>
                                      <div className="flex justify-between gap-2 items-center">
                                        <span className="text-amber-400 flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                          Жиры:
                                        </span>
                                        <span className="font-semibold text-amber-200">{data.fat} г</span>
                                      </div>
                                      <div className="flex justify-between gap-2 items-center">
                                        <span className="text-emerald-400 flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                          Углеводы:
                                        </span>
                                        <span className="font-semibold text-emerald-200">{data.carbs} г</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right" 
                            wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                          />
                          {/* Столбик расходов */}
                          <Bar 
                            yAxisId="left"
                            dataKey="amount" 
                            name="Расходы (₽)" 
                            fill="#1C1917" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={28}
                          />
                          {/* 4 линии: Калории, Белки, Жиры, Углеводы */}
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="calories" 
                            name="Калории (ккал)" 
                            stroke="#D97706" 
                            strokeWidth={2.5} 
                            dot={{ r: 3.5, fill: '#D97706' }} 
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            yAxisId="macros"
                            type="monotone" 
                            dataKey="protein" 
                            name="Белки (г)" 
                            stroke="#3B82F6" 
                            strokeWidth={2} 
                            dot={{ r: 3, fill: '#3B82F6' }} 
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            yAxisId="macros"
                            type="monotone" 
                            dataKey="fat" 
                            name="Жиры (г)" 
                            stroke="#F59E0B" 
                            strokeWidth={2} 
                            dot={{ r: 3, fill: '#F59E0B' }} 
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            yAxisId="macros"
                            type="monotone" 
                            dataKey="carbs" 
                            name="Углеводы (г)" 
                            stroke="#10B981" 
                            strokeWidth={2} 
                            dot={{ r: 3, fill: '#10B981' }} 
                            activeDot={{ r: 5 }}
                          />
                        </ComposedChart>
                      ) : chartMetric === 'calories' ? (
                        <BarChart data={periodAnalytics.buckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#D97706' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                            tickFormatter={(val) => `${val}`}
                          />
                          <Tooltip
                            cursor={{ fill: '#F5F5F4' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as BucketData;
                                return (
                                  <div className="bg-stone-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                                    <div className="font-bold text-stone-200">{data.label}</div>
                                    <div className="text-amber-300 font-bold text-sm">
                                      {data.calories.toLocaleString('ru-RU')} ккал
                                    </div>
                                    <div className="text-[10px] text-stone-300 flex gap-2 font-mono">
                                      <span>Б: {data.protein}г</span>
                                      <span>Ж: {data.fat}г</span>
                                      <span>У: {data.carbs}г</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="calories" 
                            name="Калории (ккал)" 
                            fill="#D97706" 
                            radius={[5, 5, 0, 0]} 
                            maxBarSize={34}
                          />
                        </BarChart>
                      ) : chartMetric === 'macros' ? (
                        <LineChart data={periodAnalytics.buckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                            tickFormatter={(val) => `${val}г`}
                          />
                          <Tooltip
                            cursor={{ fill: '#F5F5F4' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as BucketData;
                                return (
                                  <div className="bg-stone-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                                    <div className="font-bold text-stone-200 font-sans">{data.label}</div>
                                    <div className="text-blue-300">Белки: {data.protein}г</div>
                                    <div className="text-amber-300">Жиры: {data.fat}г</div>
                                    <div className="text-emerald-300">Углеводы: {data.carbs}г</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            align="right" 
                            wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                          />
                          <Line type="monotone" dataKey="protein" name="Белки (г)" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="fat" name="Жиры (г)" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3.5, fill: '#F59E0B' }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="carbs" name="Углеводы (г)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10B981' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      ) : (
                        <BarChart data={periodAnalytics.buckets} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#78716C' }} 
                            tickLine={false}
                            axisLine={{ stroke: '#E7E5E4' }}
                            tickFormatter={(val) => `${val}₽`}
                          />
                          <Tooltip
                            cursor={{ fill: '#F5F5F4' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as BucketData;
                                return (
                                  <div className="bg-stone-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                                    <div className="font-bold text-stone-200">{data.label}</div>
                                    <div className="text-amber-300 font-bold text-sm">
                                      {data.amount.toLocaleString('ru-RU')} ₽
                                    </div>
                                    {data.receiptsCount > 0 && (
                                      <div className="text-stone-400 text-[10px]">
                                        Чеков: {data.receiptsCount}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="amount" 
                            name="Расходы (₽)" 
                            fill="#1C1917" 
                            radius={[5, 5, 0, 0]} 
                            maxBarSize={34}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 3: ПО КАТЕГОРИЯМ И ЦЕНАМ */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  Распределение расходов по категориям
                </h4>
                
              </div>

              {categoryData.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  Нет данных о категориях покупок.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Диаграмма расходов */}
                  <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row items-center gap-4 shadow-2xs">
                    <div className="h-48 w-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                          >
                            {categoryData.map((entry) => (
                              <Cell 
                                key={entry.name} 
                                fill={CATEGORY_COLORS[entry.name] || DEFAULT_COLOR} 
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const percent = totalSpent > 0 ? Math.round((data.value / totalSpent) * 100) : 0;
                                return (
                                  <div className="bg-stone-900 text-white p-2.5 rounded-2xl shadow-xl text-xs">
                                    <div className="font-bold">{data.name}</div>
                                    <div className="text-amber-300 font-bold mt-0.5">{data.value.toLocaleString('ru-RU')} ₽ ({percent}%)</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Легенда категорий */}
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {categoryData.map((cat) => {
                        const percent = totalSpent > 0 ? Math.round((cat.value / totalSpent) * 100) : 0;
                        return (
                          <div key={cat.name} className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200/70 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: CATEGORY_COLORS[cat.name] || DEFAULT_COLOR }}
                              />
                              <span className="font-medium text-stone-800 truncate">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-bold text-stone-900 text-[11px]">
                              <span>{cat.value.toLocaleString('ru-RU')} ₽</span>
                              <span className="text-stone-400 font-normal">({percent}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Список категорий с детальными позициями и ценами */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                      Детализация цен по категориям
                    </span>

                    <div className="space-y-2">
                      {categoryData.map((cat) => (
                        <div key={cat.name} className="border border-stone-200/80 rounded-2xl bg-white p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: CATEGORY_COLORS[cat.name] || DEFAULT_COLOR }}
                              />
                              <span className="font-bold text-stone-900 text-sm">
                                {cat.name}
                              </span>
                              <span className="text-xs text-stone-400 font-medium">
                                ({cat.count} {cat.count === 1 ? 'позиция' : cat.count < 5 ? 'позиции' : 'позиций'})
                              </span>
                            </div>

                            <span className="font-extrabold text-stone-950 text-sm">
                              {cat.value.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>

                          {/* Список продуктов внутри этой категории */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {cat.items.slice(0, 8).map((it, idx) => (
                              <span key={idx} className="bg-stone-100/90 text-stone-800 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-stone-200/70">
                                {it.name} — <strong className="text-stone-950 font-bold">{it.price} ₽</strong>
                              </span>
                            ))}
                            {cat.items.length > 8 && (
                              <span className="text-[11px] text-stone-400 self-center font-medium">
                                + ещё {cat.items.length - 8}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </motion.div>

      {/* Модальное окно подтверждения удаления чека */}
      <AnimatePresence>
        {receiptToDelete && (
          <div 
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-60 flex items-center justify-center p-4"
            onClick={() => setReceiptToDelete(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-stone-200"
            >
              <h3 className="text-base font-bold text-stone-900 mb-1.5">Удалить чек?</h3>
              <p className="text-stone-600 text-sm mb-5 leading-relaxed">
                Вы действительно хотите удалить чек из <span className="font-semibold text-stone-900">«{receiptToDelete.storeName}»</span> на сумму <span className="font-semibold text-stone-900">{receiptToDelete.totalAmount} ₽</span>?
              </p>
              <div className="flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setReceiptToDelete(null)}
                  className="px-4 py-2 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="button"
                  onClick={confirmDeleteReceipt}
                  className="px-4 py-2 text-white font-medium bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-xs text-xs cursor-pointer"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
