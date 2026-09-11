import React, { useState, useEffect } from 'react';
import { Recipe, NutritionGoal, MealSlotId, DEFAULT_MEAL_SLOTS, PlannedMeal } from '../types';
import { matchDishesForTargetMacros, MatchedDayMenu } from '../utils/calendarHelpers';
import { X, Sparkles, RefreshCw, Check, Flame } from 'lucide-react';

interface MacroGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  dateStr: string;
  currentGoal: NutritionGoal;
  onSaveGoal: (goal: NutritionGoal) => void;
  onApplyPlan: (dateStr: string, meals: Array<Omit<PlannedMeal, 'id' | 'date'>>) => void;
}

const PRESETS: Array<{ label: string; calories: number; protein: number; fat: number; carbs: number }> = [
  { label: 'Баланс 2000 ккал', calories: 2000, protein: 110, fat: 65, carbs: 245 },
  { label: 'Дефицит 1600 ккал', calories: 1600, protein: 115, fat: 50, carbs: 170 },
  { label: 'Набор 2500 ккал', calories: 2500, protein: 140, fat: 80, carbs: 300 },
  { label: 'Легкий 1400 ккал', calories: 1400, protein: 95, fat: 45, carbs: 155 }
];

export default function MacroGoalModal({
  isOpen,
  onClose,
  recipes,
  dateStr,
  currentGoal,
  onSaveGoal,
  onApplyPlan
}: MacroGoalModalProps) {
  const [calories, setCalories] = useState<number>(currentGoal.calories || 2000);
  const [protein, setProtein] = useState<number>(currentGoal.protein || 110);
  const [fat, setFat] = useState<number>(currentGoal.fat || 65);
  const [carbs, setCarbs] = useState<number>(currentGoal.carbs || 245);

  const [selectedSlots, setSelectedSlots] = useState<MealSlotId[]>([
    'breakfast', 'lunch', 'dinner', 'snack'
  ]);

  const [matchedMenu, setMatchedMenu] = useState<MatchedDayMenu | null>(null);
  const [iteration, setIteration] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCalories(currentGoal?.calories || 2000);
      setProtein(currentGoal?.protein || 110);
      setFat(currentGoal?.fat || 65);
      setCarbs(currentGoal?.carbs || 245);
      setMatchedMenu(null);
      setIteration(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setCalories(p.calories);
    setProtein(p.protein);
    setFat(p.fat);
    setCarbs(p.carbs);
    setMatchedMenu(null);
  };

  const handleCaloriesChange = (val: number) => {
    setCalories(val);
    // Автоматическая пропорция 25% Б / 30% Ж / 45% У при смене калорий
    const protG = Math.round((val * 0.25) / 4);
    const fatG = Math.round((val * 0.30) / 9);
    const carbG = Math.round((val * 0.45) / 4);
    setProtein(protG);
    setFat(fatG);
    setCarbs(carbG);
    setMatchedMenu(null);
  };

  const toggleSlot = (id: MealSlotId) => {
    if (selectedSlots.includes(id)) {
      if (selectedSlots.length > 1) {
        setSelectedSlots(prev => prev.filter(s => s !== id));
      }
    } else {
      setSelectedSlots(prev => [...prev, id]);
    }
    setMatchedMenu(null);
  };

  const handleGenerate = (nextIteration = 0) => {
    const goal: NutritionGoal = { calories, protein, fat, carbs };
    const result = matchDishesForTargetMacros(recipes, goal, selectedSlots, nextIteration);
    setMatchedMenu(result);
    setIteration(nextIteration);
  };

  const handleApplyToCalendar = () => {
    if (!matchedMenu) return;

    const plannedItems: Array<Omit<PlannedMeal, 'id' | 'date'>> = matchedMenu.meals.map(m => ({
      slotId: m.slotId,
      recipeId: m.recipe.id,
      recipeName: m.recipe.name,
      category: m.recipe.category,
      imageUrl: m.recipe.imageUrl,
      portions: m.portions,
      macros: m.macros
    }));

    const goal: NutritionGoal = { calories, protein, fat, carbs };
    onSaveGoal(goal);
    onApplyPlan(dateStr, plannedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-stone-50 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={18} />
            </div>
            <h2 className="text-lg font-bold text-stone-900">
              Подбор рациона по КБЖУ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center hover:bg-stone-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          
          {/* Quick presets */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  calories === p.calories
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Goal inputs */}
          <div className="bg-stone-50 p-4 rounded-2xl space-y-3 shadow-2xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-stone-700">Калории (ккал)</span>
                <span className="text-sm font-black text-stone-900">{calories} ккал</span>
              </div>
              <input
                type="range"
                min={1000}
                max={3500}
                step={50}
                value={calories}
                onChange={e => handleCaloriesChange(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-xl shadow-2xs">
                <div className="text-[11px] font-semibold text-stone-500">Белки (Б)</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    value={protein}
                    onChange={e => setProtein(Math.max(10, Number(e.target.value)))}
                    className="w-full text-sm font-bold text-stone-900 bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">г</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl shadow-2xs">
                <div className="text-[11px] font-semibold text-stone-500">Жиры (Ж)</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    value={fat}
                    onChange={e => setFat(Math.max(5, Number(e.target.value)))}
                    className="w-full text-sm font-bold text-stone-900 bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">г</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl shadow-2xs">
                <div className="text-[11px] font-semibold text-stone-500">Углеводы (У)</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    value={carbs}
                    onChange={e => setCarbs(Math.max(10, Number(e.target.value)))}
                    className="w-full text-sm font-bold text-stone-900 bg-transparent focus:outline-none"
                  />
                  <span className="text-xs text-stone-400">г</span>
                </div>
              </div>
            </div>
          </div>

          {/* Slots Selector */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-stone-700">Приемы пищи для подбора</span>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_MEAL_SLOTS.map(slot => {
                const active = selectedSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => toggleSlot(slot.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {slot.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Matched Result */}
          {matchedMenu && (
            <div className="space-y-3 pt-2">
              <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Flame size={15} />
                    <span>Подобрано: {matchedMenu.totalMacros.calories} из {calories} ккал</span>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-md font-bold">
                    {matchedMenu.accuracyPercent}% цель
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-300 pt-1">
                  <span>Б: {matchedMenu.totalMacros.protein}г / {protein}г</span>
                  <span>Ж: {matchedMenu.totalMacros.fat}г / {fat}г</span>
                  <span>У: {matchedMenu.totalMacros.carbs}г / {carbs}г</span>
                </div>
              </div>

              {/* Meals list */}
              <div className="space-y-2">
                {matchedMenu.meals.map((m, idx) => {
                  const slotName = DEFAULT_MEAL_SLOTS.find(s => s.id === m.slotId)?.name || 'Прием пищи';
                  return (
                    <div
                      key={idx}
                      className="bg-stone-50 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {m.recipe.imageUrl && (
                          <img
                            src={m.recipe.imageUrl}
                            alt={m.recipe.name}
                            className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-xs"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {slotName}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-stone-900 truncate mt-0.5">
                            {m.recipe.name}
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5">
                            {m.macros.calories} ккал • Б: {m.macros.protein} • Ж: {m.macros.fat} • У: {m.macros.carbs}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 bg-white p-3.5 sm:p-4 pb-6 sm:pb-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex gap-2.5 items-center">
          {!matchedMenu ? (
            <button
              type="button"
              onClick={() => handleGenerate(0)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles size={17} />
              <span>Подобрать меню</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleGenerate(iteration + 1)}
                className="py-3.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              >
                <RefreshCw size={15} />
                <span>Другой вариант</span>
              </button>

              <button
                type="button"
                onClick={handleApplyToCalendar}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer"
              >
                <Check size={17} strokeWidth={3} />
                <span>Подтвердить</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
