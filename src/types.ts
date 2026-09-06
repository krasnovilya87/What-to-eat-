export interface Macros {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  sourceUrl?: string;
  macros?: Macros;
  isPrepared?: boolean;
  portions?: number;
  totalWeight?: number;
  basePortions?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity?: string;
  isPermanent?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
  isManual?: boolean;
  isPermanent?: boolean;
}

export interface ProductPurchaseEvent {
  id: string;
  itemName: string;
  type: 'added' | 'bought';
  timestamp: number; // epoch ms
}

export interface StoreLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address?: string;
}

export interface FavoriteProductConfig {
  id: string;
  name: string;
  customIntervalDays?: number;
  defaultQuantity?: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity?: string;
  price: number; // in rubles
  category?: string; // department
  macros?: Macros;
}

export interface ReceiptPurchase {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number; // epoch ms
  storeName: string;
  totalAmount: number;
  items: ReceiptItem[];
  imageUrl?: string;
}

export type ReminderType = 'schedule' | 'geo';
export type ReminderIntervalType = 'none' | 'daily' | 'weekly' | 'custom_days';

export interface ShoppingReminder {
  id: string;
  type: ReminderType;
  enabled: boolean;
  title: string;
  // Schedule settings
  dateMode?: 'specific_date' | 'weekdays';
  date?: string; // YYYY-MM-DD
  weekDays?: number[]; // 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб, 7=Вс
  time: string; // HH:mm
  repeatInterval: ReminderIntervalType;
  intervalDays?: number; // every N days (e.g. 2, 3, 5, 7)
  // Geolocation settings
  storeId?: string;
  storeName?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  address?: string;
  // Items & notes
  remindAllPendingItems: boolean;
  remindFavorites?: boolean;
  selectedItems?: string[];
  notes?: string;
  lastTriggeredAt?: number;
}

