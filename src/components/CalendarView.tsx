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
  Minus,
  Sparkles, 
  ChefHat
} from 'lucide-react';

export interface MealSlotRowConfig {
  id: MealSlotId;
  name: string;
}

export interface MealDragState {
  meal: PlannedMeal;
  sourceDate: string;
  sourceSlotId: MealSlotId;
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  cardWidth: number;
  cardHeight: number;
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
}

export const CALENDAR_MEAL_SLOTS: MealSlotRowConfig[] = [
  { id: 'breakfast', name: 'Завтрак' },
  { id: 'lunch', name: 'Обед' },
  { id: 'dinner', name: 'Ужин' },
  { id: 'snack', name: 'Перекус' }
];

export function getColWidthClass(days: number): string {
  switch (days) {
    case 7:
      return 'w-[calc(100%/7)] min-w-0 flex-1';
    case 6:
      return 'min-w-[calc(100%/6)] w-[calc(100%/6)] shrink-0';
    case 5:
      return 'min-w-[calc(100%/5)] w-[calc(100%/5)] shrink-0';
    case 4:
      return 'min-w-[calc(100%/4)] w-[calc(100%/4)] shrink-0';
    case 3:
      return 'min-w-[calc(100%/3)] w-[calc(100%/3)] shrink-0';
    case 2:
      return 'min-w-[calc(100%/2)] w-[calc(100%/2)] shrink-0';
    case 1:
      return 'min-w-full w-full shrink-0';
    default:
      return 'w-[calc(100%/7)] min-w-0 flex-1';
  }
}

