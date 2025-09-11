// Social Spy Functionality

// Global variables for social spy
let currentSpyTarget = null;
let currentSpyConversationId = null;
let spyPollingInterval = null;

// Initialize social spy when the tab is opened
function initializeSocialSpy() {
  setupSocialSpyEventListeners();
  showUsernameInputScreen();
}

function setupSocialSpyEventListeners() {
  const usernameInput = document.querySelector('.socialspy-username-input');
  const startButton = document.querySelector('.socialspy-start-button');

  if (usernameInput) {
    // Start monitoring on Enter key
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const username = e.target.value.trim();
        if (username.length >= 1) {
          startSpying(username);
        }
      }
    });
  }

  if (startButton) {
    startButton.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      if (username.length >= 1) {
        startSpying(username);
      } else {
        console.error('Please enter a username');
      }
    });
  }
}

// Show the username input screen
function showUsernameInputScreen() {
  const inputScreen = document.querySelector('.socialspy-input-screen');
  const mainSpy = document.querySelector('.socialspy-main');

  if (inputScreen) {
    inputScreen.style.display = 'flex';
  }
  if (mainSpy) {
    mainSpy.style.display = 'none';
  }
}

// Start spying on a user
async function startSpying(username) {
  try {
    console.log('Starting spy on username:', username);
    console.log('User role:', window.USER_ROLE);
    console.log('Token exists:', !!localStorage.getItem('token'));

    currentSpyTarget = username;

    // Clear input
    const usernameInput = document.querySelector('.socialspy-username-input');
    if (usernameInput) {
      usernameInput.value = '';
    }

    // Update target info
    const targetUsername = document.querySelector('.target-username');
    if (targetUsername) {
      targetUsername.textContent = username;
    }

    // Hide input screen and show main spy area
    const inputScreen = document.querySelector('.socialspy-input-screen');
    const mainSpy = document.querySelector('.socialspy-main');

    if (inputScreen) {
      inputScreen.style.display = 'none';
    }
    if (mainSpy) {
      mainSpy.style.display = 'block';
    }

    // Load user's conversations
    await loadSpyTargetConversations(username);

  } catch (error) {
    console.error('Error starting spy:', error);
    alert('Failed to start monitoring user: ' + error.message);
  }
}// Go back to username input screen
function goBackToSpyInput() {
  // Clean up current spy session
  stopSpyMessagePolling();
  currentSpyTarget = null;
  currentSpyConversationId = null;

  // Show input screen
  showUsernameInputScreen();

  // Clear conversations list
  const conversationsList = document.querySelector('#socialspy-conversations-list');
  if (conversationsList) {
    conversationsList.innerHTML = '';
  }

  // Clear messages
  const messagesContainer = document.querySelector('#socialspy-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = `
      <div class="socialspy-placeholder">
        <i class="fas fa-eye"></i>
        <h3>Social Spy Mode</h3>
        <p>Select a conversation to view messages</p>
      </div>
    `;
  }
}

// Load conversations for the spy target
async function loadSpyTargetConversations(username) {
  try {
    console.log('Loading conversations for username:', username);
    console.log('Making API request to get spy target conversations');

    const data = await window.api.get('/socialspy/user/' + encodeURIComponent(username) + '/conversations', {
      method: 'GET'
    });

    displaySpyConversations(data.conversations);
  } catch (error) {
    console.error('Error loading conversations:', error);
    alert('Failed to load conversations: ' + error.message);
  }
}

// Display conversations in the spy sidebar - using exact same structure as normal DMs
function displaySpyConversations(conversations) {
  const conversationsList = document.querySelector('#socialspy-conversations-list');

  if (!conversationsList) return;

  // Clear existing conversations
  conversationsList.innerHTML = '';

  if (conversations.length === 0) {
    // Use same empty state as normal DMs
    const emptyStateDiv = document.createElement('div');
    emptyStateDiv.className = 'empty-conversations-state';
    emptyStateDiv.innerHTML = `
      <div class="empty-conversations-content">
        <div class="empty-conversations-icon">
          <i class="fas fa-comments"></i>
        </div>
        <h3>No conversations found</h3>
        <p>This user has no conversations to monitor</p>
      </div>
    `;
    conversationsList.appendChild(emptyStateDiv);
    return;
  }

  // Create conversation elements using the same structure as normal DMs
  conversations.forEach(conv => {
    const conversationElement = createSpyConversationElement(conv);
    conversationsList.appendChild(conversationElement);
  });
}

// Create conversation element using exact same structure as normal DMs
function createSpyConversationElement(conversation) {
  const conversationDiv = document.createElement('div');
  conversationDiv.className = 'conversation-item';
  conversationDiv.setAttribute('data-conversation-id', conversation.conversation_id);
  conversationDiv.setAttribute('data-username', conversation.other_user.username);

  const statusClass = conversation.other_user.status === 'online' ? 'online' :
    conversation.other_user.status === 'idle' ? 'idle' : 'offline';

  // Create avatar element with status indicator - use local copy of function
  const avatarContainer = createSpyAvatarElement(conversation.other_user.id, conversation.other_user.has_avatar, 'conversation-avatar');
  const statusIndicator = document.createElement('span');
  statusIndicator.className = `status-indicator ${statusClass}`;
  avatarContainer.appendChild(statusIndicator);

  // Create conversation content
  const conversationContent = document.createElement('div');
  conversationContent.className = 'conversation-content';

  // Create header
  const conversationHeader = document.createElement('div');
  conversationHeader.className = 'conversation-header';

  const conversationName = createSpySafeElement('span', conversation.other_user.username, 'conversation-name');
  conversationHeader.appendChild(conversationName);

  // Create unread badge if needed
  if (conversation.unread_count > 0) {
    const unreadBadge = createSpySafeElement('span', conversation.unread_count.toString(), 'unread-badge');
    conversationHeader.appendChild(unreadBadge);
  }

  // Create last message
  const lastMessage = createSpySafeElement('div', conversation.last_message || 'No messages yet', 'last-message');

  // Create status text
  const conversationStatus = createSpySafeElement('div', conversation.other_user.status_text || '', 'conversation-status');

  // Assemble conversation content
  conversationContent.appendChild(conversationHeader);
  conversationContent.appendChild(lastMessage);
  conversationContent.appendChild(conversationStatus);

  // Assemble full conversation element
  conversationDiv.appendChild(avatarContainer);
  conversationDiv.appendChild(conversationContent);

  // Add click handler
  conversationDiv.addEventListener('click', () => {
    selectSpyConversation(conversation.conversation_id, conversation.other_user.username);
  });

  return conversationDiv;
}

// Select a conversation to spy on - using same logic as normal DMs
async function selectSpyConversation(conversationId, otherUsername) {
  try {
    currentSpyConversationId = conversationId;

    // Clear any existing polling
    if (spyPollingInterval) {
      clearInterval(spyPollingInterval);
      spyPollingInterval = null;
    }

    // Highlight selected conversation (same as normal DMs)
    const conversationItems = document.querySelectorAll('#socialspy-conversations-list .conversation-item');

    // Remove active class from all conversations
    conversationItems.forEach(item => item.classList.remove('active'));

    // Add active class to selected conversation
    conversationItems.forEach(item => {
      if (item.getAttribute('data-conversation-id') === conversationId) {
        item.classList.add('active');

        // Remove unread badge (same as normal DMs)
        const unreadBadge = item.querySelector('.unread-badge');
        if (unreadBadge) {
          unreadBadge.remove();
        }
      }
    });

    // Update conversation header (same as normal DMs)
    const userNameElement = document.querySelector('.socialspy-dms-layout .dm-user-name');
    const userStatusElement = document.querySelector('.socialspy-dms-layout .dm-user-status');

    if (userNameElement) {
      userNameElement.textContent = otherUsername;
    }
    if (userStatusElement) {
      userStatusElement.textContent = 'Social Spy Mode - Read Only';
    }

    // Load messages for this conversation
    await loadSpyConversationMessages(currentSpyTarget, conversationId);

    // Start polling for new messages
    startSpyMessagePolling();

  } catch (error) {
    console.error('Error selecting spy conversation:', error);
    alert('Failed to load conversation: ' + error.message);
  }
}

// Load messages for the selected conversation
async function loadSpyConversationMessages(username, conversationId) {
  try {
    const data = await window.api.get(`/socialspy/user/${encodeURIComponent(username)}/conversations/${conversationId}/messages`);

    displaySpyMessages(data.messages, data.target_user);
  } catch (error) {
    console.error('Error loading messages:', error);
    alert('Failed to load messages');
  }
}

// Display messages in the spy interface - using exact same structure as normal DMs
function displaySpyMessages(messages, targetUser) {
  const messagesContainer = document.querySelector('#socialspy-messages');

  if (!messagesContainer) return;

  // Clear existing messages
  messagesContainer.innerHTML = '';

  if (messages.length === 0) {
    // Use same empty state as normal DMs
    const emptyState = document.createElement('div');
    emptyState.className = 'dm-empty-state';
    emptyState.innerHTML = `
      <div class="empty-state-content">
        <i class="fas fa-envelope empty-state-icon"></i>
        <h3>No messages yet</h3>
        <p>This conversation has no messages to monitor</p>
      </div>
    `;
    messagesContainer.appendChild(emptyState);
    return;
  }

  // Add messages using the exact same function as normal DMs
  messages.forEach(message => {
    // Handle different timestamp formats and convert to local time
    let messageTime;
    try {
      let date;
      if (typeof message.timestamp === 'string') {
        // ISO string format from server (UTC)
        date = new Date(message.timestamp);
      } else if (typeof message.timestamp === 'number') {
        // Unix timestamp (in seconds or milliseconds)
        date = new Date(message.timestamp < 1e12 ? message.timestamp * 1000 : message.timestamp);
      } else {
        // Fallback for other formats
        date = new Date(message.timestamp);
      }

      // Format timestamp
      messageTime = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error parsing timestamp:', error);
      messageTime = 'Unknown time';
    }

    // Create message data in the exact same format as normal DMs
    const messageData = {
      id: message.id,
      content: message.content,
      is_own: message.is_target_user, // For spy mode, "is_own" means it's from the target user
      time: messageTime,
      reactions: message.reactions,
      reply_to: message.reply_to,
      badge: message.sender.badge,
      sender: message.sender
    };

    // Use the same addDMMessage function from normal DMs
    addSpyMessage(messageData);
  });

  // Don't auto-scroll in spy mode - let user control scroll position
}

// Add spy message using exact same logic as addDMMessage but targeting socialspy container
function addSpyMessage(messageData) {
  const messagesContainer = document.querySelector('#socialspy-messages');

  // Handle message data in exact same format as normal DMs
  const type = messageData.is_own ? 'sent' : 'received';
  const text = messageData.content;
  const time = messageData.time || messageData.timestamp;
  const reactions = messageData.reactions;
  const replyTo = messageData.reply_to;
  const messageId = messageData.id;
  const senderId = messageData.sender ? messageData.sender.id : null;
  const hasAvatar = messageData.sender ? messageData.sender.has_avatar : false;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message'; // Use same class as global chat
  messageDiv.setAttribute('data-message-id', messageId);

  // For spy mode, show the actual usernames
  let username, badge, userId, userHasAvatar;

  if (type === 'received') {
    username = messageData.sender ? messageData.sender.username : 'Unknown';
    badge = messageData.badge;
    userId = senderId;
    userHasAvatar = hasAvatar;
  } else if (type === 'sent') {
    // For target user messages, use their info
    username = messageData.sender ? messageData.sender.username : currentSpyTarget;
    badge = messageData.badge;
    userId = senderId;
    userHasAvatar = hasAvatar;
  }

  // Format timestamp (same as normal DMs)
  let timeString;
  if (typeof time === 'string' && time.includes(':')) {
    timeString = time; // Already formatted
  } else {
    const timestamp = new Date();
    timeString = timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Build reply preview if this is a reply (same as normal DMs)
  let replyContainer = null;
  if (replyTo) {
    replyContainer = document.createElement('div');
    replyContainer.className = 'dm-message-reply-preview';

    const replyUsername = createSpySafeElement('div', replyTo.sender_username, 'dm-reply-to-username');
    const replyContent = createSpySafeElement('div', replyTo.content, 'dm-reply-to-content');

    replyContainer.appendChild(replyUsername);
    replyContainer.appendChild(replyContent);
  }

  // Build reactions if present (same as normal DMs)
  let reactionsContainer = null;
  if (reactions && Object.keys(reactions).length > 0) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'dm-message-reactions';

    Object.entries(reactions).forEach(([emoji, users]) => {
      const reactionSpan = document.createElement('span');
      reactionSpan.className = 'dm-reaction';
      reactionSpan.setAttribute('data-emoji', emoji);

      const emojiText = document.createTextNode(emoji + ' ');
      const countSpan = createSpySafeElement('span', users.length.toString(), 'dm-reaction-count');

      reactionSpan.appendChild(emojiText);
      reactionSpan.appendChild(countSpan);
      reactionsContainer.appendChild(reactionSpan);
    });
  }

  // Create avatar element (same as normal DMs)
  const avatarElement = createSpyAvatarElement(userId, userHasAvatar, 'message-avatar');

  // Create message content container
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';

  // Add reply preview if exists
  if (replyContainer) {
    messageContent.appendChild(replyContainer);
  }

  // Create user span with badge (same as normal DMs)
  const userSpan = document.createElement('span');
  userSpan.className = 'message-user';

  // Add badge if exists
  if (badge && badge !== 'user') {
    const badgeIcons = {
      mod: '<i class="fa fa-shield"></i>',
      admin: '<i class="fa fa-tools"></i>',
      owner: '<i class="fa fa-crown"></i>',
      shadowbanned: '<i class="fa fa-user-slash"></i>'
    };
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'message-role';
    badgeSpan.innerHTML = `[${badgeIcons[badge]} ${badge}] `;
    userSpan.appendChild(badgeSpan);

    const usernameText = document.createTextNode(`${username}:`);
    userSpan.appendChild(usernameText);
  } else {
    userSpan.textContent = `${username}:`;
  }

  // Create message text span with safe content
  const messageTextSpan = createSpySafeElement('span', text, 'message-text');

  // Create time span
  const timeSpan = createSpySafeElement('span', timeString, 'message-time');

  // Assemble the message content
  messageContent.appendChild(userSpan);
  messageContent.appendChild(messageTextSpan);
  messageContent.appendChild(timeSpan);

  // Add reactions if present
  if (reactionsContainer) {
    messageContent.appendChild(reactionsContainer);
  }

  // Assemble the full message
  messageDiv.appendChild(avatarElement);
  messageDiv.appendChild(messageContent);

  messagesContainer.appendChild(messageDiv);
}

// Start polling for new messages in spy mode
function startSpyMessagePolling() {
  // Clear existing polling
  if (spyPollingInterval) {
    clearInterval(spyPollingInterval);
  }

  // Start new polling
  spyPollingInterval = setInterval(async () => {
    if (currentSpyTarget && currentSpyConversationId) {
      await loadSpyConversationMessages(currentSpyTarget, currentSpyConversationId);
    }
  }, 3000); // Poll every 3 seconds
}

// Stop spy message polling
function stopSpyMessagePolling() {
  if (spyPollingInterval) {
    clearInterval(spyPollingInterval);
    spyPollingInterval = null;
  }
}

// Clean up spy functionality when leaving the tab
function cleanupSocialSpy() {
  stopSpyMessagePolling();
  currentSpyTarget = null;
  currentSpyConversationId = null;

  // Show input screen
  showUsernameInputScreen();
}

// Export functions for use in main app.js
window.socialSpyFunctions = {
  initializeSocialSpy,
  cleanupSocialSpy,
  startSpying,
  goBackToSpyInput,
  selectSpyConversation
};

// Make functions globally accessible for HTML onclick
window.goBackToSpyInput = goBackToSpyInput;
window.selectSpyConversation = selectSpyConversation;

// =====================================
// UTILITY FUNCTIONS (copied from main app)
// =====================================

// Create safe element function (from sanitizer.js)
function createSpySafeElement(tagName, textContent, className) {
  const allowedTags = ['div', 'span', 'p', 'a', 'strong', 'em', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  if (!allowedTags.includes(tagName)) {
    console.error('Invalid tagName provided to createSpySafeElement:', tagName);
    return null;
  }

  const element = document.createElement(tagName);

  if (textContent) {
    element.textContent = textContent;
  }

  if (className) {
    element.className = className;
  }

  return element;
}

// Get avatar URL function (from app.js)
function getSpyAvatarUrl(userId, hasAvatar) {
  // Get user settings - simplified version
  const settings = { hideProfilePictures: false }; // Default

  // If user has disabled profile pictures, always return null for default avatar
  if (settings.hideProfilePictures) {
    return null;
  }

  // Return avatar URL if user has one
  return hasAvatar ? `${window.api.baseURL}/profile/avatar/${userId}` : null;
}

// Create avatar element function (from app.js)
function createSpyAvatarElement(userId, hasAvatar, className = 'message-avatar') {
  const avatarUrl = getSpyAvatarUrl(userId, hasAvatar);

  const avatarContainer = document.createElement('div');
  avatarContainer.className = className;

  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = 'Avatar';
    img.onerror = function () {
      this.style.display = 'none';
      this.nextElementSibling.style.display = 'flex';
    };

    const defaultAvatar = document.createElement('div');
    defaultAvatar.className = 'default-avatar';
    defaultAvatar.style.display = 'none';
    defaultAvatar.innerHTML = '<i class="fas fa-user"></i>';

    avatarContainer.appendChild(img);
    avatarContainer.appendChild(defaultAvatar);
  } else {
    const defaultAvatar = document.createElement('div');
    defaultAvatar.className = 'default-avatar';
    defaultAvatar.innerHTML = '<i class="fas fa-user"></i>';
    avatarContainer.appendChild(defaultAvatar);
  }

  return avatarContainer;
}
