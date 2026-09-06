import { useEffect, useRef } from 'react';
import { useAppState } from '../useAppState';
import { calculateDistanceMeters, calculateItemStats, cleanProductName } from '../utils/geoFavorites';

export default function GeoWatcher({ state }: { state: ReturnType<typeof useAppState> }) {
  const {
    geoReminderEnabled,
    stores,
    fridge,
    grains,
    spices,
    shoppingList,
    purchaseEvents,
    favoriteConfigs,
    setActiveGeoAlert
  } = state;

  const lastAlertTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!geoReminderEnabled || !navigator.geolocation || !stores || stores.length === 0) {
      return;
    }

    const checkLocation = (latitude: number, longitude: number) => {
      const now = Date.now();

      for (const store of stores) {
        const distance = calculateDistanceMeters(latitude, longitude, store.latitude, store.longitude);
        
        if (distance <= store.radiusMeters) {
          const lastAlert = lastAlertTimes.current[store.id] || 0;
          // Only alert once every 15 minutes for the same store
          if (now - lastAlert > 15 * 60 * 1000) {
            lastAlertTimes.current[store.id] = now;

            // Collect favorite items
            const favNames = new Set<string>();
            (fridge || []).forEach(i => i.isPermanent && favNames.add(i.name.trim()));
            (grains || []).forEach(i => i.isPermanent && favNames.add(i.name.trim()));
            (spices || []).forEach(i => i.isPermanent && favNames.add(i.name.trim()));
            (favoriteConfigs || []).forEach(c => favNames.add(c.name.trim()));

            const needed: string[] = [];
            Array.from(favNames).forEach(name => {
              const config = (favoriteConfigs || []).find(c => cleanProductName(c.name) === cleanProductName(name));
              const stats = calculateItemStats(name, purchaseEvents || [], config?.customIntervalDays);
              const inShopping = (shoppingList || []).some(
                s => cleanProductName(s.name) === cleanProductName(name) && !s.checked
              );

              if (stats.status === 'due' || stats.status === 'soon' || inShopping) {
                needed.push(name);
              }
            });

            const itemsToRemind = needed.length > 0 ? needed : Array.from(favNames).slice(0, 3);

            if (itemsToRemind.length > 0) {
              setActiveGeoAlert({
                store,
                neededItems: itemsToRemind,
                distanceMeters: distance
              });

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`📍 Вы рядом с ${store.name}!`, {
                    body: `Пора купить избранные продукты: ${itemsToRemind.join(', ')}`,
                    icon: '/favicon.ico'
                  });
                } catch (e) {
                  console.error(e);
                }
              }
            }
          }
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        checkLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        // Silently handle background watch errors
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [geoReminderEnabled, stores, fridge, grains, spices, shoppingList, purchaseEvents, favoriteConfigs, setActiveGeoAlert]);

  return null;
}
