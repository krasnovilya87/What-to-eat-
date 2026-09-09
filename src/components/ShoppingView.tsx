import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppState } from '../useAppState';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Check, Star, RotateCcw, Camera, Receipt, Bell, X, Trash2, LineChart } from 'lucide-react';
import { cn } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { 
  deduplicateShoppingList, 
  mergeShoppingItems, 
  getDepartmentForItem, 
  SUPERMARKET_DEPARTMENTS,
  Department
} from '../utils/supermarket';
import { cleanIngredientName, parseQuantity } from '../utils/ingredients';
import { cleanProductName } from '../utils/geoFavorites';
import { ShoppingItem, ReceiptPurchase, Recipe } from '../types';
import AddReceiptModal from './AddReceiptModal';
import PurchaseHistoryModal from './PurchaseHistoryModal';
import ShoppingRemindersModal from './ShoppingRemindersModal';
import PurchaseChartModal from './PurchaseChartModal';

export default function ShoppingView({ state }: { state: ReturnType<typeof useAppState> }) {
  const {
    shoppingList, setShoppingList,
    recipes, setRecipes,
    fridge, setFridge,
    grains,
    spices,
    favoriteConfigs,
    recordPurchaseEvent,
    purchases,
    addPurchase,
    deletePurchase
  } = state;

  const [newItemName, setNewItemName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [toast, setToast] = useState<{ message: string; undoItem?: ShoppingItem } | null>(null);
  
  const [isAddReceiptOpen, setIsAddReceiptOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  
  const activeRemindersCount = (state.reminders || []).filter(r => r.enabled).length;

  // Auto-hide toast after 4s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Deduplicate on load if needed
  useEffect(() => {
    if (!shoppingList || shoppingList.length === 0) return;
    const deduped = deduplicateShoppingList(shoppingList);
    if (deduped.length !== shoppingList.length) {
      setShoppingList(deduped);
    }
  }, [shoppingList, setShoppingList]);

  // Check if item is favorite across any section or config
  const isFavorite = (item: ShoppingItem) => {
    if (item.isPermanent) return true;
    const target = cleanProductName(item.name);
    if ((favoriteConfigs || []).some(c => cleanProductName(c.name) === target)) return true;
    if ((fridge || []).some(f => f.isPermanent && cleanProductName(f.name) === target)) return true;
    if ((grains || []).some(g => g.isPermanent && cleanProductName(g.name) === target)) return true;
    if ((spices || []).some(s => s.isPermanent && cleanProductName(s.name) === target)) return true;
    return false;
  };

  // Automatic grouping by supermarket departments
  const departmentGroups = useMemo(() => {
    const map = new Map<string, { department: Department; items: ShoppingItem[] }>();
    
    SUPERMARKET_DEPARTMENTS.forEach(dept => {
      map.set(dept.id, { department: dept, items: [] });
    });

    (shoppingList || []).forEach(item => {
      const dept = getDepartmentForItem(item.name);
      const group = map.get(dept.id) || map.get('other')!;
      group.items.push(item);
    });

    return Array.from(map.values()).filter(g => g.items.length > 0);
  }, [shoppingList]);

  // Add new item to shopping list
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    
    const parsedQ = parseQuantity(trimmed);
    const cleanName = cleanIngredientName(trimmed) || trimmed;
    
    let displayQuantity: string | undefined = undefined;
    if (parsedQ) {
      if (parsedQ.unit === 'г' && parsedQ.val >= 1000) {
        displayQuantity = `${parseFloat((parsedQ.val / 1000).toFixed(1))} кг`;
      } else if (parsedQ.unit === 'мл' && parsedQ.val >= 1000) {
        displayQuantity = `${parseFloat((parsedQ.val / 1000).toFixed(1))} л`;
      } else {
        displayQuantity = `${parsedQ.val} ${parsedQ.unit}`;
      }
    }

    const newItem: ShoppingItem = {
      id: uuidv4(),
      name: cleanName,
      quantity: displayQuantity,
      checked: false,
      isManual: true,
      isPermanent: (favoriteConfigs || []).some(c => cleanProductName(c.name) === cleanProductName(cleanName))
    };
    
    // Merge into list
    setShoppingList(prev => mergeShoppingItems(prev || [], [newItem]));
    
    // Record event for smart interval tracking
    recordPurchaseEvent(cleanName, 'added');
    
    setNewItemName('');
  };

  // Toggle check / bought status
  const toggleCheck = (id: string) => {
    setShoppingList(prev => (prev || []).map(item => {
      if (item.id === id) {
        const nextChecked = !item.checked;
        if (nextChecked) {
          // Record purchase event when marked bought
          recordPurchaseEvent(item.name, 'bought');
        }
        return { ...item, checked: nextChecked };
      }
      return item;
    }));
  };

  // Delete product
  const promptRemove = (item: ShoppingItem) => {
    setItemToDelete(item);
  };

  const confirmRemove = () => {
    if (itemToDelete) {
      const deletedItem = itemToDelete;
      setShoppingList(prev => (prev || []).filter(i => i.id !== deletedItem.id));
      setToast({
        message: `«${deletedItem.name}» удалено`,
        undoItem: deletedItem
      });
      setItemToDelete(null);
    }
  };

  const cancelRemove = () => {
    setItemToDelete(null);
  };

  const handleUndo = () => {
    if (toast?.undoItem) {
      setShoppingList(prev => [...(prev || []), toast.undoItem!]);
      setToast(null);
    }
  };

  const handleUpdateQuantity = (id: string, quantity: string) => {
    setShoppingList(prev => (prev || []).map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleClearChecked = () => {
    setShoppingList(prev => (prev || []).filter(item => !item.checked));
  };

  const handleRemoveRecipeFromMenu = (recipeId: string) => {
    setRecipes(prev => (prev || []).map(r => r.id === recipeId ? { ...r, isPrepared: false } : r));
  };

  const promptRemoveRecipe = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
  };

  const confirmRemoveRecipe = () => {
    if (recipeToDelete) {
      const id = recipeToDelete.id;
      const name = recipeToDelete.name;
      handleRemoveRecipeFromMenu(id);
      setToast({
        message: `Блюдо «${name}» убрано из меню`
      });
      setRecipeToDelete(null);
    }
  };

  const cancelRemoveRecipe = () => {
    setRecipeToDelete(null);
  };

  const totalItemsCount = (shoppingList || []).length;
  const checkedItemsCount = (shoppingList || []).filter(i => i.checked).length;
  const preparedRecipes = (recipes || []).filter(r => r.isPrepared);

  const handleSavePurchase = (purchase: ReceiptPurchase, syncShopping: boolean, syncFridge: boolean) => {
    addPurchase(purchase);

    if (syncShopping && shoppingList && shoppingList.length > 0) {
      const boughtNames = new Set(
        (purchase.items || []).map(it => cleanProductName(it.name).toLowerCase())
      );

      let updated = false;
      const newShoppingList = shoppingList.map(sItem => {
        const sName = cleanProductName(sItem.name).toLowerCase();
        const isMatch = Array.from(boughtNames).some(bName => bName.includes(sName) || sName.includes(bName));
        if (isMatch && !sItem.checked) {
          updated = true;
          recordPurchaseEvent(sItem.name, 'bought');
          return { ...sItem, checked: true };
        }
        return sItem;
      });

      if (updated) {
        setShoppingList(newShoppingList);
      }
    }

    if (syncFridge && setFridge) {
      setFridge(prev => {
        const existingMap = new Map((prev || []).map(f => [cleanProductName(f.name).toLowerCase(), f]));
        const next = [...(prev || [])];
        (purchase.items || []).forEach(item => {
          const key = cleanProductName(item.name).toLowerCase();
          if (!existingMap.has(key)) {
            next.push({
              id: uuidv4(),
              name: item.name,
              quantity: item.quantity
            });
          }
        });
        return next;
      });
    }

    setToast({
      message: `Чек «${purchase.storeName}» (${purchase.totalAmount} ₽) сохранён в историю!`
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-12 px-2">
      
      {/* ЕДИНЫЙ БЛОК «ПОКУПКИ» В СТИЛЕ ХОЛОДИЛЬНИКА, ЦВЕТ ЖЁЛТЫХ СТРАНИЦ БЛОКНОТА */}
      <div className="bg-[#FAF0B2] rounded-[2rem] p-6 text-stone-950 overflow-hidden shadow-lg relative">
        
        {/* Прямоугольные кнопки "Добавить чек", "История покупок", "Напоминания" и "График покупок" на всю ширину с текстом под кнопкой */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full mb-6">
          {/* Добавить чек */}
          <button
            id="btn-add-receipt"
            type="button"
            onClick={() => setIsAddReceiptOpen(true)}
            className="flex flex-col items-center w-full group cursor-pointer"
            title="Добавить фото или чек из магазина"
          >
            <div className="w-full h-14 sm:h-16 rounded-2xl bg-white/80 group-hover:bg-white flex items-center justify-center transition-all shadow-xs group-hover:shadow-sm active:scale-95 relative">
              <Camera size={22} className="text-stone-800 group-hover:text-amber-950 transition-colors" />
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-bold text-stone-900 text-center leading-tight">
              Добавить чек
            </span>
          </button>

          {/* История покупок */}
          <button
            id="btn-purchase-history"
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="flex flex-col items-center w-full group cursor-pointer"
            title="Посмотреть историю покупок и графики расходов"
          >
            <div className="w-full h-14 sm:h-16 rounded-2xl bg-white/80 group-hover:bg-white flex items-center justify-center transition-all shadow-xs group-hover:shadow-sm active:scale-95 relative">
              {(purchases || []).length > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-stone-900 text-[#FAF0B2] text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-xs">
                  {purchases.length}
                </span>
              )}
              <Receipt size={22} className="text-stone-800 group-hover:text-amber-950 transition-colors" />
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-bold text-stone-900 text-center leading-tight">
              История покупок
            </span>
          </button>

          {/* Напоминания */}
          <button
            id="btn-shopping-reminders"
            type="button"
            onClick={() => setIsRemindersOpen(true)}
            className="flex flex-col items-center w-full group cursor-pointer"
            title="Напоминания о покупках (по расписанию или приближению к магазину)"
          >
            <div className="w-full h-14 sm:h-16 rounded-2xl bg-white/80 group-hover:bg-white flex items-center justify-center transition-all shadow-xs group-hover:shadow-sm active:scale-95 relative">
              {activeRemindersCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-emerald-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-xs">
                  {activeRemindersCount}
                </span>
              )}
              <Bell size={22} className="text-stone-800 group-hover:text-amber-950 transition-colors" />
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-bold text-stone-900 text-center leading-tight">
              Напоминания
            </span>
          </button>

          {/* График покупок */}
          <button
            id="btn-purchase-chart"
            type="button"
            onClick={() => setIsChartOpen(true)}
            className="flex flex-col items-center w-full group cursor-pointer"
            title="График покупок, интервалы и цены продуктов по дням, неделям, месяцам, кварталам и годам"
          >
            <div className="w-full h-14 sm:h-16 rounded-2xl bg-white/80 group-hover:bg-white flex items-center justify-center transition-all shadow-xs group-hover:shadow-sm active:scale-95 relative">
              <LineChart size={22} className="text-stone-800 group-hover:text-amber-950 transition-colors" />
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-bold text-stone-900 text-center leading-tight">
              График покупок
            </span>
          </button>
        </div>

        {/* Блюда к приготовлению (если есть выбранные рецепты) */}
        {preparedRecipes.length > 0 && (
          <div className="mb-4 pb-3 border-b border-black/10">
            <span className="block font-semibold text-stone-800/70 text-[11px] uppercase tracking-wider mb-2">
              Блюда к приготовлению:
            </span>
            <div className="flex flex-wrap gap-2">
              {preparedRecipes.map(r => (
                <div key={r.id} className="relative rounded-xl overflow-hidden shadow-2xs">
                  {/* Фоновая аккуратная красная иконка корзины при свайпе влево */}
                  <div className="absolute inset-0 flex items-center justify-end px-3 rounded-xl bg-red-50 text-red-600 select-none pointer-events-none">
                    <Trash2 size={15} />
                  </div>

                  {/* Плашка блюда со сплошным фоном и свайпом влево */}
                  <motion.div
                    layout
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0.6, right: 0.1 }}
                    whileTap={{ cursor: "grabbing" }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -35 || info.velocity.x < -150) {
                        promptRemoveRecipe(r);
                      }
                    }}
                    className="relative z-10 bg-white border border-black/15 rounded-xl px-3.5 py-1.5 text-xs font-medium text-stone-900 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
                  >
                    <span>{r.name} — {r.portions || 1} шт.</span>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Поле добавления нового продукта */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Что нужно купить? (например, Молоко, Сыр 200г...)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 bg-black/10 border border-black/15 rounded-2xl px-4 py-3 text-sm text-stone-950 placeholder-stone-800/60 focus:outline-none focus:border-stone-900 transition-colors"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="bg-stone-900 hover:bg-stone-800 text-white rounded-2xl px-4 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
            title="Добавить в покупки"
          >
            <Plus size={22} />
          </button>
        </form>

        {/* Кнопка "Очистить купленные" над списком продуктов */}
        {checkedItemsCount > 0 && (
          <div className="flex items-center justify-between mb-4 bg-black/5 border border-black/10 px-3.5 py-2 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-stone-800">
              Куплено: <strong>{checkedItemsCount}</strong>
            </span>
            <button
              id="btn-clear-checked-products"
              type="button"
              onClick={handleClearChecked}
              className="text-xs font-bold text-stone-950 hover:text-stone-900 bg-white/70 hover:bg-white border border-black/15 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Очистить купленные ({checkedItemsCount})
            </button>
          </div>
        )}

        {/* Перечень продуктов, автоматически распределённых по отделам магазина */}
        {totalItemsCount === 0 ? (
          <p className="text-center py-8 text-sm text-stone-800/60">
            В списке покупок пока пусто.
          </p>
        ) : (
          <div className="space-y-6">
            {departmentGroups.map(({ department, items }) => (
              <div key={department.id} className="space-y-1">
                
                {/* Выделенный заголовок отдела магазина */}
                <div className="flex items-center justify-between bg-stone-900 text-[#FAF0B2] px-3.5 py-2 rounded-xl shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none shrink-0">{department.icon}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-[#FAF0B2] truncate">
                      {department.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-[#FAF0B2]/25 text-[#FAF0B2] px-2 py-0.5 rounded-lg shrink-0 ml-2">
                    {items.length}
                  </span>
                </div>

                {/* Товары данного отдела */}
                <div className="flex flex-col">
                  {items.map((item) => {
                    const itemIsFav = isFavorite(item);

                    return (
                      <div key={item.id} className="relative rounded-xl overflow-hidden">
                        {/* Фоновые индикаторы свайпов: влево — удалить, вправо — куплено */}
                        <div className="absolute inset-0 flex items-center justify-between px-3.5 rounded-xl bg-black/5 select-none pointer-events-none">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                            <Check size={16} strokeWidth={2.5} />
                            <span>{item.checked ? 'Вернуть' : 'Куплено'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-stone-900 font-bold text-xs">
                            <span>Удалить</span>
                          </div>
                        </div>

                        {/* Интерактивная строка продукта (БЕЗ прозрачности для отмеченных) */}
                        <motion.div
                          layout
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={{ left: 0.6, right: 0.6 }}
                          whileTap={{ cursor: "grabbing" }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -70 || info.velocity.x < -200) {
                              promptRemove(item);
                            } else if (info.offset.x > 70 || info.velocity.x > 200) {
                              toggleCheck(item.id);
                            }
                          }}
                          className="relative z-10 flex items-center justify-between py-2.5 bg-[#FAF0B2] select-none cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-center justify-between gap-2.5 flex-1 min-w-0">
                            
                            {/* Левая группа: Окошко для галочки + Звёздочка (запрет редактирования) + Название */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              
                              {/* 1. Окошко для галочки (левее всего) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCheck(item.id);
                                }}
                                className="p-1 -ml-1 rounded-md transition-transform active:scale-90 shrink-0 cursor-pointer flex items-center justify-center"
                                title={item.checked ? "Отметить как не купленное" : "Отметить как купленное"}
                              >
                                {item.checked ? (
                                  <div className="w-5 h-5 rounded-md bg-stone-400 text-white flex items-center justify-center shadow-xs">
                                    <Check size={14} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border-2 border-stone-800/40 hover:border-stone-900 rounded-md bg-white/50 transition-colors" />
                                )}
                              </button>

                              {/* 2. Звёздочка (индикатор, редактирование на этой вкладке запрещено) */}
                              <div
                                className={cn(
                                  "p-1 -ml-0.5 shrink-0 flex items-center justify-center select-none cursor-default transition-colors",
                                  item.checked
                                    ? "text-stone-400"
                                    : itemIsFav ? "text-stone-950" : "text-stone-900/20"
                                )}
                                title={
                                  itemIsFav
                                    ? "Избранный продукт (отмечен в Холодильнике)"
                                    : "Не в избранном (отмечается в Холодильнике)"
                                }
                              >
                                <Star
                                  size={17}
                                  strokeWidth={itemIsFav ? 1.5 : 1.25}
                                  className={cn(
                                    itemIsFav ? "fill-current" : "fill-none"
                                  )}
                                />
                              </div>

                              {/* 3. Название продукта (серый цвет при отметке галочкой) */}
                              <span className={cn(
                                "font-medium truncate flex-1 leading-tight transition-colors",
                                item.checked ? "line-through text-stone-400" : "text-stone-950"
                              )}>
                                {item.name}
                              </span>
                            </div>

                            {/* Правая часть: количество */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="text"
                                value={item.quantity || ''}
                                onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                                placeholder="кол-во"
                                className={cn(
                                  "bg-transparent border-b border-transparent focus:border-stone-900 text-sm w-16 text-right px-1 py-0.5 focus:outline-none transition-colors shrink-0 placeholder-stone-800/40",
                                  item.checked ? "line-through text-stone-400" : "text-stone-900"
                                )}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* Тонкая серая линия снизу под каждым товаром так же, как в блоке «У меня есть» */}
                          <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-900/15" />
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно подтверждения удаления (смахивание влево) */}
      <AnimatePresence>
        {itemToDelete && (
          <div 
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={cancelRemove}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-stone-200"
            >
              <h3 className="text-base font-bold text-stone-900 mb-1.5">Удалить продукт?</h3>
              <p className="text-stone-600 text-sm mb-5 leading-relaxed">
                Вы действительно хотите удалить <span className="font-semibold text-stone-900">«{itemToDelete.name}»</span>{itemToDelete.quantity ? ` (${itemToDelete.quantity})` : ''} из списка покупок?
              </p>
              <div className="flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={cancelRemove}
                  className="px-4 py-2 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="button"
                  onClick={confirmRemove}
                  className="px-4 py-2 text-white font-medium bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-xs text-xs cursor-pointer"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Модальное окно подтверждения удаления блюда из меню */}
        {recipeToDelete && (
          <div 
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={cancelRemoveRecipe}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-stone-200"
            >
              <h3 className="text-base font-bold text-stone-900 mb-1.5">Убрать блюдо из меню?</h3>
              <p className="text-stone-600 text-sm mb-5 leading-relaxed">
                Вы действительно хотите убрать блюдо <span className="font-semibold text-stone-900">«{recipeToDelete.name}»</span>{recipeToDelete.portions ? ` (${recipeToDelete.portions} шт.)` : ''} из списка к приготовлению?
              </p>
              <div className="flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={cancelRemoveRecipe}
                  className="px-4 py-2 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="button"
                  onClick={confirmRemoveRecipe}
                  className="px-4 py-2 text-white font-medium bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-xs text-xs cursor-pointer"
                >
                  Убрать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Уведомление об удалении с кнопкой отмены */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-medium border border-stone-800"
          >
            <span>{toast.message}</span>
            {toast.undoItem && (
              <button 
                type="button"
                onClick={handleUndo}
                className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>Отменить</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно добавления чека (камера / галерея) */}
      <AddReceiptModal
        isOpen={isAddReceiptOpen}
        onClose={() => setIsAddReceiptOpen(false)}
        onSavePurchase={handleSavePurchase}
        shoppingList={shoppingList || []}
      />

      {/* Модальное окно истории покупок и аналитики */}
      <PurchaseHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        purchases={purchases || []}
        onDeletePurchase={deletePurchase}
      />

      {/* Модальное окно напоминаний по расписанию и геолокации */}
      <ShoppingRemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        state={state}
      />

      {/* Модальное окно графика покупок и интервалов цен */}
      <PurchaseChartModal
        isOpen={isChartOpen}
        onClose={() => setIsChartOpen(false)}
        purchases={purchases || []}
        purchaseEvents={state.purchaseEvents || []}
        fridge={fridge || []}
        grains={grains || []}
        spices={spices || []}
        shoppingList={shoppingList || []}
      />

    </div>
  );
}
