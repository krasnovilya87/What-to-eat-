// src/services/ai/backendFunctions.ts

import { v4 as uuidv4 } from 'uuid';

export interface UserContext {
  userId: string;
  recipes?: any[];
  inventory?: {
    fridge?: any[];
    grains?: any[];
    spices?: any[];
  };
  shoppingList?: any[];
  plannedMeals?: any[];
  purchaseHistory?: any[];
}

export interface BackendExecutionResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  clientMutations?: {
    addedFridgeItems?: Array<{ name: string; quantity?: string; section: 'fridge' | 'grains' | 'spices' }>;
    addedShoppingItems?: Array<{ name: string; quantity?: string }>;
    removedInventory?: string[];
    suggestedRecipe?: any;
    updatedRecipe?: any;
    deletedRecipeId?: string;
    addedCalendarMeal?: any;
  };
}

// Каноническая таблица конвертации и среднего веса для нормализации
export const CANONICAL_CONVERSION_TABLE: Record<string, { baseUnit: 'g' | 'ml' | 'pcs'; avgWeightGrams?: number; section?: 'fridge' | 'grains' | 'spices' }> = {
  'помидор': { baseUnit: 'g', avgWeightGrams: 120, section: 'fridge' },
  'томат': { baseUnit: 'g', avgWeightGrams: 120, section: 'fridge' },
  'огурец': { baseUnit: 'g', avgWeightGrams: 100, section: 'fridge' },
  'картофел': { baseUnit: 'g', avgWeightGrams: 100, section: 'fridge' },
  'картошк': { baseUnit: 'g', avgWeightGrams: 100, section: 'fridge' },
  'морков': { baseUnit: 'g', avgWeightGrams: 85, section: 'fridge' },
  'лук': { baseUnit: 'g', avgWeightGrams: 90, section: 'fridge' },
  'чеснок': { baseUnit: 'g', avgWeightGrams: 5, section: 'fridge' },
  'яйц': { baseUnit: 'pcs', avgWeightGrams: 55, section: 'fridge' },
  'молок': { baseUnit: 'ml', section: 'fridge' },
  'сыр': { baseUnit: 'g', section: 'fridge' },
  'куриц': { baseUnit: 'g', section: 'fridge' },
  'филе': { baseUnit: 'g', section: 'fridge' },
  'говядин': { baseUnit: 'g', section: 'fridge' },
  'фарш': { baseUnit: 'g', section: 'fridge' },
  'рыб': { baseUnit: 'g', section: 'fridge' },
  'рис': { baseUnit: 'g', section: 'grains' },
  'гречк': { baseUnit: 'g', section: 'grains' },
  'овсянк': { baseUnit: 'g', section: 'grains' },
  'макарон': { baseUnit: 'g', section: 'grains' },
  'мук': { baseUnit: 'g', section: 'grains' },
  'сахар': { baseUnit: 'g', section: 'grains' },
  'соль': { baseUnit: 'g', section: 'spices' },
  'масл': { baseUnit: 'ml', section: 'spices' },
  'соус': { baseUnit: 'ml', section: 'spices' }
};

// Внутренняя функция нормализации (не экспонируется в Gemini)
export function normalizeIngredient(name: string, quantity: number, unit: string) {
  const cleanName = (name || '').toLowerCase().trim();
  const cleanUnit = (unit || 'г').toLowerCase().trim();
  let normalizedQuantity = quantity || 1;
  let normalizedUnit = cleanUnit;

  if (cleanUnit === 'кг' || cleanUnit === 'kg') {
    normalizedQuantity = quantity * 1000;
    normalizedUnit = 'г';
  } else if (cleanUnit === 'л' || cleanUnit === 'l') {
    normalizedQuantity = quantity * 1000;
    normalizedUnit = 'мл';
  } else if (cleanUnit === 'ст. л.' || cleanUnit === 'ст.л.') {
    normalizedQuantity = quantity * 15;
    normalizedUnit = 'мл';
  } else if (cleanUnit === 'ч. л.' || cleanUnit === 'ч.л.') {
    normalizedQuantity = quantity * 5;
    normalizedUnit = 'мл';
  }

  const matchedRule = Object.keys(CANONICAL_CONVERSION_TABLE).find(k => cleanName.includes(k));
  const rule = matchedRule ? CANONICAL_CONVERSION_TABLE[matchedRule] : null;

  return {
    rawName: name,
    cleanName,
    quantity,
    unit: cleanUnit,
    normalizedQuantity,
    normalizedUnit,
    section: rule?.section || 'fridge',
    rule
  };
}

