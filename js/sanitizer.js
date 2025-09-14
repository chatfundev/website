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

/**
 * Parse markdown text and convert to safe HTML elements
 * Supports: bold (**text**), italic (*text*), underline (__text__), inline code (`text`)
 * @param {string} text - The markdown text to parse
 * @returns {DocumentFragment} - A document fragment containing the parsed elements
 */
function parseMarkdownSafe(text) {
  if (!text || typeof text !== 'string') {
    return document.createDocumentFragment();
  }

  const fragment = document.createDocumentFragment();

  // Escape HTML first to prevent XSS
  let sanitized = escapeHtml(text);

  // Define markdown patterns in order of precedence (most specific first)
  const patterns = [
    { regex: /\*\*(.*?)\*\*/g, tag: 'strong', className: 'markdown-bold' },
    { regex: /__(.*?)__/g, tag: 'u', className: 'markdown-underline' },
    { regex: /\*(.*?)\*/g, tag: 'em', className: 'markdown-italic' },
    { regex: /`(.*?)`/g, tag: 'code', className: 'markdown-code' }
  ];

  // Find all matches with their positions
  const matches = [];

  patterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(sanitized)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        fullMatch: match[0],
        content: match[1],
        tag: pattern.tag,
        className: pattern.className
      });
    }
  });

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep the first one)
  const validMatches = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    let isValid = true;

    // Check if this match overlaps with any previous valid match
    for (let j = 0; j < validMatches.length; j++) {
      const previous = validMatches[j];
      if (current.start < previous.end && current.end > previous.start) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      validMatches.push(current);
    }
  }

  // Build the final content
  let currentPos = 0;

  validMatches.forEach(match => {
    // Add text before the match
    if (match.start > currentPos) {
      const beforeText = sanitized.substring(currentPos, match.start);
      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }
    }

    // Add the formatted element
    const element = createSafeElement(match.tag, match.content, match.className);
    if (element) {
      fragment.appendChild(element);
    }

    currentPos = match.end;
  });

  // Add remaining text after the last match
  if (currentPos < sanitized.length) {
    const remainingText = sanitized.substring(currentPos);
    if (remainingText) {
      fragment.appendChild(document.createTextNode(remainingText));
    }
  }

  // If no matches were found and no content was added, add the original text
  if (validMatches.length === 0 && fragment.childNodes.length === 0) {
    fragment.appendChild(document.createTextNode(sanitized));
  }

  return fragment;
}

/**
 * @param {string} tagName - The tag name for the container element
 * @param {string} markdownText - The markdown text to parse
 * @param {string} className - Optional class name for the container
 * @returns {HTMLElement} - The created element with parsed markdown content
 */
function createSafeElementWithMarkdown(tagName, markdownText, className) {
  try {
    if (!tagName || typeof tagName !== 'string') {
      console.error('Invalid tagName provided to createSafeElementWithMarkdown:', tagName);
      return null;
    }

    const element = document.createElement(tagName);
    if (className && typeof className === 'string') {
      element.className = className;
    }

    if (markdownText !== null && markdownText !== undefined) {
      const parsedContent = parseMarkdownSafe(String(markdownText));
      element.appendChild(parsedContent);
    }

    return element;
  } catch (error) {
    console.error('Error creating safe element with markdown:', error);
    return null;
  }
}
