// src/services/ai/geminiTools.ts

export const recipeCategories = [
  "breakfast",
  "meat",
  "chicken",
  "fish",
  "salad",
  "dessert",
  "snack"
] as const;

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const geminiFunctionDeclarations: GeminiToolDeclaration[] = [
  // =========================================================
  // 1. RECIPES
  // =========================================================
  {
    name: "getRecipes",
    description: "Получает список рецептов текущего пользователя. Используй для просмотра рецептов, фильтрации по категории или поиска по простому запросу.",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          enum: [...recipeCategories],
          description: "Категория рецепта."
        },
        searchQuery: {
          type: "STRING",
          description: "Поисковый запрос. Например: курица."
        },
        limit: {
          type: "INTEGER",
          description: "Максимальное количество рецептов."
        }
      }
    }
  },
  {
    name: "searchRecipes",
    description: "Ищет рецепты текущего пользователя по названию, ингредиентам и условиям. Используй для запросов вроде 'что приготовить из курицы и риса' или 'найди рецепт без лука'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Основной поисковый запрос (например: 'блюда из курицы')."
        },
        category: {
          type: "STRING",
          enum: [...recipeCategories],
          description: "Категория рецепта."
        },
        requiredIngredients: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Ингредиенты, которые обязательно должны присутствовать."
        },
        excludedIngredients: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Ингредиенты, которых не должно быть в рецепте."
        },
        limit: {
          type: "INTEGER",
          description: "Максимальное число результатов."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "getRecipe",
    description: "Получает полную информацию о конкретном рецепте пользователя по ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: {
          type: "STRING",
          description: "Уникальный ID рецепта."
        }
      },
      required: ["recipeId"]
    }
  },
  {
    name: "createRecipe",
    description: "Создаёт новый рецепт в кулинарной книге. Используй после того, как пользователь попросил добавить рецепт вручную, по фотографии блюда или по интернет-ссылке.",
    parameters: {
      type: "OBJECT",
      properties: {
        source: {
          type: "STRING",
          enum: ["manual", "image", "url"],
          description: "Источник рецепта"
        },
        title: {
          type: "STRING",
          description: "Название блюда"
        },
        photo: {
          type: "STRING",
          description: "URL фотографии или null"
        },
        category: {
          type: "STRING",
          enum: [...recipeCategories],
          description: "Категория рецепта"
        },
        description: {
          type: "STRING",
          description: "Краткое описание"
        },
        ingredients: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              quantity: { type: "NUMBER" },
              unit: { type: "STRING" }
            },
            required: ["name", "quantity", "unit"]
          },
          description: "Список ингредиентов"
        },
        instructions: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Пошаговая инструкция приготовления"
        },
        servings: {
          type: "NUMBER",
          description: "Количество порций"
        },
        nutrition: {
          type: "OBJECT",
          properties: {
            calories: { type: "NUMBER" },
            protein: { type: "NUMBER" },
            fat: { type: "NUMBER" },
            carbohydrates: { type: "NUMBER" }
          },
          description: "КБЖУ блюда"
        },
        sourceUrl: {
          type: "STRING"
        }
      },
      required: ["source", "title", "category", "ingredients", "servings"]
    }
  },
  {
    name: "updateRecipe",
    description: "Изменяет основные данные существующего рецепта (название, категорию, описание, инструкции, порции).",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        updates: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            photo: { type: "STRING" },
            category: { type: "STRING", enum: [...recipeCategories] },
            description: { type: "STRING" },
            instructions: { type: "ARRAY", items: { type: "STRING" } },
            servings: { type: "NUMBER" }
          }
        }
      },
      required: ["recipeId", "updates"]
    }
  },
  {
    name: "deleteRecipe",
    description: "Удаляет рецепт пользователя. Используй только когда пользователь явно попросил удалить рецепт.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING", description: "ID рецепта." }
      },
      required: ["recipeId"]
    }
  },
  {
    name: "duplicateRecipe",
    description: "Создаёт независимую копию существующего рецепта.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        newTitle: { type: "STRING" }
      },
      required: ["recipeId"]
    }
  },
  {
    name: "addIngredient",
    description: "Добавляет ингредиент в существующий рецепт.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        ingredient: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            quantity: { type: "NUMBER" },
            unit: { type: "STRING" }
          },
          required: ["name", "quantity", "unit"]
        }
      },
      required: ["recipeId", "ingredient"]
    }
  },
  {
    name: "removeIngredient",
    description: "Удаляет ингредиент из рецепта.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        ingredientName: { type: "STRING" }
      },
      required: ["recipeId", "ingredientName"]
    }
  },
  {
    name: "replaceIngredient",
    description: "Заменяет один ингредиент рецепта другим с пересчетом КБЖУ.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        oldIngredientName: { type: "STRING" },
        newIngredient: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            quantity: { type: "NUMBER" },
            unit: { type: "STRING" }
          },
          required: ["name"]
        }
      },
      required: ["recipeId", "oldIngredientName", "newIngredient"]
    }
  },
  {
    name: "changeServings",
    description: "Изменяет количество порций рецепта. Backend автоматически масштабирует ингредиенты и пересчитывает КБЖУ.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        servings: { type: "NUMBER", description: "Новое количество порций (число ≥ 1)" }
      },
      required: ["recipeId", "servings"]
    }
  },
  {
    name: "recalculateNutrition",
    description: "Пересчитывает калории, белки, жиры и углеводы рецепта на основе его ингредиентов.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" }
      },
      required: ["recipeId"]
    }
  },

  // =========================================================
  // 2. INVENTORY (WHAT I HAVE)
  // =========================================================
  {
    name: "getInventory",
    description: "Показывает продукты, которые сейчас есть дома у пользователя (в холодильнике, бакалее, специях).",
    parameters: {
      type: "OBJECT",
      properties: {
        searchQuery: { type: "STRING" },
        category: { type: "STRING" }
      }
    }
  },
  {
    name: "addInventoryProduct",
    description: "Добавляет продукт в домашний запас пользователя. Бэкенд нормализует единицы измерения.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        quantity: { type: "NUMBER" },
        unit: { type: "STRING" },
        isFavorite: { type: "BOOLEAN" }
      },
      required: ["name", "quantity", "unit"]
    }
  },
  {
    name: "updateInventoryProduct",
    description: "Изменяет название, единицу измерения или избранный статус продукта в запасах.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: { type: "STRING" },
        updates: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            unit: { type: "STRING" },
            isFavorite: { type: "BOOLEAN" }
          }
        }
      },
      required: ["productId", "updates"]
    }
  },
  {
    name: "updateInventoryQuantity",
    description: "Изменяет фактический остаток продукта дома.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: { type: "STRING" },
        quantity: { type: "NUMBER" },
        unit: { type: "STRING" }
      },
      required: ["productId", "quantity", "unit"]
    }
  },
  {
    name: "removeInventoryProduct",
    description: "Удаляет продукт из текущего домашнего запаса (закончился/съели). Не удаляет из истории покупок.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: { type: "STRING" }
      },
      required: ["productId"]
    }
  },
  {
    name: "getFavoriteProducts",
    description: "Получает избранные продукты и информацию об их частоте и датах покупок.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  // =========================================================
  // 3. SHOPPING
  // =========================================================
  {
    name: "calculateShoppingList",
    description: "Главная функция связи: рассчитывает, какие ингредиенты нужно купить для выбранного рецепта с учётом имеющихся продуктов дома.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeId: { type: "STRING" },
        servings: { type: "NUMBER" }
      },
      required: ["recipeId", "servings"]
    }
  },
  {
    name: "processReceipt",
    description: "Обрабатывает чек супермаркета или фото покупок, распознаёт купленные продукты и сохраняет в историю покупок и запасы.",
    parameters: {
      type: "OBJECT",
      properties: {
        image: { type: "STRING", description: "Изображение чека (base64 или URL)" }
      },
      required: ["image"]
    }
  },
  {
    name: "getPurchaseHistory",
    description: "Получает историю покупок пользователя.",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: { type: "STRING" },
        endDate: { type: "STRING" },
        productName: { type: "STRING" }
      }
    }
  },
  {
    name: "getPurchasePrediction",
    description: "Анализирует историю покупок и текущий запас и прогнозирует, какие продукты скоро потребуется купить.",
    parameters: {
      type: "OBJECT",
      properties: {
        daysAhead: { type: "INTEGER", description: "Дней вперед (по умолчанию 7)" }
      }
    }
  },
  {
    name: "getPurchaseSchedule",
    description: "Показывает график и статистику регулярных покупок пользователя.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: { type: "STRING", enum: ["week", "month", "all"] }
      },
      required: ["period"]
    }
  },
  {
    name: "createReminder",
    description: "Создаёт напоминание о покупке или событии календаря.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", enum: ["purchase", "calendar"] },
        title: { type: "STRING" },
        dateTime: { type: "STRING" },
        relatedProductId: { type: "STRING" }
      },
      required: ["type", "title", "dateTime"]
    }
  },

  // =========================================================
  // 4. CALENDAR
  // =========================================================
  {
    name: "getCalendar",
    description: "Получает запланированные блюда пользователя за указанный период (startDate, endDate в формате YYYY-MM-DD).",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: { type: "STRING" },
        endDate: { type: "STRING" }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "addCalendarMeal",
    description: "Добавляет рецепт в календарь питания на определённую дату и приём пищи (breakfast, lunch, dinner, snack).",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "Дата в формате YYYY-MM-DD" },
        mealType: { type: "STRING", enum: ["breakfast", "lunch", "dinner", "snack"] },
        recipeId: { type: "STRING" },
        servings: { type: "NUMBER" }
      },
      required: ["date", "mealType", "recipeId", "servings"]
    }
  },
  {
    name: "removeCalendarMeal",
    description: "Удаляет запланированный приём пищи из календаря.",
    parameters: {
      type: "OBJECT",
      properties: {
        calendarMealId: { type: "STRING" }
      },
      required: ["calendarMealId"]
    }
  },
  {
    name: "getDailyNutrition",
    description: "Показывает суммарные калории, белки, жиры и углеводы за день по запланированным блюдам.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "YYYY-MM-DD" }
      },
      required: ["date"]
    }
  },

  // =========================================================
  // 5. NUTRITION / PLANNING
  // =========================================================
  {
    name: "selectRecipeForNutrition",
    description: "Находит подходящие существующие рецепты пользователя по целевым калориям и КБЖУ.",
    parameters: {
      type: "OBJECT",
      properties: {
        calories: { type: "NUMBER" },
        protein: { type: "NUMBER" },
        fat: { type: "NUMBER" },
        carbohydrates: { type: "NUMBER" },
        mealType: { type: "STRING" }
      }
    }
  },
  {
    name: "generateWeeklyMenu",
    description: "Формирует недельное меню из существующих рецептов пользователя с учётом целевых калорий, КБЖУ и продуктов дома.",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: { type: "STRING", description: "YYYY-MM-DD" },
        dailyCalories: { type: "NUMBER" },
        dailyProtein: { type: "NUMBER" },
        dailyFat: { type: "NUMBER" },
        dailyCarbohydrates: { type: "NUMBER" },
        useInventory: { type: "BOOLEAN" }
      },
      required: ["startDate"]
    }
  },

  // =========================================================
  // 6. IMAGE
  // =========================================================
  {
    name: "analyzeFoodImage",
    description: "Анализирует фотографию еды, продукта, рецепта или чека и определяет, какую информацию можно извлечь.",
    parameters: {
      type: "OBJECT",
      properties: {
        image: { type: "STRING" },
        context: { type: "STRING", enum: ["recipe", "inventory", "receipt", "food"] }
      },
      required: ["image", "context"]
    }
  }
];

export const geminiToolsConfig = [
  {
    functionDeclarations: geminiFunctionDeclarations
  }
];
