import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, MapPin, Compass, Store, X, Loader2, Check, ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { POPULAR_CHAINS } from './ShoppingRemindersModal';

interface StoreFullscreenMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  storeName: string;
  address: string;
  onSave: (data: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    storeName: string;
    address: string;
  }) => void;
}

// Создаем идеальный кастомный SVG-маркер для Leaflet БЕЗ смещающих CSS-трансформаций
// Точка острия маркера находится строго в (17, 40)
const createAccuratePinIcon = () => {
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
    iconAnchor: [17, 40], // Острие пина строго на географической координате
    popupAnchor: [0, -38]
  });
};

export const StoreFullscreenMapModal: React.FC<StoreFullscreenMapModalProps> = ({
  isOpen,
  onClose,
  latitude: initialLatitude,
  longitude: initialLongitude,
  radiusMeters: initialRadiusMeters,
  storeName: initialStoreName,
  address: initialAddress,
  onSave
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Локальные состояния внутри полноэкранной карты
  const [currentLat, setCurrentLat] = useState(
    Number.isFinite(initialLatitude) && initialLatitude !== 0 ? initialLatitude : 55.7558
  );
  const [currentLng, setCurrentLng] = useState(
    Number.isFinite(initialLongitude) && initialLongitude !== 0 ? initialLongitude : 37.6173
  );
  const [currentRadius, setCurrentRadius] = useState(initialRadiusMeters || 250);
  const [currentStoreName, setCurrentStoreName] = useState(initialStoreName || '');
  const [currentAddress, setCurrentAddress] = useState(initialAddress || '');

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
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  // Синхронизация при открытии
  useEffect(() => {
    if (isOpen) {
      const lat = Number.isFinite(initialLatitude) && initialLatitude !== 0 ? initialLatitude : 55.7558;
      const lng = Number.isFinite(initialLongitude) && initialLongitude !== 0 ? initialLongitude : 37.6173;
      setCurrentLat(lat);
      setCurrentLng(lng);
      setCurrentRadius(initialRadiusMeters || 250);
      setCurrentStoreName(initialStoreName || '');
      setCurrentAddress(initialAddress || '');
    }
  }, [isOpen, initialLatitude, initialLongitude, initialRadiusMeters, initialStoreName, initialAddress]);

  // Обратное геокодирование: получить адрес точки
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

          setCurrentAddress(shortAddr || data.display_name);
          if (potentialStoreName && !currentStoreName) {
            setCurrentStoreName(String(potentialStoreName));
          }
        }
      }
    } catch {
      // Игнорируем сбои сети
    } finally {
      setReverseAddressLoading(false);
    }
  }, [currentStoreName]);

  // Инициализация карты Leaflet при открытии модалки
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const lat = currentLat;
    const lng = currentLng;

    // Создаем карту на весь экран
    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false, // Используем свои контролы
      attributionControl: false
    });

    // Добавляем тайлы OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Пин маркер с точным якорем в острие (17, 40)
    const pinIcon = createAccuratePinIcon();
    const marker = L.marker([lat, lng], {
      icon: pinIcon,
      draggable: true
    }).addTo(map);

    // Круг зоны действия: центр СТРОГО [lat, lng]
    const circle = L.circle([lat, lng], {
      radius: currentRadius,
      color: '#1c1917',
      weight: 2,
      fillColor: '#10b981',
      fillOpacity: 0.22,
      dashArray: '5, 5'
    }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Клик по карте — ставит пин и зону в точку нажатия
    map.on('click', (e: L.LeafletMouseEvent) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));

      marker.setLatLng([clickLat, clickLng]);
      circle.setLatLng([clickLat, clickLng]);

      setCurrentLat(clickLat);
      setCurrentLng(clickLng);
      fetchAddressForCoords(clickLat, clickLng);
    });

    // Перетаскивание пина пользователем
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const dragLat = Number(pos.lat.toFixed(6));
      const dragLng = Number(pos.lng.toFixed(6));

      circle.setLatLng([dragLat, dragLng]);
      setCurrentLat(dragLat);
      setCurrentLng(dragLng);
      fetchAddressForCoords(dragLat, dragLng);
    });

    // Гарантированный пересчет размеров контейнера (Leaflet invalidateSize)
    const timer1 = setTimeout(() => map.invalidateSize(), 50);
    const timer2 = setTimeout(() => map.invalidateSize(), 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [isOpen]);

  // Синхронизация радиуса со слайдером (шкала бар)
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(currentRadius);
  }, [currentRadius]);

  // ФУНКЦИЯ: УКАЗАТЬ ТОЧКУ (в центре экрана)
  const handleSpecifyPoint = () => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

    const center = mapInstanceRef.current.getCenter();
    const newLat = Number(center.lat.toFixed(6));
    const newLng = Number(center.lng.toFixed(6));

    markerRef.current.setLatLng([newLat, newLng]);
    circleRef.current.setLatLng([newLat, newLng]);

    setCurrentLat(newLat);
    setCurrentLng(newLng);
    fetchAddressForCoords(newLat, newLng);

    setPinNotice('📍 Точка указана в центре экрана');
    setTimeout(() => setPinNotice(null), 2500);
  };

  // ПОИСК АДРЕСА / МАГАЗИНА ЧЕРЕЗ NOMINATIM
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

  // ВЫБОР ТОЧКИ ИЗ РЕЗУЛЬТАТОВ ПОИСКА
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

    setCurrentLat(lat);
    setCurrentLng(lng);

    const shortAddr = result.display_name.split(',').slice(0, 3).join(', ');
    setCurrentAddress(shortAddr);

    if (!currentStoreName) {
      setCurrentStoreName(result.display_name.split(',')[0]);
    }

    setSearchResults([]);
    setSearchQuery('');
  };

  // БЫСТРЫЙ ВЫБОР ПОПУЛЯРНОГО МАГАЗИНА
  const handleQuickChainSelect = (chain: typeof POPULAR_CHAINS[0]) => {
    setCurrentStoreName(chain.name);
    setCurrentRadius(chain.defaultRadius);
    setSearchQuery(chain.name);
    handleSearch(chain.name);
  };

  // ОПРЕДЕЛЕНИЕ ТЕКУЩЕЙ GPS ПОЗИЦИИ
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

        setCurrentLat(lat);
        setCurrentLng(lng);
        fetchAddressForCoords(lat, lng);
      },
      () => {
        setIsGpsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // СОХРАНЕНИЕ И ЗАКРЫТИЕ ПОЛНОЭКРАННОЙ КАРТЫ
  const handleApply = () => {
    onSave({
      latitude: currentLat,
      longitude: currentLng,
      radiusMeters: currentRadius,
      storeName: currentStoreName.trim() || 'Супермаркет',
      address: currentAddress.trim()
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-stone-900/60 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* 1. ВЕРХНЯЯ ПАНЕЛЬ С УПРАВЛЕНИЕМ, ПОИСКОМ И БЫСТРЫМ ВЫБОРОМ МАГАЗИНОВ */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-md p-2.5 sm:p-4 space-y-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
              title="Назад к настройке напоминания"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 leading-tight flex items-center gap-1 truncate">
                <MapPin size={15} className="text-stone-900 shrink-0" />
                <span>Выбор магазина на карте</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Check size={15} />
              <span>Применить точку</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 1. ПОИСК: ПОИСКОВАЯ СТРОКА */}
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
                placeholder="Поиск магазина или адреса..."
                className="w-full pl-8.5 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-2xs"
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
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span>Найти</span>
            </button>
          </div>

          {/* Результаты поиска */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-stone-100 max-h-56 overflow-y-auto">
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

        {/* 2. БЫСТРЫЙ ВЫБОР МАГАЗИНА */}
        <div className="max-w-4xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-stone-500 shrink-0 flex items-center gap-1 pr-0.5">
            <Store size={12} />
            <span>Быстрый выбор магазина:</span>
          </span>
          {POPULAR_CHAINS.map((chain) => {
            const isSelected = currentStoreName.toLowerCase().includes(chain.name.toLowerCase());
            return (
              <button
                key={chain.name}
                type="button"
                onClick={() => handleQuickChainSelect(chain)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200/80'
                }`}
              >
                {chain.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. КАРТА НА ВЕСЬ ЭКРАН С ЭКШЕН-КНОПКАМИ */}
      <div className="relative flex-1 w-full h-full bg-stone-200 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ПЛАВАЮЩАЯ ПАНЕЛЬ: 3. УКАЗАТЬ ТОЧКУ И 5. МОЯ ГЕОЛОКАЦИЯ */}
        <div className="absolute top-3 left-3 z-[15] flex flex-wrap items-center gap-2 max-w-[calc(100%-80px)]">
          {/* ФУНКЦИЯ 3: УКАЗАТЬ ТОЧКУ */}
          <button
            type="button"
            onClick={handleSpecifyPoint}
            className="px-3 py-2 bg-stone-900/95 backdrop-blur-md text-white hover:bg-stone-800 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer flex items-center gap-1.5 border border-stone-700 active:scale-95 shrink-0"
            title="Указать точку в центре экрана"
          >
            <MapPin size={14} className="text-emerald-400 shrink-0" />
            <span>Указать точку</span>
          </button>

          {/* ФУНКЦИЯ 5: МОЯ ГЕОЛОКАЦИЯ */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isGpsLocating}
            className="px-3 py-2 bg-white/95 backdrop-blur-md text-stone-900 hover:bg-stone-100 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer flex items-center gap-1.5 border border-stone-200 active:scale-95 shrink-0 disabled:opacity-60"
            title="Определить мое местоположение по GPS"
          >
            <Compass size={14} className={`shrink-0 ${isGpsLocating ? 'animate-spin text-emerald-600' : 'text-stone-700'}`} />
            <span>{isGpsLocating ? 'Поиск GPS...' : 'Моя геолокация'}</span>
          </button>

          {pinNotice && (
            <div className="bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-md animate-in fade-in">
              {pinNotice}
            </div>
          )}
        </div>

        {/* Контролы зума */}
        <div className="absolute top-3 right-3 z-[15] flex flex-col gap-1 bg-white/95 rounded-xl border border-stone-200 shadow-md p-1">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-700 cursor-pointer"
            title="Приблизить"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-700 cursor-pointer"
            title="Отдалить"
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>

      {/* 3. НИЖНЯЯ ПАНЕЛЬ: 4. УКАЗАТЬ РАДИУС И ПАРАМЕТРЫ ТОЧКИ */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-xl p-3 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* 4. УКАЗАТЬ РАДИУС */}
          <div className="p-2.5 sm:p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="fullscreen-radius-slider" className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <span>Указать радиус:</span>
              </label>
              <div className="flex items-center gap-1 bg-stone-900 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs">
                <span>{currentRadius >= 1000 ? `${(currentRadius / 1000).toFixed(1)} км` : `${currentRadius} м`}</span>
              </div>
            </div>

            {/* Интерактивный ползунок радиуса */}
            <input
              id="fullscreen-radius-slider"
              type="range"
              min={50}
              max={2000}
              step={25}
              value={currentRadius}
              onChange={(e) => setCurrentRadius(parseInt(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />

            {/* Быстрые кнопки выбора радиуса */}
            <div className="flex justify-between items-center gap-1 pt-0.5 overflow-x-auto no-scrollbar">
              {[50, 150, 300, 500, 1000, 2000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCurrentRadius(val)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                    currentRadius === val
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {val >= 1000 ? `${val / 1000} км` : `${val} м`}
                </button>
              ))}
            </div>
          </div>

          {/* ПОЛЯ НАЗВАНИЯ И АДРЕСА ТОЧКИ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                Название магазина:
              </label>
              <input
                type="text"
                value={currentStoreName}
                onChange={(e) => setCurrentStoreName(e.target.value)}
                placeholder="Например: ВкусВилл, Перекрёсток..."
                className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5 flex items-center justify-between">
                <span>Адрес точки:</span>
                {reverseAddressLoading && <span className="text-[10px] text-stone-400">Определение...</span>}
              </label>
              <input
                type="text"
                value={currentAddress}
                onChange={(e) => setCurrentAddress(e.target.value)}
                placeholder="Адрес или ориентир..."
                className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
