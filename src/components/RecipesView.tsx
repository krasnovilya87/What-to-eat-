import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../useAppState';
import { X, Trash2, Edit2, ChefHat, Minus, Plus, Check, ShoppingCart, Sparkles, Loader2 } from 'lucide-react';
import EditRecipeModal from './EditRecipeModal';
import { motion, PanInfo } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../App';
import { checkIngredientStatus, calculateNeededIngredients, parseQuantity, scaleIngredient, cleanIngredientName } from '../utils/ingredients';
import { mergeShoppingItems } from '../utils/supermarket';
import { Recipe } from '../types';
import { calculateMacros } from '../utils/macrosCalculator';

export default function RecipesView({ state }: { state: ReturnType<typeof useAppState> }) {
  const navigate = useNavigate();
  const { recipes, setRecipes, fridge, grains, spices, setShoppingList } = state;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allInventory = React.useMemo(
    () => [...(fridge || []), ...(grains || []), ...(spices || [])],
    [fridge, grains, spices]
  );
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [returnToRecipeId, setReturnToRecipeId] = useState<string | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null);

  // Режим "Готовлю сегодня" и выбор порций
  const [isSelectingCookToday, setIsSelectingCookToday] = useState(false);
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [portionsInput, setPortionsInput] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [calculatingRecipeId, setCalculatingRecipeId] = useState<string | null>(null);
  const [macrosViewMode, setMacrosViewMode] = useState<'per100g' | 'perPortion'>('per100g');

  // Управление жестами: долгое нажатие (вибрация как на iOS) и свайп снизу вверх
  const longPressTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = React.useRef(false);
  const cardTouchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const containerTouchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const containerLongPressTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      if (containerLongPressTimeoutRef.current) clearTimeout(containerLongPressTimeoutRef.current);
    };
  }, []);

  const handleCardTouchStart = (recipe: Recipe, e: React.TouchEvent) => {
    isLongPressTriggeredRef.current = false;
    const touch = e.touches[0];
    cardTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if ('vibrate' in navigator) {
        try { navigator.vibrate?.([40, 30, 40]); } catch {}
      }

      if (!isSelectingCookToday) {
        // Первое касание (зажатие ~1 сек): карточки начинают вибрировать
        setIsSelectingCookToday(true);
      } else {
        // Если уже в режиме вибрации, повторное зажатие выходит из него
        setIsSelectingCookToday(false);
      }
    }, 900);
  };

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (cardTouchStartRef.current) {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - cardTouchStartRef.current.x, touch.clientY - cardTouchStartRef.current.y);
      if (dist > 12 && longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  };

  const handleCardTouchEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    cardTouchStartRef.current = null;
  };

  const handleCardMouseDown = (_recipe: Recipe) => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (!isSelectingCookToday) {
        setIsSelectingCookToday(true);
      } else {
        setIsSelectingCookToday(false);
      }
    }, 900);
  };

  const handleCardMouseUp = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Обработчики жестов на общем контейнере экрана (долгое нажатие для выхода)
  const handleContainerTouchStart = (e: React.TouchEvent) => {
    if (!isSelectingCookToday) return;
    const touch = e.touches[0];
    containerTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    if (containerLongPressTimeoutRef.current) clearTimeout(containerLongPressTimeoutRef.current);
    containerLongPressTimeoutRef.current = setTimeout(() => {
      setIsSelectingCookToday(false);
      if ('vibrate' in navigator) {
        try { navigator.vibrate?.(40); } catch {}
      }
    }, 850);
  };

  const handleContainerTouchMove = (e: React.TouchEvent) => {
    if (containerTouchStartRef.current) {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - containerTouchStartRef.current.x, touch.clientY - containerTouchStartRef.current.y);
      if (dist > 15 && containerLongPressTimeoutRef.current) {
        clearTimeout(containerLongPressTimeoutRef.current);
        containerLongPressTimeoutRef.current = null;
      }
    }
  };

  const handleContainerTouchEnd = () => {
    if (containerLongPressTimeoutRef.current) {
      clearTimeout(containerLongPressTimeoutRef.current);
      containerLongPressTimeoutRef.current = null;
    }
    containerTouchStartRef.current = null;
  };

  // Свайп снизу вверх: срабатывает строго от самой нижней границы экрана (последние 80px)
  React.useEffect(() => {
    if (!isSelectingCookToday) return;

    let bottomSwipeStart: { x: number; y: number; time: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Проверяем, что касание началось у самого нижнего края экрана
      const isAtBottomEdge = touch.clientY >= window.innerHeight - 85;
      if (isAtBottomEdge) {
        bottomSwipeStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      } else {
        bottomSwipeStart = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!bottomSwipeStart) return;
      const touch = e.touches[0];
      // Если потянули вверх от нижней кромки больше чем на 40px - выходим
      const deltaY = bottomSwipeStart.y - touch.clientY;
      const deltaX = Math.abs(touch.clientX - bottomSwipeStart.x);
      if (deltaY > 40 && deltaX < 75) {
        setIsSelectingCookToday(false);
        if ('vibrate' in navigator) {
          try { navigator.vibrate?.(40); } catch {}
        }
        bottomSwipeStart = null;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!bottomSwipeStart) return;
      const touch = e.changedTouches[0];
      const deltaY = bottomSwipeStart.y - touch.clientY;
      const deltaX = Math.abs(touch.clientX - bottomSwipeStart.x);
      const deltaTime = Date.now() - bottomSwipeStart.time;

      if (deltaY > 35 && deltaX < 80 && deltaTime < 700) {
        setIsSelectingCookToday(false);
        if ('vibrate' in navigator) {
          try { navigator.vibrate?.(40); } catch {}
        }
      }
      bottomSwipeStart = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isSelectingCookToday]);

  const handleCalculateRecipeMacros = async (recipe: Recipe) => {
    setCalculatingRecipeId(recipe.id);
    try {
      const result = await calculateMacros(recipe.ingredients, recipe.name, recipe.portions);
      if (result && result.macros) {
        setRecipes(prev => prev.map(r => r.id === recipe.id ? {
          ...r,
          macros: result.macros,
          totalWeight: r.totalWeight || result.totalWeight
        } : r));
      }
    } catch (e) {
      console.error('Failed to calculate macros:', e);
    } finally {
      setCalculatingRecipeId(null);
    }
  };

  // Автоматический расчёт КБЖУ при открытии подробного рецепта, если они отсутствуют
  React.useEffect(() => {
    if (!expandedId) return;
    const recipe = recipes.find(r => r.id === expandedId);
    if (!recipe) return;
    const hasMacros = recipe.macros && (recipe.macros.calories > 0 || recipe.macros.protein > 0);
    if (!hasMacros && recipe.ingredients && recipe.ingredients.length > 0 && calculatingRecipeId !== recipe.id) {
      handleCalculateRecipeMacros(recipe);
    }
  }, [expandedId, recipes]);

  const promptRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecipeToDelete(id);
  };

  const confirmRemove = () => {
    if (recipeToDelete) {
      setRecipes(prev => prev.filter(r => r.id !== recipeToDelete));
      setRecipeToDelete(null);
    }
  };

  const cancelRemove = () => {
    setRecipeToDelete(null);
  };
  
  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingRecipeId(id);
  };

  const handleSwipeRight = (recipe: typeof recipes[0]) => {
    setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, portions: (r.portions || r.basePortions || 1) + 1 } : r));
  };

  const handleSwipeLeft = (recipe: typeof recipes[0]) => {
    setRecipes(prev => prev.map(r => {
      if (r.id === recipe.id) {
        const current = r.portions || r.basePortions || 1;
        return { ...r, portions: Math.max(1, current - 1) };
      }
      return r;
    }));
  };

  const handleCardClick = (recipe: Recipe) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (isSelectingCookToday) {
      setCookingRecipe(recipe);
      setPortionsInput(recipe.portions || recipe.basePortions || 1);
    } else {
      setExpandedId(recipe.id);
    }
  };

  const handleCancelCooking = () => {
    setCookingRecipe(null);
  };

  const handleConfirmCookToday = () => {
    if (!cookingRecipe) return;
    
    try {
      const portions = Math.max(1, portionsInput);
      const base = cookingRecipe.basePortions || 1;
      const ratio = portions / base;
      
      // Пересчет ингредиентов на выбранное количество порций
      const rawIngredients = Array.isArray(cookingRecipe.ingredients) ? cookingRecipe.ingredients : [];
      const scaledIngredients = rawIngredients.map(ing => scaleIngredient(ing, ratio));
      
      // Расчет недостающих продуктов с учетом содержимого холодильника и кладовой
      const needed = calculateNeededIngredients(scaledIngredients, allInventory);
      
      let newShoppingItems = [];
      if (needed.length > 0) {
        newShoppingItems = needed.map(item => ({
          id: uuidv4(),
          name: item.name,
          quantity: item.quantity,
          checked: false,
          isManual: false
        }));
      } else {
        // Если все продукты есть в холодильнике, добавляем пересчитанные ингредиенты блюда
        newShoppingItems = scaledIngredients.map(ing => {
          const q = parseQuantity(ing);
          return {
            id: uuidv4(),
            name: cleanIngredientName(ing) || ing,
            quantity: q ? (q.unit === 'г' && q.val >= 1000 ? `${parseFloat((q.val / 1000).toFixed(1))} кг` : `${parseFloat(q.val.toFixed(1))} ${q.unit}`) : undefined,
            checked: false,
            isManual: false
          };
        });
      }
      
      setShoppingList(prev => mergeShoppingItems(prev || [], newShoppingItems));
      
      // Обновляем порции и статус в рецептах
      setRecipes(prev => (prev || []).map(r => r.id === cookingRecipe.id ? { 
        ...r, 
        portions: portions,
        isPrepared: true 
      } : r));
      
      const recipeName = cookingRecipe.name;
      setToastMessage(`«${recipeName}» (${portions} порц.) добавлено в покупки!`);
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Error in handleConfirmCookToday:', err);
    } finally {
      // Закрываем pop-up окно порций, но РЕЖИМ ВЫБОРА БЛЮД ОСТАЕТСЯ АКТИВНЫМ для дальнейшего выбора
      setCookingRecipe(null);
      setExpandedId(null);
    }
  };

  return (
    <div 
      className="flex flex-col gap-4 pb-8 min-h-full"
      onTouchStart={handleContainerTouchStart}
      onTouchMove={handleContainerTouchMove}
      onTouchEnd={handleContainerTouchEnd}
    >
      {/* Header with Title and "Добавить рецепт" button */}
      <div className="flex items-center justify-between px-2 gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">Мои рецепты</h1>
        
        <button
          onClick={() => navigate('/add')}
          className="px-3.5 py-2 rounded-2xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 bg-stone-900 hover:bg-stone-800 text-white cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Добавить рецепт</span>
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center text-stone-500 py-10 bg-white rounded-[2rem] shadow-sm mx-2">
          <p>У вас пока нет сохраненных рецептов.</p>
          <p className="text-sm mt-2 text-stone-400">Нажмите «Добавить рецепт» выше, чтобы добавить блюдо по фото, ссылке или вручную.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-2">
          {recipes.map((recipe, index) => (
            <motion.div 
              key={recipe.id} 
              drag={isSelectingCookToday ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              whileTap={{ cursor: "grabbing" }}
              onDragEnd={(_, info) => {
                if (!isSelectingCookToday) {
                  if (info.offset.x > 100) handleSwipeRight(recipe);
                  else if (info.offset.x < -100) handleSwipeLeft(recipe);
                }
              }}
              onTouchStart={(e) => handleCardTouchStart(recipe, e)}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onMouseDown={() => handleCardMouseDown(recipe)}
              onMouseMove={handleCardMouseUp}
              onMouseUp={handleCardMouseUp}
              onMouseLeave={handleCardMouseUp}
              className={cn(
                "bg-white rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all hover:shadow-md relative select-none",
                isSelectingCookToday 
                  ? cn(
                      recipe.isPrepared
                        ? "scale-[1.01] bg-emerald-50/30"
                        : "scale-[1.01] bg-stone-50/80",
                      index % 2 === 0 ? "animate-ios-jiggle-1" : "animate-ios-jiggle-2"
                    )
                  : ""
              )}
              onClick={() => handleCardClick(recipe)}
            >
              {isSelectingCookToday && (
                recipe.isPrepared ? (
                  <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Check size={12} /> {recipe.portions || 1} порц.
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                    + Выбрать
                  </div>
                )
              )}

              {recipe.imageUrl ? (
                <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-32 md:h-48 object-cover" />
              ) : (
                <div className="w-full h-32 md:h-48 bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
                  Нет фото
                </div>
              )}
              <div className="p-3 md:p-6 flex flex-col items-start justify-between flex-grow">
                <div className="w-full">
                  <h3 className="font-bold text-base md:text-xl text-stone-800 leading-tight line-clamp-2">{recipe.name}</h3>
                  <p className="text-xs md:text-sm text-stone-500 mt-1">
                      {recipe.ingredients.length} ингр. {recipe.macros && recipe.macros.calories > 0 && `• ${recipe.macros.calories} ккал`}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 mt-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                      <span>{recipe.portions || recipe.basePortions || 1} порций {recipe.totalWeight && ` • ~${Math.round(recipe.totalWeight * ((recipe.portions || recipe.basePortions || 1) / (recipe.basePortions || 1)))} г`}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Модальное окно просмотра рецепта */}
      {expandedId && (
        <div className="fixed inset-0 bg-stone-900/50 z-40 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4" onClick={() => setExpandedId(null)}>
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const recipe = recipes.find(r => r.id === expandedId);
              if (!recipe) return null;
              
              return (
                <>
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingRecipeId(recipe.id);
                        setReturnToRecipeId(recipe.id);
                        setExpandedId(null);
                      }} 
                      className="bg-black/30 hover:bg-black/50 text-white rounded-full px-3 py-2 backdrop-blur-sm transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-md"
                      title="Редактировать рецепт"
                    >
                      <Edit2 size={15} />
                      <span>Редактировать</span>
                    </button>
                    <button 
                      onClick={() => setExpandedId(null)} 
                      className="bg-black/30 hover:bg-black/50 text-white rounded-full p-2 backdrop-blur-sm transition-colors shadow-md"
                      title="Закрыть"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="overflow-y-auto no-scrollbar flex-1">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-64 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-stone-100 flex items-center justify-center text-stone-400">
                        Нет фото
                      </div>
                    )}
                    
                    <div className="p-6 flex flex-col gap-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="font-bold text-2xl text-stone-800 leading-tight">{recipe.name}</h2>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-sm font-bold text-emerald-600">
                              {recipe.portions || recipe.basePortions || 1} порций {recipe.totalWeight && ` • ~${Math.round(recipe.totalWeight * ((recipe.portions || recipe.basePortions || 1) / (recipe.basePortions || 1)))} г`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingRecipeId(recipe.id);
                            setReturnToRecipeId(recipe.id);
                            setExpandedId(null);
                          }}
                          className="shrink-0 px-3.5 py-2 rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 text-xs font-bold border border-stone-200/60 shadow-xs"
                          title="Редактировать рецепт"
                        >
                          <Edit2 size={15} className="text-stone-600" />
                          <span>Редактировать</span>
                        </button>
                      </div>

                      {calculatingRecipeId === recipe.id ? (
                        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                          <Loader2 size={18} className="animate-spin text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-emerald-900">Рассчитываем БЖУ по ингредиентам...</p>
                            <p className="text-[11px] text-emerald-700">Определяем калорийность, белки, жиры и углеводы</p>
                          </div>
                        </div>
                      ) : recipe.macros && (recipe.macros.calories > 0 || recipe.macros.protein > 0) ? (
                        (() => {
                          const portionsCount = recipe.portions || recipe.basePortions || 1;
                          const portionWeight = recipe.totalWeight 
                            ? Math.round(recipe.totalWeight / portionsCount) 
                            : 300;
                          const portionRatio = portionWeight / 100;

                          const displayProtein = (recipe.macros.protein * portionRatio).toFixed(1);
                          const displayFat = (recipe.macros.fat * portionRatio).toFixed(1);
                          const displayCarbs = (recipe.macros.carbs * portionRatio).toFixed(1);
                          const displayCalories = Math.round(recipe.macros.calories * portionRatio);

                          return (
                            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex bg-stone-200/70 p-0.5 rounded-xl text-[11px] font-semibold">
                                  <button
                                    type="button"
                                    onClick={() => setMacrosViewMode('per100g')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                      macrosViewMode === 'per100g'
                                        ? 'bg-white text-stone-900 shadow-xs font-bold'
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    На 100 г
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMacrosViewMode('perPortion')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                      macrosViewMode === 'perPortion'
                                        ? 'bg-white text-stone-900 shadow-xs font-bold'
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    На порцию (~{portionWeight} г)
                                  </button>
                                </div>

                                <button 
                                  onClick={() => handleCalculateRecipeMacros(recipe)}
                                  disabled={calculatingRecipeId === recipe.id}
                                  title="Пересчитать по ингредиентам"
                                  className="text-[11px] font-semibold text-stone-400 hover:text-emerald-600 flex items-center gap-1 transition-colors ml-2"
                                >
                                  <Sparkles size={12} />
                                  <span className="hidden sm:inline">Пересчитать</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-4 gap-2 text-center text-stone-700">
                                <div className="bg-white py-2 px-1 rounded-xl border border-stone-100 shadow-xs">
                                  <p className="text-[10px] font-bold text-stone-400 uppercase">Белки</p>
                                  <p className="font-bold text-sm text-stone-800">
                                    {macrosViewMode === 'per100g' ? `${recipe.macros.protein}г` : `${displayProtein}г`}
                                  </p>
                                </div>
                                <div className="bg-white py-2 px-1 rounded-xl border border-stone-100 shadow-xs">
                                  <p className="text-[10px] font-bold text-stone-400 uppercase">Жиры</p>
                                  <p className="font-bold text-sm text-stone-800">
                                    {macrosViewMode === 'per100g' ? `${recipe.macros.fat}г` : `${displayFat}г`}
                                  </p>
                                </div>
                                <div className="bg-white py-2 px-1 rounded-xl border border-stone-100 shadow-xs">
                                  <p className="text-[10px] font-bold text-stone-400 uppercase">Углеводы</p>
                                  <p className="font-bold text-sm text-stone-800">
                                    {macrosViewMode === 'per100g' ? `${recipe.macros.carbs}г` : `${displayCarbs}г`}
                                  </p>
                                </div>
                                <div className="bg-white py-2 px-1 rounded-xl border border-stone-100 shadow-xs">
                                  <p className="text-[10px] font-bold text-stone-400 uppercase">Ккал</p>
                                  <p className="font-bold text-sm text-stone-800">
                                    {macrosViewMode === 'per100g' ? recipe.macros.calories : displayCalories}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-100">
                          <div>
                            <p className="text-xs font-bold text-stone-700">КБЖУ не указаны</p>
                            <p className="text-[11px] text-stone-400">Рассчитать автоматически по ингредиентам</p>
                          </div>
                          <button
                            onClick={() => handleCalculateRecipeMacros(recipe)}
                            disabled={calculatingRecipeId === recipe.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-sm"
                          >
                            {calculatingRecipeId === recipe.id ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Считаем...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={13} />
                                <span>Рассчитать БЖУ</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-bold text-stone-400 text-[10px] mb-3 uppercase tracking-widest">Ингредиенты</h4>
                        <ul className="text-sm space-y-2">
                          {recipe.ingredients.map((ing, i) => {
                            const ratio = (recipe.portions || recipe.basePortions || 1) / (recipe.basePortions || 1);
                            const scaledIng = scaleIngredient(ing, ratio);
                            const status = checkIngredientStatus(scaledIng, allInventory);
                            let colorClass = 'text-red-600';
                            if (status === 'green') colorClass = 'text-emerald-600';
                            else if (status === 'yellow') colorClass = 'text-yellow-600';
                            
                            let dotClass = 'bg-red-500';
                            if (status === 'green') dotClass = 'bg-emerald-500';
                            else if (status === 'yellow') dotClass = 'bg-yellow-500';

                            return (
                              <li key={i} className={`flex items-start gap-2 ${colorClass}`}>
                                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                                <span>{scaledIng}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      
                      {recipe.instructions && recipe.instructions.length > 0 && (
                        <div>
                          <h4 className="font-bold text-stone-400 text-[10px] mb-3 uppercase tracking-widest">Инструкция</h4>
                          <ol className="list-decimal list-inside text-sm text-stone-700 space-y-3">
                            {recipe.instructions.map((inst, i) => <li key={i} className="leading-relaxed">{inst}</li>)}
                          </ol>
                        </div>
                      )}
                      
                      {recipe.sourceUrl && (
                        <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 font-bold uppercase tracking-wider hover:underline inline-block mt-2">
                          Оригинал рецепта →
                        </a>
                      )}
                    </div>
                  </div>
                  
                  {/* Кнопки внизу карточки: "Готовлю сегодня", "Редактировать", "Удалить" */}
                  <div className="p-4 border-t border-stone-100 flex flex-col gap-2 bg-white">
                    <button 
                      onClick={() => {
                        setCookingRecipe(recipe);
                        setPortionsInput(recipe.portions || recipe.basePortions || 1);
                        setExpandedId(null);
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                      <ChefHat size={18} /> Готовлю сегодня
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRecipeId(recipe.id);
                          setReturnToRecipeId(recipe.id);
                          setExpandedId(null);
                        }}
                        className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit2 size={16} /> Редактировать
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          promptRemove(e, recipe.id);
                          setExpandedId(null);
                        }}
                        className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 size={16} /> Удалить
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* Диалог "Сколько порций?" */}
      {cookingRecipe && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4" onClick={handleCancelCooking}>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <ChefHat size={20} />
                <span className="font-bold text-xs uppercase tracking-wider">Готовлю сегодня</span>
              </div>
              <button 
                onClick={handleCancelCooking}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-xl font-bold text-stone-900 mb-1">Сколько порций?</h3>
            <p className="text-sm text-stone-500 mb-5 line-clamp-1">{cookingRecipe.name}</p>

            {/* Выбор количества порций */}
            <div className="flex items-center justify-center gap-4 bg-stone-50 p-4 rounded-2xl mb-4">
              <button 
                onClick={() => setPortionsInput(p => Math.max(1, p - 1))}
                disabled={portionsInput <= 1}
                className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-sm disabled:opacity-30 active:scale-95 transition-all text-xl font-bold"
              >
                <Minus size={18} />
              </button>

              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={portionsInput}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) setPortionsInput(val);
                    else if (e.target.value === '') setPortionsInput(1);
                  }}
                  className="w-20 text-center font-bold text-3xl bg-transparent border-none focus:outline-none text-stone-800"
                />
                <span className="text-xs text-stone-400 font-medium">порций</span>
              </div>

              <button 
                onClick={() => setPortionsInput(p => p + 1)}
                className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition-all text-xl font-bold"
              >
                <Plus size={18} />
              </button>
            </div>

            {cookingRecipe.totalWeight && (
              <div className="text-xs text-stone-600 text-center mb-4 bg-emerald-50 text-emerald-800 py-2.5 px-3 rounded-xl font-medium">
                Расчетный вес блюда: ~
                <span className="font-bold">
                  {Math.round(cookingRecipe.totalWeight * (portionsInput / (cookingRecipe.basePortions || 1)))} г
                </span>
              </div>
            )}

            <p className="text-[11px] text-stone-400 text-center mb-6 leading-relaxed">
              Необходимые ингредиенты пересчитаются и будут добавлены в список покупок с учетом продуктов в холодильнике.
            </p>

            <div className="flex gap-2">
              <button 
                onClick={handleCancelCooking}
                className="flex-1 py-3 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-sm"
              >
                Отмена
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleConfirmCookToday();
                }}
                className="flex-1 py-3 text-white font-medium bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-1.5"
              >
                <Check size={18} /> Окей
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating notification about added ingredients */}
      {toastMessage && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-stone-800"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShoppingCart size={16} />
            </div>
            <p className="text-xs font-medium text-stone-200 truncate">{toastMessage}</p>
          </div>
          <button 
            onClick={() => {
              setIsSelectingCookToday(false);
              navigate('/shopping');
            }}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg bg-white/10 shrink-0 whitespace-nowrap"
          >
            В покупки →
          </button>
        </motion.div>
      )}

      {editingRecipeId && (
        <EditRecipeModal 
            recipe={recipes.find(r => r.id === editingRecipeId)!}
            setRecipes={setRecipes}
            onClose={() => {
              setEditingRecipeId(null);
              if (returnToRecipeId) {
                setExpandedId(returnToRecipeId);
                setReturnToRecipeId(null);
              }
            }}
        />
      )}
      
      {recipeToDelete && (
        <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold text-stone-900 mb-2">Удалить рецепт?</h3>
            <p className="text-stone-500 mb-6">Вы уверены, что хотите удалить этот рецепт? Это действие нельзя отменить.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={cancelRemove}
                className="px-5 py-2.5 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={confirmRemove}
                className="px-5 py-2.5 text-white font-medium bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
