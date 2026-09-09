import React, { useState, useRef } from 'react';
import { Recipe, RecipeCategory, RECIPE_CATEGORIES } from '../types';
import { Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { calculateMacros } from '../utils/macrosCalculator';
import { getRecipeCategory } from '../utils/recipeCategories';
import { cn } from '../App';

interface EditRecipeModalProps {
  recipe?: Recipe;
  onClose: () => void;
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

export default function EditRecipeModal({ recipe, onClose, setRecipes }: EditRecipeModalProps) {
  const [name, setName] = useState(recipe?.name || '');
  const [category, setCategory] = useState<RecipeCategory>(() => {
    if (recipe?.category) return recipe.category;
    return getRecipeCategory(recipe || { name: recipe?.name || '' });
  });
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join('\n') || '');
  const [instructions, setInstructions] = useState(recipe?.instructions?.join('\n') || '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl || '');
  const [macros, setMacros] = useState({
      protein: recipe?.macros?.protein || 0,
      fat: recipe?.macros?.fat || 0,
      carbs: recipe?.macros?.carbs || 0,
      calories: recipe?.macros?.calories || 0,
  });
  const [isCalculatingMacros, setIsCalculatingMacros] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoCalculated, setAutoCalculated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutoCalculate = async () => {
    const list = ingredients.split('\n').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return;

    setIsCalculatingMacros(true);
    try {
      const result = await calculateMacros(list, name);
      if (result && result.macros) {
        setMacros(result.macros);
        setAutoCalculated(true);
      }
    } catch (e) {
      console.error('Failed to calculate macros:', e);
    } finally {
      setIsCalculatingMacros(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    let finalMacros = { ...macros };
    let finalTotalWeight = recipe?.totalWeight;
    let finalPortions = recipe?.portions || recipe?.basePortions || 1;

    const ingList = ingredients.split('\n').map(s => s.trim()).filter(Boolean);

    // Если пользователь не указал БЖУ (все по 0) и есть ингредиенты — рассчитываем автоматически
    const isMacrosEmpty = finalMacros.calories === 0 && finalMacros.protein === 0 && finalMacros.fat === 0 && finalMacros.carbs === 0;
    if (isMacrosEmpty && ingList.length > 0) {
      try {
        const calc = await calculateMacros(ingList, name);
        if (calc && calc.macros && (calc.macros.calories > 0 || calc.macros.protein > 0)) {
          finalMacros = calc.macros;
          if (!finalTotalWeight && calc.totalWeight) {
            finalTotalWeight = calc.totalWeight;
          }
          if (calc.portions) {
            finalPortions = calc.portions;
          }
        }
      } catch (err) {
        console.error('Auto calculate on save error:', err);
      }
    }

    if (recipe) {
      setRecipes(prev => prev.map(r => r.id === recipe.id ? {
        ...r,
        name,
        category,
        ingredients: ingList,
        instructions: instructions.split('\n').filter(Boolean),
        imageUrl,
        macros: finalMacros,
        totalWeight: finalTotalWeight || r.totalWeight
      } : r));
    } else {
      setRecipes(prev => [...prev, {
        id: uuidv4(),
        name,
        category,
        ingredients: ingList,
        instructions: instructions.split('\n').filter(Boolean),
        imageUrl,
        macros: finalMacros,
        portions: finalPortions,
        basePortions: finalPortions,
        totalWeight: finalTotalWeight
      }]);
    }
    setIsSaving(false);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const hasIngredients = ingredients.split('\n').some(i => i.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-stone-800">{recipe ? 'Редактировать' : 'Новое блюдо'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X /></button>
        </div>
        <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 bg-stone-100 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden relative"
            >
              {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <Upload className="text-stone-400" />}
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Название блюда</label>
              <input 
                value={name} 
                onChange={e => {
                  const newName = e.target.value;
                  setName(newName);
                  if (!recipe?.category) {
                    setCategory(getRecipeCategory({ name: newName, ingredients: ingredients.split('\n') }));
                  }
                }} 
                className="w-full p-3 bg-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:bg-stone-50" 
                placeholder="Например: Омлет с овощами" 
              />
            </div>

            {/* Выбор категории */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">Категория</label>
              <div className="flex flex-wrap gap-1.5">
                {RECIPE_CATEGORIES.map(cat => {
                  const isSelected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                        isSelected
                          ? "bg-stone-900 text-white shadow-xs"
                          : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Ингредиенты (по одному в строке)</label>
              <textarea 
                value={ingredients} 
                onChange={e => setIngredients(e.target.value)} 
                className="w-full p-3 bg-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:bg-stone-50" 
                rows={4} 
                placeholder="Яйца - 3 шт&#10;Помидор - 1 шт&#10;Молоко - 50 мл" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Инструкция приготовления</label>
              <textarea 
                value={instructions} 
                onChange={e => setInstructions(e.target.value)} 
                className="w-full p-3 bg-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:bg-stone-50" 
                rows={3} 
                placeholder="Шаги приготовления..." 
              />
            </div>
            
            {/* Блок КБЖУ с кнопкой авторасчета */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-700">Пищевая ценность (на 100 г)</span>
                  {autoCalculated && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">Авто</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAutoCalculate}
                  disabled={!hasIngredients || isCalculatingMacros}
                  className="inline-flex items-center gap-1 text-xs font-bold text-stone-800 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isCalculatingMacros ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Считаем...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Рассчитать по ингредиентам</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-0.5 text-center">Белки</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={macros.protein || ''} 
                    onChange={e => setMacros({...macros, protein: e.target.value === '' ? 0 : Number(e.target.value)})} 
                    className="w-full p-2.5 text-center bg-stone-100 rounded-xl text-sm font-semibold focus:outline-none focus:bg-stone-50" 
                    placeholder="0 г" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-0.5 text-center">Жиры</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={macros.fat || ''} 
                    onChange={e => setMacros({...macros, fat: e.target.value === '' ? 0 : Number(e.target.value)})} 
                    className="w-full p-2.5 text-center bg-stone-100 rounded-xl text-sm font-semibold focus:outline-none focus:bg-stone-50" 
                    placeholder="0 г" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-0.5 text-center">Углеводы</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={macros.carbs || ''} 
                    onChange={e => setMacros({...macros, carbs: e.target.value === '' ? 0 : Number(e.target.value)})} 
                    className="w-full p-2.5 text-center bg-stone-100 rounded-xl text-sm font-semibold focus:outline-none focus:bg-stone-50" 
                    placeholder="0 г" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-stone-400 mb-0.5 text-center">Ккал</label>
                  <input 
                    type="number" 
                    value={macros.calories || ''} 
                    onChange={e => setMacros({...macros, calories: e.target.value === '' ? 0 : Number(e.target.value)})} 
                    className="w-full p-2.5 text-center bg-stone-100 rounded-xl text-sm font-semibold focus:outline-none focus:bg-stone-50" 
                    placeholder="0" 
                  />
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={isSaving || !name.trim()}
              className="w-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <span>Сохранить</span>
              )}
            </button>
        </div>
      </div>
    </div>
  );
}

