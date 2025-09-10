/**
 * Client-side HTML sanitization utilities for preventing XSS attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize text content for safe HTML insertion
 * @param {string} content - The content to sanitize
 * @returns {string} - The sanitized content
 */
function sanitizeContent(content) {
  if (!content) return '';

  // First escape HTML
  let sanitized = escapeHtml(content);

  // Additional protection against encoded scripts
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  return sanitized;
}

/**
 * Safely set HTML content using textContent to prevent XSS
 * @param {HTMLElement} element - The element to set content on
 * @param {string} content - The content to set
 */
function setSafeTextContent(element, content) {
  if (element && content !== undefined) {
    element.textContent = content;
  }
}

/**
 * Create a safe text node
 * @param {string} content - The content for the text node
 * @returns {Text} - A text node with the safe content
 */
function createSafeTextNode(content) {
  return document.createTextNode(content || '');
}

/**
 * Safely create HTML elements with text content
 * @param {string} tagName - The tag name to create
 * @param {string} textContent - The text content to set
 * @param {string} className - Optional class name
 * @returns {HTMLElement} - The created element
 */
function createSafeElement(tagName, textContent, className) {
  try {
    if (!tagName || typeof tagName !== 'string') {
      console.error('Invalid tagName provided to createSafeElement:', tagName);
      return null;
    }

    const element = document.createElement(tagName);
    if (textContent !== null && textContent !== undefined) {
      element.textContent = String(textContent);
    }
    if (className && typeof className === 'string') {
      element.className = className;
    }
    return element;
  } catch (error) {
    console.error('Error creating safe element:', error);
    return null;
  }
}
