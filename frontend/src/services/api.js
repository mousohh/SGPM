const BASE_URL = '/api'

const getToken = () => localStorage.getItem('token')

const headers = () => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export const api = {
  get: async (url) => {
    const res = await fetch(`${BASE_URL}${url}`, { headers: headers() })
    return res.json()
  },
  post: async (url, body) => {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body)
    })
    return res.json()
  },
  put: async (url, body) => {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT', headers: headers(), body: JSON.stringify(body)
    })
    return res.json()
  },
  patch: async (url, body = {}) => {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify(body)
    })
    return res.json()
  },
  delete: async (url) => {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE', headers: headers()
    })
    return res.json()
  }
}