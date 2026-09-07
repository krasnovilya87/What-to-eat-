// Centralized API client with automatic backend URL resolution and safe response parsing

const CLOUD_RUN_BACKEND = 'https://ais-pre-3izdkmsaofonpkjibb4336-29735408137.asia-east1.run.app';

export function getApiBaseUrl(): string {
  // If explicitly configured in env
  const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envApiUrl) {
    return envApiUrl.replace(/\/$/, '');
  }

  // If running in browser
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // When hosted on Firebase Hosting, GitHub Pages, Vercel, or external static hosting
    if (
      hostname.endsWith('.web.app') ||
      hostname.endsWith('.firebaseapp.com') ||
      hostname.endsWith('.github.io') ||
      hostname.endsWith('.vercel.app')
    ) {
      return CLOUD_RUN_BACKEND;
    }
  }

  // By default (Cloud Run, local Vite dev server with proxy), use relative paths
  return '';
}

export async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${getApiBaseUrl()}${normalizedEndpoint}`;

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr: any) {
    throw new Error('Ошибка сети при обращении к серверу. Проверьте интернет-соединение.');
  }

  const contentType = response.headers.get('content-type') || '';

  // If content-type is not JSON or is HTML (from SPA routing fallback)
  if (!contentType.includes('application/json')) {
    try {
      const text = await response.text();
      if (text.trim().startsWith('<')) {
        throw new Error('Сервер распознавания недоступен на статическом хостинге.');
      }
      throw new Error(`Неожиданный ответ сервера: ${text.slice(0, 80)}`);
    } catch (textErr: any) {
      throw new Error(textErr.message || 'Сервер распознавания недоступен на статическом хостинге.');
    }
  }

  let data: any;
  try {
    const rawText = await response.text();
    if (rawText.trim().startsWith('<')) {
      throw new Error('Сервер распознавания недоступен на статическом хостинге.');
    }
    data = JSON.parse(rawText);
  } catch (parseErr: any) {
    throw new Error('Сервер распознавания рецептов недоступен на статическом хостинге.');
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Ошибка сервера (${response.status})`;
    throw new Error(errorMessage);
  }

  return data as T;
}
