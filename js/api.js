class APIHandler {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.bearerToken = null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (this.bearerToken) {
      config.headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    try {
      console.log('Making API request:', {
        url,
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body
      });

      const response = await fetch(url, config);

      console.log('API response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint, headers = {}) {
    return this.request(endpoint, {
      method: 'GET',
      headers
    });
  }

  async post(endpoint, data, headers = {}) {
    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data, headers = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint, headers = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      headers
    });
  }
}

// Export for use in other modules
const api = new APIHandler('http://localhost:5000/api');
window.api = api;