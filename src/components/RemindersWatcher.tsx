import { useEffect, useRef } from 'react';
import { useAppState } from '../useAppState';
import { calculateDistanceMeters } from '../utils/geoFavorites';

export default function RemindersWatcher({ state }: { state: ReturnType<typeof useAppState> }) {
  const { reminders, shoppingList, setActiveReminderAlert, fridge, grains, spices, favoriteConfigs } = state;
  const lastFiredRef = useRef<Record<string, number>>({});

  const getFavoriteNames = () => {
    const names = new Set<string>();
    (fridge || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (grains || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (spices || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    (favoriteConfigs || []).forEach(c => c.name?.trim() && names.add(c.name.trim()));
    (shoppingList || []).forEach(i => i.isPermanent && i.name?.trim() && names.add(i.name.trim()));
    if (names.size === 0) {
      names.add('Молоко');
      names.add('Яйца');
    }
    return Array.from(names);
  };

  const getItemsForReminder = (rem: (typeof reminders)[0], pendingItems: typeof shoppingList) => {
    const items: string[] = [];
    if (rem.remindAllPendingItems) {
      items.push(...pendingItems.map(p => p.name));
    }
    if (rem.remindFavorites) {
      items.push(...getFavoriteNames());
    }
    if (!rem.remindAllPendingItems && !rem.remindFavorites && rem.selectedItems && rem.selectedItems.length > 0) {
      items.push(...rem.selectedItems);
    }
    const unique = Array.from(new Set(items));
    return unique.length > 0 ? unique : ['Продукты по списку'];
  };

  // 1. Проверка напоминаний по расписанию (каждые 20 секунд)
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      // День недели: 1=Пн, 2=Вт, ..., 7=Вс
      const currentDay = now.getDay() === 0 ? 7 : now.getDay();
      const currentDateStr = now.toISOString().split('T')[0];
      const nowMs = Date.now();

      const pendingItems = (shoppingList || []).filter(item => !item.checked);

      for (const rem of reminders || []) {
        if (!rem.enabled || rem.type !== 'schedule') continue;

        const lastFired = lastFiredRef.current[rem.id] || 0;
        // Защита от повторного срабатывания в течение 45 минут
        if (nowMs - lastFired < 45 * 60 * 1000) continue;

        // Проверка времени
        if (rem.time !== currentTimeStr) continue;

        // Проверка дня
        let dayMatches = false;
        if (rem.dateMode === 'specific_date') {
          dayMatches = rem.date === currentDateStr;
        } else {
          // weekdays
          dayMatches = (rem.weekDays || [1, 2, 3, 4, 5, 6, 7]).includes(currentDay);
        }

        if (dayMatches) {
          lastFiredRef.current[rem.id] = nowMs;

          const itemsToRemind = getItemsForReminder(rem, pendingItems);

          setActiveReminderAlert({
            reminder: rem,
            items: itemsToRemind
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`⏰ Время покупок: ${rem.title}`, {
                body: `Пора зайти за покупками: ${itemsToRemind.slice(0, 3).join(', ')}`,
                icon: '/favicon.ico'
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 20000);
    return () => clearInterval(interval);
  }, [reminders, shoppingList, setActiveReminderAlert, fridge, grains, spices, favoriteConfigs]);

  // 2. Проверка напоминаний по геолокации (watchPosition)
  useEffect(() => {
    if (!navigator.geolocation) return;

    const geoReminders = (reminders || []).filter(r => r.enabled && r.type === 'geo' && r.latitude && r.longitude);
    if (geoReminders.length === 0) return;

    const pendingItems = (shoppingList || []).filter(item => !item.checked);

    const checkGeo = (lat: number, lng: number) => {
      const nowMs = Date.now();

      for (const rem of geoReminders) {
        if (!rem.latitude || !rem.longitude) continue;

        const distance = calculateDistanceMeters(lat, lng, rem.latitude, rem.longitude);
        const radius = rem.radiusMeters || 250;

        if (distance <= radius) {
          const lastFired = lastFiredRef.current[rem.id] || 0;
          // Оповещать не чаще чем раз в 20 минут для того же магазина
          if (nowMs - lastFired > 20 * 60 * 1000) {
            lastFiredRef.current[rem.id] = nowMs;

            const itemsToRemind = getItemsForReminder(rem, pendingItems);

            setActiveReminderAlert({
              reminder: rem,
              items: itemsToRemind,
              distanceMeters: distance
            });

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`📍 Вы рядом с «${rem.storeName || 'магазином'}»!`, {
                  body: `Расстояние ~${distance} м. Не забудьте купить: ${itemsToRemind.slice(0, 3).join(', ')}`,
                  icon: '/favicon.ico'
                });
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        checkGeo(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // Silent error
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
  }, [reminders, shoppingList, setActiveReminderAlert]);

  return null;
}
