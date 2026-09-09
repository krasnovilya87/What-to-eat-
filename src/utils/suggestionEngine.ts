import { Recipe, RecipeCategory } from '../types';

export interface SuggestionResult {
  name: string;
  reason: string;
  missingIngredients: string[];
  isNew: boolean;
  recipeId?: string;
  imageUrl?: string;
  ingredients?: string[];
  calories?: number;
  portions?: number;
  totalWeight?: number;
  category?: RecipeCategory;
  instructions?: string[];
}

// Clean and extract root/stem from ingredient string
function cleanIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_,\(\)\.:\d]/g, ' ')
    .replace(/\b(кг|г|гр|мл|л|литр|килограмм|грамм|шт|штук|ст|ложка|ч|зубчик|пучок|пачка|банка|по вкусу)\b/g, ' ')
    .trim();
}

function matchesIngredient(inventoryItem: string, recipeIngredient: string): boolean {
  const inv = cleanIngredient(inventoryItem);
  const rec = cleanIngredient(recipeIngredient);

  if (!inv || !rec) return false;

  // Direct substring
  if (rec.includes(inv) || inv.includes(rec)) return true;

  // Stem check (word root >= 3 letters)
  const invWords = inv.split(/\s+/).filter(w => w.length >= 3);
  const recWords = rec.split(/\s+/).filter(w => w.length >= 3);

  for (const iw of invWords) {
    const root = iw.slice(0, Math.min(iw.length - 1, 5));
    for (const rw of recWords) {
      if (rw.startsWith(root) || iw.startsWith(rw.slice(0, Math.min(rw.length - 1, 5)))) {
        return true;
      }
    }
  }

  return false;
}

interface CatalogDish {
  name: string;
  ingredients: string[];
  keyIngredients: string[];
  imageUrl?: string;
  calories?: number;
  portions?: number;
  instructions?: string[];
  category?: RecipeCategory;
}