// =========================================================
// 1. RECIPE FUNCTIONS
// =========================================================

export async function getRecipes(args: { category?: string; searchQuery?: string; limit?: number }, context: UserContext): Promise<BackendExecutionResult> {
  const allRecipes = context.recipes || [];
  let filtered = [...allRecipes];

  if (args.category) {
    const catLower = args.category.toLowerCase().trim();
    filtered = filtered.filter(r => (r.category || '').toLowerCase().includes(catLower));
  }

  if (args.searchQuery) {
    const q = args.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(r => {
      const inName = (r.name || r.title || '').toLowerCase().includes(q);
      const inIng = (r.ingredients || []).some((i: any) => (typeof i === 'string' ? i : i.name || '').toLowerCase().includes(q));
      return inName || inIng;
    });
  }

  const limit = Math.min(Math.max(1, args.limit || 20), 50);
  const result = filtered.slice(0, limit).map(r => ({
    id: r.id,
    title: r.name || r.title,
    category: r.category,
    servings: r.portions || r.servings || 2,
    calories: r.macros?.calories || r.calories,
    ingredientsCount: (r.ingredients || []).length
  }));

  return {
    success: true,
    data: {
      total: filtered.length,
      recipes: result
    }
  };
}

export async function searchRecipes(args: { query: string; category?: string; requiredIngredients?: string[]; excludedIngredients?: string[]; limit?: number }, context: UserContext): Promise<BackendExecutionResult> {
  const allRecipes = context.recipes || [];
  const queryLower = (args.query || '').toLowerCase().trim();
  const reqLower = (args.requiredIngredients || []).map(i => i.toLowerCase().trim());
  const exLower = (args.excludedIngredients || []).map(i => i.toLowerCase().trim());

  const matched = allRecipes.filter(recipe => {
    const title = (recipe.name || recipe.title || '').toLowerCase();
    const ingStrings = (recipe.ingredients || []).map((i: any) => (typeof i === 'string' ? i : i.name || '').toLowerCase());

    if (reqLower.length > 0) {
      const hasAllRequired = reqLower.every(req => title.includes(req) || ingStrings.some((ing: string) => ing.includes(req)));
      if (!hasAllRequired) return false;
    }

    if (exLower.length > 0) {
      const hasExcluded = exLower.some(ex => title.includes(ex) || ingStrings.some((ing: string) => ing.includes(ex)));
      if (hasExcluded) return false;
    }

    if (args.category) {
      const catMatch = (recipe.category || '').toLowerCase().includes(args.category.toLowerCase().trim());
      if (!catMatch) return false;
    }

    if (queryLower) {
      const words = queryLower.split(/\s+/).filter(w => w.length > 2);
      const matchesAnyWord = words.some(w => title.includes(w) || ingStrings.some((ing: string) => ing.includes(w)));
      return matchesAnyWord;
    }

    return true;
  });

  const limit = Math.min(Math.max(1, args.limit || 10), 20);
  const recipes = matched.slice(0, limit).map(r => ({
    id: r.id,
    title: r.name || r.title,
    category: r.category,
    servings: r.portions || r.servings || 2,
    calories: r.macros?.calories || r.calories,
    ingredients: (r.ingredients || []).slice(0, 6)
  }));

  return {
    success: true,
    data: {
      foundCount: matched.length,
      recipes
    }
  };
}

export async function getRecipe(args: { recipeId: string }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) {
    return {
      success: false,
      error: { code: 'RECIPE_NOT_FOUND', message: `Рецепт с ID ${args.recipeId} не найден.` }
    };
  }
  return {
    success: true,
    data: {
      id: recipe.id,
      title: recipe.name || recipe.title,
      category: recipe.category,
      servings: recipe.portions || recipe.servings || 2,
      nutrition: recipe.macros || { calories: recipe.calories },
      ingredients: recipe.ingredients,
      instructions: recipe.instructions
    }
  };
}

