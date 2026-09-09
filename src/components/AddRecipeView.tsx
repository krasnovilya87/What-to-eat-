import React, { useState, useRef } from 'react';
import { useAppState } from '../useAppState';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Link as LinkIcon, Loader2, PenLine, Sparkles, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import EditRecipeModal from './EditRecipeModal';
import { calculateMacros } from '../utils/macrosCalculator';
import { apiPost } from '../utils/api';
import { RECIPE_CATEGORIES } from '../types';
import { getRecipeCategory } from '../utils/recipeCategories';

export default function AddRecipeView({ state }: { state: ReturnType<typeof useAppState> }) {
  const { setRecipes } = state;
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [initialDishName, setInitialDishName] = useState<string>('');

  const extractNameFromInput = (input?: string): string => {
    if (!input) return '';
    try {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const url = new URL(input);
        const parts = url.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1] || '';
        const decoded = decodeURIComponent(last)
          .replace(/[-_]/g, ' ')
          .replace(/\.(html|php|asp|jsp)$/i, '')
          .replace(/\d+/g, '')
          .trim();
        if (decoded.length > 2) {
          return decoded.charAt(0).toUpperCase() + decoded.slice(1);
        }
      }
    } catch (e) {
      // ignore
    }
    return input.length <= 50 ? input : '';
  };

  const extractRecipe = async (payload: { imageBase64?: string, textInput?: string }) => {
    setLoading(true);
    setError(null);
    if (payload.imageBase64) {
      setUploadedImage(payload.imageBase64);
    }
    try {
      const data = await apiPost('/api/extract-recipe', payload);
      
      let recipeMacros = data.macros;
      let recipePortions = data.portions || 1;
      let recipeTotalWeight = data.totalWeight;

      // Если БЖУ не указаны или равны 0 — рассчитываем автоматически по ингредиентам
      const hasMacros = recipeMacros && (recipeMacros.calories > 0 || recipeMacros.protein > 0);
      if (!hasMacros && data.ingredients && data.ingredients.length > 0) {
        try {
          const calculated = await calculateMacros(data.ingredients, data.dishName, recipePortions);
          if (calculated && calculated.macros && (calculated.macros.calories > 0 || calculated.macros.protein > 0)) {
            recipeMacros = calculated.macros;
            if (!recipeTotalWeight && calculated.totalWeight) {
              recipeTotalWeight = calculated.totalWeight;
            }
            if (calculated.portions) {
              recipePortions = calculated.portions;
            }
          }
        } catch (calcErr) {
          console.warn('Auto macro calculation failed:', calcErr);
        }
      }

      const recipeCategory = (data.category && (RECIPE_CATEGORIES as readonly string[]).includes(data.category))
        ? data.category
        : getRecipeCategory({ name: data.dishName, ingredients: data.ingredients });

      const newRecipe = {
        id: uuidv4(),
        name: data.dishName || 'Неизвестное блюдо',
        category: recipeCategory,
        ingredients: data.ingredients || [],
        instructions: data.instructions || [],
        imageUrl: payload.imageBase64 || undefined,
        sourceUrl: payload.textInput || undefined,
        macros: recipeMacros,
        portions: recipePortions,
        basePortions: recipePortions,
        totalWeight: recipeTotalWeight,
      };

      setRecipes(prev => [...prev, newRecipe]);
      navigate('/');
    } catch (err: any) {
      console.warn('AI extraction unavailable, opening manual entry:', err);
      const nameFromText = extractNameFromInput(payload.textInput);
      setInitialDishName(nameFromText);
      setIsManualModalOpen(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    extractRecipe({ textInput: linkInput });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      extractRecipe({ imageBase64: base64String });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 pb-2 px-1 max-w-md mx-auto select-none">
      {/* Заголовок с кнопкой назад */}
      <div className="flex items-center gap-2.5 pt-1">
        <button 
          onClick={() => navigate(-1)} 
          className="p-1.5 -ml-1 text-stone-500 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors shrink-0"
          title="Назад"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-stone-900">Добавить блюдо</h1>
      </div>

      {error && !isManualModalOpen && (
        <div className="text-stone-700 bg-stone-100 p-3.5 rounded-2xl text-xs flex flex-col gap-2 shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="text-stone-900 font-bold underline text-left cursor-pointer w-fit"
          >
            Заполнить рецепт вручную →
          </button>
        </div>
      )}

      {/* Вариант 1: Загрузить фото */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="group bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:from-emerald-850 hover:to-emerald-900 transition-all text-white shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-emerald-800/80 text-emerald-200 flex items-center justify-center shrink-0 shadow-inner">
            <Upload size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">Загрузить фото</span>
              <Sparkles size={13} className="text-emerald-300" />
            </div>
            <p className="text-xs text-emerald-200/70 truncate mt-0.5">
              ИИ распознает блюдо и ингредиенты
            </p>
          </div>
        </div>

        <ChevronRight size={18} className="text-emerald-400/60 group-hover:text-emerald-200 transition-colors shrink-0" />

        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
      </div>

      {/* Разделитель */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex-1 h-px bg-stone-200/60" />
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">или</span>
        <div className="flex-1 h-px bg-stone-200/60" />
      </div>

      {/* Вариант 2: По ссылке */}
      <div className="bg-white rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <LinkIcon size={12} />
          </div>
          <span className="text-xs font-bold text-stone-700">
            По ссылке на рецепт (сайт, блог, Pinterest)
          </span>
        </div>

        <form onSubmit={handleLinkSubmit} className="flex gap-2">
          <input
            type="url"
            placeholder="Вставьте ссылку https://..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="flex-1 min-w-0 bg-stone-50 focus:bg-white rounded-xl px-3 py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none shadow-inner transition-colors"
          />
          <button 
            type="submit" 
            disabled={!linkInput.trim() || loading}
            className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold disabled:opacity-40 transition-colors shadow-xs shrink-0 active:scale-95"
          >
            Распознать
          </button>
        </form>
      </div>

      {/* Разделитель */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex-1 h-px bg-stone-200/60" />
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">или</span>
        <div className="flex-1 h-px bg-stone-200/60" />
      </div>

      {/* Вариант 3: Добавить вручную */}
      <div 
        onClick={() => setIsManualModalOpen(true)}
        className="group bg-white rounded-2xl p-4 shadow-xs hover:bg-stone-50/80 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <PenLine size={19} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-stone-800">Добавить вручную</p>
            <p className="text-xs text-stone-400 truncate mt-0.5">
              Ввести название, состав и пошаговый рецепт
            </p>
          </div>
        </div>

        <ChevronRight size={18} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
      </div>

      {/* Индикатор загрузки */}
      {loading && (
        <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 flex flex-col items-center max-w-xs w-full shadow-2xl text-center">
            <Loader2 className="animate-spin text-emerald-600 mb-3" size={40} />
            <p className="font-bold text-stone-900 text-base">ИИ распознает рецепт...</p>
            <p className="text-stone-500 text-xs mt-1">Извлекаем название, состав и порции</p>
          </div>
        </div>
      )}

      {/* Модальное окно ручного добавления рецепта */}
      {isManualModalOpen && (
        <EditRecipeModal 
          recipe={(uploadedImage || initialDishName || linkInput) ? {
            id: uuidv4(),
            name: initialDishName || '',
            ingredients: [],
            instructions: [],
            imageUrl: uploadedImage || undefined,
            sourceUrl: linkInput || undefined,
            portions: 1,
            basePortions: 1
          } : undefined}
          setRecipes={setRecipes}
          onClose={() => {
            setIsManualModalOpen(false);
            setUploadedImage(null);
            setInitialDishName('');
          }} 
        />
      )}
    </div>
  );
}
