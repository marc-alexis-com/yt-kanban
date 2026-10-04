// Thin fetch wrapper. When the app sits behind a login proxy (tinyauth,
// Authelia…), an expired session turns API calls into redirects to the login
// page: we stop following them and tell the UI to offer a reload instead of
// failing silently.
import { ref } from 'vue';

export const sessionExpired = ref(false);

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      redirect: 'manual',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Network unreachable (${err.message})`);
  }
  if (res.type === 'opaqueredirect' || res.status === 401) {
    sessionExpired.value = true;
    throw new Error('Session expired');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  config: () => request('GET', '/api/config'),
  videos: () => request('GET', '/api/videos'),
  add: (urls) => request('POST', '/api/videos', { urls }),
  update: (id, patch) => request('PATCH', `/api/videos/${id}`, patch),
  remove: (id) => request('DELETE', `/api/videos/${id}`),
  renameTheme: (from, to) => request('POST', '/api/themes/rename', { from, to }),
  suggest: () => request('POST', '/api/triage/suggest'),
  applyTriage: (assignments) => request('POST', '/api/triage/apply', { assignments }),
  import: (file) => request('POST', '/api/import', file),
};
