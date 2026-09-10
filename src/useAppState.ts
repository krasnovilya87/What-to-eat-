import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Recipe, 
  InventoryItem, 
  ShoppingItem, 
  ProductPurchaseEvent, 
  StoreLocation, 
  FavoriteProductConfig, 
  ReceiptPurchase, 
  ShoppingReminder,
  PlannedMeal,
  NutritionGoal,
  MealSlotId
} from './types';
import { getInitialSeedEvents } from './utils/geoFavorites';
import { getInitialPurchases } from './utils/initialPurchases';
import { v4 as uuidv4 } from 'uuid';
import { auth, db, doc, onSnapshot, setDoc, type User, onAuthStateChanged } from './firebase';
import {
  DEFAULT_RUSSIAN_RECIPES,
  DEFAULT_RUSSIAN_FRIDGE,
  DEFAULT_RUSSIAN_GRAINS,
  DEFAULT_RUSSIAN_SPICES
} from './data/russianSeedData';

function getInitialRecipes(): Recipe[] {
  const seeded = localStorage.getItem('seeded_russian_recipes_v2');
  const saved = localStorage.getItem('recipes');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!seeded) {
          localStorage.setItem('seeded_russian_recipes_v2', 'true');
          const existingNames = new Set(parsed.map((r: Recipe) => r.name.toLowerCase().trim()));
          const missingDefaults = DEFAULT_RUSSIAN_RECIPES.filter(
            r => !existingNames.has(r.name.toLowerCase().trim())
          );
          return [...parsed, ...missingDefaults];
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing saved recipes:', e);
    }
  }
  localStorage.setItem('seeded_russian_recipes_v2', 'true');
  return DEFAULT_RUSSIAN_RECIPES;
}

function getInitialInventory(key: 'fridge' | 'grains' | 'spices', defaultItems: InventoryItem[]): InventoryItem[] {
  const seeded = localStorage.getItem(`seeded_russian_${key}_v2`);
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!seeded) {
          localStorage.setItem(`seeded_russian_${key}_v2`, 'true');
          const existingNames = new Set(parsed.map((i: InventoryItem) => i.name.toLowerCase().trim()));
          const missingDefaults = defaultItems.filter(
            i => !existingNames.has(i.name.toLowerCase().trim())
          );
          return [...parsed, ...missingDefaults];
        }
        return parsed;
      }
    } catch (e) {
      console.error(`Error parsing saved ${key}:`, e);
    }
  }
  localStorage.setItem(`seeded_russian_${key}_v2`, 'true');
  return defaultItems;
}

function getInitialPlannedMeals(): PlannedMeal[] {
  const saved = localStorage.getItem('plannedMeals');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Error parsing planned meals:', e);
    }
  }
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'plan-1',
      date: today,
      slotId: 'breakfast',
      recipeId: 'rec-bf-1',
      recipeName: 'Пышные сырники из творога со сметаной',
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
      category: 'Завтрак',
      portions: 1,
      macros: { protein: 15, fat: 8, carbs: 16, calories: 198 }
    },
    {
      id: 'plan-2',
      date: today,
      slotId: 'lunch',
      recipeId: 'rec-meat-1',
      recipeName: 'Бефстроганов из говядины в сметанном соусе',
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      category: 'Мясо',
      portions: 1,
      macros: { protein: 24, fat: 18, carbs: 7, calories: 286 }
    },
    {
      id: 'plan-3',
      date: today,
      slotId: 'dinner',
      recipeId: 'rec-bf-2',
      recipeName: 'Нежный омлет с молоком на сливочном масле',
      imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      category: 'Завтрак',
      portions: 1,
      macros: { protein: 11, fat: 13, carbs: 3, calories: 171 }
    }
  ];
}

function getInitialNutritionGoal(): NutritionGoal {
  const saved = localStorage.getItem('nutritionGoal');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.calories === 'number') return parsed;
    } catch (e) {
      console.error('Error parsing nutrition goal:', e);
    }
  }
  return {
    calories: 2000,
    protein: 110,
    fat: 65,
    carbs: 240
  };
}