export async function createRecipe(args: any, context: UserContext): Promise<BackendExecutionResult> {
  const newRecipe = {
    id: `rec-${Date.now()}-${uuidv4().slice(0, 6)}`,
    name: args.title,
    title: args.title,
    category: args.category || 'Завтрак',
    portions: args.servings || 2,
    basePortions: args.servings || 2,
    imageUrl: args.photo || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    ingredients: (args.ingredients || []).map((i: any) => `${i.name} — ${i.quantity} ${i.unit}`),
    instructions: args.instructions || ['Приготовить ингредиенты и следовать рецепту.'],
    macros: args.nutrition || { calories: 350, protein: 18, fat: 12, carbs: 30 }
  };

  return {
    success: true,
    data: {
      recipeId: newRecipe.id,
      title: newRecipe.name,
      servings: newRecipe.portions,
      calories: newRecipe.macros.calories
    },
    clientMutations: {
      suggestedRecipe: newRecipe
    }
  };
}

export async function updateRecipe(args: { recipeId: string; updates: any }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) {
    return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };
  }

  const updated = {
    ...recipe,
    name: args.updates.title || recipe.name,
    category: args.updates.category || recipe.category,
    portions: args.updates.servings || recipe.portions,
    instructions: args.updates.instructions || recipe.instructions
  };

  return {
    success: true,
    data: { recipeId: updated.id, updatedFields: Object.keys(args.updates) },
    clientMutations: { updatedRecipe: updated }
  };
}

export async function deleteRecipe(args: { recipeId: string }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) {
    return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };
  }

  return {
    success: true,
    data: { deletedRecipeId: args.recipeId, title: recipe.name || recipe.title },
    clientMutations: { deletedRecipeId: args.recipeId }
  };
}

export async function duplicateRecipe(args: { recipeId: string; newTitle?: string }, context: UserContext): Promise<BackendExecutionResult> {
  const original = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!original) {
    return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Исходный рецепт не найден' } };
  }

  const copy = {
    ...original,
    id: `rec-copy-${Date.now()}`,
    name: args.newTitle || `${original.name || original.title} (Копия)`,
    title: args.newTitle || `${original.name || original.title} (Копия)`
  };

  return {
    success: true,
    data: { originalId: original.id, newRecipeId: copy.id, title: copy.name },
    clientMutations: { suggestedRecipe: copy }
  };
}

export async function addIngredient(args: { recipeId: string; ingredient: { name: string; quantity: number; unit: string } }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };

  const ingStr = `${args.ingredient.name} — ${args.ingredient.quantity} ${args.ingredient.unit}`;
  const updatedIngredients = [...(recipe.ingredients || []), ingStr];
  const updated = { ...recipe, ingredients: updatedIngredients };

  return {
    success: true,
    data: { recipeId: recipe.id, added: ingStr, totalIngredients: updatedIngredients.length },
    clientMutations: { updatedRecipe: updated }
  };
}

export async function removeIngredient(args: { recipeId: string; ingredientName: string }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };

  const needle = args.ingredientName.toLowerCase().trim();
  const filtered = (recipe.ingredients || []).filter((i: any) => {
    const name = (typeof i === 'string' ? i : i.name || '').toLowerCase();
    return !name.includes(needle);
  });

  const updated = { ...recipe, ingredients: filtered };
  return {
    success: true,
    data: { recipeId: recipe.id, removed: args.ingredientName, remaining: filtered.length },
    clientMutations: { updatedRecipe: updated }
  };
}

export async function replaceIngredient(args: { recipeId: string; oldIngredientName: string; newIngredient: { name: string; quantity?: number; unit?: string } }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };

  const oldNeedle = args.oldIngredientName.toLowerCase().trim();
  let replaced = false;
  const newIngredients = (recipe.ingredients || []).map((i: any) => {
    const raw = typeof i === 'string' ? i : i.name || '';
    if (raw.toLowerCase().includes(oldNeedle)) {
      replaced = true;
      const qty = args.newIngredient.quantity || 1;
      const unit = args.newIngredient.unit || 'шт';
      return `${args.newIngredient.name} — ${qty} ${unit}`;
    }
    return i;
  });

  if (!replaced) {
    return { success: false, error: { code: 'INGREDIENT_NOT_FOUND', message: `Ингредиент "${args.oldIngredientName}" не найден в рецепте.` } };
  }

  const updated = { ...recipe, ingredients: newIngredients };
  return {
    success: true,
    data: { recipeId: recipe.id, replacedFrom: args.oldIngredientName, replacedTo: args.newIngredient.name },
    clientMutations: { updatedRecipe: updated }
  };
}

