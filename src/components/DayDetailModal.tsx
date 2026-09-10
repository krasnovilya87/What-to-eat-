import React from 'react';
import { PlannedMeal, MealSlotId, DEFAULT_MEAL_SLOTS, NutritionGoal } from '../types';
import { formatFullDay, calculateDailyMacros } from '../utils/calendarHelpers';
import { X, Plus, Trash2, Sparkles, ChefHat, Minus } from 'lucide-react';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  meals: PlannedMeal[];
  nutritionGoal: NutritionGoal;
  onOpenGoalModal: () => void;
  onOpenRecipePicker: (slotId: MealSlotId) => void;
  onUpdatePortions: (mealId: string, portions: number) => void;
  onRemoveMeal: (mealId: string) => void;
}

export default function DayDetailModal({
  isOpen,
  onClose,
  dateStr,
  meals,
  nutritionGoal,
  onOpenGoalModal,
  onOpenRecipePicker,
  onUpdatePortions,
  onRemoveMeal
}: DayDetailModalProps) {
  if (!isOpen) return null;

  const dailyMacros = calculateDailyMacros(meals);
  const goalCalories = nutritionGoal.calories || 2000;
  const calPercent = Math.round((dailyMacros.calories / goalCalories) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-stone-50 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {formatFullDay(dateStr)}
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          
          {/* Day Macros Card */}
          <div className="bg-stone-50 p-4 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-stone-900">
                    {dailyMacros.calories}
                  </span>
                  <span className="text-xs font-bold text-stone-500">
                    / {goalCalories} ккал
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg shadow-2xs">
                  {calPercent}%
                </span>
                <button
                  type="button"
                  onClick={onOpenGoalModal}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Подобрать</span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, calPercent)}%` }}
              />
            </div>

            {/* PFC Breakdown: figures separated by dots / clean badges */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-white p-2.5 rounded-xl text-center shadow-2xs">
                <span className="text-[11px] font-semibold text-stone-500 block">Белки</span>
                <span className="text-xs font-black text-stone-900 mt-0.5 block">
                  {dailyMacros.protein}г <span className="text-stone-400 font-normal">/ {nutritionGoal.protein}г</span>
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl text-center shadow-2xs">
                <span className="text-[11px] font-semibold text-stone-500 block">Жиры</span>
                <span className="text-xs font-black text-stone-900 mt-0.5 block">
                  {dailyMacros.fat}г <span className="text-stone-400 font-normal">/ {nutritionGoal.fat}г</span>
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl text-center shadow-2xs">
                <span className="text-[11px] font-semibold text-stone-500 block">Углеводы</span>
                <span className="text-xs font-black text-stone-900 mt-0.5 block">
                  {dailyMacros.carbs}г <span className="text-stone-400 font-normal">/ {nutritionGoal.carbs}г</span>
                </span>
              </div>
            </div>
          </div>

          {/* Slots and Dishes */}
          <div className="space-y-3">
            {DEFAULT_MEAL_SLOTS.map(slot => {
              const mealsInSlot = meals.filter(m => m.slotId === slot.id);
              const slotMacros = calculateDailyMacros(mealsInSlot);

              return (
                <div key={slot.id} className="bg-stone-50 p-4 rounded-2xl space-y-3 shadow-2xs">
                  
                  {/* Slot Title & Subtotal */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">
                        {slot.name}
                      </span>
                      {mealsInSlot.length > 0 && (
                        <span className="bg-stone-200 text-stone-700 text-xs font-semibold px-2 py-0.5 rounded-md">
                          {mealsInSlot.length}
                        </span>
                      )}
                    </div>

                    {mealsInSlot.length > 0 && (
                      <span className="text-xs font-semibold text-stone-500">
                        {slotMacros.calories} ккал • {slotMacros.protein}.{slotMacros.fat}.{slotMacros.carbs}
                      </span>
                    )}
                  </div>

                  {/* Dishes inside slot */}
                  {mealsInSlot.length > 0 && (
                    <div className="space-y-2">
                      {mealsInSlot.map(meal => (
                        <div
                          key={meal.id}
                          className="bg-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {meal.imageUrl ? (
                              <img
                                src={meal.imageUrl}
                                alt={meal.recipeName}
                                className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                                <ChefHat size={18} />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-stone-900 truncate">
                                {meal.recipeName}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5">
                                {meal.macros.calories} ккал • {meal.macros.protein}.{meal.macros.fat}.{meal.macros.carbs}
                              </div>
                            </div>
                          </div>

                          {/* Portions & Delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center bg-stone-100 rounded-xl shadow-2xs px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => onUpdatePortions(meal.id, Math.max(0.5, (meal.portions || 1) - 0.5))}
                                className="w-6 h-6 flex items-center justify-center text-stone-500 hover:text-stone-800 cursor-pointer"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="text-xs font-bold text-stone-800 px-1">
                                {meal.portions || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdatePortions(meal.id, (meal.portions || 1) + 0.5)}
                                className="w-6 h-6 flex items-center justify-center text-stone-500 hover:text-stone-800 cursor-pointer"
                              >
                                <Plus size={13} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveMeal(meal.id)}
                              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add dish button for this slot */}
                  <button
                    type="button"
                    onClick={() => onOpenRecipePicker(slot.id)}
                    className="w-full py-2 bg-white hover:bg-stone-100/80 text-stone-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Добавить блюдо</span>
                  </button>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