export function useAppState() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const saveTimeoutRef = useRef<any>(null);

  const [recipes, setRecipes] = useState<Recipe[]>(() => getInitialRecipes());

  const [fridge, setFridge] = useState<InventoryItem[]>(() => 
    getInitialInventory('fridge', DEFAULT_RUSSIAN_FRIDGE)
  );

  const [grains, setGrains] = useState<InventoryItem[]>(() => 
    getInitialInventory('grains', DEFAULT_RUSSIAN_GRAINS)
  );

  const [spices, setSpices] = useState<InventoryItem[]>(() => 
    getInitialInventory('spices', DEFAULT_RUSSIAN_SPICES)
  );

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('shoppingList');
    return saved ? JSON.parse(saved) : [];
  });

  const [purchaseEvents, setPurchaseEvents] = useState<ProductPurchaseEvent[]>(() => {
    const saved = localStorage.getItem('purchaseEvents');
    return saved ? JSON.parse(saved) : getInitialSeedEvents();
  });

  const [stores, setStores] = useState<StoreLocation[]>(() => {
    const saved = localStorage.getItem('stores');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'store-1',
        name: 'Супермаркет у дома',
        latitude: 55.7558,
        longitude: 37.6173,
        radiusMeters: 250,
        address: 'Ближайший продуктовый магазин'
      }
    ];
  });

  const [geoReminderEnabled, setGeoReminderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('geoReminderEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [favoriteConfigs, setFavoriteConfigs] = useState<FavoriteProductConfig[]>(() => {
    const saved = localStorage.getItem('favoriteConfigs');
    return saved ? JSON.parse(saved) : [];
  });

  const [purchases, setPurchases] = useState<ReceiptPurchase[]>(() => {
    const saved = localStorage.getItem('purchases');
    return saved ? JSON.parse(saved) : getInitialPurchases();
  });

  const [reminders, setReminders] = useState<ShoppingReminder[]>(() => {
    const saved = localStorage.getItem('shoppingReminders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'rem-1',
        type: 'schedule',
        enabled: true,
        title: 'Закупить продукты к ужину',
        dateMode: 'weekdays',
        weekDays: [1, 3, 5], // Пн, Ср, Пт
        time: '18:00',
        repeatInterval: 'weekly',
        intervalDays: 7,
        remindAllPendingItems: true,
        notes: 'Проверить молоко, хлеб и свежие овощи'
      },
      {
        id: 'rem-2',
        type: 'geo',
        enabled: true,
        title: 'Супермаркет у дома',
        storeName: 'Супермаркет у дома',
        address: 'Ближайший продуктовый',
        latitude: 55.7558,
        longitude: 37.6173,
        radiusMeters: 250,
        time: 'любое',
        repeatInterval: 'none',
        remindAllPendingItems: true,
        notes: 'Купить недостающие товары по списку'
      }
    ];
  });

  const [activeGeoAlert, setActiveGeoAlert] = useState<{
    store: StoreLocation;
    neededItems: string[];
    distanceMeters: number;
  } | null>(null);

  const [activeReminderAlert, setActiveReminderAlert] = useState<{
    reminder: ShoppingReminder;
    items: string[];
    distanceMeters?: number;
  } | null>(null);

  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>(() => getInitialPlannedMeals());
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>(() => getInitialNutritionGoal());

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setIsCloudSynced(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync with Firestore when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    const dataDocRef = doc(db, 'users', currentUser.uid, 'data', 'culinary_state');
    
    const unsubscribe = onSnapshot(dataDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        isRemoteUpdateRef.current = true;

        if (Array.isArray(data.recipes)) setRecipes(data.recipes.length > 0 ? data.recipes : DEFAULT_RUSSIAN_RECIPES);
        if (Array.isArray(data.fridge)) setFridge(data.fridge.length > 0 ? data.fridge : DEFAULT_RUSSIAN_FRIDGE);
        if (Array.isArray(data.grains)) setGrains(data.grains.length > 0 ? data.grains : DEFAULT_RUSSIAN_GRAINS);
        if (Array.isArray(data.spices)) setSpices(data.spices.length > 0 ? data.spices : DEFAULT_RUSSIAN_SPICES);
        if (Array.isArray(data.shoppingList)) setShoppingList(data.shoppingList);
        if (Array.isArray(data.purchaseEvents)) setPurchaseEvents(data.purchaseEvents);
        if (Array.isArray(data.stores)) setStores(data.stores);
        if (typeof data.geoReminderEnabled === 'boolean') setGeoReminderEnabled(data.geoReminderEnabled);
        if (Array.isArray(data.favoriteConfigs)) setFavoriteConfigs(data.favoriteConfigs);
        if (Array.isArray(data.purchases)) setPurchases(data.purchases);
        if (Array.isArray(data.reminders)) setReminders(data.reminders);
        if (Array.isArray(data.plannedMeals)) setPlannedMeals(data.plannedMeals);
        if (data.nutritionGoal && typeof data.nutritionGoal.calories === 'number') setNutritionGoal(data.nutritionGoal);

        setIsCloudSynced(true);
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 100);
      } else {
        // Document does not exist yet; upload current local state
        setDoc(dataDocRef, {
          userId: currentUser.uid,
          recipes,
          fridge,
          grains,
          spices,
          shoppingList,
          purchaseEvents,
          stores,
          geoReminderEnabled,
          favoriteConfigs,
          purchases,
          reminders,
          plannedMeals,
          nutritionGoal,
          updatedAt: new Date().toISOString()
        }, { merge: true })
          .then(() => setIsCloudSynced(true))
          .catch((err) => console.error('Initial state upload to Firestore error:', err));
      }
    }, (error) => {
      console.warn('Firestore subscription notice:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Push local changes to Firestore when user is logged in
  const syncToFirestore = useCallback(() => {
    if (!currentUser || isRemoteUpdateRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const dataDocRef = doc(db, 'users', currentUser.uid, 'data', 'culinary_state');
      setDoc(dataDocRef, {
        userId: currentUser.uid,
        recipes,
        fridge,
        grains,
        spices,
        shoppingList,
        purchaseEvents,
        stores,
        geoReminderEnabled,
        favoriteConfigs,
        purchases,
        reminders,
        plannedMeals,
        nutritionGoal,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .then(() => setIsCloudSynced(true))
        .catch((err) => console.error('Error saving state to Firestore:', err));
    }, 800);
  }, [
    currentUser, recipes, fridge, grains, spices, shoppingList, 
    purchaseEvents, stores, geoReminderEnabled, favoriteConfigs, purchases, reminders,
    plannedMeals, nutritionGoal
  ]);

  // Save to LocalStorage and trigger Firestore sync
  useEffect(() => {
    localStorage.setItem('recipes', JSON.stringify(recipes));
    syncToFirestore();
  }, [recipes, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('fridge', JSON.stringify(fridge));
    syncToFirestore();
  }, [fridge, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('grains', JSON.stringify(grains));
    syncToFirestore();
  }, [grains, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('spices', JSON.stringify(spices));
    syncToFirestore();
  }, [spices, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
    syncToFirestore();
  }, [shoppingList, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('purchaseEvents', JSON.stringify(purchaseEvents));
    syncToFirestore();
  }, [purchaseEvents, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('stores', JSON.stringify(stores));
    syncToFirestore();
  }, [stores, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('geoReminderEnabled', JSON.stringify(geoReminderEnabled));
    syncToFirestore();
  }, [geoReminderEnabled, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('favoriteConfigs', JSON.stringify(favoriteConfigs));
    syncToFirestore();
  }, [favoriteConfigs, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('purchases', JSON.stringify(purchases));
    syncToFirestore();
  }, [purchases, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('shoppingReminders', JSON.stringify(reminders));
    syncToFirestore();
  }, [reminders, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('plannedMeals', JSON.stringify(plannedMeals));
    syncToFirestore();
  }, [plannedMeals, syncToFirestore]);

  useEffect(() => {
    localStorage.setItem('nutritionGoal', JSON.stringify(nutritionGoal));
    syncToFirestore();
  }, [nutritionGoal, syncToFirestore]);

  const addPlannedMeal = useCallback((meal: Omit<PlannedMeal, 'id'>) => {
    const newMeal: PlannedMeal = {
      ...meal,
      id: uuidv4()
    };
    setPlannedMeals(prev => [...(prev || []), newMeal]);
  }, []);

  const removePlannedMeal = useCallback((id: string) => {
    setPlannedMeals(prev => (prev || []).filter(m => m.id !== id));
  }, []);

  const updatePlannedMealPortions = useCallback((id: string, portions: number) => {
    if (portions <= 0) {
      setPlannedMeals(prev => (prev || []).filter(m => m.id !== id));
      return;
    }
    setPlannedMeals(prev => (prev || []).map(m => {
      if (m.id === id) {
        const factor = portions / (m.portions || 1);
        return {
          ...m,
          portions,
          macros: {
            protein: Math.round(m.macros.protein * factor * 10) / 10,
            fat: Math.round(m.macros.fat * factor * 10) / 10,
            carbs: Math.round(m.macros.carbs * factor * 10) / 10,
            calories: Math.round(m.macros.calories * factor)
          }
        };
      }
      return m;
    }));
  }, []);

  const clearDayPlan = useCallback((date: string) => {
    setPlannedMeals(prev => (prev || []).filter(m => m.date !== date));
  }, []);

  const applyDayPlan = useCallback((date: string, meals: Array<Omit<PlannedMeal, 'id' | 'date'>>) => {
    const newMeals: PlannedMeal[] = meals.map(m => ({
      ...m,
      id: uuidv4(),
      date
    }));
    setPlannedMeals(prev => [
      ...(prev || []).filter(m => m.date !== date),
      ...newMeals
    ]);
  }, []);

  const addReminder = useCallback((reminder: ShoppingReminder) => {
    setReminders(prev => [reminder, ...(prev || [])]);
  }, []);

  const updateReminder = useCallback((reminder: ShoppingReminder) => {
    setReminders(prev => (prev || []).map(r => r.id === reminder.id ? reminder : r));
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders(prev => (prev || []).filter(r => r.id !== id));
  }, []);

  const toggleReminder = useCallback((id: string) => {
    setReminders(prev => (prev || []).map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const recordPurchaseEvent = useCallback((itemName: string, type: 'added' | 'bought') => {
    if (!itemName || !itemName.trim()) return;
    const newEvent: ProductPurchaseEvent = {
      id: uuidv4(),
      itemName: itemName.trim(),
      type,
      timestamp: Date.now()
    };
    setPurchaseEvents(prev => [...(prev || []), newEvent]);
  }, []);

  const addPurchase = useCallback((purchase: ReceiptPurchase) => {
    setPurchases(prev => [purchase, ...(prev || [])]);
  }, []);

  const deletePurchase = useCallback((id: string) => {
    setPurchases(prev => (prev || []).filter(p => p.id !== id));
  }, []);

  return {
    recipes, setRecipes,
    fridge, setFridge,
    grains, setGrains,
    spices, setSpices,
    shoppingList, setShoppingList,
    purchaseEvents, setPurchaseEvents,
    recordPurchaseEvent,
    stores, setStores,
    geoReminderEnabled, setGeoReminderEnabled,
    favoriteConfigs, setFavoriteConfigs,
    purchases, setPurchases,
    addPurchase,
    deletePurchase,
    activeGeoAlert, setActiveGeoAlert,
    reminders, setReminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminder,
    activeReminderAlert, setActiveReminderAlert,
    plannedMeals, setPlannedMeals,
    nutritionGoal, setNutritionGoal,
    addPlannedMeal,
    removePlannedMeal,
    updatePlannedMealPortions,
    clearDayPlan,
    applyDayPlan,
    currentUser,
    isCloudSynced
  };
}
