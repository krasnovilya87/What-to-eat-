import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppState } from '../useAppState';
import { Recipe, PlannedMeal, MealSlotId, DEFAULT_MEAL_SLOTS, NutritionGoal } from '../types';
import { 
  getTodayDateStr, 
  getWeekDates, 
  getAdjacentWeek, 
  formatShortDay, 
  formatFullDay, 
  formatWeekRange,
  calculateDailyMacros,
  calculateWeeklyMacros
} from '../utils/calendarHelpers';
import RecipePickerModal from './RecipePickerModal';
import MacroGoalModal from './MacroGoalModal';
import DayDetailModal from './DayDetailModal';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  ChefHat
} from 'lucide-react';

type ZoomLevel = 1 | 2 | 3 | 4;

const ZOOM_CONFIG: Record<ZoomLevel, {
  label: string;
  minColWidth: string;
  cardPadding: string;
  titleSize: string;
  macroSize: string;
  showPhoto: boolean;
  showSlotBadge: boolean;
  showPortions: boolean;
}> = {
  1: {
    label: 'Компактный',
    minColWidth: 'flex-1 min-w-0',
    cardPadding: 'p-1',
    titleSize: 'text-[9.5px] leading-tight line-clamp-2',
    macroSize: 'text-[8.5px]',
    showPhoto: false,
    showSlotBadge: false,
    showPortions: false
  },
  2: {
    label: 'Обычный',
    minColWidth: 'min-w-[80px] flex-1',
    cardPadding: 'p-1.5',
    titleSize: 'text-[10.5px] leading-tight line-clamp-2',
    macroSize: 'text-[9.5px]',
    showPhoto: false,
    showSlotBadge: true,
    showPortions: false
  },
  3: {
    label: 'Крупный',
    minColWidth: 'min-w-[130px] flex-1',
    cardPadding: 'p-1.5',
    titleSize: 'text-xs font-bold leading-tight line-clamp-2',
    macroSize: 'text-[10.5px]',
    showPhoto: true,
    showSlotBadge: true,
    showPortions: true
  },
  4: {
    label: 'Детальный',
    minColWidth: 'min-w-[190px] flex-1',
    cardPadding: 'p-2',
    titleSize: 'text-sm font-bold leading-tight line-clamp-2',
    macroSize: 'text-xs',
    showPhoto: true,
    showSlotBadge: true,
    showPortions: true
  }
};

const SLOT_SHORT_NAMES: Record<MealSlotId, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  afternoon_snack: 'Полдник',
  dinner: 'Ужин',
  snack: 'Перекус'
};

