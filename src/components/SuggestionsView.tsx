import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../useAppState';
import { Recipe, ShoppingItem, RecipeCategory, RECIPE_CATEGORIES } from '../types';
import { Sparkles, Loader2, CheckCircle, ChefHat, Plus, X, Minus, Check, ShoppingCart, Flame, RotateCw, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiPost } from '../utils/api';
import { generateLocalSuggestions, generateMoreLocalSuggestions, SuggestionResult, POPULAR_CATALOG } from '../utils/suggestionEngine';
import { v4 as uuidv4 } from 'uuid';
import { scaleIngredient, calculateNeededIngredients, parseQuantity, cleanIngredientName } from '../utils/ingredients';
import { mergeShoppingItems } from '../utils/supermarket';
import { findMacroCombinations, MacroCombo } from '../utils/macroPlanner';
import { cn } from '../App';

export default function SuggestionsView({ state }: { state: ReturnType<typeof useAppState> }) {
  const navigate = useNavigate();
  const { fridge, grains, spices, recipes, setRecipes, setShoppingList } = state;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [availableSuggestions, setAvailableSuggestions] = useState<SuggestionResult[]>([]);
  const [newSuggestions, setNewSuggestions] = useState<SuggestionResult[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<RecipeCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedSuggestion, setSelectedSuggestion] = useState<{
    sug: SuggestionResult;
    matchedRecipe?: Recipe;
  } | null>(null);

  // Режим выбора порций и зажатия карточки
  const [isSelectingCookToday, setIsSelectingCookToday] = useState(false);
  const [preparedSuggestions, setPreparedSuggestions] = useState<Record<string, number>>({});
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [portionsInput, setPortionsInput] = useState<number>(2);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Цель по КБЖУ и подбор рациона
  const [targetCalories, setTargetCalories] = useState<string>('');
  const [targetProtein, setTargetProtein] = useState<string>('');
  const [targetFat, setTargetFat] = useState<string>('');
  const [targetCarbs, setTargetCarbs] = useState<string>('');
  const [showAdvancedMacros, setShowAdvancedMacros] = useState<boolean>(false);
  const [comboIndex, setComboIndex] = useState<number>(0);

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

  const handleCardTouchStart = (sug: SuggestionResult, matchedRecipe: Recipe | undefined, e: React.TouchEvent) => {
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
        setIsSelectingCookToday(true);
      } else {
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

  const handleCardMouseDown = () => {
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

  // Свайп снизу вверх: срабатывает строго от самой нижней границы экрана (последние 85px)
  React.useEffect(() => {
    if (!isSelectingCookToday) return;

    let bottomSwipeStart: { x: number; y: number; time: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
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

  const allInventory = [...(fridge || []), ...(grains || []), ...(spices || [])];

  const suggestionToRecipe = (sug: SuggestionResult, matchedRecipe?: Recipe): Recipe => {
    if (matchedRecipe) return matchedRecipe;
    return {
      id: sug.recipeId || `sug-${sug.name}`,
      name: sug.name,
      category: sug.category || 'Завтрак',
      imageUrl: sug.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      ingredients: sug.ingredients && sug.ingredients.length > 0 
        ? sug.ingredients 
        : (sug.missingIngredients?.length ? sug.missingIngredients : ['По вкусу']),
      instructions: sug.instructions && sug.instructions.length > 0 
        ? sug.instructions 
        : ['Приготовить ингредиенты и подавать к столу.'],
      basePortions: sug.portions || 2,
      portions: sug.portions || 2,
      macros: sug.calories ? { calories: sug.calories, protein: 0, fat: 0, carbs: 0 } : undefined,
      totalWeight: sug.totalWeight
    };
  };

  const handleCardClick = (sug: SuggestionResult, matchedRecipe: Recipe | undefined) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (isSelectingCookToday) {
      const targetRecipe = suggestionToRecipe(sug, matchedRecipe);
      setCookingRecipe(targetRecipe);
      setPortionsInput(targetRecipe.portions || targetRecipe.basePortions || 2);
    } else {
      setSelectedSuggestion({ sug, matchedRecipe });
    }
  };

  const handleToggleAll = () => {
    setSelectedCategories([]);
  };

  const handleToggleCategory = (cat: RecipeCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    const inventoryNames = allInventory.map(f => f.name);

    try {
      // Пытаемся получить через API
      const data = await apiPost('/api/suggest-recipes', {
        fridgeItems: inventoryNames,
        savedRecipes: (recipes || []).map(r => ({ name: r.name, ingredients: r.ingredients, category: r.category })),
        categories: selectedCategories
      });
      
      if (data?.myRecipeSuggestions || data?.availableSuggestions || data?.newSuggestions) {
        // Не ограничиваем количество рецептов в секции «Из моих рецептов»
        const rawAvail = data.myRecipeSuggestions || data.availableSuggestions;
        const avail = Array.isArray(rawAvail) ? rawAvail : [];
        const ideas = Array.isArray(data.newSuggestions) ? data.newSuggestions.slice(0, 6) : [];
        if (avail.length > 0 || ideas.length > 0) {
          setAvailableSuggestions(avail);
          setNewSuggestions(ideas);
          return;
        }
      } else if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        // Если API вернул плоский список
        const all: SuggestionResult[] = data.suggestions;
        const avail = all.filter(s => !s.isNew);
        const availNames = new Set(avail.map(a => a.name.toLowerCase()));
        const ideas = all.filter(s => !availNames.has(s.name.toLowerCase())).slice(0, 6);
        setAvailableSuggestions(avail);
        setNewSuggestions(ideas);
        return;
      }
      
      // Если сервер вернул пустой результат, используем локальный алгоритм
      const localResults = generateLocalSuggestions(inventoryNames, recipes || [], selectedCategories);
      setAvailableSuggestions(localResults.myRecipes || localResults.available || []);
      setNewSuggestions(localResults.newIdeas.slice(0, 6));
    } catch (err: any) {
      // При любой ошибке плавно переключаемся на локальный расчет
      const localResults = generateLocalSuggestions(inventoryNames, recipes || [], selectedCategories);
      const avail = localResults.myRecipes || localResults.available || [];
      if (avail.length > 0 || localResults.newIdeas.length > 0) {
        setAvailableSuggestions(avail);
        setNewSuggestions(localResults.newIdeas.slice(0, 6));
      } else {
        setError('Не удалось подобрать рецепты. Добавьте больше продуктов в холодильник.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreNew = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const inventoryNames = allInventory.map(f => f.name);
    const excludeNames = [
      ...availableSuggestions.map(s => s.name),
      ...newSuggestions.map(s => s.name)
    ];

    try {
      const data = await apiPost('/api/suggest-more-new', {
        fridgeItems: inventoryNames,
        excludeNames,
        categories: selectedCategories
      });

      if (data?.newSuggestions && Array.isArray(data.newSuggestions) && data.newSuggestions.length > 0) {
        setNewSuggestions(prev => [...prev, ...data.newSuggestions]);
        return;
      }

      // Локальный подбор дополнительных рецептов
      const moreLocal = generateMoreLocalSuggestions(inventoryNames, excludeNames, 6, selectedCategories);
      if (moreLocal.length > 0) {
        setNewSuggestions(prev => [...prev, ...moreLocal]);
      }
    } catch {
      const moreLocal = generateMoreLocalSuggestions(inventoryNames, excludeNames, 6, selectedCategories);
      if (moreLocal.length > 0) {
        setNewSuggestions(prev => [...prev, ...moreLocal]);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenCooking = (recipe: Recipe) => {
    setCookingRecipe(recipe);
    setPortionsInput(recipe.portions || recipe.basePortions || 2);
    setSelectedSuggestion(null);
  };

  const handleConfirmCookToday = () => {
    if (!cookingRecipe) return;

    try {
      const portions = Math.max(1, portionsInput);
      const base = cookingRecipe.basePortions || 1;
      const ratio = portions / base;

      const rawIngredients = Array.isArray(cookingRecipe.ingredients) ? cookingRecipe.ingredients : [];
      const scaledIngredients = rawIngredients.map(ing => scaleIngredient(ing, ratio));
      const needed = calculateNeededIngredients(scaledIngredients, allInventory);

      let newShoppingItems: ShoppingItem[] = [];
      if (needed.length > 0) {
        newShoppingItems = needed.map(item => ({
          id: uuidv4(),
          name: item.name,
          quantity: item.quantity,
          checked: false,
          isManual: false
        }));
      } else {
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

      setRecipes(prev => (prev || []).map(r => r.id === cookingRecipe.id ? {
        ...r,
        portions,
        isPrepared: true
      } : r));

      setPreparedSuggestions(prev => ({
        ...prev,
        [cookingRecipe.id]: portions,
        [cookingRecipe.name.toLowerCase().trim()]: portions
      }));

      setToastMessage(`«${cookingRecipe.name}» (${portions} порц.) добавлено в покупки!`);
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Error confirming cooking:', err);
    } finally {
      setCookingRecipe(null);
    }
  };

  const handleSaveNewRecipe = (sug: SuggestionResult) => {
    const newRecipe: Recipe = {
      id: uuidv4(),
      name: sug.name,
      category: sug.category || 'Завтрак',
      imageUrl: sug.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      ingredients: sug.ingredients && sug.ingredients.length > 0 
        ? sug.ingredients 
        : (sug.missingIngredients?.length ? sug.missingIngredients : ['По вкусу']),
      instructions: sug.instructions && sug.instructions.length > 0 
        ? sug.instructions 
        : ['Приготовить ингредиенты и подавать к столу.'],
      basePortions: sug.portions || 2,
      portions: sug.portions || 2,
      macros: sug.calories ? { calories: sug.calories, protein: 0, fat: 0, carbs: 0 } : undefined,
      totalWeight: sug.totalWeight
    };

    setRecipes(prev => [newRecipe, ...(prev || [])]);
    setSelectedSuggestion(null);
    setToastMessage(`«${sug.name}» добавлен в мои рецепты!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const renderRecipeCard = (sug: SuggestionResult, key: string, index: number) => {
    const matchedRecipe = (recipes || []).find(r => 
      (sug.recipeId && r.id === sug.recipeId) ||
      r.name.toLowerCase().trim() === sug.name.toLowerCase().trim()
    );

    const imageUrl = matchedRecipe?.imageUrl || sug.imageUrl;
    const ingredientsCount = matchedRecipe?.ingredients?.length || sug.ingredients?.length || 4;
    const calories = matchedRecipe?.macros?.calories || sug.calories;
    const portions = matchedRecipe?.portions || matchedRecipe?.basePortions || sug.portions || 2;
    const totalWeight = matchedRecipe?.totalWeight || sug.totalWeight;

    const isPrepared = Boolean(
      matchedRecipe?.isPrepared || 
      (sug.recipeId && preparedSuggestions[sug.recipeId]) || 
      preparedSuggestions[sug.name.toLowerCase().trim()]
    );
    const preparedPortions = 
      matchedRecipe?.portions || 
      (sug.recipeId ? preparedSuggestions[sug.recipeId] : undefined) || 
      preparedSuggestions[sug.name.toLowerCase().trim()] || 
      portions;

    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onTouchStart={(e) => handleCardTouchStart(sug, matchedRecipe, e)}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onMouseDown={handleCardMouseDown}
        onMouseMove={handleCardMouseUp}
        onMouseUp={handleCardMouseUp}
        onMouseLeave={handleCardMouseUp}
        className={cn(
          "bg-white rounded-2xl md:rounded-[2rem] shadow-sm overflow-hidden flex flex-col cursor-pointer transition-all hover:shadow-md relative select-none",
          isSelectingCookToday 
            ? cn(
                isPrepared
                  ? "scale-[1.01] bg-emerald-50/30"
                  : "scale-[1.01] bg-stone-50/80",
                index % 2 === 0 ? "animate-ios-jiggle-1" : "animate-ios-jiggle-2"
              )
            : ""
        )}
        onClick={() => handleCardClick(sug, matchedRecipe)}
      >
        {isSelectingCookToday ? (
          isPrepared ? (
            <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
              <Check size={12} /> {preparedPortions} порц.
            </div>
          ) : (
            <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
              + Выбрать
            </div>
          )
        ) : (
          sug.missingIngredients && sug.missingIngredients.length > 0 ? (
            <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-full shadow-xs">
              Не хватает: {sug.missingIngredients.length}
            </div>
          ) : (
            <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              Все продукты
            </div>
          )
        )}

        {imageUrl ? (
          <img src={imageUrl} alt={sug.name} className="w-full h-32 md:h-48 object-cover" />
        ) : (
          <div className="w-full h-32 md:h-48 bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
            Нет фото
          </div>
        )}

        <div className="p-3 md:p-6 flex flex-col items-start justify-between flex-grow">
          <div className="w-full">
            <h3 className="font-bold text-base md:text-xl text-stone-800 leading-tight line-clamp-2">
              {sug.name}
            </h3>
            <p className="text-xs md:text-sm text-stone-500 mt-1">
              {ingredientsCount} ингр. {calories && calories > 0 ? `• ${calories} ккал` : ''}
            </p>
            <p className="text-xs font-bold text-emerald-600 mt-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              <span>
                {portions} порций {totalWeight ? ` • ~${totalWeight} г` : ''}
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  const displayedAvailable = selectedCategories.length > 0
    ? availableSuggestions.filter(s => !s.category || selectedCategories.includes(s.category as RecipeCategory))
    : availableSuggestions;

  const displayedNew = selectedCategories.length > 0
    ? newSuggestions.filter(s => !s.category || selectedCategories.includes(s.category as RecipeCategory))
    : newSuggestions;

  const hasAnySuggestions = displayedAvailable.length > 0 || displayedNew.length > 0;

  return (
    <div 
      className="flex flex-col gap-5 pb-8 px-2"
      onTouchStart={handleContainerTouchStart}
      onTouchMove={handleContainerTouchMove}
      onTouchEnd={handleContainerTouchEnd}
    >
      <div className="bg-emerald-900 rounded-[2rem] p-8 flex flex-col items-center text-center gap-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-emerald-800 rounded-full blur-3xl opacity-50"></div>
        <Sparkles className="text-emerald-100 z-10" size={40} />
        <p className="text-lg font-semibold z-10">Узнайте, что можно приготовить из продуктов в вашем холодильнике</p>
        <button 
          id="btn-get-suggestions"
          onClick={getSuggestions}
          disabled={loading || allInventory.length === 0}
          className="w-full bg-white text-emerald-900 rounded-2xl py-4 font-bold mt-2 disabled:opacity-50 shadow-xl z-10 hover:bg-emerald-50 transition-colors active:scale-[0.99] cursor-pointer"
        >
          {loading ? 'Анализируем...' : 'Подобрать рецепты'}
        </button>
        {allInventory.length === 0 && <p className="text-xs text-emerald-200/70 mt-1 z-10">Сначала добавьте продукты в холодильник или кладовую</p>}
      </div>

      {/* Категории блюд */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-0.5 select-none">
        <button
          type="button"
          onClick={handleToggleAll}
          className={cn(
            "px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs",
            selectedCategories.length === 0
              ? "bg-stone-900 text-white"
              : "bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          )}
        >
          Все
        </button>
        {RECIPE_CATEGORIES.map(cat => {
          const isSelected = selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleToggleCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs",
                isSelected
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {error && <div className="text-stone-700 bg-stone-100 p-4 rounded-2xl text-sm shadow-xs">{error}</div>}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-emerald-600" size={40} />
        </div>
      )}

      {!loading && hasAnySuggestions && (
        <div className="flex flex-col gap-6">
          {/* Секция 1: Из моих рецептов */}
          {displayedAvailable.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-lg md:text-xl text-stone-800">Из моих рецептов</h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full uppercase tracking-wider">
                  {displayedAvailable.length} вариантов
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-6">
                {displayedAvailable.map((sug, index) =>
                  renderRecipeCard(sug, sug.recipeId ? `avail-${sug.recipeId}` : `avail-${sug.name}-${index}`, index)
                )}
              </div>
            </div>
          )}

          {/* Секция 2: Что-то новенькое */}
          {displayedNew.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-lg md:text-xl text-stone-800">Что-то новенькое</h3>
                <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  {displayedNew.length} вариантов
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-6">
                {displayedNew.map((sug, index) =>
                  renderRecipeCard(sug, sug.recipeId ? `new-${sug.recipeId}` : `new-${sug.name}-${index}`, displayedAvailable.length + index)
                )}
              </div>
              <button
                onClick={handleLoadMoreNew}
                disabled={loadingMore}
                className="w-full py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-xs cursor-pointer active:scale-98 disabled:opacity-50 mt-1"
              >
                {loadingMore ? (
                  <Loader2 size={18} className="animate-spin text-stone-600" />
                ) : (
                  <span>Ещё</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Кнопка завершения режима выбора порций */}
      <AnimatePresence>
        {isSelectingCookToday && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65]"
          >
            <button
              type="button"
              onClick={() => setIsSelectingCookToday(false)}
              className="bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check size={14} className="text-emerald-400" />
              <span>Завершить выбор</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно просмотра выбранного рецепта */}
      <AnimatePresence>
        {selectedSuggestion && (
          <div 
            className="fixed inset-0 bg-stone-900/50 z-[60] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4"
            onClick={() => setSelectedSuggestion(null)}
          >
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Верхняя панель поверх фото */}
              <div className="absolute top-4 inset-x-4 z-10 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto">
                  <span className="bg-black/40 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md">
                    {selectedSuggestion.matchedRecipe?.category || selectedSuggestion.sug.category || (selectedSuggestion.sug.isNew ? 'Идея' : 'Рецепт')}
                  </span>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button 
                    onClick={() => setSelectedSuggestion(null)} 
                    className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-md transition-colors shadow-md cursor-pointer"
                    title="Закрыть"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto no-scrollbar flex-1">
                {/* Фото */}
                {selectedSuggestion.matchedRecipe?.imageUrl || selectedSuggestion.sug.imageUrl ? (
                  <img 
                    src={selectedSuggestion.matchedRecipe?.imageUrl || selectedSuggestion.sug.imageUrl} 
                    alt={selectedSuggestion.sug.name} 
                    className="w-full h-64 object-cover" 
                  />
                ) : (
                  <div className="w-full h-48 bg-stone-100 flex items-center justify-center text-stone-400">
                    Нет фото
                  </div>
                )}

                <div className="p-6 flex flex-col gap-6">
                  <div>
                    <h2 className="font-bold text-2xl text-stone-800 leading-tight">
                      {selectedSuggestion.sug.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm font-bold text-emerald-600">
                        {selectedSuggestion.matchedRecipe?.portions || selectedSuggestion.matchedRecipe?.basePortions || selectedSuggestion.sug.portions || 2} порций
                        {(selectedSuggestion.matchedRecipe?.totalWeight || selectedSuggestion.sug.totalWeight) ? ` • ~${selectedSuggestion.matchedRecipe?.totalWeight || selectedSuggestion.sug.totalWeight} г` : ''}
                        {(selectedSuggestion.matchedRecipe?.macros?.calories || selectedSuggestion.sug.calories) ? ` • ${selectedSuggestion.matchedRecipe?.macros?.calories || selectedSuggestion.sug.calories} ккал` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Статус наличия ингредиентов */}
                  {selectedSuggestion.sug.missingIngredients && selectedSuggestion.sug.missingIngredients.length > 0 ? (
                    <div className="bg-stone-50 p-4 rounded-2xl flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-stone-500">Не хватает:</span>
                      <p className="text-sm font-medium text-stone-800">
                        {selectedSuggestion.sug.missingIngredients.join(', ')}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/70 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                      <span>Все ингредиенты в наличии</span>
                    </div>
                  )}

                  {/* Ингредиенты */}
                  <div>
                    <h3 className="font-bold text-lg text-stone-800 mb-3">Ингредиенты</h3>
                    <div className="flex flex-col gap-2">
                      {(selectedSuggestion.matchedRecipe?.ingredients || selectedSuggestion.sug.ingredients || selectedSuggestion.sug.missingIngredients || []).map((ing, idx) => {
                        const isMissing = selectedSuggestion.sug.missingIngredients?.some(m => 
                          ing.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(ing.toLowerCase())
                        );
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 text-sm">
                            <span className="text-stone-800 font-medium">{ing}</span>
                            {isMissing ? (
                              <span className="text-xs text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md font-semibold">Купить</span>
                            ) : (
                              <span className="text-xs text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md font-semibold">Есть</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Инструкции приготовления */}
                  {((selectedSuggestion.matchedRecipe?.instructions && selectedSuggestion.matchedRecipe.instructions.length > 0) || 
                    (selectedSuggestion.sug.instructions && selectedSuggestion.sug.instructions.length > 0)) && (
                    <div>
                      <h3 className="font-bold text-lg text-stone-800 mb-3">Приготовление</h3>
                      <div className="flex flex-col gap-3">
                        {(selectedSuggestion.matchedRecipe?.instructions || selectedSuggestion.sug.instructions || []).map((step, idx) => (
                          <div key={idx} className="flex gap-3 text-sm leading-relaxed text-stone-700">
                            <span className="font-bold text-emerald-600 shrink-0">{idx + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Нижняя панель действий */}
              <div className="p-4 pb-8 sm:pb-4 bg-white shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button 
                    onClick={() => {
                      const targetRec = selectedSuggestion.matchedRecipe || suggestionToRecipe(selectedSuggestion.sug);
                      setCookingRecipe(targetRec);
                      setPortionsInput(targetRec.portions || targetRec.basePortions || 2);
                      setSelectedSuggestion(null);
                    }}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer active:scale-98"
                  >
                    <ChefHat size={18} />
                    <span>Готовлю сегодня</span>
                  </button>

                  {selectedSuggestion.matchedRecipe ? (
                    <button 
                      onClick={() => {
                        setToastMessage(`«${selectedSuggestion.sug.name}» уже есть в ваших рецептах!`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      className="py-3.5 px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-2xs cursor-pointer active:scale-98"
                    >
                      <Check size={18} className="text-emerald-600" />
                      <span>В моих рецептах</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSaveNewRecipe(selectedSuggestion.sug)}
                      className="py-3.5 px-5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-2xs cursor-pointer active:scale-98"
                    >
                      <Plus size={18} />
                      <span>Добавить в мои рецепты</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно выбора порций «Готовлю сегодня» */}
      <AnimatePresence>
        {cookingRecipe && (
          <div className="fixed inset-0 bg-stone-900/50 z-[70] flex items-center justify-center p-4" onClick={() => setCookingRecipe(null)}>
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
                  onClick={() => setCookingRecipe(null)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-xl font-bold text-stone-900 mb-1">Сколько порций?</h3>
              <p className="text-sm text-stone-500 mb-5 line-clamp-1">{cookingRecipe.name}</p>

              <div className="flex items-center justify-center gap-4 bg-stone-50 p-4 rounded-2xl mb-4">
                <button 
                  onClick={() => setPortionsInput(p => Math.max(1, p - 1))}
                  disabled={portionsInput <= 1}
                  className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-sm disabled:opacity-30 active:scale-95 transition-all text-xl font-bold cursor-pointer"
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
                  className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition-all text-xl font-bold cursor-pointer"
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

              <div className="flex gap-2">
                <button 
                  onClick={() => setCookingRecipe(null)}
                  className="flex-1 py-3 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-sm cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleConfirmCookToday();
                  }}
                  className="flex-1 py-3 text-white font-medium bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={18} /> Окей
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Всплывающее уведомление */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[70] bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShoppingCart size={16} />
              </div>
              <p className="text-xs font-medium text-stone-200 truncate">{toastMessage}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => {
                  setIsSelectingCookToday(false);
                  navigate('/shopping');
                }}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg bg-white/10 shrink-0 whitespace-nowrap cursor-pointer"
              >
                В покупки →
              </button>
              <button 
                onClick={() => setToastMessage(null)}
                className="text-stone-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