export async function changeServings(args: { recipeId: string; servings: number }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };

  const targetServings = Math.max(1, Math.round(args.servings));
  const basePortions = recipe.basePortions || recipe.portions || 2;
  const ratio = targetServings / basePortions;

  // Масштабируем граммовки в строках ингредиентов
  const scaledIngredients = (recipe.ingredients || []).map((i: any) => {
    if (typeof i !== 'string') return i;
    const match = i.match(/^(.*?)\s*[-—]\s*(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (match) {
      const name = match[1].trim();
      const num = parseFloat(match[2].replace(',', '.')) * ratio;
      const roundedNum = num >= 10 ? Math.round(num) : Math.round(num * 10) / 10;
      const unit = match[3].trim();
      return `${name} — ${roundedNum} ${unit}`;
    }
    return i;
  });

  const baseCalories = recipe.macros?.calories || recipe.calories || 300;
  const scaledCalories = Math.round(baseCalories * ratio);

  const updated = {
    ...recipe,
    portions: targetServings,
    ingredients: scaledIngredients,
    macros: {
      ...(recipe.macros || {}),
      calories: scaledCalories
    }
  };

  return {
    success: true,
    data: {
      recipeId: recipe.id,
      oldServings: basePortions,
      newServings: targetServings,
      caloriesTotal: scaledCalories
    },
    clientMutations: { updatedRecipe: updated }
  };
}

export async function recalculateNutrition(args: { recipeId: string }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };

  const portions = recipe.portions || 2;
  const calories = Math.round(portions * 220);
  const protein = Math.round(portions * 14);
  const fat = Math.round(portions * 9);
  const carbohydrates = Math.round(portions * 20);

  const updated = {
    ...recipe,
    macros: { calories, protein, fat, carbs: carbohydrates }
  };

  return {
    success: true,
    data: { recipeId: recipe.id, nutrition: { calories, protein, fat, carbohydrates } },
    clientMutations: { updatedRecipe: updated }
  };
}

// =========================================================
// 2. INVENTORY FUNCTIONS
// =========================================================

export async function getInventory(args: { searchQuery?: string; category?: string }, context: UserContext): Promise<BackendExecutionResult> {
  const fridge = context.inventory?.fridge || [];
  const grains = context.inventory?.grains || [];
  const spices = context.inventory?.spices || [];

  let all = [
    ...fridge.map(i => ({ ...i, section: 'fridge' })),
    ...grains.map(i => ({ ...i, section: 'grains' })),
    ...spices.map(i => ({ ...i, section: 'spices' }))
  ];

  if (args.category) {
    const cat = args.category.toLowerCase().trim();
    all = all.filter(i => i.section.includes(cat));
  }

  if (args.searchQuery) {
    const q = args.searchQuery.toLowerCase().trim();
    all = all.filter(i => (i.name || '').toLowerCase().includes(q));
  }

  const products = all.map(p => {
    const parsedQty = parseFloat(String(p.quantity || '1').replace(',', '.')) || 1;
    const unitMatch = String(p.quantity || '').match(/[a-zA-Zа-яА-ЯёЁ.]+/);
    const unit = unitMatch ? unitMatch[0] : 'шт';
    const norm = normalizeIngredient(p.name, parsedQty, unit);

    return {
      id: p.id,
      name: p.name,
      quantity: parsedQty,
      unit,
      normalizedQuantity: norm.normalizedQuantity,
      normalizedUnit: norm.normalizedUnit,
      section: p.section
    };
  });

  return {
    success: true,
    data: {
      totalProducts: products.length,
      products
    }
  };
}

export async function addInventoryProduct(args: { name: string; quantity: number; unit: string; isFavorite?: boolean }, context: UserContext): Promise<BackendExecutionResult> {
  const norm = normalizeIngredient(args.name, args.quantity, args.unit);
  const formattedQty = `${args.quantity} ${args.unit}`;

  return {
    success: true,
    data: {
      name: norm.rawName,
      quantity: args.quantity,
      unit: args.unit,
      normalizedQuantity: norm.normalizedQuantity,
      normalizedUnit: norm.normalizedUnit,
      section: norm.section
    },
    clientMutations: {
      addedFridgeItems: [
        {
          name: norm.rawName,
          quantity: formattedQty,
          section: norm.section
        }
      ]
    }
  };
}

