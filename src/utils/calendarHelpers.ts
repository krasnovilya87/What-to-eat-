import { Recipe, PlannedMeal, NutritionGoal, MealSlotId, Macros, DEFAULT_MEAL_SLOTS } from '../types';
import { DEFAULT_RUSSIAN_RECIPES } from '../data/russianSeedData';

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Получить даты недели (с Понедельника по Воскресенье) для переданной даты
export function getWeekDates(referenceDateStr: string): string[] {
  const refDate = parseDateStr(referenceDateStr);
  const dayOfWeek = refDate.getDay(); // 0 = вс, 1 = пн, ..., 6 = сб
  // Смещение от понедельника: если 0 (вс), смещение 6; иначе dayOfWeek - 1
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDateStr(d));
  }
  return dates;
}

export function getAdjacentWeek(currentDateStr: string, direction: 'prev' | 'next'): string {
  const date = parseDateStr(currentDateStr);
  const delta = direction === 'next' ? 7 : -7;
  date.setDate(date.getDate() + delta);
  return formatDateStr(date);
}

const RU_DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const RU_DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const RU_MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

export function formatShortDay(dateStr: string): {
  dayOfWeek: string;
  dayNum: number;
  monthName: string;
  isToday: boolean;
} {
  const d = parseDateStr(dateStr);
  const todayStr = getTodayDateStr();
  return {
    dayOfWeek: RU_DAYS_SHORT[d.getDay()],
    dayNum: d.getDate(),
    monthName: RU_MONTHS_SHORT[d.getMonth()],
    isToday: dateStr === todayStr
  };
}

export function formatFullDay(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const todayStr = getTodayDateStr();
  const dayName = RU_DAYS_FULL[d.getDay()];
  const dayNum = d.getDate();
  const monthName = RU_MONTHS_GENITIVE[d.getMonth()];

  if (dateStr === todayStr) {
    return `Сегодня, ${dayNum} ${monthName}`;
  }
  return `${dayName}, ${dayNum} ${monthName}`;
}

