import React, { useState, useMemo } from 'react';
import { Recipe, RecipeCategory, RECIPE_CATEGORIES, MealSlotId, DEFAULT_MEAL_SLOTS } from '../types';
import { X, Search, Plus, ChefHat } from 'lucide-react';

interface RecipePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  slotId: MealSlotId;
  dateStr: string;
  onSelectRecipe: (recipe: Recipe, portions: number) => void;
}

export default function RecipePickerModal({
  isOpen,
  onClose,
  recipes,
  slotId,
  dateStr,
  onSelectRecipe
}: RecipePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [portions, setPortions] = useState<number>(1);

  const slotTitle = DEFAULT_MEAL_SLOTS.find(s => s.id === slotId)?.name || 'Прием пищи';

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchesSearch = !searchQuery.trim() || r.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCategory = selectedCategory === 'Все' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [recipes, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-stone-50 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Добавить в {slotTitle.toLowerCase()}
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

        {/* Search & Categories */}
        <div className="p-4 space-y-3 shrink-0 bg-white shadow-2xs">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по рецептам..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-100 rounded-2xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:bg-stone-200/80 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('Все')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'Все'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Все
            </button>
            {RECIPE_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {filteredRecipes.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-sm">
              Рецепты не найдены
            </div>
          ) : (
            filteredRecipes.map(recipe => {
              const macros = recipe.macros || { protein: 0, fat: 0, carbs: 0, calories: 0 };
              return (
                <div
                  key={recipe.id}
                  className="bg-stone-50 hover:bg-stone-100/80 p-3 rounded-2xl flex items-center justify-between gap-3 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {recipe.imageUrl ? (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        className="w-13 h-13 rounded-xl object-cover shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-xl bg-stone-200 flex items-center justify-center text-stone-500 shrink-0">
                        <ChefHat size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-900 truncate">
                        {recipe.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1 flex-wrap">
                        {recipe.category && (
                          <span className="bg-white px-2 py-0.5 rounded-md font-medium text-stone-700 shadow-2xs">
                            {recipe.category}
                          </span>
                        )}
                        <span className="font-semibold text-stone-700">
                          {macros.calories} ккал
                        </span>
                        <span>•</span>
                        <span>Б: {macros.protein}</span>
                        <span>Ж: {macros.fat}</span>
                        <span>У: {macros.carbs}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectRecipe(recipe, portions);
                      onClose();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Выбрать</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