export async function updateInventoryProduct(args: { productId: string; updates: any }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: { productId: args.productId, updates: args.updates }
  };
}

export async function updateInventoryQuantity(args: { productId: string; quantity: number; unit: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: { productId: args.productId, newQuantity: args.quantity, unit: args.unit }
  };
}

export async function removeInventoryProduct(args: { productId: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: { removedProductId: args.productId },
    clientMutations: {
      removedInventory: [args.productId]
    }
  };
}

export async function getFavoriteProducts(args: any, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      favoriteProducts: [
        { name: 'Молоко 3.2%', purchaseFrequencyDays: 4, lastPurchased: '2026-09-08' },
        { name: 'Яйца куриные С0', purchaseFrequencyDays: 7, lastPurchased: '2026-09-05' },
        { name: 'Куриное филе', purchaseFrequencyDays: 5, lastPurchased: '2026-09-07' }
      ]
    }
  };
}

// =========================================================
// 3. SHOPPING & LINK CORE
// =========================================================

export async function calculateShoppingList(args: { recipeId: string; servings: number }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  if (!recipe) {
    return { success: false, error: { code: 'RECIPE_NOT_FOUND', message: 'Рецепт не найден' } };
  }

  const targetServings = Math.max(1, Math.round(args.servings || 2));
  const basePortions = recipe.basePortions || recipe.portions || 2;
  const ratio = targetServings / basePortions;

  const allInventory = [
    ...(context.inventory?.fridge || []),
    ...(context.inventory?.grains || []),
    ...(context.inventory?.spices || [])
  ];

  const shoppingToBuy: Array<{ name: string; quantity: string }> = [];

  for (const rawIng of (recipe.ingredients || [])) {
    const text = typeof rawIng === 'string' ? rawIng : rawIng.name || '';
    const match = text.match(/^(.*?)\s*[-—]\s*(\d+(?:[.,]\d+)?)\s*(.*)$/);
    const ingName = match ? match[1].trim() : text.trim();
    const qty = match ? parseFloat(match[2].replace(',', '.')) * ratio : 1 * ratio;
    const unit = match ? match[3].trim() : 'шт';

    const normalizedReq = normalizeIngredient(ingName, qty, unit);

    // Ищем в запасах совпадение по корню слова
    const homeMatches = allInventory.filter(inv => {
      const invName = (inv.name || '').toLowerCase().trim();
      const stem = normalizedReq.cleanName.slice(0, 4);
      return stem.length > 2 && invName.includes(stem);
    });

    let homeAvailableNormalized = 0;
    for (const h of homeMatches) {
      const parsedQty = parseFloat(String(h.quantity || '1').replace(',', '.')) || 1;
      const unitMatch = String(h.quantity || '').match(/[a-zA-Zа-яА-ЯёЁ.]+/);
      const hUnit = unitMatch ? unitMatch[0] : 'шт';
      const normH = normalizeIngredient(h.name, parsedQty, hUnit);
      if (normH.normalizedUnit === normalizedReq.normalizedUnit) {
        homeAvailableNormalized += normH.normalizedQuantity;
      }
    }

    const delta = normalizedReq.normalizedQuantity - homeAvailableNormalized;
    if (delta > 0) {
      const roundedDelta = delta >= 10 ? Math.round(delta) : Math.round(delta * 10) / 10;
      shoppingToBuy.push({
        name: ingName,
        quantity: `${roundedDelta} ${normalizedReq.normalizedUnit}`
      });
    }
  }

  return {
    success: true,
    data: {
      recipeId: recipe.id,
      recipeTitle: recipe.name || recipe.title,
      servings: targetServings,
      toBuyCount: shoppingToBuy.length,
      items: shoppingToBuy
    },
    clientMutations: {
      addedShoppingItems: shoppingToBuy
    }
  };
}

export async function processReceipt(args: { image: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      message: 'Чек передан в обработку OCR'
    }
  };
}

export async function getPurchaseHistory(args: { startDate?: string; endDate?: string; productName?: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      purchases: [
        { date: '2026-09-08', store: 'ВкусВилл', name: 'Молоко 3.2%', price: 89 },
        { date: '2026-09-08', store: 'ВкусВилл', name: 'Творог 9%', price: 135 },
        { date: '2026-09-07', store: 'Перекрёсток', name: 'Филе куриное', price: 340 }
      ]
    }
  };
}

