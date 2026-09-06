import { ProductPurchaseEvent } from '../types';

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function cleanProductName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase();
}

export interface ItemPurchaseStats {
  itemName: string;
  addCount: number;
  boughtCount: number;
  lastBoughtTimestamp: number | null;
  lastAddedTimestamp: number | null;
  averageIntervalDays: number;
  daysSinceLastBought: number | null;
  daysUntilNextRecommended: number | null;
  status: 'due' | 'soon' | 'ok' | 'unknown';
  confidence: 'measured' | 'estimated';
  history: ProductPurchaseEvent[];
}

export function calculateItemStats(
  rawItemName: string,
  events: ProductPurchaseEvent[],
  customIntervalDays?: number
): ItemPurchaseStats {
  const target = cleanProductName(rawItemName);
  const itemEvents = events.filter(e => cleanProductName(e.itemName) === target);

  const addEvents = itemEvents.filter(e => e.type === 'added').sort((a, b) => a.timestamp - b.timestamp);
  const boughtEvents = itemEvents.filter(e => e.type === 'bought').sort((a, b) => a.timestamp - b.timestamp);

  const lastBought = boughtEvents.length > 0 ? boughtEvents[boughtEvents.length - 1].timestamp : null;
  const lastAdded = addEvents.length > 0 ? addEvents[addEvents.length - 1].timestamp : null;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  let averageIntervalDays = customIntervalDays || 4;
  let confidence: 'measured' | 'estimated' = 'estimated';

  if (boughtEvents.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < boughtEvents.length; i++) {
      const diffDays = (boughtEvents[i].timestamp - boughtEvents[i - 1].timestamp) / oneDayMs;
      if (diffDays > 0.2) { // filter out accidental double clicks on same day
        intervals.push(diffDays);
      }
    }

    if (intervals.length > 0) {
      const sum = intervals.reduce((acc, v) => acc + v, 0);
      averageIntervalDays = Math.max(1, Math.round((sum / intervals.length) * 10) / 10);
      confidence = 'measured';
    }
  } else if (customIntervalDays) {
    averageIntervalDays = customIntervalDays;
    confidence = 'measured';
  }

  let daysSinceLastBought: number | null = null;
  let daysUntilNextRecommended: number | null = null;
  let status: 'due' | 'soon' | 'ok' | 'unknown' = 'unknown';

  if (lastBought) {
    daysSinceLastBought = Math.max(0, Math.round(((now - lastBought) / oneDayMs) * 10) / 10);
    daysUntilNextRecommended = Math.round((averageIntervalDays - daysSinceLastBought) * 10) / 10;

    if (daysUntilNextRecommended <= 0) {
      status = 'due';
    } else if (daysUntilNextRecommended <= 1.2) {
      status = 'soon';
    } else {
      status = 'ok';
    }
  } else if (boughtEvents.length === 0) {
    status = 'due'; // Never bought yet or due for replenishment
  }

  return {
    itemName: rawItemName,
    addCount: addEvents.length,
    boughtCount: boughtEvents.length,
    lastBoughtTimestamp: lastBought,
    lastAddedTimestamp: lastAdded,
    averageIntervalDays,
    daysSinceLastBought,
    daysUntilNextRecommended,
    status,
    confidence,
    history: itemEvents.slice(-8)
  };
}

// Generate realistic demonstration events so the user immediately experiences the feature
export function getInitialSeedEvents(): ProductPurchaseEvent[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: 'seed-milk-1',
      itemName: 'Молоко',
      type: 'added',
      timestamp: now - 12 * dayMs
    },
    {
      id: 'seed-milk-2',
      itemName: 'Молоко',
      type: 'bought',
      timestamp: now - 12 * dayMs + 2 * 60 * 60 * 1000
    },
    {
      id: 'seed-milk-3',
      itemName: 'Молоко',
      type: 'added',
      timestamp: now - 8 * dayMs
    },
    {
      id: 'seed-milk-4',
      itemName: 'Молоко',
      type: 'bought',
      timestamp: now - 8 * dayMs + 1 * 60 * 60 * 1000
    },
    {
      id: 'seed-milk-5',
      itemName: 'Молоко',
      type: 'added',
      timestamp: now - 4 * dayMs
    },
    {
      id: 'seed-milk-6',
      itemName: 'Молоко',
      type: 'bought',
      timestamp: now - 4 * dayMs + 3 * 60 * 60 * 1000
    },
    {
      id: 'seed-eggs-1',
      itemName: 'Яйца',
      type: 'added',
      timestamp: now - 14 * dayMs
    },
    {
      id: 'seed-eggs-2',
      itemName: 'Яйца',
      type: 'bought',
      timestamp: now - 14 * dayMs + 2 * 60 * 60 * 1000
    },
    {
      id: 'seed-eggs-3',
      itemName: 'Яйца',
      type: 'added',
      timestamp: now - 7 * dayMs
    },
    {
      id: 'seed-eggs-4',
      itemName: 'Яйца',
      type: 'bought',
      timestamp: now - 7 * dayMs + 2 * 60 * 60 * 1000
    }
  ];
}
