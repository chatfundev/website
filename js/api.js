class APIHandler {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.bearerToken = null;
  }

  handleAuthenticationError() {
    // Only handle authentication errors globally if we're in the app
    // Don't interfere with login/register page error handling
    const currentPage = window.location.pathname;
    const isAuthPage = currentPage.includes('login.html') || currentPage.includes('register.html') || currentPage.includes('index.html');

    if (isAuthPage) {
      // Let the auth pages handle their own 401 errors
      return;
    }

    // Clear the invalid token
    if (window.clearAuthToken) {
      window.clearAuthToken();
    } else {
      localStorage.removeItem('authToken');
    }

    // Show a brief notification before redirect
    try {
      // Create a simple notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #e74c3c;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      notification.textContent = 'Your session has expired. Redirecting to login...';
      document.body.appendChild(notification);

      // Remove notification after redirect
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 2000);
    } catch (e) {
      // Ignore notification errors
    }

    // Redirect to login page after a brief delay
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
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

          // Preserve additional error data for specific handling
          if (errorData.dm_disabled) {
            const error = new Error(errorMessage);
            error.dm_disabled = errorData.dm_disabled;
            error.username = errorData.username;
            throw error;
          }
        } catch (e) {
          // If response is not JSON, use status text
          if (e.dm_disabled) {
            // Re-throw the enhanced error
            throw e;
          }
          errorMessage = response.statusText || errorMessage;
        }

        // Handle authentication errors globally
        if (response.status === 401) {
          console.warn('Authentication failed - token expired or invalid');
          // Check if error message indicates specific issue
          if (errorMessage.toLowerCase().includes('expired')) {
            console.warn('Token has expired');
          } else if (errorMessage.toLowerCase().includes('invalid')) {
            console.warn('Token is invalid');
          }

          // Only redirect if we're not on auth pages (login/register)
          const currentPath = window.location.pathname;
          const isAuthPage = currentPath.includes('login.html') ||
            currentPath.includes('register.html') ||
            currentPath.includes('index.html');

          if (!isAuthPage) {
            this.handleAuthenticationError();
          }
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