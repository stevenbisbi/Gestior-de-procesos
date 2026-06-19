// API helper with token auth
const API_BASE = '/api';
const TOKEN_KEY = 'tuberia_token';

export const getToken  = () => localStorage.getItem(TOKEN_KEY);
export const setToken  = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new Error('No autenticado');
  }
  if (!res.ok) {
    let detail = 'Error en la petición';
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get:    (p)        => request(p),
  post:   (p, body)  => request(p, { method: 'POST',  body: JSON.stringify(body) }),
  put:    (p, body)  => request(p, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  (p, body)  => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (p)        => request(p, { method: 'DELETE' }),
};

// Endpoints concretos
export const Auth = {
  login:  (username, password) => api.post('/auth/login/', { username, password }),
  logout: () => api.post('/auth/logout/'),
  me:     () => api.get('/auth/me/'),
};

export const Batches = {
  list:    (params = {}) => api.get('/batches/?' + new URLSearchParams(params)),
  get:     (id)          => api.get(`/batches/${id}/`),
  create:  (data)        => api.post('/batches/', data),
  update:  (id, data)    => api.patch(`/batches/${id}/`, data),
  receive: (id, data)    => api.post(`/batches/${id}/receive/`, data || {}),
  dispatch:(id)          => api.post(`/batches/${id}/dispatch/`),  // url_path='dispatch' on backend
};

export const Records = {
  get:    (id)         => api.get(`/records/${id}/`),
  start:  (id, data)   => api.post(`/records/${id}/start/`, data),
  finish: (id, data)   => api.post(`/records/${id}/finish/`, data),
  rework: (id, data)   => api.post(`/records/${id}/rework/`, data),
};

export const Catalog = {
  products:       ()      => api.get('/product-types/'),
  createProduct:  (data)  => api.post('/product-types/', data),
  machines:       ()      => api.get('/machines/'),
  tubes:          ()      => api.get('/tube-specs/'),
  createTube:     (data)  => api.post('/tube-specs/', data),
};

export const Dashboard = {
  supervisor:     () => api.get('/supervisor/dashboard/'),
  machinesStatus: () => api.get('/supervisor/machines/'),
  operatorTasks:  () => api.get('/operator/tasks/'),
};

export const Quality = {
  list:    (params = {}) => api.get('/quality/checks/?' + new URLSearchParams(params)),
  byRecord:(rid)         => api.get(`/quality/checks/?record=${rid}`),
  get:     (id)          => api.get(`/quality/checks/${id}/`),
  create:  (data)        => api.post('/quality/checks/', data),
  update:  (id, data)    => api.put(`/quality/checks/${id}/`, data),
  report:  ()            => api.get('/quality/report/'),
};

export const DimLogs = {
  byRecord: (rid) => api.get(`/quality/logs/?record=${rid}`),
  create:   (data)=> api.post('/quality/logs/', data),
};

export const CuttingPrograms = {
  list:    ()        => api.get('/cutting-programs/'),
  get:     (id)      => api.get(`/cutting-programs/${id}/`),
  active:  ()        => api.get('/cutting-programs/active/'),
  create:  (data)    => api.post('/cutting-programs/', data),
  update:  (id,data) => api.patch(`/cutting-programs/${id}/`, data),
  activate:(id)      => api.post(`/cutting-programs/${id}/activate/`),
  close:   (id)      => api.post(`/cutting-programs/${id}/close/`),
};

export const CuttingLines = {
  create:  (data)    => api.post('/cutting-lines/', data),
  update:  (id,data) => api.patch(`/cutting-lines/${id}/`, data),
  delete:  (id)      => api.delete(`/cutting-lines/${id}/`),
};

export const TubeReceptions = {
  list:    (params = {}) => api.get('/tube-receptions/?' + new URLSearchParams(params)),
  create:  (data)        => api.post('/tube-receptions/', data),
  basket:  ()            => api.get('/tube-receptions/basket/'),
};
