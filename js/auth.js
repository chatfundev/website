function getAuthToken() {
  return localStorage.getItem("authToken");
}

function setAuthToken(token) {
  localStorage.setItem("authToken", token);
  api.bearerToken = token;
}

function clearAuthToken() {
  localStorage.removeItem("authToken");
  api.bearerToken = null;
}

async function register(username, password) {
  try {
    const data = await api.post('/auth/register', { username, password });

    if (data.access_token) {
      setAuthToken(data.access_token);
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'Registration failed' };
    }
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: error.message || 'Registration failed' };
  }
}

async function login(username, password) {
  try {
    const data = await api.post('/auth/login', { username, password });

    if (data.access_token) {
      setAuthToken(data.access_token);
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message || 'Login failed' };
  }
}

function logout() {
  clearAuthToken();
  window.location.href = 'login.html';
}

// Utility function to show error messages
function showError(message, containerId = 'error-container') {
  let errorContainer = document.getElementById(containerId);

  if (!errorContainer) {
    // Create error container if it doesn't exist
    errorContainer = document.createElement('div');
    errorContainer.id = containerId;
    errorContainer.className = 'error-container';

    // Insert before the form
    const form = document.querySelector('form');
    form.parentNode.insertBefore(errorContainer, form);
  }

  errorContainer.innerHTML = `
    <div class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      <span>${message}</span>
    </div>
  `;
  errorContainer.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }, 5000);
}

// Utility function to show success messages
function showSuccess(message, containerId = 'success-container') {
  let successContainer = document.getElementById(containerId);

  if (!successContainer) {
    // Create success container if it doesn't exist
    successContainer = document.createElement('div');
    successContainer.id = containerId;
    successContainer.className = 'success-container';

    // Insert before the form
    const form = document.querySelector('form');
    form.parentNode.insertBefore(successContainer, form);
  }

  successContainer.innerHTML = `
    <div class="success-message">
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    </div>
  `;
  successContainer.style.display = 'block';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (successContainer) {
      successContainer.style.display = 'none';
    }
  }, 3000);
}

// Check if user is already logged in
function checkAuthStatus() {
  const token = getAuthToken();
  if (token) {
    // Redirect to app if already logged in
    window.location.href = 'app.html';
  }
}

window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuthToken = clearAuthToken;
window.register = register;
window.login = login;
window.logout = logout;
window.showError = showError;
window.showSuccess = showSuccess;
window.checkAuthStatus = checkAuthStatus;