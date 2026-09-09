import React, { useState } from 'react';
import { useAppState } from '../useAppState';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiPost } from '../utils/api';
import { generateLocalSuggestions, SuggestionResult } from '../utils/suggestionEngine';

export default function SuggestionsView({ state }: { state: ReturnType<typeof useAppState> }) {
  const { fridge, grains, spices, recipes } = state;
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allInventory = [...(fridge || []), ...(grains || []), ...(spices || [])];

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    const inventoryNames = allInventory.map(f => f.name);

    try {
      // Пытаемся получить через API
      const data = await apiPost('/api/suggest-recipes', {
        fridgeItems: inventoryNames,
        savedRecipes: (recipes || []).map(r => ({ name: r.name, ingredients: r.ingredients }))
      });
      
      if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        return;
      }
      // Если сервер вернул пустой список, используем локальный алгоритм
      const localResults = generateLocalSuggestions(inventoryNames, recipes || []);
      setSuggestions(localResults);
    } catch (err: any) {
      // При любой ошибке сети/сервера плавно переключаемся на локальный расчет
      const localResults = generateLocalSuggestions(inventoryNames, recipes || []);
      if (localResults.length > 0) {
        setSuggestions(localResults);
      } else {
        setError('Не удалось подобрать рецепты. Добавьте больше продуктов в холодильник.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8 px-2">
      <div className="bg-emerald-900 rounded-[2rem] p-8 flex flex-col items-center text-center gap-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-emerald-800 rounded-full blur-3xl opacity-50"></div>
        <Sparkles className="text-emerald-100 z-10" size={40} />
        <p className="text-lg font-semibold z-10">Узнайте, что можно приготовить из продуктов в вашем холодильнике</p>
        <button 
          onClick={getSuggestions}
          disabled={loading || allInventory.length === 0}
          className="w-full bg-white text-emerald-900 rounded-2xl py-4 font-bold mt-2 disabled:opacity-50 shadow-xl z-10 hover:bg-emerald-50 transition-colors active:scale-[0.99]"
        >
          {loading ? 'Анализируем...' : 'Подобрать рецепты'}
        </button>
        {allInventory.length === 0 && <p className="text-xs text-emerald-200/70 mt-1 z-10">Сначала добавьте продукты в холодильник или кладовую</p>}
      </div>

      {error && <div className="text-stone-700 bg-stone-100 p-4 rounded-2xl text-sm shadow-xs">{error}</div>}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-emerald-600" size={40} />
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-bold text-xl text-stone-800">Предложения</h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full uppercase tracking-wider">{suggestions.length} вариантов</span>
          </div>
          
          <div className="space-y-4">
            {suggestions.map((sug, i) => (
              <div key={i} className="group p-5 bg-white rounded-[2rem] shadow-xs flex flex-col gap-3 transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-lg text-stone-800 leading-tight">{sug.name}</h4>
                  {sug.isNew && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0">
                      Новое
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500">{sug.reason}</p>
                
                {sug.missingIngredients.length > 0 ? (
                  <div className="mt-1 bg-amber-50/80 p-3 rounded-xl flex gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">Нужно докупить</p>
                      <p className="text-sm text-amber-950">{sug.missingIngredients.join(', ')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 bg-emerald-50/80 p-3 rounded-xl flex gap-2 items-center">
                    <CheckCircle size={16} className="text-emerald-700 shrink-0" />
                    <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Все ингредиенты в наличии</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
