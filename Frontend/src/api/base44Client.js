const APP_ID = "68c7a10605a1f2c7944e5a4e";
const API_KEY = "c9bc6c2964914f0b8176e95548abea10";
const BASE_URL = `https://app.base44.com/api/apps/${APP_ID}`;

const headers = {
  'api_key': API_KEY,
  'Content-Type': 'application/json'
};


export const base44 = {
  auth: {
    // Mimicking Auth using the User/Student entity
    me: async () => {
      const response = await fetch(`${BASE_URL}/entities/Student`, { headers });
      const students = await response.json();
      // For demo: returns the first student or a guest object
      return students[0] || { full_name: "Admin User", email: "admin@proctorguard.com" };
    },
    logout: async () => {
      localStorage.clear();
      return Promise.resolve();
    }
  }
};

export const createEntityClient = (entityName) => ({
  list: async () => {
    const response = await fetch(`${BASE_URL}/entities/${entityName}`, { headers });
    const data = await response.json();
    // Handle both { data: [...] } and [...] response formats
    return Array.isArray(data) ? data : (data.data || data.results || []);
  },
  filter: async (params) => {
    // Base44 supports query params for filtering
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/entities/${entityName}?${query}`, { headers });
    const data = await response.json();
    // Handle both { data: [...] } and [...] response formats
    return Array.isArray(data) ? data : (data.data || data.results || []);
  },
  create: async (data) => {
    const response = await fetch(`${BASE_URL}/entities/${entityName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await response.json();
    // Return the created item itself (handle both { data: {...} } and direct object)
    return Array.isArray(result) ? result[0] : (result.data || result);
  },
  update: async (id, data) => {
    const response = await fetch(`${BASE_URL}/entities/${entityName}/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    const result = await response.json();
    return Array.isArray(result) ? result[0] : (result.data || result);
  },
  delete: async (id) => {
    return fetch(`${BASE_URL}/entities/${entityName}/${id}`, {
      method: 'DELETE',
      headers
    });
  }
});