export default function CalendarView({ state }: { state: ReturnType<typeof useAppState> }) {
  const { 
    recipes, 
    plannedMeals, 
    nutritionGoal, 
    setNutritionGoal,
    addPlannedMeal, 
    removePlannedMeal, 
    updatePlannedMealPortions,
    applyDayPlan
  } = state;

  const today = useMemo(() => getTodayDateStr(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);

  // Modals
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSlotId, setPickerSlotId] = useState<MealSlotId>('breakfast');
  const [pickerDate, setPickerDate] = useState<string>(today);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const lastZoomTimeRef = useRef<number>(0);

  // Two-finger pinch-to-zoom gesture
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistanceRef.current !== null) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const diff = currentDist - touchDistanceRef.current;
        const now = Date.now();

        if (Math.abs(diff) > 28 && now - lastZoomTimeRef.current > 160) {
          if (diff > 0) {
            setZoomLevel(prev => (Math.min(4, prev + 1) as ZoomLevel));
          } else {
            setZoomLevel(prev => (Math.max(1, prev - 1) as ZoomLevel));
          }
          touchDistanceRef.current = currentDist;
          lastZoomTimeRef.current = now;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchDistanceRef.current = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastZoomTimeRef.current > 140) {
          if (e.deltaY < 0) {
            setZoomLevel(prev => (Math.min(4, prev + 1) as ZoomLevel));
          } else if (e.deltaY > 0) {
            setZoomLevel(prev => (Math.max(1, prev - 1) as ZoomLevel));
          }
          lastZoomTimeRef.current = now;
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Week dates for current selected date
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    return calculateWeeklyMacros(plannedMeals, weekDates);
  }, [plannedMeals, weekDates]);

  // Week navigation
  const handlePrevWeek = () => {
    setSelectedDate(prev => getAdjacentWeek(prev, 'prev'));
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => getAdjacentWeek(prev, 'next'));
  };

  const handleJumpToToday = () => {
    setSelectedDate(today);
  };

  // Open day detailed view
  const handleOpenDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsDayModalOpen(true);
  };

  // Open recipe picker for specific day and slot
  const handleOpenRecipePicker = (dateStr: string, slotId: MealSlotId = 'breakfast') => {
    setPickerDate(dateStr);
    setPickerSlotId(slotId);
    setIsPickerOpen(true);
  };

  // Add chosen recipe to meal plan
  const handleSelectRecipe = (recipe: Recipe, portions: number) => {
    const baseMacros = recipe.macros || { protein: 12, fat: 8, carbs: 20, calories: 200 };
    const factor = portions || 1;
    const macros = {
      protein: Math.round(baseMacros.protein * factor * 10) / 10,
      fat: Math.round(baseMacros.fat * factor * 10) / 10,
      carbs: Math.round(baseMacros.carbs * factor * 10) / 10,
      calories: Math.round(baseMacros.calories * factor)
    };

    addPlannedMeal({
      date: pickerDate,
      slotId: pickerSlotId,
      recipeId: recipe.id,
      recipeName: recipe.name,
      category: recipe.category,
      imageUrl: recipe.imageUrl,
      portions,
      macros
    });

    const slotName = DEFAULT_MEAL_SLOTS.find(s => s.id === pickerSlotId)?.name || '';
    showToast(`Добавлено в ${slotName.toLowerCase()}`);
  };

  // Meals for currently selected day (for DayDetailModal)
  const selectedDayMeals = useMemo(() => {
    return plannedMeals.filter(m => m.date === selectedDate);
  }, [plannedMeals, selectedDate]);

  const zoomConfig = ZOOM_CONFIG[zoomLevel];

  return (
    <div className="w-full max-w-5xl mx-auto px-1 sm:px-2 pt-1 pb-16 space-y-1 sm:space-y-1.5">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* iOS-Style Top Bar: Week Navigation + Scale Controls */}
      <div className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-xs space-y-1.5">
        
        <div className="flex items-center justify-between gap-1.5">
          {/* Week switcher */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs sm:text-sm font-bold text-stone-900 px-0.5 whitespace-nowrap">
              {formatWeekRange(weekDates)}
            </span>

            <button
              type="button"
              onClick={handleNextWeek}
              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>

            {selectedDate !== today && (
              <button
                type="button"
                onClick={handleJumpToToday}
                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                Сегодня
              </button>
            )}
          </div>

          {/* Action buttons: Match KBJU */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Подобрать по КБЖУ</span>
              <span className="sm:hidden">Подбор</span>
            </button>
          </div>
        </div>

        {/* Weekly Summary bar */}
        <div className="flex items-center justify-between bg-stone-50 px-2.5 py-1 rounded-xl text-[10px] text-stone-600 shadow-2xs">
          <span>
            Итого за неделю: <strong className="text-stone-900 font-black">{weeklyStats.total.calories} ккал</strong>
          </span>
          <span className="font-semibold text-stone-700">
            {weeklyStats.total.protein}.{weeklyStats.total.fat}.{weeklyStats.total.carbs}
          </span>
        </div>

      </div>

      {/* 7 Columns iOS Calendar Grid */}
      <div 
        ref={gridContainerRef}
        className="bg-white rounded-2xl shadow-xs overflow-hidden select-none touch-pan-y"
      >
        
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto no-scrollbar"
        >
          <div className="flex divide-x divide-stone-200 min-w-full">
            {weekDates.map(dateStr => {
              const { dayOfWeek, dayNum, isToday } = formatShortDay(dateStr);
              const dayMeals = plannedMeals.filter(m => m.date === dateStr);
              const dayMacros = calculateDailyMacros(dayMeals);
              const isSelected = dateStr === selectedDate;

              return (
                <div
                  key={dateStr}
                  className={`flex flex-col transition-all ${zoomConfig.minColWidth} ${
                    isSelected ? 'bg-stone-100/70' : 'bg-transparent'
                  }`}
                >
                  
                  {/* Column Header: Day, Date, and Day Total Macros (in 2 neat rows, regardless of scale) */}
                  <div
                    onClick={() => handleOpenDay(dateStr)}
                    className="p-1 flex flex-col items-center justify-center text-center cursor-pointer select-none hover:bg-stone-100/80 transition-colors border-b border-stone-200/80"
                  >
                    {/* Day of Week */}
                    <span className="text-[9px] sm:text-[10px] font-bold text-stone-500 uppercase leading-none">
                      {dayOfWeek}
                    </span>

                    {/* Day Number Circle */}
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center my-0.5 font-bold text-xs transition-transform active:scale-90 ${
                      isToday 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : isSelected 
                        ? 'bg-stone-900 text-white' 
                        : 'text-stone-900'
                    }`}>
                      {dayNum}
                    </div>

                    {/* Subtotal Macros in 2 rows under each date: Calories, then P.F.C */}
                    <div className="w-full pt-0.5 leading-none">
                      {/* Row 1: Calories */}
                      <div className="text-[10px] sm:text-[11px] font-black text-stone-900 tracking-tight">
                        {dayMacros.calories}
                      </div>

                      {/* Row 2: Б.Ж.У numbers separated by dots */}
                      <div className="text-[8.5px] sm:text-[9.5px] font-semibold text-stone-500 tracking-tight mt-0.5">
                        {dayMacros.protein}.{dayMacros.fat}.{dayMacros.carbs}
                      </div>
                    </div>
                  </div>

                  {/* Column Body: Dishes for this day */}
                  <div className="flex-1 p-0.5 sm:p-1 space-y-1 min-h-[220px]">
                    {dayMeals.length === 0 ? (
                      <div 
                        onClick={() => handleOpenDay(dateStr)}
                        className="h-20 flex flex-col items-center justify-center opacity-25 hover:opacity-60 transition-opacity cursor-pointer text-stone-400"
                      >
                        <span className="text-[9px] font-medium text-center leading-none">
                          —
                        </span>
                      </div>
                    ) : (
                      dayMeals.map(meal => {
                        const mMacros = meal.macros || { calories: 0, protein: 0, fat: 0, carbs: 0 };
                        const slotName = SLOT_SHORT_NAMES[meal.slotId] || 'Блюдо';

                        return (
                          <div
                            key={meal.id}
                            onClick={() => handleOpenDay(dateStr)}
                            className={`bg-stone-50 hover:bg-stone-100/90 rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer ${zoomConfig.cardPadding}`}
                          >
                            {/* Detailed / Large Zoom: show food photo thumbnail */}
                            {zoomConfig.showPhoto && (
                              <div className="w-full h-12 sm:h-16 mb-1 rounded-md overflow-hidden bg-stone-200 flex items-center justify-center">
                                {meal.imageUrl ? (
                                  <img
                                    src={meal.imageUrl}
                                    alt={meal.recipeName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ChefHat size={16} className="text-stone-400" />
                                )}
                              </div>
                            )}

                            {/* Slot Badge if zoom >= 2 */}
                            {zoomConfig.showSlotBadge && (
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8.5px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded">
                                  {slotName}
                                </span>
                                {zoomConfig.showPortions && meal.portions && meal.portions !== 1 && (
                                  <span className="text-[8.5px] font-medium text-stone-400">
                                    x{meal.portions}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Dish Name */}
                            <div className={`${zoomConfig.titleSize} text-stone-900 font-semibold break-words`}>
                              {meal.recipeName}
                            </div>

                            {/* Calories & Macros (P.F.C separated by dots) */}
                            <div className={`${zoomConfig.macroSize} text-stone-500 font-medium mt-0.5 leading-tight`}>
                              <span className="font-bold text-stone-800">{mMacros.calories}</span>
                              <span className="mx-0.5 opacity-50">•</span>
                              <span>{mMacros.protein}.{mMacros.fat}.{mMacros.carbs}</span>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Quick Add Button inside column */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRecipePicker(dateStr, 'breakfast');
                      }}
                      className="w-full py-1 bg-stone-100/60 hover:bg-stone-200 active:scale-95 text-stone-600 rounded-lg text-[9px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-2xs mt-0.5"
                    >
                      <Plus size={11} />
                      <span className={zoomLevel === 1 ? 'hidden' : 'inline'}>Добавить</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Detailed Day Modal (Opened upon clicking any day) */}
      <DayDetailModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        dateStr={selectedDate}
        meals={selectedDayMeals}
        nutritionGoal={nutritionGoal}
        onOpenGoalModal={() => {
          setIsDayModalOpen(false);
          setIsGoalModalOpen(true);
        }}
        onOpenRecipePicker={(slotId) => {
          handleOpenRecipePicker(selectedDate, slotId);
        }}
        onUpdatePortions={(mealId, portions) => {
          updatePlannedMealPortions(mealId, portions);
        }}
        onRemoveMeal={(mealId) => {
          removePlannedMeal(mealId);
        }}
      />

      {/* Recipe Picker Modal */}
      <RecipePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        recipes={recipes}
        slotId={pickerSlotId}
        dateStr={pickerDate}
        onSelectRecipe={handleSelectRecipe}
      />

      {/* Smart KBJU Matcher Modal */}
      <MacroGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        recipes={recipes}
        dateStr={selectedDate}
        currentGoal={nutritionGoal}
        onSaveGoal={goal => {
          setNutritionGoal(goal);
          showToast('Цель по КБЖУ сохранена');
        }}
        onApplyPlan={(d, meals) => {
          applyDayPlan(d, meals);
          showToast('Рацион применен в календарь');
        }}
      />

    </div>
  );
}
