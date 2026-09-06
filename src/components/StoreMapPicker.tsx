import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, MapPin, Compass, Store, X, Loader2 } from 'lucide-react';
import { POPULAR_CHAINS } from './ShoppingRemindersModal';

interface StoreMapPickerProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  storeName: string;
  address: string;
  onLocationChange: (data: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    storeName?: string;
    address?: string;
  }) => void;
}

// Создаем точный кастомный SVG-маркер для Leaflet БЕЗ смещающих CSS-трансформаций
const createCustomPinIcon = () => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="width: 34px; height: 42px; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.5 17 40 17 40C17 40 34 27.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="#1c1917"/>
          <circle cx="17" cy="16" r="6.5" fill="#ffffff"/>
          <circle cx="17" cy="16" r="3" fill="#10b981"/>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38]
  });
};

export const StoreMapPicker: React.FC<StoreMapPickerProps> = ({
  latitude,
  longitude,
  radiusMeters,
  storeName,
  address,
  onLocationChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Поиск и геокодирование
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>>([]);
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  const [reverseAddressLoading, setReverseAddressLoading] = useState(false);

  // Обратное геокодирование (получение адреса по координатам)
  const fetchAddressForCoords = useCallback(async (lat: number, lng: number) => {
    try {
      setReverseAddressLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`,
        { headers: { 'User-Agent': 'CulinaraRemindersApp/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const shortAddr = data.address?.road 
            ? `${data.address.road}${data.address.house_number ? ', ' + data.address.house_number : ''}`
            : data.display_name.split(',').slice(0, 3).join(', ');
          
          const potentialStoreName = data.address?.shop || data.address?.supermarket || data.address?.amenity;

          onLocationChange({
            latitude: lat,
            longitude: lng,
            radiusMeters,
            address: shortAddr || data.display_name,
            storeName: potentialStoreName ? String(potentialStoreName) : storeName
          });
        }
      }
    } catch {
      // Игнорируем сетевые сбои геокодера
    } finally {
      setReverseAddressLoading(false);
    }
  }, [onLocationChange, radiusMeters, storeName]);

  // Инициализация карты Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : 55.7558;
    const initialLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : 37.6173;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false
    });

    // Добавляем тайлы OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Пин маркер
    const pinIcon = createCustomPinIcon();
    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true
    }).addTo(map);

    // Окружность радиуса
    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
      color: '#1c1917',
      weight: 1.5,
      fillColor: '#10b981',
      fillOpacity: 0.2
    }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Клик по карте — ставит пин в точку нажатия
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const fixedLat = Number(lat.toFixed(6));
      const fixedLng = Number(lng.toFixed(6));

      marker.setLatLng([fixedLat, fixedLng]);
      circle.setLatLng([fixedLat, fixedLng]);

      onLocationChange({
        latitude: fixedLat,
        longitude: fixedLng,
        radiusMeters,
        storeName,
        address
      });

      fetchAddressForCoords(fixedLat, fixedLng);
    });

    // Перетаскивание пина пользователем
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const fixedLat = Number(pos.lat.toFixed(6));
      const fixedLng = Number(pos.lng.toFixed(6));

      circle.setLatLng([fixedLat, fixedLng]);

      onLocationChange({
        latitude: fixedLat,
        longitude: fixedLng,
        radiusMeters,
        storeName,
        address
      });

      fetchAddressForCoords(fixedLat, fixedLng);
    });

    // Исправление возможного бага отображения тайлов при открытии в модалке
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // Только при первом монтировании

  // Синхронизация позиции при внешнем изменении координат
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const currentLatLng = markerRef.current.getLatLng();
    if (Math.abs(currentLatLng.lat - latitude) > 0.00001 || Math.abs(currentLatLng.lng - longitude) > 0.00001) {
      markerRef.current.setLatLng([latitude, longitude]);
      circleRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }
  }, [latitude, longitude]);

  // Синхронизация радиуса со слайдером
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(radiusMeters);
  }, [radiusMeters]);

  // Поиск адреса / магазина через Nominatim
  const handleSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=ru`,
        { headers: { 'User-Agent': 'CulinaraRemindersApp/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
      }
    } catch {
      // Игнорируем сетевые ошибки
    } finally {
      setIsSearching(false);
    }
  };

  // Выбор точки из результатов поиска
  const handleSelectSearchResult = (result: {
    lat: string;
    lon: string;
    display_name: string;
  }) => {
    const lat = Number(parseFloat(result.lat).toFixed(6));
    const lng = Number(parseFloat(result.lon).toFixed(6));

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 16);
    }

    const shortAddr = result.display_name.split(',').slice(0, 3).join(', ');

    onLocationChange({
      latitude: lat,
      longitude: lng,
      radiusMeters,
      address: shortAddr,
      storeName: storeName || result.display_name.split(',')[0]
    });

    setSearchResults([]);
    setSearchQuery('');
  };

  // Определение текущей GPS позиции пользователя
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 16);
        }

        onLocationChange({
          latitude: lat,
          longitude: lng,
          radiusMeters,
          storeName,
          address
        });

        fetchAddressForCoords(lat, lng);
      },
      () => {
        setIsGpsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Быстрый выбор популярного магазина
  const handleQuickChainSelect = (chain: typeof POPULAR_CHAINS[0]) => {
    onLocationChange({
      latitude,
      longitude,
      radiusMeters: chain.defaultRadius,
      storeName: chain.name,
      address
    });

    // Запускаем поиск ближайшего филиала рядом с текущей точкой
    handleSearch(`${chain.name}`);
  };

  return (
    <div className="space-y-3">
      {/* 1. БЫСТРЫЙ ВЫБОР МАГАЗИНА */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
            <Store size={13} className="text-stone-500" />
            <span>Быстрый выбор магазина:</span>
          </label>
          <span className="text-[11px] text-stone-400">популярные сети</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {POPULAR_CHAINS.map((chain) => {
            const isSelected = storeName === chain.name;
            return (
              <button
                key={chain.name}
                type="button"
                onClick={() => handleQuickChainSelect(chain)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100/80'
                }`}
              >
                {chain.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. СТРОКА ПОИСКА АДРЕСА / МАГАЗИНА */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Поиск магазина или адреса (например: ВкусВилл Арбат, ул. Ленина)..."
              className="w-full pl-8 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
          >
            {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            <span>Найти</span>
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isGpsLocating}
            title="Определить моё местоположение"
            className="p-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <Compass size={16} className={isGpsLocating ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>

        {/* Выпадающие результаты поиска */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-stone-100 max-h-56 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left p-2.5 hover:bg-stone-50 transition-colors flex items-start gap-2 text-xs text-stone-800 cursor-pointer"
              >
                <MapPin size={14} className="text-stone-900 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. ИНТЕРАКТИВНАЯ КАРТА С ФУНКЦИЕЙ ПИНА ПО КЛИКУ */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
            <MapPin size={13} className="text-stone-900" />
            <span>Интерактивная карта</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {reverseAddressLoading ? 'Определение адреса точки...' : 'Нажмите на точку карты для установки пина'}
          </span>
        </div>

        <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-stone-300 shadow-inner bg-stone-100">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Плашка подсказки поверх карты */}
          <div className="absolute top-2 left-2 bg-stone-900/85 text-white backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-medium pointer-events-none shadow-md flex items-center gap-1.5 z-[10]">
            <MapPin size={11} className="text-emerald-400" />
            <span>Кликните на карту, чтобы переместить пин</span>
          </div>

          {/* Индикатор текущих координат в углу */}
          <div className="absolute bottom-2 left-2 bg-white/90 text-stone-700 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[10px] font-mono border border-stone-200 pointer-events-none z-[10]">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </div>
        </div>
      </div>

      {/* 4. ШКАЛА БАР: ПЕРЕТЯГИВАНИЕ ПОЛЗУНКА УВЕЛИЧИВАЕТ РАДИУС */}
      <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="radius-slider" className="text-xs font-bold text-stone-800">
            Радиус действия зоны напоминания:
          </label>
          <div className="flex items-center gap-1.5 bg-stone-900 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs">
            <span>{radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)} км` : `${radiusMeters} м`}</span>
          </div>
        </div>

        {/* Интерактивный ползунок (шкала бар) */}
        <div className="space-y-1.5 pt-1">
          <input
            id="radius-slider"
            type="range"
            min={50}
            max={2000}
            step={25}
            value={radiusMeters}
            onChange={(e) => {
              const newRadius = parseInt(e.target.value);
              onLocationChange({
                latitude,
                longitude,
                radiusMeters: newRadius,
                storeName,
                address
              });
            }}
            className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
          />

          {/* Метки шкалы */}
          <div className="flex justify-between text-[10px] font-semibold text-stone-600 px-0.5">
            <span>50 м</span>
            <span>250 м</span>
            <span>500 м</span>
            <span>1 км</span>
            <span>1.5 км</span>
            <span>2 км</span>
          </div>
        </div>

        <p className="text-[11px] text-stone-600">
          Зона действия (зелёный круг) динамически изменяется на карте при перетягивании ползунка.
        </p>
      </div>

      {/* Поля названия магазина и адреса */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Название магазина:
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) =>
              onLocationChange({
                latitude,
                longitude,
                radiusMeters,
                storeName: e.target.value,
                address
              })
            }
            placeholder="Например: ВкусВилл, Перекрёсток"
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Адрес или ориентир:
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) =>
              onLocationChange({
                latitude,
                longitude,
                radiusMeters,
                storeName,
                address: e.target.value
              })
            }
            placeholder="ул. Тверская, 15"
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
      </div>
    </div>
  );
};