export const POPULAR_CATALOG: CatalogDish[] = [
  {
    name: 'Шакшука с томатами',
    ingredients: ['Яйца - 3 шт', 'Помидоры - 2 шт', 'Лук репчатый - 1 шт', 'Чеснок - 1 зубчик', 'Растительное масло - 1 ст. л.'],
    keyIngredients: ['яйц', 'помидор'],
    imageUrl: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=800&q=80',
    calories: 220,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Мелко нарезать лук и чеснок, обжарить на растительном масле до прозрачности.',
      'Добавить нарезанные кубиками помидоры и тушить 5-7 минут до образования соуса.',
      'Сделать ложкой углубления и аккуратно разбить в них яйца.',
      'Готовить на медленном огне под крышкой 5-6 минут, пока белок не схватится.'
    ]
  },
  {
    name: 'Нежный омлет с сыром',
    ingredients: ['Яйца - 3 шт', 'Молоко - 80 мл', 'Сыр твердый - 50 г', 'Сливочное масло - 15 г'],
    keyIngredients: ['яйц', 'сыр'],
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
    calories: 215,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Взбить яйца с молоком и щепоткой соли до однородности.',
      'Растопить сливочное масло на сковороде на среднем огне.',
      'Вылить смесь и посыпать тертым сыром. Готовить под крышкой 5 минут.'
    ]
  },
  {
    name: 'Домашние сырники',
    ingredients: ['Творог - 400 г', 'Яйцо - 1 шт', 'Мука - 3 ст. л.', 'Сахар - 2 ст. л.'],
    keyIngredients: ['творог'],
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    calories: 210,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Смешать творог с яйцом, сахаром и 2 ложками муки.',
      'Сформировать шайбочки, обвалять в муке.',
      'Обжарить на среднем огне по 4-5 минут с каждой стороны до золотистой корочки.'
    ]
  },
  {
    name: 'Блинчики тонкие',
    ingredients: ['Молоко - 500 мл', 'Мука - 200 г', 'Яйца - 2 шт', 'Сахар - 1.5 ст. л.', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['молок', 'мук'],
    imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=800&q=80',
    calories: 190,
    portions: 4,
    category: 'Десерты, перекус',
    instructions: [
      'Взбить яйца с сахаром, влить половину теплого молока.',
      'Добавить муку, перемешать венчиком до исчезновения комочков.',
      'Влить оставшееся молоко и масло, выпекать на раскаленной сковороде с двух сторон.'
    ]
  },
  {
    name: 'Паста с чесноком, сыром и зеленью',
    ingredients: ['Макароны - 200 г', 'Сыр - 70 г', 'Чеснок - 2 зубчика', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['макарон', 'сыр'],
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281290?auto=format&fit=crop&w=800&q=80',
    calories: 340,
    portions: 2,
    category: 'Десерты, перекус',
    instructions: [
      'Отварить макароны в подсоленной воде до состояния al dente.',
      'На сковороде слегка прогреть масло с измельченным чесноком.',
      'Переложить пасту на сковороду, посыпать тертым сыром и перемешать.'
    ]
  },
  {
    name: 'Запечённое куриное филе с овощами',
    ingredients: ['Куриное филе - 400 г', 'Помидоры - 2 шт', 'Сыр - 80 г', 'Чеснок - 2 зубчика', 'Специи - по вкусу'],
    keyIngredients: ['кур'],
    imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    calories: 240,
    portions: 2,
    category: 'Курица',
    instructions: [
      'Куриное филе нарезать порционно, натереть чесноком и специями.',
      'Выложить в форму, сверху выложить кружочки помидоров и посыпать сыром.',
      'Запекать в духовке при 180°C около 25-30 минут.'
    ]
  },
  {
    name: 'Картофель по-деревенски с чесноком',
    ingredients: ['Картофель - 600 г', 'Чеснок - 3 зубчика', 'Растительное масло - 3 ст. л.', 'Специи - по вкусу'],
    keyIngredients: ['картоф'],
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
    calories: 175,
    portions: 3,
    category: 'Десерты, перекус',
    instructions: [
      'Картофель тщательно вымыть и нарезать дольками вместе с кожурой.',
      'Смешать с маслом, давленым чесноком и любимыми специями.',
      'Выложить на противень и запекать при 200°C 35 минут до румяной корочки.'
    ]
  },
  {
    name: 'Гречневая каша с жареным луком',
    ingredients: ['Гречка - 200 г', 'Лук репчатый - 2 шт', 'Сливочное масло - 30 г'],
    keyIngredients: ['греч'],
    imageUrl: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=800&q=80',
    calories: 165,
    portions: 2,
    category: 'Десерты, перекус',
    instructions: [
      'Промыть гречку, залить водой в соотношении 1:2, варить 15-20 минут.',
      'Лук нарезать полукольцами и обжарить на сливочном масле до золотистости.',
      'Смешать готовую горячую гречку с обжаренным луком.'
    ]
  },
  {
    name: 'Овощной салат с сыром',
    ingredients: ['Помидоры - 2 шт', 'Огурцы - 2 шт', 'Сыр - 80 г', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['помидор', 'огур'],
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    calories: 140,
    portions: 2,
    category: 'Салаты',
    instructions: [
      'Овощи нарезать средними дольками, сыр кубиками.',
      'Заправить маслом, посолить по вкусу и перемешать.'
    ]
  },
  {
    name: 'Французские гренки',
    ingredients: ['Хлеб - 4 ломтика', 'Яйца - 2 шт', 'Молоко - 50 мл', 'Сливочное масло - 20 г'],
    keyIngredients: ['хлеб', 'яйц'],
    imageUrl: 'https://images.unsplash.com/photo-1484723091739-00a8a6401083?auto=format&fit=crop&w=800&q=80',
    calories: 230,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Взбить яйца с молоком и щепоткой соли или сахара.',
      'Обмакнуть ломтики хлеба в яичную смесь с обеих сторон.',
      'Обжарить на сливочном масле до аппетитной корочки.'
    ]
  },
  {
    name: 'Драники картофельные',
    ingredients: ['Картофель - 500 г', 'Яйцо - 1 шт', 'Мука - 2 ст. л.', 'Лук - 1 шт'],
    keyIngredients: ['картоф', 'яйц'],
    imageUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80',
    calories: 215,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Натереть картофель и лук на мелкой терке, отжать лишний сок.',
      'Добавить яйцо, муку, соль и перец.',
      'Выкладывать ложкой на раскаленную сковороду с маслом и жарить с двух сторон.'
    ]
  },
  {
    name: 'Куриный суп с лапшой',
    ingredients: ['Курица - 400 г', 'Картофель - 2 шт', 'Морковь - 1 шт', 'Лук - 1 шт', 'Макароны - 80 г'],
    keyIngredients: ['кур', 'картоф'],
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
    calories: 180,
    portions: 4,
    category: 'Курица',
    instructions: [
      'Сварить прозрачный бульон из курицы (30-40 минут).',
      'Добавить нарезанный картофель и спассерованные лук с морковью.',
      'За 5 минут до готовности добавить лапшу, выключить и дать настояться.'
    ]
  },
  {
    name: 'Классический борщ',
    ingredients: ['Говядина или свинина - 400 г', 'Свекла - 1 шт', 'Капуста - 250 г', 'Картофель - 3 шт', 'Морковь - 1 шт', 'Лук репчатый - 1 шт', 'Томатная паста - 2 ст. л.'],
    keyIngredients: ['мяс', 'говядин', 'свинин', 'свекл'],
    imageUrl: 'https://images.unsplash.com/photo-1572441713132-c542fc4fe282?auto=format&fit=crop&w=800&q=80',
    calories: 160,
    portions: 4,
    category: 'Мясо',
    instructions: [
      'Отварить мясо до готовности (около часа), нарезать порционно.',
      'Свеклу, морковь и лук обжарить с томатной пастой.',
      'В бульон положить картофель и капусту, варить 15 минут.',
      'Добавить зажарку из свеклы, варить еще 5-7 минут, дать настояться.'
    ]
  },
  {
    name: 'Салат «Цезарь» с курицей',
    ingredients: ['Куриное филе - 300 г', 'Листья салата - 100 г', 'Помидоры черри - 6 шт', 'Сыр - 50 г', 'Сухарики - 40 г', 'Чеснок - 1 зубчик'],
    keyIngredients: ['кур', 'салат', 'сыр'],
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=800&q=80',
    calories: 210,
    portions: 2,
    category: 'Салаты',
    instructions: [
      'Куриное филе обжарить на сковороде до золотистой корочки и нарезать ломтиками.',
      'Листья салата порвать руками и выложить в тарелку.',
      'Добавить курицу, половинки помидоров черри и сухарики.',
      'Посыпать тертым сыром и заправить соусом.'
    ]
  },
  {
    name: 'Запеченная рыба с лимоном',
    ingredients: ['Рыбное филе - 450 г', 'Лимон - 1 шт', 'Сливочное масло - 25 г', 'Чеснок - 1 зубчик', 'Зелень - по вкусу'],
    keyIngredients: ['рыб', 'филе'],
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    calories: 155,
    portions: 2,
    category: 'Рыба',
    instructions: [
      'Рыбное филе посолить, поперчить и сбрызнуть лимонным соком.',
      'Сверху выложить тонкие ломтики лимона и кусочки сливочного масла.',
      'Запекать в духовке при 190°C 18-20 минут.'
    ]
  },
  {
    name: 'Рис с овощами по-азиатски',
    ingredients: ['Рис - 200 г', 'Морковь - 1 шт', 'Лук репчатый - 1 шт', 'Яйцо - 2 шт', 'Соевый соус - 2 ст. л.', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['рис', 'яйц'],
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
    calories: 195,
    portions: 3,
    category: 'Десерты, перекус',
    instructions: [
      'Отварить рис до рассыпчатости.',
      'Обжарить на сковороде мелко нарезанные морковь и лук.',
      'Сдвинуть овощи, разбить яйца и быстро перемешать до схватывания.',
      'Добавить рис, соевый соус и обжаривать все вместе 3-4 минуты.'
    ]
  },
  {
    name: 'Творожная запеканка',
    ingredients: ['Творог - 450 г', 'Яйца - 2 шт', 'Сахар - 3 ст. л.', 'Манка - 3 ст. л.', 'Сливочное масло - 20 г'],
    keyIngredients: ['творог'],
    imageUrl: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=800&q=80',
    calories: 220,
    portions: 4,
    category: 'Десерты, перекус',
    instructions: [
      'Творог размять с яйцами и сахаром, добавить манку и оставить на 10 минут.',
      'Форму смазать сливочным маслом и выложить творожную массу.',
      'Выпекать при 180°C около 35 минут до аппетитной корочки.'
    ]
  },
  {
    name: 'Овсяная каша с яблоком',
    ingredients: ['Овсяные хлопья - 80 г', 'Молоко - 300 мл', 'Яблоко - 1 шт', 'Сливочное масло - 15 г', 'Сахар или мед - 1 ст. л.'],
    keyIngredients: ['овсян', 'молок', 'яблок'],
    imageUrl: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80',
    calories: 145,
    portions: 2,
    category: 'Завтрак',
    instructions: [
      'Довести молоко до кипения, всыпать овсяные хлопья с щепоткой соли.',
      'Варить на медленном огне 5-7 минут, помешивая.',
      'Яблоко нарезать кубиками, добавить в кашу вместе со сливочным маслом и сахаром.'
    ]
  },
  {
    name: 'Тефтели в томатном соусе',
    ingredients: ['Фарш мясной - 450 г', 'Рис - 70 г', 'Лук репчатый - 1 шт', 'Томатная паста - 2 ст. л.', 'Морковь - 1 шт', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['фарш', 'мяс'],
    imageUrl: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80',
    calories: 235,
    portions: 3,
    category: 'Мясо',
    instructions: [
      'Отварить рис до полуготовности и смешать с фаршем, измельченным луком и солью.',
      'Сформировать шарики-тефтели и слегка обжарить их на сковороде.',
      'Обжарить морковь с томатной пастой, влить 200 мл воды и залить тефтели.',
      'Тушить под крышкой 20-25 минут на слабом огне.'
    ]
  },
  {
    name: 'Паста Карбонара',
    ingredients: ['Спагетти - 250 г', 'Бекон или грудинка - 150 г', 'Яичные желтки - 3 шт', 'Сыр твердый - 60 г', 'Чеснок - 1 зубчик'],
    keyIngredients: ['макарон', 'спагетти', 'сыр', 'яйц'],
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=800&q=80',
    calories: 380,
    portions: 2,
    category: 'Мясо',
    instructions: [
      'Отварить спагетти в кипящей подсоленной воде.',
      'Бекон нарезать соломкой и обжарить с раздавленным зубчиком чеснока.',
      'Взбить желтки с тертым сыром и щепоткой черного перца.',
      'Смешать горячую пасту с беконом и соусом из желтков, не доводя до кипения.'
    ]
  },
  {
    name: 'Овощное рагу',
    ingredients: ['Кабачок - 1 шт', 'Картофель - 3 шт', 'Морковь - 1 шт', 'Лук репчатый - 1 шт', 'Помидоры - 2 шт', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['картоф', 'кабачок', 'морков'],
    imageUrl: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=800&q=80',
    calories: 120,
    portions: 3,
    category: 'Салаты',
    instructions: [
      'Нарезать все овощи одинаковыми кубиками.',
      'Обжарить лук и морковь, затем добавить картофель и кабачок.',
      'Добавить помидоры, немного воды и тушить на медленном огне 25 минут.'
    ]
  },
  {
    name: 'Домашние куриные котлеты',
    ingredients: ['Фарш куриный - 500 г', 'Лук репчатый - 1 шт', 'Хлеб - 2 ломтика', 'Молоко - 50 мл', 'Яйцо - 1 шт', 'Растительное масло - 2 ст. л.'],
    keyIngredients: ['фарш', 'кур', 'хлеб'],
    imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=80',
    calories: 210,
    portions: 4,
    category: 'Курица',
    instructions: [
      'Замочить хлеб в молоке, отжать и добавить к фаршу вместе с измельченным луком и яйцом.',
      'Сформировать небольшие котлеты.',
      'Обжарить на разогретой сковороде по 5-6 минут с каждой стороны до румяной корочки.'
    ]
  },
  {
    name: 'Греческий салат',
    ingredients: ['Огурцы - 2 шт', 'Помидоры - 2 шт', 'Сыр фета или брынза - 100 г', 'Маслины - 50 г', 'Оливковое масло - 2 ст. л.', 'Красный лук - 0.5 шт'],
    keyIngredients: ['огур', 'помидор', 'сыр'],
    imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
    calories: 160,
    portions: 2,
    category: 'Салаты',
    instructions: [
      'Крупно нарезать огурцы и помидоры, лук нарезать тонкими перьями.',
      'Сыр нарезать кубиками.',
      'Смешать овощи, добавить маслины, сыр, полить оливковым маслом и посыпать сухими травами.'
    ]
  },
  {
    name: 'Пышные оладьи',
    ingredients: ['Кефир или молоко - 250 мл', 'Мука - 200 г', 'Яйцо - 1 шт', 'Сахар - 1.5 ст. л.', 'Сода - 0.5 ч. л.'],
    keyIngredients: ['кефир', 'молок', 'мук'],
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80',
    calories: 225,
    portions: 3,
    category: 'Завтрак',
    instructions: [
      'Смешать теплый кефир или молоко с яйцом и сахаром.',
      'Добавить просеянную муку с содой, аккуратно перемешать ложкой без взбивания.',
      'Выкладывать ложкой на разогретую сковороду с маслом и жарить под крышкой с двух сторон.'
    ]
  }
];

export interface GroupedSuggestions {
  myRecipes: SuggestionResult[];
  newIdeas: SuggestionResult[];
  available?: SuggestionResult[]; // backward compatibility
}

export function generateLocalSuggestions(
  inventoryNames: string[],
  savedRecipes: Recipe[],
  selectedCategories?: string[]
): GroupedSuggestions {
  const cleanInv = inventoryNames.filter(Boolean);
  const catFilter = selectedCategories && selectedCategories.length > 0 ? selectedCategories : null;

  if (cleanInv.length === 0) {
    return { myRecipes: [], newIdeas: [], available: [] };
  }

  // 1. Анализируем ВСЕ сохраненные рецепты пользователя
  const evaluatedSaved: {
    recipe: Recipe;
    missing: string[];
    matchRatio: number;
    matchedCount: number;
  }[] = [];

  for (const recipe of savedRecipes) {
    if (!recipe.ingredients || recipe.ingredients.length === 0) continue;
    if (catFilter && recipe.category && !catFilter.includes(recipe.category)) continue;

    const missing: string[] = [];
    let matchedCount = 0;

    for (const ing of recipe.ingredients) {
      const isAvailable = cleanInv.some(invItem => matchesIngredient(invItem, ing));
      if (isAvailable) {
        matchedCount++;
      } else {
        missing.push(ing);
      }
    }

    const matchRatio = matchedCount / recipe.ingredients.length;
    // Включаем рецепт, если есть совпадения (0 недостающих, либо не хватает 1-2, либо есть совпадение)
    if (missing.length <= 2 || matchRatio >= 0.25 || matchedCount > 0) {
      evaluatedSaved.push({ recipe, missing, matchRatio, matchedCount });
    }
  }

  // Сортируем сохраненные рецепты: сначала полностью укомплектованные (0 недостающих), затем 1 недостающий, затем по степени совпадения
  evaluatedSaved.sort((a, b) => {
    if (a.missing.length !== b.missing.length) {
      return a.missing.length - b.missing.length;
    }
    return b.matchRatio - a.matchRatio;
  });

  const myRecipes: SuggestionResult[] = evaluatedSaved.map(item => {
    let reason = '';
    if (item.missing.length === 0) {
      reason = 'Все ингредиенты есть в наличии! Можно готовить прямо сейчас.';
    } else if (item.missing.length === 1) {
      reason = `Не хватает только одного ингредиента: ${item.missing[0]}`;
    } else {
      reason = `Не хватает: ${item.missing.slice(0, 3).join(', ')}`;
    }

    return {
      name: item.recipe.name,
      reason,
      missingIngredients: item.missing,
      isNew: false,
      recipeId: item.recipe.id,
      imageUrl: item.recipe.imageUrl,
      ingredients: item.recipe.ingredients,
      calories: item.recipe.macros?.calories,
      portions: item.recipe.portions || item.recipe.basePortions || 2,
      totalWeight: item.recipe.totalWeight,
      category: item.recipe.category,
      instructions: item.recipe.instructions
    };
  });

  // 2. Формируем идеи для «Что-то новенькое» (первые 6 вариантов)
  const myRecipeNames = new Set(myRecipes.map(r => r.name.toLowerCase()));
  const evaluatedCatalog: {
    dish: CatalogDish;
    missing: string[];
    matchedCount: number;
  }[] = [];

  for (const dish of POPULAR_CATALOG) {
    if (myRecipeNames.has(dish.name.toLowerCase())) continue;
    if (catFilter && dish.category && !catFilter.includes(dish.category)) continue;

    const missing: string[] = [];
    let matchedCount = 0;

    for (const ing of dish.ingredients) {
      const isAvailable = cleanInv.some(inv => matchesIngredient(inv, ing));
      if (isAvailable) {
        matchedCount++;
      } else {
        missing.push(ing);
      }
    }

    evaluatedCatalog.push({ dish, missing, matchedCount });
  }

  // Сортируем: сначала те, где есть совпадения с имеющимися продуктами
  evaluatedCatalog.sort((a, b) => {
    if (a.matchedCount !== b.matchedCount) {
      return b.matchedCount - a.matchedCount;
    }
    return a.missing.length - b.missing.length;
  });

  const newIdeas: SuggestionResult[] = evaluatedCatalog.slice(0, 6).map(item => ({
    name: item.dish.name,
    reason: item.missing.length === 0 ? 'Все ингредиенты есть в наличии' : `Не хватает: ${item.missing.slice(0, 2).join(', ')}`,
    missingIngredients: item.missing,
    isNew: true,
    imageUrl: item.dish.imageUrl,
    ingredients: item.dish.ingredients,
    calories: item.dish.calories,
    portions: item.dish.portions || 2,
    category: item.dish.category || 'Завтрак',
    instructions: item.dish.instructions
  }));

  return {
    myRecipes,
    newIdeas,
    available: myRecipes // backward compatibility
  };
}

export function generateMoreLocalSuggestions(
  inventoryNames: string[],
  excludeNames: string[],
  count: number = 6,
  selectedCategories?: string[]
): SuggestionResult[] {
  const cleanInv = inventoryNames.filter(Boolean);
  const excludeSet = new Set(excludeNames.map(n => n.toLowerCase().trim()));
  const catFilter = selectedCategories && selectedCategories.length > 0 ? selectedCategories : null;

  const evaluated: {
    dish: CatalogDish;
    missing: string[];
    matchedCount: number;
  }[] = [];

  for (const dish of POPULAR_CATALOG) {
    if (excludeSet.has(dish.name.toLowerCase().trim())) continue;
    if (catFilter && dish.category && !catFilter.includes(dish.category)) continue;

    const missing: string[] = [];
    let matchedCount = 0;

    for (const ing of dish.ingredients) {
      const isAvailable = cleanInv.some(inv => matchesIngredient(inv, ing));
      if (isAvailable) {
        matchedCount++;
      } else {
        missing.push(ing);
      }
    }

    evaluated.push({ dish, missing, matchedCount });
  }

  // Сортируем по совпадениям
  evaluated.sort((a, b) => {
    if (a.matchedCount !== b.matchedCount) {
      return b.matchedCount - a.matchedCount;
    }
    return a.missing.length - b.missing.length;
  });

  return evaluated.slice(0, count).map(item => ({
    name: item.dish.name,
    reason: item.missing.length === 0 ? 'Все ингредиенты есть в наличии' : `Не хватает: ${item.missing.slice(0, 2).join(', ')}`,
    missingIngredients: item.missing,
    isNew: true,
    imageUrl: item.dish.imageUrl,
    ingredients: item.dish.ingredients,
    calories: item.dish.calories,
    portions: item.dish.portions || 2,
    category: item.dish.category || 'Завтрак',
    instructions: item.dish.instructions
  }));
}