export default function CalendarView({ state }: { state: ReturnType<typeof useAppState> }) {
  const { 
    recipes, 
    plannedMeals, 
    nutritionGoal, 
    setNutritionGoal,
    addPlannedMeal, 
    removePlannedMeal, 
    updatePlannedMealPortions,
    movePlannedMeal,
    applyDayPlan
  } = state;

  const today = useMemo(() => getTodayDateStr(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [visibleDays, setVisibleDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('culinara_cal_visible_days');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 1 && val <= 7) return val;
      }
    } catch {}
    return 7; // default: full 7 days visible (smallest zoom)
  });

  // Track window height so at smallest zoom (7 days) the calendar goes all the way to the bottom of the page
  const [viewportHeight, setViewportHeight] = useState<number>(() => 
    typeof window !== 'undefined' ? window.innerHeight : 720
  );

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Save visibleDays setting
  useEffect(() => {
    try {
      localStorage.setItem('culinara_cal_visible_days', String(visibleDays));
    } catch {}
  }, [visibleDays]);

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
  const gestureHandledRef = useRef(false);
  const lastZoomTimeRef = useRef<number>(0);

  // Drag & drop state for moving meals across days & slots
  const [dragState, setDragState] = useState<MealDragState | null>(null);
  const [hoveredDropTarget, setHoveredDropTarget] = useState<{ date: string; slotId: MealSlotId } | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartInfoRef = useRef<{
    meal: PlannedMeal;
    sourceDate: string;
    sourceSlotId: MealSlotId;
    pointerId: number;
    startX: number;
    startY: number;
    cardRect: DOMRect;
  } | null>(null);
  const wasJustDraggedRef = useRef(false);

  // Dynamic calendar vertical expansion state
  const [customBodyMinHeight, setCustomBodyMinHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('culinara_cal_height');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 180 && val <= 850) return val;
      }
    } catch {
      // ignore
    }
    return 280;
  });

  const isResizingRef = useRef(false);
  const startDragYRef = useRef(0);
  const startHeightRef = useRef(280);
  const latestHeightRef = useRef(customBodyMinHeight);

  // Global pointer listeners for dragging bottom edge
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = e.clientY - startDragYRef.current;
      const newHeight = Math.round(Math.max(180, Math.min(850, startHeightRef.current + deltaY)));
      latestHeightRef.current = newHeight;
      setCustomBodyMinHeight(newHeight);
    };

    const handleGlobalPointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        try {
          localStorage.setItem('culinara_cal_height', String(latestHeightRef.current));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizingRef.current = true;
    startDragYRef.current = e.clientY;
    startHeightRef.current = customBodyMinHeight;
    latestHeightRef.current = customBodyMinHeight;
  };

  // Two-finger pinch-to-zoom gesture: exactly 1 day per finger movement!
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        gestureHandledRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchDistanceRef.current !== null && !gestureHandledRef.current) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const diff = currentDist - touchDistanceRef.current;

        // One deliberate gesture = exactly one day step!
        if (Math.abs(diff) > 22) {
          if (diff > 0) {
            // Spreading fingers apart -> zoom in -> 1 less day visible on screen
            setVisibleDays(prev => Math.max(1, prev - 1));
          } else {
            // Pinching fingers together -> zoom out -> 1 more day visible on screen
            setVisibleDays(prev => Math.min(7, prev + 1));
          }
          gestureHandledRef.current = true; // wait for next touch gesture
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchDistanceRef.current = null;
        gestureHandledRef.current = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastZoomTimeRef.current > 180) {
          if (e.deltaY < 0) {
            // zoom in -> 1 less day
            setVisibleDays(prev => Math.max(1, prev - 1));
          } else if (e.deltaY > 0) {
            // zoom out -> 1 more day
            setVisibleDays(prev => Math.min(7, prev + 1));
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

  // Global pointer listeners for Meal Drag & Drop
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerStartInfoRef.current) return;
      if (e.pointerId !== pointerStartInfoRef.current.pointerId) return;

      const dx = e.clientX - pointerStartInfoRef.current.startX;
      const dy = e.clientY - pointerStartInfoRef.current.startY;
      const dist = Math.hypot(dx, dy);

      // If moved > 8px before timer fired, cancel timer (user is swiping/scrolling)
      if (!dragState?.isDragging) {
        if (dist > 8 && holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        return;
      }

      // Dragging is active! Prevent default scrolling and update coordinates
      e.preventDefault();
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);

      // Auto-scroll calendar horizontally if near edge
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        if (e.clientX < rect.left + 35) {
          scrollContainerRef.current.scrollLeft -= 5;
        } else if (e.clientX > rect.right - 35) {
          scrollContainerRef.current.scrollLeft += 5;
        }
      }

      // Determine drop target under finger
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let foundTarget: { date: string; slotId: MealSlotId } | null = null;

      for (const el of elements) {
        const dropDate = el.getAttribute('data-drop-date');
        const dropSlot = el.getAttribute('data-drop-slot') as MealSlotId;
        if (dropDate && dropSlot) {
          foundTarget = { date: dropDate, slotId: dropSlot };
          break;
        }
      }

      setHoveredDropTarget(foundTarget);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (dragState?.isDragging) {
        wasJustDraggedRef.current = true;
        setTimeout(() => { wasJustDraggedRef.current = false; }, 160);

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetDate: string | null = null;
        let targetSlot: MealSlotId | null = null;

        for (const el of elements) {
          const d = el.getAttribute('data-drop-date');
          const s = el.getAttribute('data-drop-slot') as MealSlotId;
          if (d && s) {
            targetDate = d;
            targetSlot = s;
            break;
          }
        }

        if (targetDate && targetSlot) {
          if (targetDate !== dragState.sourceDate || targetSlot !== dragState.sourceSlotId) {
            movePlannedMeal(dragState.meal.id, targetDate, targetSlot);
            try {
              if (navigator.vibrate) navigator.vibrate(35);
            } catch {}
            const { dayOfWeek, dayNum } = formatShortDay(targetDate);
            const slotTitle = CALENDAR_MEAL_SLOTS.find(s => s.id === targetSlot)?.name || 'приём';
            showToast(`«${dragState.meal.recipeName}» перенесено на ${dayOfWeek} (${dayNum}), ${slotTitle.toLowerCase()}`);
          }
        }
      }

      setDragState(null);
      setHoveredDropTarget(null);
      pointerStartInfoRef.current = null;
    };

    const onPointerCancel = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setDragState(null);
      setHoveredDropTarget(null);
      pointerStartInfoRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [dragState, movePlannedMeal]);

  const handleMealPointerDown = (
    e: React.PointerEvent<HTMLDivElement>, 
    meal: PlannedMeal, 
    sourceDate: string, 
    sourceSlotId: MealSlotId
  ) => {
    if (e.button !== 0) return;

    const cardRect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;

    pointerStartInfoRef.current = {
      meal,
      sourceDate,
      sourceSlotId,
      pointerId,
      startX,
      startY,
      cardRect
    };

    holdTimerRef.current = setTimeout(() => {
      try {
        if (navigator.vibrate) navigator.vibrate(35);
      } catch {}

      setDragState({
        meal,
        sourceDate,
        sourceSlotId,
        pointerId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        offsetX: startX - cardRect.left,
        offsetY: startY - cardRect.top,
        isDragging: true
      });
    }, 170);
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

  const colWidthClass = getColWidthClass(visibleDays);
  const showPhoto = visibleDays <= 5;
  const titleClass = visibleDays <= 2 
    ? 'text-xs font-bold leading-tight' 
    : visibleDays <= 4 
    ? 'text-[10px] font-semibold leading-tight' 
    : 'text-[9px] font-semibold leading-tight';
  const macroClass = visibleDays <= 3 ? 'text-[9px]' : 'text-[8px]';

  // At small zoom (7 days), calendar extends down to the end of the page
  const effectiveMinHeight = visibleDays === 7 
    ? Math.max(customBodyMinHeight, viewportHeight - 275, 480) 
    : customBodyMinHeight;

  return (
    <div className="w-full max-w-5xl mx-auto px-1 sm:px-2 pt-1 pb-16 space-y-1 sm:space-y-1.5 min-h-[calc(100dvh-80px)] flex flex-col">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Floating Drag Preview for dragged meal */}
      {dragState?.isDragging && (
        <div
          className="fixed pointer-events-none z-50 shadow-2xl rounded-xl bg-white p-2 border-none ring-2 ring-emerald-500/50"
          style={{
            width: `${Math.max(120, Math.min(220, dragState.cardWidth))}px`,
            left: `${dragState.currentX - dragState.offsetX}px`,
            top: `${dragState.currentY - dragState.offsetY - 8}px`,
            transform: 'scale(1.05) rotate(2deg)',
            opacity: 0.95
          }}
        >
          {showPhoto && dragState.meal.imageUrl && (
            <div className="w-full h-11 mb-1 rounded-md overflow-hidden bg-stone-200">
              <img src={dragState.meal.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="text-[10px] font-bold text-stone-900 leading-tight line-clamp-2">
            {dragState.meal.recipeName}
          </div>
          <div className="text-[8.5px] font-medium text-stone-500 mt-0.5">
            <span className="font-bold text-stone-800">{dragState.meal.macros.calories} ккал</span>
            <span className="mx-0.5 opacity-50">•</span>
            <span>{dragState.meal.macros.protein}.{dragState.meal.macros.fat}.{dragState.meal.macros.carbs}</span>
          </div>
        </div>
      )}

      {/* iOS-Style Top Bar: Week Navigation + Day-Step Zoom Controls */}
      <div className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-xs space-y-1.5">
        
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
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

          {/* Controls: Zoom Step (1 day per step) + Match KBJU */}
          <div className="flex items-center gap-1.5">
            {/* Day Zoom Stepper (1 day step) */}
            <div className="flex items-center bg-stone-100/90 rounded-xl p-0.5 gap-0.5 text-stone-700">
              <button
                type="button"
                onClick={() => setVisibleDays(prev => Math.max(1, prev - 1))}
                disabled={visibleDays <= 1}
                className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200/70 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center transition-colors cursor-pointer text-stone-700 shadow-2xs"
                title="Увеличить (меньше дней)"
              >
                <Minus size={11} strokeWidth={2.5} />
              </button>
              <span className="text-[10px] font-bold px-1.5 whitespace-nowrap text-stone-800">
                {visibleDays} {visibleDays === 1 ? 'день' : visibleDays < 5 ? 'дня' : 'дней'}
              </span>
              <button
                type="button"
                onClick={() => setVisibleDays(prev => Math.min(7, prev + 1))}
                disabled={visibleDays >= 7}
                className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200/70 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center transition-colors cursor-pointer text-stone-700 shadow-2xs"
                title="Уменьшить (больше дней)"
              >
                <Plus size={11} strokeWidth={2.5} />
              </button>
            </div>

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
        className="bg-white rounded-2xl shadow-xs overflow-hidden select-none touch-pan-y flex-1 flex flex-col relative"
      >
        
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto no-scrollbar flex-1 flex flex-col relative"
        >
          <div className="flex divide-x divide-stone-200 min-w-full flex-1">
            {weekDates.map(dateStr => {
              const { dayOfWeek, dayNum, isToday } = formatShortDay(dateStr);
              const dayMeals = plannedMeals.filter(m => m.date === dateStr);
              const dayMacros = calculateDailyMacros(dayMeals);
              const isSelected = dateStr === selectedDate;
              const isMonday = dateStr === weekDates[0];

              return (
                <div
                  key={dateStr}
                  className={`flex flex-col transition-all ${colWidthClass} ${
                    isSelected ? 'bg-stone-100/70' : 'bg-transparent'
                  }`}
                >
                  
                  {/* Column Header: Day, Date, and Day Total Macros (in 2 neat rows) */}
                  <div
                    onClick={() => handleOpenDay(dateStr)}
                    className="p-1 flex flex-col items-center justify-center text-center cursor-pointer select-none hover:bg-stone-100/80 transition-colors border-b border-stone-200/80 shrink-0"
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

                  {/* Column Body: Dishes organized into 4 Meal Slot Rows with 5 Horizontal Lines */}
                  <div 
                    className="flex-1 flex flex-col transition-[min-height] duration-75"
                    style={{ minHeight: `${effectiveMinHeight}px` }}
                  >
                    {CALENDAR_MEAL_SLOTS.map((slot, sIdx) => {
                      // Collect planned meals for this slot
                      const slotMeals = dayMeals.filter(m => {
                        if (slot.id === 'snack') {
                          return m.slotId === 'snack' || m.slotId === 'afternoon_snack';
                        }
                        return m.slotId === slot.id;
                      });

                      const isDropHovered = dragState?.isDragging && hoveredDropTarget?.date === dateStr && hoveredDropTarget?.slotId === slot.id;

                      return (
                        <div
                          key={slot.id}
                          data-drop-date={dateStr}
                          data-drop-slot={slot.id}
                          className={`relative flex-1 flex flex-col justify-start p-1 min-h-[64px] border-t border-emerald-600/25 transition-colors ${
                            sIdx === CALENDAR_MEAL_SLOTS.length - 1 ? 'border-b border-emerald-600/25' : ''
                          } ${
                            isDropHovered ? 'bg-emerald-100/70 ring-2 ring-emerald-500/40 ring-inset rounded-lg' : ''
                          }`}
                        >
                          {/* Subtle vertical meal slot label inside the calendar row */}
                          {isMonday && (
                            <div className="absolute left-0.5 inset-y-0 flex items-center justify-center w-3 pointer-events-none select-none z-0">
                              <span className="-rotate-90 origin-center text-[7px] sm:text-[7.5px] font-bold text-stone-300 uppercase tracking-widest whitespace-nowrap">
                                {slot.name}
                              </span>
                            </div>
                          )}

                          {/* Content inside this meal slot */}
                          <div className={`flex-1 flex flex-col space-y-1 ${isMonday ? 'ml-3' : ''}`}>
                            {slotMeals.length > 0 ? (
                              slotMeals.map(meal => {
                                const mMacros = meal.macros || { calories: 0, protein: 0, fat: 0, carbs: 0 };
                                const isBeingDragged = dragState?.isDragging && dragState.meal.id === meal.id;

                                return (
                                  <div
                                    key={meal.id}
                                    onPointerDown={(e) => handleMealPointerDown(e, meal, dateStr, slot.id)}
                                    onClick={() => {
                                      if (wasJustDraggedRef.current) return;
                                      handleOpenDay(dateStr);
                                    }}
                                    className={`bg-stone-50 hover:bg-stone-100/90 rounded-lg p-1 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between flex-1 min-h-[46px] select-none touch-none ${
                                      isBeingDragged ? 'opacity-25 scale-95' : ''
                                    }`}
                                  >
                                    <div>
                                      {/* Food Photo thumbnail if zoomed in */}
                                      {showPhoto && meal.imageUrl && (
                                        <div className="w-full h-11 sm:h-14 mb-1 rounded-md overflow-hidden bg-stone-200 flex items-center justify-center shrink-0 pointer-events-none">
                                          <img
                                            src={meal.imageUrl}
                                            alt={meal.recipeName}
                                            className="w-full h-full object-cover pointer-events-none select-none"
                                            draggable={false}
                                          />
                                        </div>
                                      )}

                                      {/* Dish Name: wraps smoothly across multiple lines */}
                                      <div className={`${titleClass} text-stone-900 break-words pointer-events-none select-none`}>
                                        {meal.recipeName}
                                      </div>
                                    </div>

                                    {/* Calories & Macros (P.F.C separated by dots) */}
                                    <div className={`${macroClass} text-stone-500 font-medium mt-0.5 leading-tight pointer-events-none select-none`}>
                                      <span className="font-bold text-stone-800">{mMacros.calories}</span>
                                      <span className="mx-0.5 opacity-50">•</span>
                                      <span>{mMacros.protein}.{mMacros.fat}.{mMacros.carbs}</span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              /* Subtle quick-add button for this meal slot */
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRecipePicker(dateStr, slot.id);
                                }}
                                className="w-full flex-1 min-h-[36px] rounded-md hover:bg-stone-100/60 active:bg-stone-200/60 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-all cursor-pointer group"
                                title={`Добавить ${slot.name.toLowerCase()}`}
                              >
                                <Plus size={11} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Drag Handle for pulling/stretching calendar height */}
        <div
          onPointerDown={handleResizePointerDown}
          className="w-full py-2 bg-stone-50 hover:bg-stone-100/80 active:bg-stone-200/80 flex items-center justify-center cursor-ns-resize touch-none select-none transition-colors group"
          title="Потяните вниз или вверх для изменения высоты календаря"
        >
          <div className="w-12 h-1 bg-stone-300 group-hover:bg-stone-400 group-active:bg-stone-500 rounded-full transition-colors" />
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
