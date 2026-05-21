const API_BASE = import.meta.env.VITE_API_BASE || '';

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

export async function uploadImage(file, token) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '上传失败');
  return data;
}