export async function getPurchasePrediction(args: { daysAhead?: number }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      daysAhead: args.daysAhead || 7,
      predictions: [
        { product: 'Молоко', expectedDate: '2026-09-12', confidence: 0.92, reason: 'Покупается каждые 4 дня' },
        { product: 'Яйца', expectedDate: '2026-09-13', confidence: 0.85, reason: 'Осталась 1 упаковка' }
      ]
    }
  };
}

export async function getPurchaseSchedule(args: { period: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      period: args.period,
      topStores: ['ВкусВилл', 'Перекрёсток', 'Самокат'],
      regularDays: ['Суббота', 'Среда']
    }
  };
}

export async function createReminder(args: { type: string; title: string; dateTime: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      reminderId: `rem-${Date.now()}`,
      title: args.title,
      dateTime: args.dateTime
    }
  };
}

// =========================================================
// 4. CALENDAR FUNCTIONS
// =========================================================

export async function getCalendar(args: { startDate: string; endDate: string }, context: UserContext): Promise<BackendExecutionResult> {
  const planned = context.plannedMeals || [];
  return {
    success: true,
    data: {
      startDate: args.startDate,
      endDate: args.endDate,
      meals: planned
    }
  };
}

export async function addCalendarMeal(args: { date: string; mealType: string; recipeId: string; servings: number }, context: UserContext): Promise<BackendExecutionResult> {
  const recipe = (context.recipes || []).find(r => r.id === args.recipeId);
  const meal = {
    id: `plan-${Date.now()}`,
    date: args.date,
    slotId: args.mealType,
    recipeId: args.recipeId,
    recipeName: recipe?.name || 'Запланированное блюдо',
    portions: args.servings || 1
  };

  return {
    success: true,
    data: meal,
    clientMutations: {
      addedCalendarMeal: meal
    }
  };
}

export async function removeCalendarMeal(args: { calendarMealId: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: { removedMealId: args.calendarMealId }
  };
}

export async function getDailyNutrition(args: { date: string }, context: UserContext): Promise<BackendExecutionResult> {
  const dayMeals = (context.plannedMeals || []).filter(m => m.date === args.date);
  let calories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  for (const m of dayMeals) {
    calories += m.macros?.calories || 250;
    protein += m.macros?.protein || 15;
    fat += m.macros?.fat || 10;
    carbs += m.macros?.carbs || 20;
  }

  return {
    success: true,
    data: {
      date: args.date,
      nutrition: { calories, protein, fat, carbohydrates: carbs },
      mealsCount: dayMeals.length
    }
  };
}

// =========================================================
// 5. NUTRITION & PLANNING
// =========================================================

export async function selectRecipeForNutrition(args: { calories?: number; protein?: number; fat?: number; carbohydrates?: number; mealType?: string }, context: UserContext): Promise<BackendExecutionResult> {
  const recipes = context.recipes || [];
  const targetCal = args.calories || 500;

  const sorted = [...recipes].sort((a, b) => {
    const calA = a.macros?.calories || a.calories || 300;
    const calB = b.macros?.calories || b.calories || 300;
    return Math.abs(calA - targetCal) - Math.abs(calB - targetCal);
  });

  const best = sorted.slice(0, 3).map(r => ({
    id: r.id,
    title: r.name || r.title,
    calories: r.macros?.calories || r.calories,
    category: r.category
  }));

  return {
    success: true,
    data: {
      targetCalories: targetCal,
      matchedRecipes: best
    }
  };
}

export async function generateWeeklyMenu(args: { startDate: string; dailyCalories?: number; useInventory?: boolean }, context: UserContext): Promise<BackendExecutionResult> {
  const recipes = context.recipes || [];
  return {
    success: true,
    data: {
      startDate: args.startDate,
      dailyCalories: args.dailyCalories || 2000,
      daysPlanned: 7,
      sampleDishes: recipes.slice(0, 5).map(r => r.name || r.title)
    }
  };
}

export async function analyzeFoodImage(args: { image: string; context: string }, context: UserContext): Promise<BackendExecutionResult> {
  return {
    success: true,
    data: {
      analyzedContext: args.context,
      detectedItems: ['Куриное филе', 'Помидоры свежие', 'Зелень']
    }
  };
}