export function formatWeekRange(weekDates: string[]): string {
  if (weekDates.length === 0) return '';
  const first = parseDateStr(weekDates[0]);
  const last = parseDateStr(weekDates[weekDates.length - 1]);
  const firstMonth = RU_MONTHS_SHORT[first.getMonth()];
  const lastMonth = RU_MONTHS_SHORT[last.getMonth()];

  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${firstMonth} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${firstMonth} – ${last.getDate()} ${lastMonth} ${last.getFullYear()}`;
}

// Подсчёт БКЖУ за один день
export function calculateDailyMacros(meals: PlannedMeal[]): Macros {
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let calories = 0;

  for (const meal of meals) {
    if (meal.macros) {
      protein += meal.macros.protein || 0;
      fat += meal.macros.fat || 0;
      carbs += meal.macros.carbs || 0;
      calories += meal.macros.calories || 0;
    }
  }

  return {
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    calories: Math.round(calories)
  };
}

// Подсчёт БКЖУ за неделю
export function calculateWeeklyMacros(allMeals: PlannedMeal[], weekDates: string[]): {
  total: Macros;
  dailyAverage: Macros;
  daysWithMealsCount: number;
  dailyBreakdown: Record<string, Macros>;
} {
  const weekSet = new Set(weekDates);
  const weekMeals = allMeals.filter(m => weekSet.has(m.date));

  const dailyBreakdown: Record<string, Macros> = {};
  for (const date of weekDates) {
    dailyBreakdown[date] = { protein: 0, fat: 0, carbs: 0, calories: 0 };
  }

  let daysWithMeals = 0;
  for (const date of weekDates) {
    const dayMeals = weekMeals.filter(m => m.date === date);
    if (dayMeals.length > 0) {
      daysWithMeals++;
    }
    dailyBreakdown[date] = calculateDailyMacros(dayMeals);
  }

  const total = calculateDailyMacros(weekMeals);

  // Среднее за 7 дней недели (или за количество заполненных дней)
  const divisor = 7;
  const dailyAverage: Macros = {
    protein: Math.round((total.protein / divisor) * 10) / 10,
    fat: Math.round((total.fat / divisor) * 10) / 10,
    carbs: Math.round((total.carbs / divisor) * 10) / 10,
    calories: Math.round(total.calories / divisor)
  };

  return {
    total,
    dailyAverage,
    daysWithMealsCount: daysWithMeals,
    dailyBreakdown
  };
}

export interface MatchedDayMenu {
  meals: Array<{
    slotId: MealSlotId;
    recipe: Recipe;
    portions: number;
    macros: Macros;
  }>;
  totalMacros: Macros;
  accuracyPercent: number;
}

// Подбор блюд под целевое КБЖУ дня
export function matchDishesForTargetMacros(
  recipes: Recipe[],
  target: NutritionGoal,
  selectedSlots: MealSlotId[],
  iterationOffset = 0
): MatchedDayMenu | null {
  // Гарантируем наличие достаточной базы рецептов
  let pool = (recipes && recipes.length > 0) ? [...recipes] : [];
  if (pool.length < 5) {
    const existingNames = new Set(pool.map(r => r.name.toLowerCase().trim()));
    for (const defRec of DEFAULT_RUSSIAN_RECIPES) {
      if (!existingNames.has(defRec.name.toLowerCase().trim())) {
        pool.push(defRec);
      }
    }
  }

  const activeSlots = (selectedSlots && selectedSlots.length > 0)
    ? selectedSlots
    : (['breakfast', 'lunch', 'dinner', 'snack'] as MealSlotId[]);

  const safeTarget: NutritionGoal = {
    calories: target && target.calories > 0 ? target.calories : 2000,
    protein: target && target.protein > 0 ? target.protein : 110,
    fat: target && target.fat > 0 ? target.fat : 65,
    carbs: target && target.carbs > 0 ? target.carbs : 245
  };

  if (pool.length === 0) {
    return null;
  }

  // Распределяем рецепты по слотам
  const breakfastPool = pool.filter(r => r.category === 'Завтрак' || /каша|омлет|сырник|блин|яйц|творог/i.test(r.name));
  const lunchPool = pool.filter(r => r.category === 'Мясо' || r.category === 'Курица' || r.category === 'Рыба' || /борщ|суп|котлет|жарк|пюре/i.test(r.name));
  const dinnerPool = pool.filter(r => r.category === 'Рыба' || r.category === 'Курица' || r.category === 'Салаты' || r.category === 'Мясо');
  const snackPool = pool.filter(r => r.category === 'Десерты, перекус' || r.category === 'Салаты' || r.category === 'Завтрак');

  const getSlotPool = (slotId: MealSlotId): Recipe[] => {
    switch (slotId) {
      case 'breakfast':
        return breakfastPool.length > 0 ? breakfastPool : pool;
      case 'lunch':
        return lunchPool.length > 0 ? lunchPool : pool;
      case 'dinner':
        return dinnerPool.length > 0 ? dinnerPool : pool;
      case 'afternoon_snack':
      case 'snack':
        return snackPool.length > 0 ? snackPool : pool;
      default:
        return pool;
    }
  };

  // Собираем кандидатов для каждого слота
  const slotCandidates: Array<{ slotId: MealSlotId; pool: Recipe[] }> = activeSlots.map(slotId => ({
    slotId,
    pool: getSlotPool(slotId)
  }));

  interface CandidateCombo {
    meals: Array<{ slotId: MealSlotId; recipe: Recipe; portions: number; macros: Macros }>;
    totalMacros: Macros;
    score: number;
    accuracyPercent: number;
  }

  const combinations: CandidateCombo[] = [];

  // Выполняем взвешенный перебор комбинаций
  const maxTries = 400;
  let tries = 0;

  while (tries < maxTries) {
    tries++;
    const chosenMeals: Array<{ slotId: MealSlotId; recipe: Recipe; portions: number; macros: Macros }> = [];
    const usedRecipeIds = new Set<string>();

    for (const sc of slotCandidates) {
      // Исключаем дубликаты блюд в один день
      const available = sc.pool.filter(r => !usedRecipeIds.has(r.id));
      const poolToUse = available.length > 0 ? available : sc.pool;
      
      // Выбираем рецепт с рандомизацией
      const randIndex = Math.floor(Math.random() * poolToUse.length);
      const recipe = poolToUse[randIndex];
      usedRecipeIds.add(recipe.id);

      const baseMacros = recipe.macros || { protein: 12, fat: 8, carbs: 20, calories: 200 };
      chosenMeals.push({
        slotId: sc.slotId,
        recipe,
        portions: 1,
        macros: { ...baseMacros }
      });
    }

    let totCal = 0;
    let totProt = 0;
    let totFat = 0;
    let totCarbs = 0;

    for (const m of chosenMeals) {
      totCal += m.macros.calories;
      totProt += m.macros.protein;
      totFat += m.macros.fat;
      totCarbs += m.macros.carbs;
    }

    const totalMacros: Macros = {
      calories: Math.round(totCal),
      protein: Math.round(totProt * 10) / 10,
      fat: Math.round(totFat * 10) / 10,
      carbs: Math.round(totCarbs * 10) / 10
    };

    // Оценка отклонения от цели
    const calDiff = Math.abs(totCal - target.calories) / target.calories;
    const protDiff = target.protein > 0 ? Math.abs(totProt - target.protein) / target.protein : 0;
    const fatDiff = target.fat > 0 ? Math.abs(totFat - target.fat) / target.fat : 0;
    const carbsDiff = target.carbs > 0 ? Math.abs(totCarbs - target.carbs) / target.carbs : 0;

    const weightedScore = calDiff * 2.0 + protDiff * 0.8 + fatDiff * 0.8 + carbsDiff * 0.6;
    const accuracy = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, calDiff)) * 100)));

    combinations.push({
      meals: chosenMeals,
      totalMacros,
      score: weightedScore,
      accuracyPercent: accuracy
    });
  }

  if (combinations.length === 0) return null;

  // Сортируем по точности попадания в цель (наименьший score)
  combinations.sort((a, b) => a.score - b.score);

  // Учитываем смещение при запросе "Другой вариант"
  const selectedIndex = iterationOffset % Math.min(10, combinations.length);
  const best = combinations[selectedIndex] || combinations[0];

  return {
    meals: best.meals,
    totalMacros: best.totalMacros,
    accuracyPercent: best.accuracyPercent
  };
}
