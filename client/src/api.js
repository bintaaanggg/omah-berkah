const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'ob_token';
const USER_KEY = 'ob_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};
export const saveSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export async function api(path, { method='GET', body, auth=false } = {}) {
  const headers = {'Content-Type':'application/json'};
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let res;
  try { res = await fetch(`${API_URL}/api${path}`, {method, headers, body: body ? JSON.stringify(body) : undefined}); }
  catch { throw new Error('Backend tidak dapat dihubungi. Pastikan API berjalan.'); }
  let data={}; try { data=await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request gagal (${res.status})`);
  return data;
}
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  let res;
  try {
    res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      body: formData,
    });
  } catch { throw new Error('Backend tidak dapat dihubungi. Pastikan API berjalan.'); }
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Upload gagal (${res.status})`);
  return data.url;
}

export { API_URL };
