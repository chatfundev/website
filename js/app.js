document.addEventListener('DOMContentLoaded', function () {
  // =====================================
  // CONFIGURATION & GLOBAL VARIABLES
  // =====================================

  // User Information - make them global properties
  window.USER_ROLE = null;
  window.USER_ID = null;
  window.CURRENT_USERNAME = null;
  window.CURRENT_USER_HAS_AVATAR = false;

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const chatMessages = document.getElementById('chat-messages');
  const chatInputContainer = document.querySelector('.chat-input-container');

  // Mute functionality variables
  let muteExpiry = null;
  let muteCountdownInterval = null;

  // Context menu variables
  let currentMessageElement = null;
  let currentMessageAuthor = null;
  let currentMessageId = null;
  let currentReplyTo = null;

  // =====================================
  // MARKDOWN PARSER
  // =====================================
  // AUTHENTICATION UTILITIES
  // =====================================

  function validateAuthenticationAndRedirect() {
    const token = window.getAuthToken();
    if (!token) {
      console.warn('No authentication token found - redirecting to login');
      window.location.href = 'login.html';
      return false;
    }

    // Set token for API calls
    if (window.api) {
      window.api.bearerToken = token;
    }

    return true;
  }

  // =====================================
  // TAB SWITCHING FUNCTIONALITY
  // =====================================

  function initializeTabSwitching() {
    navItems.forEach(item => {
      item.addEventListener('click', async function () {
        const tabId = this.getAttribute('data-tab');

        // Clean up DM polling when leaving DMs tab
        if (dmPollingInterval && tabId !== 'dms') {
          clearInterval(dmPollingInterval);
          dmPollingInterval = null;
          currentDMConversation = null;
          currentConversationId = null;
        }

        // Clean up social spy when leaving social spy tab
        if (tabId !== 'socialspy' && window.socialSpyFunctions) {
          window.socialSpyFunctions.cleanupSocialSpy();
        }

        // Clear message cache when leaving chat tab to ensure fresh data on return
        if (tabId !== 'chat') {
          currentMessages = [];
        }

        // Remove active class from all nav items and tab contents
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked nav item and corresponding tab content
        this.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // If entering DMs tab, check if DMs are enabled and load latest conversation
        if (tabId === 'dms') {
          if (!isDMsEnabled()) {
            showDMDisabledScreen();
          } else {
            await loadLatestDMConversation();
          }
        }

        // If entering social spy tab, initialize it
        if (tabId === 'socialspy') {
          if (window.socialSpyFunctions) {
            window.socialSpyFunctions.initializeSocialSpy();
          }
        }

        // If entering settings tab, load current avatar
        if (tabId === 'settings') {
          loadCurrentAvatar();
        }
      });
    });
  }

  // =====================================
  // USER ROLE PERMISSIONS
  // =====================================

  function initializeUserPermissions() {
    if (window.USER_ROLE == 'mod' || window.USER_ROLE == 'admin' || window.USER_ROLE == 'owner') {
      console.log("Mod access!");
      document.querySelectorAll('.mod-only').forEach(element => {
        element.style.display = 'flex';
      });
    }

    if (window.USER_ROLE == 'admin' || window.USER_ROLE == 'owner') {
      console.log("Admin access!")
      document.querySelectorAll('.admin-only').forEach(element => {
        element.style.display = 'flex';
      });

      document.querySelectorAll('.admin-only-action').forEach(element => {
        element.style.display = 'block';
      });
    }

    console.log("Role: " + window.USER_ROLE);
  }

  // =====================================
  // MUTE FUNCTIONALITY
  // =====================================

  function muteUser(expiryEpochSeconds) {
    muteExpiry = expiryEpochSeconds * 1000; // Convert to milliseconds

    // Replace chat input with countdown
    const muteContainer = document.createElement('div');
    muteContainer.className = 'mute-countdown-container';

    const muteMessage = createSafeElement('span', 'You are muted for: ', 'mute-message');
    const muteTimer = createSafeElement('span', '', 'mute-timer');
    muteTimer.id = 'muteTimer';

    muteContainer.appendChild(muteMessage);
    muteContainer.appendChild(muteTimer);

    chatInputContainer.innerHTML = '';
    chatInputContainer.appendChild(muteContainer);

    // Also mute DM input if it exists
    muteDMInput(expiryEpochSeconds);

    // Start countdown
    updateMuteCountdown();
    muteCountdownInterval = setInterval(() => {
      updateMuteCountdown();
      updateDMMuteCountdown();
    }, 1000);
  }

  function updateMuteCountdown() {
    const now = Date.now();
    const timeLeft = muteExpiry - now;

    if (timeLeft <= 0) {
      unmuteUser();
      return;
    }

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const timerElement = document.getElementById('muteTimer');
    if (timerElement) {
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  function unmuteUser() {
    muteExpiry = null;

    // Clear countdown interval
    if (muteCountdownInterval) {
      clearInterval(muteCountdownInterval);
      muteCountdownInterval = null;
    }

    // Restore original chat input
    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.className = 'chat-input';
    chatInput.placeholder = 'type your message...';
    chatInput.maxLength = 200;

    const sendButton = document.createElement('button');
    sendButton.className = 'send-button';
    sendButton.textContent = 'send';

    chatInputContainer.innerHTML = '';
    chatInputContainer.appendChild(chatInput);
    chatInputContainer.appendChild(sendButton);

    // Also restore DM input
    unmuteDMInput();

    // Reattach event listeners
    attachChatEventListeners();

    // Refresh user data to update account standing and status
    refreshUserStatus();
  }

  // DM Mute functionality
  function muteDMInput(expiryEpochSeconds) {
    const dmInputContainer = document.querySelector('.dm-input-container');
    if (!dmInputContainer) return;

    // Replace DM input with countdown
    const muteContainer = document.createElement('div');
    muteContainer.className = 'mute-countdown-container dm-mute-countdown';

    const muteMessage = createSafeElement('span', 'You are muted for: ', 'mute-message');
    const muteTimer = createSafeElement('span', '', 'mute-timer');
    muteTimer.id = 'dmMuteTimer';

    muteContainer.appendChild(muteMessage);
    muteContainer.appendChild(muteTimer);

    // Store original DM input content
    const originalDMInput = dmInputContainer.innerHTML;
    window.originalDMInput = originalDMInput;

    dmInputContainer.innerHTML = '';
    dmInputContainer.appendChild(muteContainer);
  }

  function updateDMMuteCountdown() {
    const now = Date.now();
    const timeLeft = muteExpiry - now;

    if (timeLeft <= 0) {
      unmuteDMInput();
      return;
    }

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const timerElement = document.getElementById('dmMuteTimer');
    if (timerElement) {
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  function unmuteDMInput() {
    const dmInputContainer = document.querySelector('.dm-input-container');
    if (!dmInputContainer) return;

    // Restore original DM input if it was stored
    if (window.originalDMInput) {
      dmInputContainer.innerHTML = window.originalDMInput;
      window.originalDMInput = null;
    } else {
      // Fallback: create basic DM input structure
      dmInputContainer.innerHTML = `
        <input type="text" class="dm-input" placeholder="Type your message..." maxlength="200">
        <button class="dm-send-button">
          <i class="fas fa-paper-plane"></i>
        </button>
      `;
    }

    // Reattach DM event listeners
    initializeDMMessaging();
  }

  // =====================================
  // CHAT FUNCTIONALITY
  // =====================================

  let lastMessageId = null;
  let messagePollingInterval = null;
  let currentMessages = []; // Cache current messages to avoid unnecessary re-renders

  // Helper function to compare two message arrays for equality
  function messagesAreEqual(oldMessages, newMessages) {
    if (oldMessages.length !== newMessages.length) {
      return false;
    }

    for (let i = 0; i < oldMessages.length; i++) {
      const oldMsg = oldMessages[i];
      const newMsg = newMessages[i];

      // Compare key properties that would affect rendering
      if (
        oldMsg.uuid !== newMsg.uuid ||
        oldMsg.username !== newMsg.username ||
        oldMsg.content !== newMsg.content ||
        oldMsg.timestamp !== newMsg.timestamp ||
        oldMsg.badge !== newMsg.badge ||
        oldMsg.user_id !== newMsg.user_id ||
        oldMsg.has_avatar !== newMsg.has_avatar
      ) {
        return false;
      }
    }

    return true;
  }

  async function sendMessage() {
    // Check if user is muted
    if (muteExpiry && Date.now() < muteExpiry) {
      return; // User is still muted, don't send message
    }

    const currentChatInput = document.querySelector('.chat-input');
    if (!currentChatInput) return; // Input not available (user might be muted)

    const message = currentChatInput.value.trim();
    if (!message) return;

    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token available');
        window.location.href = 'login.html';
        return;
      }

      // Set the bearer token for this request
      api.bearerToken = token;

      // Send message to server
      const response = await api.post('/messages', { content: message });

      // Clear input on successful send
      currentChatInput.value = '';

      // Check if this was an admin command response
      if (response && (response.success || response.error)) {
        // Only show notifications for admin commands (which return string messages)
        // Regular messages return success: true (boolean), which we don't want to show
        if (response.success && typeof response.success === 'string') {
          showNotification(response.success, 'success');
        } else if (response.error && typeof response.error === 'string') {
          showNotification(response.error, 'error');
        }

        // For sudo and clear commands, refresh messages to see changes
        if (message.startsWith('/sudo') || message.startsWith('/clear')) {
          await fetchMessages();
        }
        // For regular commands, don't refresh since it's not a message
        else if (message.startsWith('/')) {
          return; // Don't fetch messages for other admin commands
        }
      }

      // For regular messages or commands that don't prevent it, fetch new messages
      if (!message.startsWith('/') || message.startsWith('/sudo') || message.startsWith('/clear')) {
        await fetchMessages();
      }

    } catch (error) {
      console.error('Failed to send message:', error);

      // Check if this is an authentication error
      if (error.message && (error.message.includes('401') || error.message.includes('Token has expired'))) {
        console.warn('Authentication failed while sending message');
        // API handler will redirect, but this is a backup
        return;
      }

      // Check if this is a mute error
      if (error.message && error.message.includes('muted')) {
        showNotification('You are currently muted and cannot send messages.', 'error');
        // Refresh user status to update mute info
        refreshUserStatus();
        return;
      }

      // Show a user-friendly error message for other errors
      showNotification('Failed to send message. Please try again.', 'error');
    }
  }

  async function fetchMessages() {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No auth token available for fetching messages');
        window.location.href = 'login.html';
        return;
      }

      // Set the bearer token for this request
      api.bearerToken = token;

      // Fetch messages from server
      const response = await api.get('/messages?limit=50');

      if (response.messages && Array.isArray(response.messages)) {
        updateChatMessages(response.messages);
      }

    } catch (error) {
      console.error('Failed to fetch messages:', error);

      // Check if this is an authentication error
      if (error.message && (error.message.includes('401') || error.message.includes('Token has expired'))) {
        console.warn('Authentication failed while fetching messages');
        // API handler will redirect, but we can stop polling
        stopMessagePolling();
        return;
      }

      // For other errors, just log them - don't stop the app
    }
  }

  function updateChatMessages(messages) {
    // Check if chatMessages element exists
    if (!chatMessages) {
      console.error('chatMessages element not found');
      return;
    }

    // Check if messages have actually changed to avoid unnecessary re-renders
    if (messagesAreEqual(currentMessages, messages)) {
      return; // No changes, skip re-rendering
    }

    // Update the cached messages
    currentMessages = [...messages];

    // Clear existing messages
    chatMessages.innerHTML = '';

    // Show empty state if no messages
    if (messages.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';

      const emptyStateContent = document.createElement('div');
      emptyStateContent.className = 'empty-state-content';

      const icon = document.createElement('i');
      icon.className = 'fas fa-comments empty-state-icon';

      const heading = createSafeElement('h3', 'No messages yet');
      const paragraph = createSafeElement('p', 'Be the first to start the conversation!');

      // Validate elements before appending
      if (heading && paragraph) {
        emptyStateContent.appendChild(icon);
        emptyStateContent.appendChild(heading);
        emptyStateContent.appendChild(paragraph);

        emptyState.appendChild(emptyStateContent);
        chatMessages.appendChild(emptyState);
      } else {
        console.error('Failed to create safe elements for empty state');
      }
      return;
    }

    messages.forEach(message => {
      // Validate message data
      if (!message || !message.username || !message.content) {
        console.warn('Invalid message data:', message);
        return;
      }

      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.setAttribute('data-author', message.username);
      messageDiv.setAttribute('data-message-id', message.uuid || '');
      messageDiv.setAttribute('data-message-author', message.username);

      // Format timestamp
      const timestamp = new Date(message.timestamp);
      const timeString = timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      const badgeIcons = {
        mod: '<i class="fa fa-shield"></i>',
        admin: '<i class="fa fa-tools"></i>',
        owner: '<i class="fa fa-crown"></i>',
        shadowbanned: '<i class="fa fa-user-slash"></i>'
      };

      // Create avatar element
      const avatarElement = createAvatarElement(message.user_id, message.has_avatar, 'message-avatar');

      // Create message content container
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';

      // Create user span with badge
      const userSpan = document.createElement('span');
      userSpan.className = 'message-user';

      // Add badge if exists
      if (message.badge && message.badge !== 'user') {
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'message-role';
        badgeSpan.innerHTML = `[${badgeIcons[message.badge]} ${message.badge}] `;
        userSpan.appendChild(badgeSpan);

        const usernameText = document.createTextNode(`${message.username}:`);
        userSpan.appendChild(usernameText);
      } else {
        userSpan.textContent = `${message.username}:`;
      }

      // Create message text span with markdown parsing
      const messageTextSpan = document.createElement('span');
      messageTextSpan.className = 'message-text';
      if (message.content) {
        messageTextSpan.innerHTML = parseMarkdown(message.content);
      }

      // Add deleted styling if message is deleted
      const deletedTexts = [
        "Deleted by sender",
        "Removed by a moderator",
        "Message removed due to message limit"
      ];

      if (messageTextSpan && deletedTexts.includes(message.content)) {
        messageTextSpan.classList.add('deleted');
      }

      // Create time span
      const timeSpan = createSafeElement('span', timeString, 'message-time');

      // Validate elements before appending
      if (messageTextSpan && timeSpan && avatarElement) {
        // Assemble the message
        messageContent.appendChild(userSpan);
        messageContent.appendChild(messageTextSpan);
        messageContent.appendChild(timeSpan);

        messageDiv.appendChild(avatarElement);
        messageDiv.appendChild(messageContent);

        chatMessages.appendChild(messageDiv);
      } else {
        console.error('Failed to create message elements for message:', message);
      }
    });

    // Auto-scroll to bottom if enabled (always scroll when enabled)
    const settings = getSettings();
    if (settings.autoScroll) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Always scroll to bottom on initial load
    if (!window.initialLoadScroll) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
      window.initialLoadScroll = true;
    }
  }

  function startMessagePolling() {
    // Fetch messages immediately
    fetchMessages();

    // Set up polling every second
    messagePollingInterval = setInterval(fetchMessages, 1000);
  }

  function stopMessagePolling() {
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
      messagePollingInterval = null;
    }
  }

  function attachChatEventListeners() {
    const currentSendButton = document.querySelector('.send-button');
    const currentChatInput = document.querySelector('.chat-input');

    if (currentSendButton) {
      // Remove existing listener by cloning and replacing
      const newSendButton = currentSendButton.cloneNode(true);
      currentSendButton.parentNode.replaceChild(newSendButton, currentSendButton);
      newSendButton.addEventListener('click', sendMessage);
    }

    if (currentChatInput) {
      // Remove existing listener by cloning and replacing
      const newChatInput = currentChatInput.cloneNode(true);
      currentChatInput.parentNode.replaceChild(newChatInput, currentChatInput);

      newChatInput.addEventListener('keydown', function (e) {
        const settings = getSettings();
        const ctrlEnterMode = settings.ctrlEnterToSend;

        if (ctrlEnterMode) {
          // Ctrl+Enter to send mode
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            sendMessage();
          }
        } else {
          // Regular Enter to send mode
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }
      });

      // Maintain focus on the new input element
      if (document.activeElement === document.body) {
        newChatInput.focus();
      }
    }
  }

  function initializeChatFunctionality() {
    attachChatEventListeners();
    startMessagePolling();
  }

  // =====================================
  // CONTEXT MENU FUNCTIONALITY  
  // =====================================

  function initializeContextMenu() {
    const contextMenu = document.getElementById('messageContextMenu');
    const reportMenuItem = document.getElementById('reportMessage');
    const deleteMenuItem = document.getElementById('deleteMessage');
    const userActionsMenuItem = document.getElementById('userActions');
    const undoReportActionsMenuItem = document.getElementById('undoReportActions');

    // Context menu event listeners
    document.addEventListener('contextmenu', function (e) {
      const messageElement = e.target.closest('.message');
      const reportItemElement = e.target.closest('.report-item');

      // Handle message context menu (but not for report items)
      if (messageElement && messageElement.parentElement.id === 'chat-messages' && !reportItemElement) {
        e.preventDefault();

        currentMessageElement = messageElement;
        currentMessageAuthor = messageElement.getAttribute('data-author');
        currentMessageId = messageElement.getAttribute('data-message-id');

        // Show/hide menu items based on permissions
        const isOwnMessage = currentMessageAuthor === window.CURRENT_USERNAME;
        const isMod = window.USER_ROLE === 'mod' || window.USER_ROLE === 'admin' || window.USER_ROLE === 'owner';
        const isAdmin = window.USER_ROLE === 'admin' || window.USER_ROLE === 'owner';

        // Report message: show for everyone, but not for own messages
        const showReport = !isOwnMessage;
        reportMenuItem.style.display = showReport ? 'block' : 'none';

        // Delete message: show for mods/admins and message author
        const showDelete = isMod || isOwnMessage;
        deleteMenuItem.style.display = showDelete ? 'block' : 'none';

        // Hide undo actions for regular messages
        undoReportActionsMenuItem.style.display = 'none';

        // Only show context menu if at least one item is visible
        if (showReport || showDelete) {
          // Position and show context menu
          contextMenu.style.left = e.pageX + 'px';
          contextMenu.style.top = e.pageY + 'px';
          contextMenu.style.display = 'block';
        }
      }
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', function () {
      contextMenu.style.display = 'none';
      const dmContextMenu = document.getElementById('dmContextMenu');
      if (dmContextMenu) {
        dmContextMenu.style.display = 'none';
      }
    });

    // DM context menu event handlers
    const replyDMMenuItem = document.getElementById('replyDMMessage');
    const reactDMMenuItem = document.getElementById('reactDMMessage');

    if (replyDMMenuItem) {
      replyDMMenuItem.addEventListener('click', function () {
        if (window.currentDMMessageId) {
          replyToDMMessage(window.currentDMMessageId);
        }
        document.getElementById('dmContextMenu').style.display = 'none';
      });
    }

    if (reactDMMenuItem) {
      reactDMMenuItem.addEventListener('click', function () {
        if (window.currentDMMessageId) {
          showReactionPicker(window.currentDMMessageId);
        }
        document.getElementById('dmContextMenu').style.display = 'none';
      });
    }
  }

  // =====================================
  // MODAL FUNCTIONALITY
  // =====================================

  function initializeModals() {
    const reportModal = document.getElementById('reportModal');
    const deleteModal = document.getElementById('deleteModal');
    const userActionsModal = document.getElementById('userActionsModal');
    const undoReportModal = document.getElementById('undoReportModal');

    const reportMenuItem = document.getElementById('reportMessage');
    const deleteMenuItem = document.getElementById('deleteMessage');
    const userActionsMenuItem = document.getElementById('userActions');
    const undoReportActionsMenuItem = document.getElementById('undoReportActions');

    // Report message functionality
    reportMenuItem.addEventListener('click', function () {
      const contextMenu = document.getElementById('messageContextMenu');
      contextMenu.style.display = 'none';

      // Populate the report modal with message information
      document.getElementById('reportedUsername').textContent = currentMessageAuthor;
      const messageContent = currentMessageElement.querySelector('.message-text').textContent;
      document.getElementById('reportedMessageContent').textContent = messageContent;

      // Reset the form
      resetReportForm();
      reportModal.style.display = 'flex';
    });

    // Delete message functionality
    deleteMenuItem.addEventListener('click', function () {
      const contextMenu = document.getElementById('messageContextMenu');
      contextMenu.style.display = 'none';
      deleteModal.style.display = 'flex';
    });

    // Undo report actions functionality
    undoReportActionsMenuItem.addEventListener('click', function () {
      const contextMenu = document.getElementById('messageContextMenu');
      contextMenu.style.display = 'none';
      showUndoReportModal(currentMessageElement);
    });

    // Modal close handlers
    initializeModalCloseHandlers(reportModal, deleteModal, userActionsModal);
  }

  async function deleteMessage(messageId) {
    try {
      const response = await window.api.delete(`/messages/${messageId}`);

      if (response.success) {
        // Show success notification
        showNotification('Message deleted successfully', 'success');

        // Refresh messages to show the updated content
        if (window.loadMessages) {
          window.loadMessages();
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error);

      // Show appropriate error message
      let errorMessage = 'Failed to delete message';
      if (error.message.includes('15 seconds')) {
        errorMessage = 'Can only delete own messages within 15 seconds of sending';
      } else if (error.message.includes('Permission denied')) {
        errorMessage = 'You do not have permission to delete this message';
      } else if (error.message.includes('already deleted')) {
        errorMessage = 'Message has already been deleted';
      }

      showNotification(errorMessage, 'error');
    }
  }

  function initializeModalCloseHandlers(reportModal, deleteModal, userActionsModal) {
    // Delete modal event listeners
    document.getElementById('deleteModalClose').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirmDelete').addEventListener('click', async function () {
      if (currentMessageId) {
        await deleteMessage(currentMessageId);
      }
      closeModal(deleteModal);
    });

    // Delete avatar modal event listeners
    const deleteAvatarModal = document.getElementById('deleteAvatarModal');
    document.getElementById('deleteAvatarModalClose').addEventListener('click', () => closeModal(deleteAvatarModal));
    document.getElementById('cancelDeleteAvatar').addEventListener('click', () => closeModal(deleteAvatarModal));
    document.getElementById('confirmDeleteAvatar').addEventListener('click', function () {
      performAvatarRemoval();
      closeModal(deleteAvatarModal);
    });

    // User actions modal event listeners
    document.getElementById('userActionsModalClose').addEventListener('click', () => closeModal(userActionsModal));
    document.getElementById('cancelUserActions').addEventListener('click', () => closeModal(userActionsModal));
    document.getElementById('confirmUserActions').addEventListener('click', handleUserActionsSubmit);

    // Report modal close handlers
    document.getElementById('reportModalClose').addEventListener('click', () => closeModal(reportModal));
    document.getElementById('cancelReport').addEventListener('click', () => closeModal(reportModal));
    document.getElementById('submitReport').addEventListener('click', handleReportSubmit);

    // Close modals when clicking outside
    window.addEventListener('click', function (e) {
      if (e.target === reportModal) closeModal(reportModal);
      if (e.target === deleteModal) closeModal(deleteModal);
      if (e.target === userActionsModal) closeModal(userActionsModal);
      if (e.target === deleteAvatarModal) closeModal(deleteAvatarModal);
    });
  }

  function closeModal(modal) {
    modal.style.display = 'none';
  }

  // =====================================
  // USER ACTIONS FUNCTIONALITY
  // =====================================

  function resetUserActionsForm() {
    document.getElementById('muteUser').checked = false;
    document.getElementById('warnUser').checked = false;
    document.getElementById('banUser').checked = false;
    document.getElementById('muteDuration').value = '5';
    document.getElementById('muteReason').value = '';
    document.getElementById('warnReason').value = '';
    document.getElementById('banReason').value = '';
    document.getElementById('banDuration').value = '1440';
  }

  // Function to toggle action fields visibility and required attributes
  function toggleActionFields() {
    const muteUser = document.getElementById('muteUser');
    const warnUser = document.getElementById('warnUser');
    const banUser = document.getElementById('banUser');

    const muteDurationContainer = muteUser.closest('.action-item').querySelector('.action-duration');
    const warnReasonContainer = warnUser.closest('.action-item').querySelector('.action-reason');
    const banReasonContainer = banUser.closest('.action-item').querySelector('.action-reason');

    // Toggle mute fields
    muteDurationContainer.style.display = muteUser.checked ? 'grid' : 'none';
    document.getElementById('muteReason').required = muteUser.checked;

    // Toggle warn fields
    warnReasonContainer.style.display = warnUser.checked ? 'grid' : 'none';
    document.getElementById('warnReason').required = warnUser.checked;

    // Toggle ban fields
    banReasonContainer.style.display = banUser.checked ? 'grid' : 'none';
    document.getElementById('banReason').required = banUser.checked;
  }

  function handleUserActionsSubmit() {
    const muteUserChecked = document.getElementById('muteUser').checked;
    const warnUserChecked = document.getElementById('warnUser').checked;
    const banUserChecked = document.getElementById('banUser').checked;

    // Check if at least one action is selected
    if (!muteUserChecked && !warnUserChecked && !banUserChecked) {
      alert('Please select at least one action to apply.');
      return;
    }

    // Validate required fields for selected actions
    const validationErrors = validateUserActionsForm(muteUserChecked, warnUserChecked, banUserChecked);

    if (validationErrors.length > 0) {
      alert('Please fix the following errors:\n• ' + validationErrors.join('\n• '));
      return;
    }

    // Get form values and apply actions
    const actionData = gatherUserActionData();
    applyUserActions(actionData, muteUserChecked, warnUserChecked, banUserChecked);

    const userActionsModal = document.getElementById('userActionsModal');
    closeModal(userActionsModal);
  }

  function validateUserActionsForm(muteChecked, warnChecked, banChecked) {
    const errors = [];

    if (muteChecked && !document.getElementById('muteReason').value.trim()) {
      errors.push('Mute reason is required');
    }

    if (warnChecked && !document.getElementById('warnReason').value.trim()) {
      errors.push('Warning reason is required');
    }

    if (banChecked && !document.getElementById('banReason').value.trim()) {
      errors.push('Ban reason is required');
    }

    return errors;
  }

  function gatherUserActionData() {
    return {
      muteDuration: document.getElementById('muteDuration').value,
      muteReason: document.getElementById('muteReason').value,
      warnReason: document.getElementById('warnReason').value,
      banReason: document.getElementById('banReason').value,
      banDuration: document.getElementById('banDuration').value
    };
  }

  function applyUserActions(actionData, muteChecked, warnChecked, banChecked) {
    // If muting the current user, apply the mute with countdown
    if (muteChecked && currentMessageAuthor === window.CURRENT_USERNAME) {
      const muteSeconds = parseInt(actionData.muteDuration) * 60; // Convert minutes to seconds
      const expiryTime = Math.floor(Date.now() / 1000) + muteSeconds;
      muteUser(expiryTime);
    }

    // Create action summary for logging
    const actionSummary = [];
    if (muteChecked) actionSummary.push(`Muted for ${actionData.muteDuration} minutes: ${actionData.muteReason}`);
    if (warnChecked) actionSummary.push(`Warning: ${actionData.warnReason}`);
    if (banChecked) {
      const banDurationText = actionData.banDuration === '0' ? 'permanently' : `for ${actionData.banDuration} minutes`;
      actionSummary.push(`Banned ${banDurationText}: ${actionData.banReason}`);
    }

    // Log actions (replace with actual server communication)
    console.log('User actions applied to', currentMessageAuthor + ':', actionSummary);
    console.log('User actions data:', {
      target: currentMessageAuthor,
      mute: muteChecked ? { duration: actionData.muteDuration, reason: actionData.muteReason } : null,
      warn: warnChecked ? { reason: actionData.warnReason } : null,
      ban: banChecked ? { reason: actionData.banReason, duration: actionData.banDuration } : null
    });

    // If this action was taken on a report item, update its status
    if (currentMessageElement && currentMessageElement.classList.contains('report-item')) {
      updateReportItemStatus(currentMessageElement, actionSummary);
    }
  }

  function updateReportItemStatus(reportElement, actionSummary) {
    const statusElement = reportElement.querySelector('.report-status');
    if (statusElement) {
      // Update status to show actions taken
      statusElement.innerHTML = `<i class="fas fa-check-circle" title="Actions taken: ${actionSummary.join(', ')}"></i>`;
      statusElement.style.color = 'var(--success-color, #28a745)';

      // Add visual indicator that this report has been handled
      reportElement.classList.add('completed');
      reportElement.setAttribute('data-status', 'completed');
      reportElement.setAttribute('data-actions', JSON.stringify(actionSummary));

      // Refresh the current view to reflect the change
      refreshReportsView();
    }
  }

  // =====================================
  // ENHANCED REPORTS SYSTEM
  // =====================================

  // Mock data - in a real application, this would come from the server
  let reportsData = [
    {
      id: 1,
      reportedUser: 'user456',
      submitter: 'user123',
      reason: 'spam',
      messageContent: 'Buy my crypto now!!! Limited time offer!!!',
      timestamp: new Date(2025, 7, 20, 10, 30),
      status: 'pending'
    },
    {
      id: 2,
      reportedUser: 'toxicuser',
      submitter: 'user789',
      reason: 'harassment',
      messageContent: 'You are the worst player ever, quit the game!',
      timestamp: new Date(2025, 7, 21, 14, 15),
      status: 'pending'
    },
    {
      id: 3,
      reportedUser: 'spammer123',
      submitter: 'user456',
      reason: 'inappropriate',
      messageContent: 'Inappropriate content that violated community guidelines',
      timestamp: new Date(2025, 7, 19, 16, 45),
      status: 'completed',
      actions: ['Warned: Inappropriate content', 'Muted for 60 minutes: Violation of community standards'],
      handledBy: 'mod1',
      handledAt: new Date(2025, 7, 19, 17, 0)
    },
    {
      id: 4,
      reportedUser: 'newbie42',
      submitter: 'user111',
      reason: 'misinformation',
      messageContent: 'The earth is flat and vaccines cause autism',
      timestamp: new Date(2025, 7, 22, 9, 20),
      status: 'pending'
    },
    {
      id: 5,
      reportedUser: 'griefer99',
      submitter: 'player555',
      reason: 'cheating',
      messageContent: 'Bragging about using cheats and exploits',
      timestamp: new Date(2025, 7, 18, 20, 10),
      status: 'completed',
      actions: ['Banned permanently: Using cheats and exploits'],
      handledBy: 'admin1',
      handledAt: new Date(2025, 7, 18, 20, 30)
    },
    {
      id: 6,
      reportedUser: 'annoying_kid',
      submitter: 'veteran_player',
      reason: 'spam',
      messageContent: 'hello hello hello hello hello (repeated 50 times)',
      timestamp: new Date(2025, 7, 23, 11, 0),
      status: 'pending'
    },
    {
      id: 7,
      reportedUser: 'troll_master',
      submitter: 'casual_gamer',
      reason: 'harassment',
      messageContent: 'Targeting and bullying new players consistently',
      timestamp: new Date(2025, 7, 24, 8, 45),
      status: 'completed',
      actions: ['Banned for 7 days: Repeated harassment of new players'],
      handledBy: 'mod2',
      handledAt: new Date(2025, 7, 24, 9, 0)
    },
    {
      id: 8,
      reportedUser: 'fake_news_guy',
      submitter: 'fact_checker',
      reason: 'misinformation',
      messageContent: 'Spreading conspiracy theories and medical misinformation',
      timestamp: new Date(2025, 7, 23, 19, 30),
      status: 'pending'
    },
    {
      id: 9,
      reportedUser: 'scammer_bot',
      submitter: 'alert_user',
      reason: 'spam',
      messageContent: 'Free money! Click this suspicious link now!',
      timestamp: new Date(2025, 7, 22, 15, 20),
      status: 'completed',
      actions: ['Banned permanently: Account identified as spam bot', 'Warned: Removed suspicious links'],
      handledBy: 'admin1',
      handledAt: new Date(2025, 7, 22, 15, 25)
    },
    {
      id: 10,
      reportedUser: 'edgy_teen',
      submitter: 'concerned_parent',
      reason: 'inappropriate',
      messageContent: 'Using offensive language and inappropriate jokes',
      timestamp: new Date(2025, 7, 21, 12, 10),
      status: 'pending'
    }
  ];

  let currentReportsCategory = 'all';
  let currentReportsPage = 1;
  const reportsPerPage = 5;
  let currentReportElement = null;
  let currentSearchQuery = '';
  let currentReasonFilter = '';

  function initializeReportsSystem() {
    // Initialize tab switching
    const tabButtons = document.querySelectorAll('.reports-tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', function () {
        const category = this.getAttribute('data-category');
        switchReportsTab(category);
      });
    });

    // Initialize search and filter
    const searchInput = document.getElementById('reportSearchInput');
    const reasonFilter = document.getElementById('reasonFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');

    searchInput.addEventListener('input', function () {
      currentSearchQuery = this.value.toLowerCase().trim();
      currentReportsPage = 1;
      loadReports();
    });

    reasonFilter.addEventListener('change', function () {
      currentReasonFilter = this.value;
      currentReportsPage = 1;
      loadReports();
    });

    clearFiltersBtn.addEventListener('click', function () {
      searchInput.value = '';
      reasonFilter.value = '';
      currentSearchQuery = '';
      currentReasonFilter = '';
      currentReportsPage = 1;
      loadReports();
    });

    // Initialize pagination
    document.getElementById('prevPage').addEventListener('click', () => {
      if (currentReportsPage > 1) {
        currentReportsPage--;
        loadReports();
      }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
      const totalPages = Math.ceil(getFilteredReports().length / reportsPerPage);
      if (currentReportsPage < totalPages) {
        currentReportsPage++;
        loadReports();
      }
    });

    // Load initial reports
    loadReports();

    // Initialize undo modal
    initializeUndoReportModal();
  }

  function switchReportsTab(category) {
    currentReportsCategory = category;
    currentReportsPage = 1;

    // Update active tab
    document.querySelectorAll('.reports-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // Load reports for the selected category
    loadReports();
  }

  function getFilteredReports() {
    let filtered = reportsData;

    // Filter by category
    switch (currentReportsCategory) {
      case 'pending':
        filtered = filtered.filter(report => report.status === 'pending');
        break;
      case 'completed':
        filtered = filtered.filter(report => report.status === 'completed');
        break;
      case 'all':
      default:
        // No additional filtering needed
        break;
    }

    // Filter by search query
    if (currentSearchQuery) {
      filtered = filtered.filter(report =>
        report.reportedUser.toLowerCase().includes(currentSearchQuery) ||
        report.submitter.toLowerCase().includes(currentSearchQuery) ||
        report.reason.toLowerCase().includes(currentSearchQuery) ||
        (report.messageContent && report.messageContent.toLowerCase().includes(currentSearchQuery))
      );
    }

    // Filter by reason
    if (currentReasonFilter) {
      filtered = filtered.filter(report => report.reason === currentReasonFilter);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered;
  }

  function loadReports() {
    const reportsList = document.getElementById('reportsList');
    const filteredReports = getFilteredReports();
    const totalPages = Math.ceil(filteredReports.length / reportsPerPage);

    // Update statistics
    document.getElementById('totalReports').textContent = filteredReports.length;

    // Update pagination info
    document.getElementById('currentPage').textContent = currentReportsPage;
    document.getElementById('totalPages').textContent = Math.max(1, totalPages);

    // Update pagination buttons
    document.getElementById('prevPage').disabled = currentReportsPage <= 1;
    document.getElementById('nextPage').disabled = currentReportsPage >= totalPages;

    // Calculate which reports to show
    const startIndex = (currentReportsPage - 1) * reportsPerPage;
    const endIndex = startIndex + reportsPerPage;
    const reportsToShow = filteredReports.slice(startIndex, endIndex);

    // Clear current reports
    reportsList.innerHTML = '';

    // Show loading state
    reportsList.innerHTML = '<div class="reports-loading"><i class="fas fa-spinner"></i> Loading reports...</div>';

    // Simulate loading delay (remove in production)
    setTimeout(() => {
      reportsList.innerHTML = '';

      if (reportsToShow.length === 0) {
        // Show empty state
        const emptyMessage = currentReportsCategory === 'pending' ? 'No pending reports' :
          currentReportsCategory === 'completed' ? 'No completed reports' :
            'No reports found';
        reportsList.innerHTML = `
          <div class="reports-empty">
            <i class="fas fa-clipboard-list"></i>
            <p>${emptyMessage}</p>
          </div>
        `;
        return;
      }

      // Render reports
      reportsToShow.forEach(report => {
        const reportElement = createReportElement(report);
        reportsList.appendChild(reportElement);

        // Add event listeners for action buttons
        const userActionsBtn = reportElement.querySelector('.user-actions-btn');
        const undoActionsBtn = reportElement.querySelector('.undo-actions-btn');

        if (userActionsBtn) {
          userActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleUserActionsClick(reportElement);
          });
        }

        if (undoActionsBtn) {
          undoActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleUndoActionsClick(reportElement);
          });
        }
      });
    }, 300);
  }

  function createReportElement(report) {
    const reportDiv = document.createElement('div');
    reportDiv.className = `report-item ${report.status}`;
    reportDiv.setAttribute('data-report-id', report.id);
    reportDiv.setAttribute('data-reported-user', report.reportedUser);
    reportDiv.setAttribute('data-submitter', report.submitter);
    reportDiv.setAttribute('data-reason', report.reason);
    reportDiv.setAttribute('data-status', report.status);

    if (report.actions) {
      reportDiv.setAttribute('data-actions', JSON.stringify(report.actions));
    }

    const timeAgo = getTimeAgo(report.timestamp);
    const statusIcon = report.status === 'completed' ?
      '<i class="fas fa-check-circle" title="Report completed"></i>' :
      '<i class="fas fa-clock" title="Pending review"></i>';

    // Determine which buttons to show based on status and permissions
    const isMod = window.USER_ROLE === 'mod' || window.USER_ROLE === 'admin';
    const showUserActions = isMod && report.status === 'pending';
    const showUndoActions = isMod && report.status === 'completed';

    const actionButtons = isMod ? `
      <div class="report-actions">
        ${showUserActions ? `
          <button class="report-action-btn user-actions-btn" title="Take action on ${report.reportedUser}">
            <i class="fas fa-user-shield"></i>
            <span>User Actions</span>
          </button>
        ` : ''}
        ${showUndoActions ? `
          <button class="report-action-btn undo-actions-btn" title="Undo actions taken on ${report.reportedUser}">
            <i class="fas fa-undo"></i>
            <span>Undo Actions</span>
          </button>
        ` : ''}
      </div>
    ` : '';

    reportDiv.innerHTML = `
      <div class="report-content">
        <div class="report-users">
          <span class="report-user">
            <span class="report-user-label">submitter: </span>${report.submitter}
          </span>
          <span class="report-user">
            <span class="report-user-label">reported: </span>${report.reportedUser}
          </span>
          <span class="report-timestamp">${timeAgo}</span>
        </div>
        <span class="report-reason">${report.reason}</span>
        <div class="report-status">
          ${statusIcon}
        </div>
      </div>
      ${actionButtons}
    `;

    return reportDiv;
  }

  function getTimeAgo(timestamp) {
    const now = new Date();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function refreshReportsView() {
    // Update the current view to reflect any changes
    loadReports();
  }

  function initializeUndoReportModal() {
    const undoModal = document.getElementById('undoReportModal');

    // Close button
    document.getElementById('undoReportModalClose').addEventListener('click', () => {
      closeModal(undoModal);
    });

    // Cancel button
    document.getElementById('cancelUndoReport').addEventListener('click', () => {
      closeModal(undoModal);
    });

    // Confirm undo button
    document.getElementById('confirmUndoReport').addEventListener('click', () => {
      undoReportActions();
      closeModal(undoModal);
    });

    // Close on outside click
    window.addEventListener('click', function (e) {
      if (e.target === undoModal) {
        closeModal(undoModal);
      }
    });
  }

  function showUndoReportModal(reportElement) {
    const reportId = parseInt(reportElement.getAttribute('data-report-id'));
    const reportedUser = reportElement.getAttribute('data-reported-user');
    const report = reportsData.find(r => r.id === reportId);

    if (!report || report.status !== 'completed' || !report.actions) {
      alert('Cannot undo actions for this report.');
      return;
    }

    currentReportElement = reportElement;

    // Populate modal
    document.getElementById('undoTargetUser').textContent = reportedUser;

    const actionsTakenDiv = document.getElementById('actionsTaken');
    actionsTakenDiv.innerHTML = '';

    report.actions.forEach(action => {
      const actionDiv = document.createElement('div');
      actionDiv.className = 'action-item';

      // Determine icon based on action type
      let icon = 'fas fa-info-circle';
      if (action.toLowerCase().includes('mute')) icon = 'fas fa-volume-mute';
      else if (action.toLowerCase().includes('ban')) icon = 'fas fa-ban';
      else if (action.toLowerCase().includes('warn')) icon = 'fas fa-exclamation-triangle';

      actionDiv.innerHTML = `
        <i class="${icon}"></i>
        <span>${action}</span>
      `;
      actionsTakenDiv.appendChild(actionDiv);
    });

    // Show modal
    document.getElementById('undoReportModal').style.display = 'flex';
  }

  function undoReportActions() {
    if (!currentReportElement) return;

    const reportId = parseInt(currentReportElement.getAttribute('data-report-id'));
    const report = reportsData.find(r => r.id === reportId);

    if (report) {
      // Update report status
      report.status = 'pending';
      delete report.actions;
      delete report.handledBy;
      delete report.handledAt;

      // Update visual appearance
      currentReportElement.classList.remove('completed');
      currentReportElement.setAttribute('data-status', 'pending');
      currentReportElement.removeAttribute('data-actions');

      const statusElement = currentReportElement.querySelector('.report-status');
      if (statusElement) {
        statusElement.innerHTML = '<i class="fas fa-clock" title="Pending review"></i>';
        statusElement.style.color = '';
      }

      // Log undo action
      console.log('Report actions undone for report ID:', reportId);
      console.log('Report reopened for review');

      // Refresh the view
      refreshReportsView();
    }

    currentReportElement = null;
  }

  // =====================================
  // REPORT BUTTON HANDLERS
  // =====================================

  function handleUserActionsClick(reportElement) {
    // Set current context similar to the old context menu approach
    currentMessageAuthor = reportElement.getAttribute('data-reported-user');
    currentMessageElement = reportElement;
    currentMessageId = null;

    // Open user actions modal
    const userActionsModal = document.getElementById('userActionsModal');
    document.getElementById('targetUsername').textContent = currentMessageAuthor;

    // Reset form
    resetUserActionsForm();
    toggleActionFields();
    userActionsModal.style.display = 'flex';
  }

  function handleUndoActionsClick(reportElement) {
    // Set current context
    currentMessageElement = reportElement;

    // Show undo modal
    showUndoReportModal(reportElement);
  }

  function initializeUserActionsListeners() {
    // Add event listeners for checkboxes to toggle field visibility
    document.getElementById('muteUser').addEventListener('change', toggleActionFields);
    document.getElementById('warnUser').addEventListener('change', toggleActionFields);
    document.getElementById('banUser').addEventListener('change', toggleActionFields);
  }

  // =====================================
  // REPORT FUNCTIONALITY
  // =====================================

  function resetReportForm() {
    // Clear all radio buttons
    document.querySelectorAll('input[name="reportReason"]').forEach(radio => {
      radio.checked = false;
    });

    // Clear description
    const descriptionTextarea = document.getElementById('reportDescription');
    descriptionTextarea.value = '';
    updateCharacterCount();

    // Disable submit button
    document.getElementById('submitReport').disabled = true;
  }

  function updateCharacterCount() {
    const textarea = document.getElementById('reportDescription');
    const count = document.getElementById('descriptionCount');
    count.textContent = textarea.value.length;
  }

  function updateSubmitButton() {
    const reasonSelected = document.querySelector('input[name="reportReason"]:checked');
    const submitButton = document.getElementById('submitReport');
    submitButton.disabled = !reasonSelected;
  }

  function handleReportSubmit() {
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    const description = document.getElementById('reportDescription').value;

    if (!selectedReason) {
      return; // Should not happen due to button being disabled
    }

    // Create report data
    const reportData = {
      messageId: currentMessageId,
      reportedUser: currentMessageAuthor,
      reportedBy: window.CURRENT_USERNAME,
      reason: selectedReason.value,
      description: description.trim(),
      timestamp: new Date().toISOString(),
      messageContent: document.getElementById('reportedMessageContent').textContent
    };

    // Log report (replace with actual server communication)
    console.log('Report submitted:', reportData);

    // Show success feedback
    const submitButton = document.getElementById('submitReport');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-check"></i> Report Sent';
    submitButton.disabled = true;

    setTimeout(() => {
      submitButton.innerHTML = originalText;
      const reportModal = document.getElementById('reportModal');
      closeModal(reportModal);
      console.log('Report has been sent to moderators for review.');
    }, 1500);
  }

  function initializeReportFunctionality() {
    // Character count for description
    document.getElementById('reportDescription').addEventListener('input', updateCharacterCount);

    // Update submit button when reason is selected
    document.querySelectorAll('input[name="reportReason"]').forEach(radio => {
      radio.addEventListener('change', updateSubmitButton);
    });
  }

  // =====================================
  // UTILITY FUNCTIONS
  // =====================================

  // Test functions for mute functionality (can be called from browser console)
  window.testMute = function (minutes = 1) {
    const expiryTime = Math.floor(Date.now() / 1000) + (minutes * 60);
    muteUser(expiryTime);
    console.log(`User muted for ${minutes} minute(s)`);
  };

  window.testUnmute = function () {
    unmuteUser();
    console.log('User unmuted');
  };

  // =====================================
  // ITEMS FUNCTIONALITY
  // =====================================

  let currentItemToSell = null;

  function initializeItemsFunctionality() {
    // Add event listeners to action buttons
    document.getElementById('createRandomBtn').addEventListener('click', function () {
      handleCreateRandomItem();
    });

    Array.from(document.getElementsByClassName('item-sell-button')).forEach(button => {
      console.log('Found sell button:', button);
      button.addEventListener('click', function () {
        handleSellItem(button);
      });
    });

    // Initialize modal event listeners
    initializeItemModals();
  }

  function initializeItemModals() {
    const createItemModal = document.getElementById('createItemModal');
    const sellItemModal = document.getElementById('sellItemModal');
    const insufficientCoinsModal = document.getElementById('insufficientCoinsModal');

    // Create item modal events
    document.getElementById('createItemModalClose').addEventListener('click', () => closeModal(createItemModal));
    document.getElementById('cancelCreateItem').addEventListener('click', () => closeModal(createItemModal));
    document.getElementById('confirmCreateItem').addEventListener('click', () => {
      confirmCreateRandomItem();
      closeModal(createItemModal);
    });

    // Sell item modal events
    document.getElementById('sellItemModalClose').addEventListener('click', () => closeModal(sellItemModal));
    document.getElementById('cancelSellItem').addEventListener('click', () => closeModal(sellItemModal));
    document.getElementById('confirmSellItem').addEventListener('click', () => {
      confirmSellItem();
      closeModal(sellItemModal);
    });

    // Insufficient coins modal events
    document.getElementById('insufficientCoinsModalClose').addEventListener('click', () => closeModal(insufficientCoinsModal));
    document.getElementById('closeInsufficientCoinsModal').addEventListener('click', () => closeModal(insufficientCoinsModal));

    // Close modals on outside click
    window.addEventListener('click', function (e) {
      if (e.target === createItemModal) closeModal(createItemModal);
      if (e.target === sellItemModal) closeModal(sellItemModal);
      if (e.target === insufficientCoinsModal) closeModal(insufficientCoinsModal);
    });
  }

  function handleSellItem(sellButton) {
    const itemElement = sellButton.closest('.item');
    const itemName = itemElement.querySelector('.item-name').textContent;
    const itemRarity = itemElement.querySelector('.item-rarity').textContent;
    const itemWorth = itemElement.querySelector('.item-worth').textContent;

    // Extract coin value from the worth text (e.g., "Worth 50 Coins" -> 50)
    const coinValue = parseInt(itemWorth.match(/\d+/)[0]);

    // Store reference to the item for later
    currentItemToSell = itemElement;

    // Populate modal with item details
    document.getElementById('sellItemName').textContent = itemName;
    document.getElementById('sellItemRarity').textContent = itemRarity;
    document.getElementById('sellItemPrice').innerHTML = `${coinValue} <i class="fas fa-coins"></i>`;

    // Show modal
    document.getElementById('sellItemModal').style.display = 'flex';
  }

  function confirmSellItem() {
    if (!currentItemToSell) return;

    const itemName = currentItemToSell.querySelector('.item-name').textContent;
    const itemWorth = currentItemToSell.querySelector('.item-worth').textContent;
    const coinValue = parseInt(itemWorth.match(/\d+/)[0]);

    // Update the current coins display
    const currentCoinsElement = document.querySelector('.currency-info span');
    const currentCoinsText = currentCoinsElement.textContent;
    const currentCoins = parseInt(currentCoinsText.match(/\d+/)[0]);
    const newCoins = currentCoins + coinValue;

    // Update the display
    currentCoinsElement.innerHTML = `<i class="fas fa-coins"></i> coins: ${newCoins}`;

    // Remove the item from the grid
    currentItemToSell.remove();
    currentItemToSell = null;

    console.log(`Sold ${itemName} for ${coinValue} coins. New balance: ${newCoins}`);
  }

  function handleCreateRandomItem() {
    const creationCost = 50; // Fixed cost for random item

    // Check if user has enough coins
    const currentCoinsElement = document.querySelector('.currency-info span');
    const currentCoinsText = currentCoinsElement.textContent;
    const currentCoins = parseInt(currentCoinsText.match(/\d+/)[0]);

    if (currentCoins < creationCost) {
      // Show insufficient coins modal instead of alert
      showInsufficientCoinsModal(creationCost, currentCoins);
      return;
    }

    // Update balance display in modal
    document.getElementById('currentBalanceDisplay').innerHTML = `${currentCoins} <i class="fas fa-coins"></i>`;

    // Show modal
    document.getElementById('createItemModal').style.display = 'flex';
  }

  function showInsufficientCoinsModal(requiredCoins, currentCoins) {
    const neededCoins = requiredCoins - currentCoins;

    // Update modal content
    document.getElementById('requiredCoinsDisplay').innerHTML = `${requiredCoins} <i class="fas fa-coins"></i>`;
    document.getElementById('currentCoinsDisplay').innerHTML = `${currentCoins} <i class="fas fa-coins"></i>`;
    document.getElementById('neededCoinsDisplay').innerHTML = `${neededCoins} <i class="fas fa-coins"></i> more`;

    // Show modal
    document.getElementById('insufficientCoinsModal').style.display = 'flex';
  }

  function confirmCreateRandomItem() {
    const creationCost = 50;
    const currentCoinsElement = document.querySelector('.currency-info span');
    const currentCoinsText = currentCoinsElement.textContent;
    const currentCoins = parseInt(currentCoinsText.match(/\d+/)[0]);

    // Update coins
    const newCoins = currentCoins - creationCost;
    currentCoinsElement.innerHTML = `<i class="fas fa-coins"></i> coins: ${newCoins}`;

    // Generate random item
    const randomItem = generateRandomItem();

    // Add to inventory
    addItemToInventory(randomItem.name, randomItem.rarity, randomItem.worth);

    console.log(`Created random item: ${randomItem.name} for ${creationCost} coins. New balance: ${newCoins}`);
  }

  function generateRandomItem() {
    // Random item names
    const itemNames = [
      'mystic aura', 'shadow cloak', 'crystal sword', 'flame wings', 'ice shield',
      'thunder bolt', 'star dust', 'moon beam', 'sun ray', 'wind spirit',
      'earth guardian', 'water flow', 'fire dance', 'lightning strike', 'frost bite',
      'golden crown', 'silver blade', 'bronze armor', 'diamond ring', 'ruby gem',
      'emerald stone', 'sapphire orb', 'pearl necklace', 'amethyst staff', 'obsidian dagger'
    ];

    // Rarity weights (higher numbers = more likely)
    const rarityWeights = [
      { name: 'Common 50.0%', weight: 50, worthMultiplier: 0.5 },
      { name: 'Uncommon 30.0%', weight: 30, worthMultiplier: 0.8 },
      { name: 'Rare 17.24%', weight: 17, worthMultiplier: 1.2 },
      { name: 'Epic 8.1%', weight: 8, worthMultiplier: 2.0 },
      { name: 'Legendary 2.5%', weight: 3, worthMultiplier: 4.0 }
    ];

    // Pick random name
    const randomName = itemNames[Math.floor(Math.random() * itemNames.length)];

    // Pick random rarity based on weights
    const totalWeight = rarityWeights.reduce((sum, rarity) => sum + rarity.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    let selectedRarity = rarityWeights[0];

    for (const rarity of rarityWeights) {
      if (randomWeight <= rarity.weight) {
        selectedRarity = rarity;
        break;
      }
      randomWeight -= rarity.weight;
    }

    // Calculate worth based on rarity
    const baseWorth = 25;
    const worth = Math.floor(baseWorth * selectedRarity.worthMultiplier + Math.random() * 20);

    return {
      name: randomName,
      rarity: selectedRarity.name,
      worth: worth
    };
  }

  function addItemToInventory(itemName, itemRarity, sellValue) {
    const itemsGrid = document.querySelector('.items-grid');

    const newItem = document.createElement('div');
    newItem.className = 'item owned';
    newItem.innerHTML = `
      <div class="item-name">${itemName}</div>
      <div class="item-rarity">${itemRarity}</div>
      <div class="item-worth">Worth ${sellValue} Coins</div>
      <button class="sell-button">sell</button>
    `;

    itemsGrid.appendChild(newItem);
  }

  // =====================================
  // FRIENDS FUNCTIONALITY
  // =====================================

  function initializeFriendsFunctionality() {
    // Initialize friend request tabs
    initializeFriendRequestTabs();

    // Initialize friends filter
    initializeFriendsFilter();

    // Initialize friend action buttons
    initializeFriendActions();

    // Add specific event listener for the add friend button
    const addFriendBtn = document.getElementById('sendFriendRequestBtn');
    if (addFriendBtn) {
      addFriendBtn.addEventListener('click', function () {
        showAddFriendModal();
      });
    }

    // Load friends and requests from server
    loadFriendsList();
    loadFriendRequests();

    // Set up periodic refresh
    setInterval(() => {
      loadFriendsList();
      loadFriendRequests();
    }, 30000);

    // Update user status periodically
    setInterval(updateUserStatus, 60000); // Update status every minute
    updateUserStatus(); // Initial status update

    // Update online users count periodically
    setInterval(updateOnlineUsersCount, 30000); // Update every 30 seconds
    updateOnlineUsersCount(); // Initial count update
  }

  async function loadFriendsList() {
    try {
      const response = await api.get('/friends/list');
      const friends = response.friends || [];

      const friendsContainer = document.querySelector('.friends-list');
      if (!friendsContainer) return;

      // Clear existing friends
      friendsContainer.innerHTML = '';

      // Count friends by status
      let totalCount = friends.length;
      let onlineCount = 0;
      let offlineCount = 0;

      if (friends.length === 0) {
        friendsContainer.innerHTML = `
          <div class="no-friends-message">
            <div class="no-friends-icon">
              <i class="fas fa-user-friends"></i>
            </div>
            <h3>No friends yet</h3>
            <p>Send friend requests to start building your network!</p>
          </div>
        `;
      } else {
        friends.forEach(friend => {
          const friendElement = createFriendElement(friend);
          friendsContainer.appendChild(friendElement);

          // Count friends by status
          if (friend.status === 'online' || friend.status === 'idle') {
            onlineCount++;
          } else {
            offlineCount++;
          }
        });
      }

      // Update friend counts in UI
      updateFriendCounts(totalCount, onlineCount, offlineCount);
      updateOnlineFriendsCount(onlineCount);

    } catch (error) {
      console.error('Failed to load friends list:', error);
    }
  }

  function createFriendElement(friend) {
    const friendDiv = document.createElement('div');
    friendDiv.className = 'friend-item';
    friendDiv.setAttribute('data-status', friend.status);

    const statusIcon = getStatusIcon(friend.status);
    const statusClass = friend.status === 'online' ? 'online' : friend.status === 'idle' ? 'idle' : 'offline';

    friendDiv.innerHTML = `
      <div class="friend-avatar">
        <i class="fas fa-user"></i>
        <span class="status-indicator ${statusClass}"></span>
      </div>
      <div class="friend-info">
        <span class="friend-name">${friend.username}</span>
        <span class="friend-status">${friend.status_text}</span>
      </div>
      <div class="friend-actions">
        <button class="message-friend-btn btn-primary" data-friend="${friend.username}">
          <i class="fas fa-comment"></i> Message
        </button>
        <button class="remove-friend-btn btn-danger" data-friend-id="${friend.id}">
          <i class="fas fa-user-minus"></i> Remove
        </button>
      </div>
    `;

    return friendDiv;
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'online': return '🟢';
      case 'idle': return '🟡';
      case 'offline': return '⚫';
      default: return '⚫';
    }
  }

  async function loadFriendRequests() {
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        api.get('/friends/requests/incoming'),
        api.get('/friends/requests/outgoing')
      ]);

      const incomingRequests = incomingResponse.requests || [];
      const outgoingRequests = outgoingResponse.requests || [];

      // Load incoming requests
      const incomingContainer = document.querySelector('.incoming-requests');
      if (incomingContainer) {
        incomingContainer.innerHTML = '';

        if (incomingRequests.length === 0) {
          incomingContainer.innerHTML = `
            <div class="no-requests-message">
              <p>No incoming friend requests</p>
            </div>
          `;
        } else {
          incomingRequests.forEach(request => {
            const requestElement = createIncomingRequestElement(request);
            incomingContainer.appendChild(requestElement);
          });
        }
      }

      // Load outgoing requests  
      const outgoingContainer = document.querySelector('.outgoing-requests');
      if (outgoingContainer) {
        outgoingContainer.innerHTML = '';

        if (outgoingRequests.length === 0) {
          outgoingContainer.innerHTML = `
            <div class="no-requests-message">
              <p>No outgoing friend requests</p>
            </div>
          `;
        } else {
          outgoingRequests.forEach(request => {
            const requestElement = createOutgoingRequestElement(request);
            outgoingContainer.appendChild(requestElement);
          });
        }
      }

      // Update request counts
      updateRequestCount(incomingRequests.length, outgoingRequests.length);

    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  }

  function createIncomingRequestElement(request) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'friend-request-item';
    requestDiv.setAttribute('data-request-id', request.id);

    requestDiv.innerHTML = `
      <div class="request-user-info">
        <div class="request-user-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="request-user-details">
          <span class="friend-name">${request.requester.username}</span>
          <span class="request-time">${formatRequestTime(request.created_at)}</span>
        </div>
      </div>
      <div class="request-actions">
        <button class="accept-friend-btn btn-success" data-request-id="${request.id}">
          <i class="fas fa-check"></i> Accept
        </button>
        <button class="decline-friend-btn btn-danger" data-request-id="${request.id}">
          <i class="fas fa-times"></i> Decline
        </button>
      </div>
    `;

    return requestDiv;
  }

  function createOutgoingRequestElement(request) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'friend-request-item';
    requestDiv.setAttribute('data-request-id', request.id);

    requestDiv.innerHTML = `
      <div class="request-user-info">
        <div class="request-user-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="request-user-details">
          <span class="friend-name">${request.recipient.username}</span>
          <span class="request-time">${formatRequestTime(request.created_at)}</span>
        </div>
      </div>
      <div class="request-actions">
        <button class="cancel-request-btn btn-secondary" data-request-id="${request.id}">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    `;

    return requestDiv;
  }

  function formatRequestTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  async function updateUserStatus() {
    try {
      await api.post('/friends/status', { status: 'online' });
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  }

  async function updateOnlineUsersCount() {
    try {
      const response = await api.get('/stats/online');
      const onlineCount = response.online_count || 0;

      const onlineCountElement = document.getElementById('online-count');
      if (onlineCountElement) {
        if (onlineCount === 0) {
          onlineCountElement.textContent = 'No one online';
        } else if (onlineCount === 1) {
          onlineCountElement.textContent = '1 person online';
        } else {
          onlineCountElement.textContent = `${onlineCount} people online`;
        }
      }
    } catch (error) {
      console.error('Failed to update online users count:', error);
      const onlineCountElement = document.getElementById('online-count');
      if (onlineCountElement) {
        onlineCountElement.textContent = 'Error loading count';
      }
    }
  }

  function initializeFriendRequestTabs() {
    const requestTabs = document.querySelectorAll('.request-tab-btn');
    const requestLists = document.querySelectorAll('.friend-requests-list');

    requestTabs.forEach(tab => {
      tab.addEventListener('click', function () {
        const requestType = this.getAttribute('data-request-type');

        // Remove active class from all tabs and lists
        requestTabs.forEach(t => t.classList.remove('active'));
        requestLists.forEach(list => list.classList.remove('active'));

        // Add active class to clicked tab and corresponding list
        this.classList.add('active');
        document.querySelector(`.${requestType}-requests`).classList.add('active');
      });
    });
  }

  function initializeFriendsFilter() {
    const filterButtons = document.querySelectorAll('.friends-filter .filter-btn');
    const friendItems = document.querySelectorAll('.friend-item');

    filterButtons.forEach(button => {
      button.addEventListener('click', function () {
        const filter = this.getAttribute('data-filter');

        // Remove active class from all filter buttons
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Show/hide friends based on filter
        friendItems.forEach(item => {
          const status = item.getAttribute('data-status');

          if (filter === 'all') {
            item.style.display = 'flex';
          } else if (filter === 'online' && status === 'online') {
            item.style.display = 'flex';
          } else if (filter === 'offline' && status === 'offline') {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  function initializeFriendActions() {
    // Send friend request
    document.addEventListener('click', function (e) {
      if (e.target.id === 'sendFriendRequestBtn' || e.target.classList.contains('sendFriendRequestBtn') || e.target.parentElement.classList.contains('sendFriendRequestBtn')) {
        showAddFriendModal();
      }
    });

    // Accept friend request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('accept-friend-btn') || e.target.parentElement.classList.contains('accept-friend-btn')) {
        const button = e.target.classList.contains('accept-friend-btn') ? e.target : e.target.parentElement;
        const requestId = button.getAttribute('data-request-id');
        acceptFriendRequest(requestId);
      }
    });

    // Decline friend request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('decline-friend-btn') || e.target.parentElement.classList.contains('decline-friend-btn')) {
        const button = e.target.classList.contains('decline-friend-btn') ? e.target : e.target.parentElement;
        const requestId = button.getAttribute('data-request-id');
        declineFriendRequest(requestId);
      }
    });

    // Cancel outgoing request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('cancel-request-btn') || e.target.parentElement.classList.contains('cancel-request-btn')) {
        const button = e.target.classList.contains('cancel-request-btn') ? e.target : e.target.parentElement;
        const requestId = button.getAttribute('data-request-id');
        declineFriendRequest(requestId); // Same endpoint for cancel
      }
    });

    // Remove friend
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('remove-friend-btn') || e.target.parentElement.classList.contains('remove-friend-btn')) {
        const button = e.target.classList.contains('remove-friend-btn') ? e.target : e.target.parentElement;
        const friendId = button.getAttribute('data-friend-id');
        removeFriend(friendId);
      }
    });

    // Message friend button
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('message-friend-btn') || e.target.parentElement.classList.contains('message-friend-btn')) {
        const button = e.target.classList.contains('message-friend-btn') ? e.target : e.target.parentElement;
        const friendName = button.getAttribute('data-friend');

        // Switch to DMs tab and open conversation
        switchToDMConversation(friendName);
      }
    });
  }

  async function acceptFriendRequest(requestId) {
    try {
      await api.post(`/friends/request/${requestId}/accept`);
      showFriendActionMessage('Friend request accepted!', 'success');

      // Reload friends and requests
      loadFriendsList();
      loadFriendRequests();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      showFriendActionMessage('Failed to accept friend request', 'error');
    }
  }

  async function declineFriendRequest(requestId) {
    try {
      await api.post(`/friends/request/${requestId}/decline`);
      showFriendActionMessage('Friend request declined', 'info');

      // Reload requests
      loadFriendRequests();
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      showFriendActionMessage('Failed to decline friend request', 'error');
    }
  }

  async function removeFriend(friendId) {
    if (!confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    try {
      await api.post('/friends/remove', { friend_id: friendId });
      showFriendActionMessage('Friend removed', 'info');

      // Reload friends list
      loadFriendsList();
    } catch (error) {
      console.error('Failed to remove friend:', error);
      showFriendActionMessage('Failed to remove friend', 'error');
    }
  }

  async function sendFriendRequest(username) {
    try {
      await api.post('/friends/request', { username: username });
      showFriendActionMessage(`Friend request sent to ${username}!`, 'success');

      // Reload requests
      loadFriendRequests();
    } catch (error) {
      console.error('Failed to send friend request:', error);
      const errorMessage = error.message || 'Failed to send friend request';
      showFriendActionMessage(errorMessage, 'error');
      throw error; // Re-throw to handle in modal
    }
  }

  function updateOnlineFriendsCount(count) {
    const onlineFriendsSpan = document.querySelector('.online-friends-count');
    if (onlineFriendsSpan) {
      if (count === 0) {
        onlineFriendsSpan.textContent = 'No friends online';
      } else if (count === 1) {
        onlineFriendsSpan.textContent = '1 friend online';
      } else {
        onlineFriendsSpan.textContent = `${count} friends online`;
      }
    }
  }

  function updateFriendCounts(totalCount, onlineCount, offlineCount) {
    // Update total friends count
    const totalCountSpan = document.getElementById('friends-total-count');
    if (totalCountSpan) {
      if (totalCount === 0) {
        totalCountSpan.textContent = 'No friends';
      } else if (totalCount === 1) {
        totalCountSpan.textContent = '1 total';
      } else {
        totalCountSpan.textContent = `${totalCount} total`;
      }
    }

    // Update filter button counts
    const allBtn = document.getElementById('filter-all');
    const onlineBtn = document.getElementById('filter-online');
    const offlineBtn = document.getElementById('filter-offline');

    if (allBtn) {
      allBtn.textContent = `All (${totalCount})`;
    }
    if (onlineBtn) {
      onlineBtn.textContent = `Online (${onlineCount})`;
    }
    if (offlineBtn) {
      offlineBtn.textContent = `Offline (${offlineCount})`;
    }
  }

  function updateRequestCount(incomingCount = null, outgoingCount = null) {
    if (incomingCount === null) {
      // Count from DOM if not provided
      const incomingRequests = document.querySelectorAll('.incoming-requests .friend-request-item:not(.no-requests-message)');
      incomingCount = incomingRequests.length;
    }

    if (outgoingCount === null) {
      // Count from DOM if not provided  
      const outgoingRequests = document.querySelectorAll('.outgoing-requests .friend-request-item:not(.no-requests-message)');
      outgoingCount = outgoingRequests.length;
    }

    const requestCountSpan = document.querySelector('.request-count');
    const incomingTabBtn = document.querySelector('[data-request-type="incoming"]');
    const outgoingTabBtn = document.querySelector('[data-request-type="outgoing"]');

    // Update the main request count (total pending)
    const totalPending = incomingCount;
    if (requestCountSpan) {
      if (totalPending === 0) {
        requestCountSpan.textContent = 'No pending requests';
      } else if (totalPending === 1) {
        requestCountSpan.textContent = '1 pending request';
      } else {
        requestCountSpan.textContent = `${totalPending} pending requests`;
      }
    }

    // Update the tab button texts
    if (incomingTabBtn) {
      incomingTabBtn.innerHTML = `<i class="fas fa-arrow-down"></i> Incoming (${incomingCount})`;
    }

    if (outgoingTabBtn) {
      outgoingTabBtn.innerHTML = `<i class="fas fa-arrow-up"></i> Outgoing (${outgoingCount})`;
    }
  }

  function showFriendActionMessage(message, type) {
    // Create a temporary notification (you could enhance this with a proper notification system)
    const notification = document.createElement('div');
    notification.className = `friend-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // =====================================
  // DMS FUNCTIONALITY
  // =====================================

  let currentDMConversation = null;
  let currentConversationId = null;
  let lastMessageCount = 0;
  let dmPollingInterval = null;

  function initializeDMsFunctionality() {
    // Check if user has disabled DMs first
    if (!isDMsEnabled()) {
      showDMDisabledScreen();
      return;
    }

    // Load conversations from server
    loadConversationsList();

    // Initialize conversation switching
    initializeConversationSwitching();

    // Initialize DM messaging
    initializeDMMessaging();

    // Initialize conversation search
    initializeConversationSearch();

    // Set up periodic refresh of conversations (every 30 seconds)
    setInterval(loadConversationsList, 30000);

    // Check if DMs tab is already active on page load
    const dmsTab = document.getElementById('dms');
    if (dmsTab && dmsTab.classList.contains('active')) {
      // Delay to ensure conversations are loaded first
      setTimeout(loadLatestDMConversation, 300);
    }
  }

  function isDMsEnabled() {
    const settings = getSettings();
    return settings.allowDirectMessages !== false;
  }

  function showDMDisabledForOtherUser(username) {
    const dmMessages = document.getElementById('dm-messages');
    const dmInputContainer = document.querySelector('.dm-input-container');
    const dmConversationHeader = document.querySelector('.dm-conversation-header');

    // Hide input container and header
    if (dmInputContainer) {
      dmInputContainer.style.display = 'none';
    }
    if (dmConversationHeader) {
      dmConversationHeader.style.display = 'none';
    }

    // Show DM disabled screen for other user
    dmMessages.innerHTML = `
      <div class="dm-disabled-screen other-user">
        <div class="dm-disabled-content">
          <i class="fas fa-ban dm-disabled-icon"></i>
          <h3>${username} has disabled direct messages</h3>
          <p>This user has chosen not to receive direct messages. You cannot send them messages at this time.</p>
        </div>
      </div>
    `;
  }

  function showDMDisabledScreen() {
    const dmsLayout = document.querySelector('.dms-layout');
    if (dmsLayout) {
      dmsLayout.innerHTML = `
        <div class="dm-disabled-screen">
          <div class="dm-disabled-content">
            <div class="dm-disabled-icon">
              <i class="fas fa-ban"></i>
            </div>
            <h3>Direct Messages Disabled</h3>
            <p>You have disabled direct messages in your settings.</p>
            <button class="enable-dms-button" onclick="enableDMs()">
              <i class="fas fa-check"></i>
              Enable Direct Messages
            </button>
          </div>
        </div>
      `;
    }
  }

  function hideDMDisabledScreen() {
    const dmsLayout = document.querySelector('.dms-layout');
    if (dmsLayout) {
      // Restore original DM layout structure
      dmsLayout.innerHTML = `
        <!-- Conversations Sidebar -->
        <div class="conversations-sidebar">
          <div class="conversations-header">
            <div class="search-container">
              <i class="fas fa-search search-icon"></i>
              <input type="text" class="conversation-search" placeholder="Search conversations...">
            </div>
          </div>
          <div class="conversations-list">
            <!-- Conversations will be populated here -->
          </div>
        </div>

        <!-- Message Area -->
        <div class="dm-messages-area">
          <!-- Active conversation header -->
          <div class="dm-conversation-header">
            <div class="dm-user-info">
              <div class="dm-user-avatar">
                <i class="fas fa-user"></i>
                <div class="status-indicator online"></div>
              </div>
              <div class="dm-user-details">
                <span class="dm-user-name"></span>
                <span class="dm-user-status"></span>
              </div>
            </div>
          </div>

          <!-- Messages container -->
          <div class="chat-messages" id="dm-messages">
          </div>

          <!-- Message input -->
          <div class="dm-input-container">
            <input type="text" class="dm-input" placeholder="Type your message..." maxlength="200">
            <button class="dm-send-button">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      `;
    }
  }

  // Global function to enable DMs
  window.enableDMs = function () {
    setSetting('allowDirectMessages', true);
    hideDMDisabledScreen();
    // Reinitialize DM functionality
    initializeDMsFunctionality();
  };

  async function loadLatestDMConversation() {
    try {
      // Clear any placeholder content immediately
      const dmMessages = document.getElementById('dm-messages');
      if (dmMessages) {
        dmMessages.innerHTML = '';
      }

      // Clear conversation header placeholder
      const dmUserName = document.querySelector('.dm-user-name');
      const dmUserStatus = document.querySelector('.dm-user-status');
      if (dmUserName) dmUserName.textContent = '';
      if (dmUserStatus) dmUserStatus.textContent = '';

      // Wait a moment for conversations to load if they haven't already
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get the first conversation item (most recent)
      const firstConversation = document.querySelector('.conversation-item');

      if (firstConversation) {
        const conversationUsername = firstConversation.getAttribute('data-conversation');
        if (conversationUsername && conversationUsername !== 'undefined') {
          await switchDMConversation(conversationUsername);
        }
      } else {
        // No conversations available, show empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'dm-empty-state';
        emptyState.innerHTML = `
          <div class="empty-state-content">
            <i class="fas fa-comments empty-state-icon"></i>
            <h3>No conversations yet</h3>
            <p>Start messaging your friends to see conversations here!</p>
          </div>
        `;
        dmMessages.appendChild(emptyState);
      }
    } catch (error) {
      console.error('Failed to load latest DM conversation:', error);
    }
  }

  async function loadConversationsList() {
    try {
      const response = await api.get('/dms/conversations');
      const conversations = response.conversations || [];

      const conversationsContainer = document.querySelector('.conversations-list');
      if (!conversationsContainer) return;

      // Clear existing conversations (except search input)
      const existingItems = conversationsContainer.querySelectorAll('.conversation-item');
      existingItems.forEach(item => item.remove());

      if (conversations.length === 0) {
        // Show empty state
        showEmptyConversationsState();
        return;
      }

      // Add conversations from server
      conversations.forEach(conversation => {
        const conversationElement = createConversationElement(conversation);
        conversationsContainer.appendChild(conversationElement);
      });

      // Re-initialize conversation switching with new elements
      initializeConversationSwitching();

      // Hide empty state if it's showing
      hideEmptyConversationsState();

    } catch (error) {
      console.error('Failed to load conversations:', error);
      showEmptyConversationsState();
    }
  }

  function showEmptyConversationsState() {
    const conversationsContainer = document.querySelector('.conversations-list');
    const dmMessagesContainer = document.getElementById('dm-messages');

    if (conversationsContainer) {
      // Check if empty state already exists
      if (!conversationsContainer.querySelector('.empty-conversations-state')) {
        const emptyStateDiv = document.createElement('div');
        emptyStateDiv.className = 'empty-conversations-state';
        emptyStateDiv.innerHTML = `
          <div class="empty-conversations-content">
            <div class="empty-conversations-icon">
              <i class="fas fa-comments"></i>
            </div>
            <h3>No conversations yet</h3>
            <p>Start messaging your friends to see conversations here!</p>
          </div>
        `;
        conversationsContainer.appendChild(emptyStateDiv);
      }
    }

    if (dmMessagesContainer) {
      dmMessagesContainer.innerHTML = `
        <div class="no-conversation-selected">
          <div class="no-conversation-icon">
            <i class="fas fa-comment"></i>
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a friend to start messaging or create a new conversation</p>
        </div>
      `;
    }
  }

  function hideEmptyConversationsState() {
    const emptyState = document.querySelector('.empty-conversations-state');
    if (emptyState) {
      emptyState.remove();
    }
  }

  function createConversationElement(conversation) {
    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation-item';
    conversationDiv.setAttribute('data-conversation', conversation.other_user.username);

    const statusClass = conversation.other_user.status === 'online' ? 'online' :
      conversation.other_user.status === 'idle' ? 'idle' : 'offline';

    // Create avatar element with status indicator
    const avatarContainer = createAvatarElement(conversation.other_user.id, conversation.other_user.has_avatar, 'conversation-avatar');
    const statusIndicator = document.createElement('span');
    statusIndicator.className = `status-indicator ${statusClass}`;
    avatarContainer.appendChild(statusIndicator);

    // Create conversation content
    const conversationContent = document.createElement('div');
    conversationContent.className = 'conversation-content';

    // Create header
    const conversationHeader = document.createElement('div');
    conversationHeader.className = 'conversation-header';

    const conversationName = createSafeElement('span', conversation.other_user.username, 'conversation-name');
    conversationHeader.appendChild(conversationName);

    // Create unread badge if needed
    if (conversation.unread_count > 0) {
      const unreadBadge = createSafeElement('span', conversation.unread_count.toString(), 'unread-badge');
      conversationHeader.appendChild(unreadBadge);
    }

    // Create last message with markdown support
    const lastMessage = document.createElement('div');
    lastMessage.className = 'last-message';
    if (conversation.last_message) {
      lastMessage.innerHTML = parseMarkdown(conversation.last_message);
    } else {
      lastMessage.textContent = 'No messages yet';
    }

    // Create status text
    const conversationStatus = createSafeElement('div', conversation.other_user.status_text, 'conversation-status');

    // Assemble conversation content
    conversationContent.appendChild(conversationHeader);
    conversationContent.appendChild(lastMessage);
    conversationContent.appendChild(conversationStatus);

    // Assemble full conversation element
    conversationDiv.appendChild(avatarContainer);
    conversationDiv.appendChild(conversationContent);

    return conversationDiv;
  }

  function initializeConversationSwitching() {
    const conversationItems = document.querySelectorAll('.conversation-item');

    conversationItems.forEach(item => {
      item.addEventListener('click', async function () {
        const conversationUsername = this.getAttribute('data-conversation');
        await switchDMConversation(conversationUsername);
      });
    });
  }

  async function switchDMConversation(conversationUsername) {
    const conversationItems = document.querySelectorAll('.conversation-item');

    // Clear any existing polling
    if (dmPollingInterval) {
      clearInterval(dmPollingInterval);
      dmPollingInterval = null;
    }

    // Reset DM initial load scroll flag so new conversation scrolls to bottom
    window.dmInitialLoadScroll = false;

    // Remove active class from all conversations
    conversationItems.forEach(item => item.classList.remove('active'));

    // Add active class to selected conversation
    const activeConversation = document.querySelector(`[data-conversation="${conversationUsername}"]`);
    if (activeConversation) {
      activeConversation.classList.add('active');

      // Remove unread badge
      const unreadBadge = activeConversation.querySelector('.unread-badge');
      if (unreadBadge) {
        unreadBadge.remove();
      }
    }

    // Update conversation header
    await updateDMConversationHeader(conversationUsername);

    // Ensure header and input are visible for valid conversations
    showDMInterface();

    // Load conversation messages
    await loadDMConversation(conversationUsername);

    // Update current conversation
    currentDMConversation = conversationUsername;

    // Start polling for new messages
    startDMMessagePolling();
  }

  function showDMInterface() {
    const dmInputContainer = document.querySelector('.dm-input-container');
    const dmConversationHeader = document.querySelector('.dm-conversation-header');

    // Show input container and header
    if (dmInputContainer) {
      dmInputContainer.style.display = 'flex';
    }
    if (dmConversationHeader) {
      dmConversationHeader.style.display = 'block';
    }
  }

  async function updateDMConversationHeader(conversationUsername) {
    const dmUserName = document.querySelector('.dm-user-name');
    const dmUserStatus = document.querySelector('.dm-user-status');
    const dmUserAvatar = document.querySelector('.dm-user-avatar');

    try {
      // Get conversation data to get user info
      const convResponse = await api.get(`/dms/conversations/with/${conversationUsername}`);
      const otherUser = convResponse.other_user;

      if (dmUserName) {
        dmUserName.textContent = otherUser.username;
      }

      if (dmUserStatus) {
        dmUserStatus.textContent = otherUser.status_text;
      }

      // Update avatar
      if (dmUserAvatar) {
        const avatarElement = createAvatarElement(otherUser.id, otherUser.has_avatar, 'dm-user-avatar');
        // Add status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.className = `status-indicator ${otherUser.status}`;
        avatarElement.appendChild(statusIndicator);

        // Clear and set the avatar
        dmUserAvatar.innerHTML = '';
        dmUserAvatar.appendChild(avatarElement);
      }

      // Update status indicator (fallback)
      const statusIndicator = document.querySelector('.dm-user-avatar .status-indicator');
      if (statusIndicator) {
        statusIndicator.className = `status-indicator ${otherUser.status}`;
      }
    } catch (error) {
      console.error('Failed to update DM header:', error);

      // Fallback to just showing the username
      if (dmUserName) {
        dmUserName.textContent = conversationUsername;
      }
      if (dmUserStatus) {
        dmUserStatus.textContent = 'Unknown status';
      }
    }
  }

  async function loadDMConversation(conversationUsername) {
    const dmMessages = document.getElementById('dm-messages');

    try {
      // Get or create conversation with the user
      const convResponse = await api.get(`/dms/conversations/with/${conversationUsername}`);
      const conversationId = convResponse.conversation_id;

      // Update current conversation ID
      currentConversationId = conversationId;

      // Get messages for this conversation
      const messagesResponse = await api.get(`/dms/conversations/${conversationId}/messages`);
      const messages = messagesResponse.messages || [];

      // Update message count for polling
      lastMessageCount = messages.length;

      // Clear existing messages
      dmMessages.innerHTML = '';

      // Show empty state if no messages
      if (messages.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'dm-empty-state';
        emptyState.innerHTML = `
          <div class="empty-state-content">
            <i class="fas fa-envelope empty-state-icon"></i>
            <h3>No messages yet</h3>
            <p>Send the first message to start your conversation!</p>
          </div>
        `;
        dmMessages.appendChild(emptyState);
        return;
      }

      // Add messages
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

        // Use new message format with reactions and replies
        const messageData = {
          id: message.id,
          content: message.content,
          is_own: message.is_own,
          time: messageTime,
          reactions: message.reactions,
          reply_to: message.reply_to,
          sender: message.sender // Include sender info with badge and avatar
        };

        addDMMessage(messageData, false);
      });

      // Always scroll to bottom when loading a conversation (like initial load)
      dmMessages.scrollTop = dmMessages.scrollHeight;
    } catch (error) {
      console.error('Failed to load DM conversation:', error);

      // Check if the error is due to DMs being disabled
      if (error.dm_disabled) {
        showDMDisabledForOtherUser(error.username);
        return;
      }

      // Clear messages and show error
      dmMessages.innerHTML = `
        <div class="dm-error">
          <p>Failed to load conversation</p>
        </div>
      `;
    }
  }

  function initializeDMMessaging() {
    const dmInput = document.querySelector('.dm-input');
    const dmSendButton = document.querySelector('.dm-send-button');

    async function sendDMMessage() {
      // Check if user is muted
      if (muteExpiry && Date.now() < muteExpiry) {
        return; // User is still muted, don't send message
      }

      if (!dmInput.value.trim()) return;

      const message = dmInput.value.trim();

      try {
        // Find the recipient ID from the current DM conversation
        const recipientId = await getRecipientIdFromCurrentConversation();

        if (!recipientId) {
          console.error('No recipient found for current conversation');
          return;
        }

        // Prepare message data
        const messageData = {
          recipient_id: recipientId,
          content: message
        };

        // Add reply_to if there's an active reply
        if (currentReplyTo) {
          messageData.reply_to = currentReplyTo;
        }

        // Send message to server
        const response = await api.post('/dms/send', messageData);

        if (response.success) {
          // Clear input
          dmInput.value = '';

          // Clear reply indicator and get reply data before clearing
          const dmInputContainer = document.querySelector('.dm-input-container');
          const replyIndicator = dmInputContainer?.querySelector('.reply-indicator');
          let replyData = null;

          if (replyIndicator && currentReplyTo) {
            // Find the original message being replied to
            const originalMessage = document.querySelector(`[data-message-id="${currentReplyTo}"]`);
            if (originalMessage) {
              const originalText = originalMessage.querySelector('.dm-message-text')?.textContent || '';
              const originalAuthor = originalMessage.classList.contains('sent')
                ? (window.CURRENT_USERNAME || 'You')
                : (currentDMConversation || 'Unknown User');

              replyData = {
                message_id: currentReplyTo,
                content: originalText.substring(0, 100) + (originalText.length > 100 ? '...' : ''),
                sender_username: originalAuthor
              };
            }

            replyIndicator.remove();
            dmInputContainer.classList.remove('input-container-with-reply');
            currentReplyTo = null;
          }

          // Add the message immediately to the UI with reply data
          const messageTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          // Create message object for addDMMessage
          const messageObj = {
            content: message,
            timestamp: messageTime,
            is_own: true,
            reply_to: replyData
          };

          addDMMessage(messageObj, false);

          // Update message count
          lastMessageCount++;

          // Refresh conversations list to update last message and timestamp
          await loadConversationsList();

          // Immediately check for new messages to ensure the sent message appears
          await checkForNewMessages();
        }
      } catch (error) {
        console.error('Failed to send DM:', error);

        // Handle specific error cases
        if (error.message && error.message.includes('muted')) {
          showNotification('You are currently muted and cannot send messages', 'error');
          // Refresh user status to update mute info
          refreshUserStatus();
        } else if (error.message && error.message.includes('disabled direct messages')) {
          showNotification('This user has disabled direct messages', 'error');
        } else if (error.message) {
          showNotification(error.message, 'error');
        } else {
          showNotification('Failed to send message', 'error');
        }
      }
    }

    // Send message on button click
    dmSendButton.addEventListener('click', sendDMMessage);

    // Send message on Enter key
    dmInput.addEventListener('keydown', function (e) {
      const settings = getSettings();
      const ctrlEnterMode = settings.ctrlEnterToSend;

      if (ctrlEnterMode) {
        // Ctrl+Enter to send mode
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          sendDMMessage();
        }
      } else {
        // Regular Enter to send mode
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendDMMessage();
        }
      }
    });

    // Add event delegation for DM reaction clicks and context menu
    const dmMessages = document.getElementById('dm-messages');
    dmMessages.addEventListener('click', function (e) {
      if (e.target.closest('.dm-reaction')) {
        e.preventDefault();
        const reactionElement = e.target.closest('.dm-reaction');
        const emoji = reactionElement.getAttribute('data-emoji');
        const messageElement = e.target.closest('.message'); // Changed from .dm-message to .message
        const messageId = messageElement.getAttribute('data-message-id');

        if (messageId && emoji) {
          reactToDMMessage(messageId, emoji);
        }
      }
    });

    // Add context menu for DM messages
    dmMessages.addEventListener('contextmenu', function (e) {
      console.log('DM context menu triggered', e.target);
      const messageElement = e.target.closest('.message'); // Changed from .dm-message to .message
      console.log('Message element:', messageElement);
      if (messageElement && messageElement.parentElement.id === 'dm-messages') { // Ensure it's a DM message
        e.preventDefault();

        const messageId = messageElement.getAttribute('data-message-id');
        console.log('Message ID:', messageId);
        if (messageId) {
          // Store current message for context menu actions
          window.currentDMMessageId = messageId;

          // Show DM context menu
          const dmContextMenu = document.getElementById('dmContextMenu');
          dmContextMenu.style.left = e.pageX + 'px';
          dmContextMenu.style.top = e.pageY + 'px';
          dmContextMenu.style.display = 'block';
          console.log('DM context menu shown');
        } else {
          console.log('No message ID found');
        }
      } else {
        console.log('No message element found');
      }
    });
  }

  async function getRecipientIdFromCurrentConversation() {
    try {
      // Get conversation list to find the recipient ID
      const response = await api.get('/dms/conversations');
      const conversations = response.conversations || [];

      // Find the current conversation
      const currentConversation = conversations.find(conv =>
        conv.other_user.username === currentDMConversation
      );

      return currentConversation ? currentConversation.other_user.id : null;
    } catch (error) {
      console.error('Failed to get recipient ID:', error);
      return null;
    }
  }

  function startDMMessagePolling() {
    // Clear any existing polling first
    if (dmPollingInterval) {
      clearInterval(dmPollingInterval);
    }

    // Poll for new messages every 3 seconds
    dmPollingInterval = setInterval(async () => {
      if (currentConversationId && currentDMConversation) {
        await checkForNewMessages();
      }
    }, 3000);
  }

  async function checkForNewMessages() {
    try {
      if (!currentConversationId) return;

      const messagesResponse = await api.get(`/dms/conversations/${currentConversationId}/messages`);
      const messages = messagesResponse.messages || [];

      // Check if there are new messages
      if (messages.length > lastMessageCount) {
        const dmMessages = document.getElementById('dm-messages');

        // Add only the new messages
        const newMessages = messages.slice(lastMessageCount);
        newMessages.forEach(message => {
          let messageTime;
          try {
            let date;

            if (typeof message.timestamp === 'string') {
              // Enhanced parsing for string timestamps, especially ISO format from server
              date = new Date(message.timestamp);

              // Validate the parsed date
              if (isNaN(date.getTime())) {
                // If ISO parsing fails, try parsing as Unix timestamp if it's a numeric string
                const numericTimestamp = parseFloat(message.timestamp);
                if (!isNaN(numericTimestamp)) {
                  date = new Date(numericTimestamp * 1000);
                }
              }
            } else {
              // Handle numeric timestamps (assumed to be Unix timestamps)
              date = new Date(message.timestamp * 1000);
            }

            // Final validation and format
            if (date && !isNaN(date.getTime())) {
              messageTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            } else {
              throw new Error('Invalid timestamp');
            }
          } catch (error) {
            console.warn('Error parsing timestamp:', error, message.timestamp);
            messageTime = 'Unknown time';
          }

          // Use new message format with all properties
          const messageData = {
            id: message.id,
            content: message.content,
            is_own: message.is_own,
            time: messageTime,
            reactions: message.reactions,
            reply_to: message.reply_to,
            sender: message.sender // Include sender info with badge and avatar
          };

          addDMMessage(messageData, false);
        });

        // Update message count
        lastMessageCount = messages.length;

        // Auto-scroll to bottom if enabled (always scroll when enabled)
        const settings = getSettings();
        if (settings.autoScroll) {
          dmMessages.scrollTop = dmMessages.scrollHeight;
        }

        // Update conversations list to show updated last message
        await loadConversationsList();
      }
    } catch (error) {
      console.error('Failed to check for new messages:', error);
    }
  }

  function addDMMessage(messageData, shouldScroll = true) {
    const dmMessages = document.getElementById('dm-messages');

    // Handle both old format (type, text, time) and new format (message object)
    let type, text, time, reactions, replyTo, messageId, senderId, hasAvatar;

    if (typeof messageData === 'string') {
      // Old format: addDMMessage(type, text, time)
      type = messageData;
      text = arguments[1];
      time = arguments[2];
      shouldScroll = arguments[3] !== undefined ? arguments[3] : true;
      reactions = null;
      replyTo = null;
      messageId = null;
      senderId = null;
      hasAvatar = false;
    } else {
      // New format: addDMMessage(messageObject)
      console.log('Adding DM message:', messageData);
      type = messageData.is_own ? 'sent' : 'received';
      text = messageData.content;
      time = messageData.time || messageData.timestamp;
      reactions = messageData.reactions;
      replyTo = messageData.reply_to;
      messageId = messageData.id;
      senderId = messageData.sender ? messageData.sender.id : null;
      hasAvatar = messageData.sender ? messageData.sender.has_avatar : false;
      shouldScroll = arguments[1] !== undefined ? arguments[1] : true;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message'; // Use same class as global chat
    messageDiv.setAttribute('data-message-id', messageId);

    // For DMs, always show both users in conversation style
    let username, badge, userId, userHasAvatar;

    if (type === 'received') {
      console.log(`Creating received message: senderId=${senderId}, hasAvatar=${hasAvatar}`);
      username = messageData.sender ? messageData.sender.username : 'Unknown';
      badge = messageData.badge;
      userId = senderId;
      userHasAvatar = hasAvatar;
    } else if (type === 'sent') {
      // For sent messages, use current user's info
      console.log(`Creating sent message: userId=${window.USER_ID}, hasAvatar=${window.CURRENT_USER_HAS_AVATAR}`);
      username = window.CURRENT_USERNAME;
      badge = window.USER_ROLE === 'user' ? null : window.USER_ROLE;
      userId = window.USER_ID;
      userHasAvatar = window.CURRENT_USER_HAS_AVATAR;
    }

    // Format timestamp
    const timestamp = new Date();
    let timeString;
    if (typeof time === 'string' && time.includes(':')) {
      timeString = time; // Already formatted
    } else {
      timeString = timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Build reply preview if this is a reply
    let replyContainer = null;
    if (replyTo) {
      replyContainer = document.createElement('div');
      replyContainer.className = 'dm-message-reply-preview';

      const replyUsername = createSafeElement('div', replyTo.sender_username, 'dm-reply-to-username');
      const replyContent = document.createElement('div');
      replyContent.className = 'dm-reply-to-content';
      if (replyTo.content) {
        replyContent.innerHTML = parseMarkdown(replyTo.content);
      }

      replyContainer.appendChild(replyUsername);
      replyContainer.appendChild(replyContent);
    }

    // Build reactions if present
    let reactionsContainer = null;
    if (reactions && Object.keys(reactions).length > 0) {
      reactionsContainer = document.createElement('div');
      reactionsContainer.className = 'dm-message-reactions';

      Object.entries(reactions).forEach(([emoji, users]) => {
        const isActive = users.includes(window.USER_ID);
        const reactionSpan = document.createElement('span');
        reactionSpan.className = `dm-reaction ${isActive ? 'active' : ''}`;
        reactionSpan.setAttribute('data-emoji', emoji);

        const emojiText = document.createTextNode(emoji + ' ');
        const countSpan = createSafeElement('span', users.length.toString(), 'dm-reaction-count');

        reactionSpan.appendChild(emojiText);
        reactionSpan.appendChild(countSpan);
        reactionsContainer.appendChild(reactionSpan);
      });
    }

    // Create avatar element
    const avatarElement = createAvatarElement(userId, userHasAvatar, 'message-avatar');

    // Create message content container
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Add reply preview if exists
    if (replyContainer) {
      messageContent.appendChild(replyContainer);
    }

    // Create user span with badge
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

    console.log("Created user span:", userSpan.outerHTML);

    // Create message text span with markdown parsing
    const messageTextSpan = document.createElement('span');
    messageTextSpan.className = 'message-text';
    if (text) {
      messageTextSpan.innerHTML = parseMarkdown(text);
    }

    // Add deleted styling if message is deleted
    const deletedTexts = [
      "Deleted by sender",
      "Removed by a moderator",
      "Message removed due to message limit"
    ];

    if (messageTextSpan && deletedTexts.includes(text)) {
      messageTextSpan.classList.add('deleted');
    }

    // Create time span
    const timeSpan = createSafeElement('span', timeString, 'message-time');

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

    dmMessages.appendChild(messageDiv);

    // Auto-scroll to bottom if enabled (always scroll when enabled)
    const settings = getSettings();
    if (settings.autoScroll && shouldScroll) {
      dmMessages.scrollTop = dmMessages.scrollHeight;
    }

    // Always scroll to bottom on initial load
    if (!window.dmInitialLoadScroll) {
      dmMessages.scrollTop = dmMessages.scrollHeight;
      window.dmInitialLoadScroll = true;
    }
  }

  function initializeConversationSearch() {
    const searchInput = document.querySelector('.conversation-search');
    const conversationItems = document.querySelectorAll('.conversation-item');

    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase().trim();

      conversationItems.forEach(item => {
        const conversationName = item.querySelector('.conversation-name').textContent.toLowerCase();
        const lastMessage = item.querySelector('.last-message').textContent.toLowerCase();

        if (conversationName.includes(searchTerm) || lastMessage.includes(searchTerm)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  function switchToDMConversation(friendName) {
    // Switch to DMs tab
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    // Remove active class from all nav items and tab contents
    navItems.forEach(nav => nav.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to DMs nav and tab
    const dmsNav = document.querySelector('[data-tab="dms"]');
    const dmsTab = document.getElementById('dms');

    if (dmsNav && dmsTab) {
      dmsNav.classList.add('active');
      dmsTab.classList.add('active');

      // Switch to the specific conversation
      switchDMConversation(friendName);
    }
  }

  // DM Reactions and Replies
  window.replyToDMMessage = async function (messageId) {
    // Find the message to reply to
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    // Get message content from the correct element (now using global chat format)
    const messageTextElement = messageElement.querySelector('.message-text');
    if (!messageTextElement) return;

    const messageContent = messageTextElement.textContent.trim();

    // Get message author from the message-user element
    const messageUserElement = messageElement.querySelector('.message-user');
    let messageAuthor = 'Unknown User';
    if (messageUserElement) {
      // Extract username from the format "[badge] username:" 
      const userText = messageUserElement.textContent;
      const colonIndex = userText.lastIndexOf(':');
      if (colonIndex > 0) {
        messageAuthor = userText.substring(0, colonIndex).replace(/^\[[^\]]*\]\s*/, '').trim();
      }
    }

    // Find DM input container
    const dmInputContainer = document.querySelector('.dm-input-container');
    if (!dmInputContainer) return;

    // Show reply indicator
    showReplyIndicator(messageAuthor, messageContent, messageId, dmInputContainer);
  };

  window.showReactionPicker = function (messageId) {
    const reactions = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡'];
    const reactionPicker = document.createElement('div');
    reactionPicker.className = 'reaction-picker';

    // Use CSS class instead of inline styles for proper theming

    // Close picker when clicking outside
    const closeHandler = (e) => {
      if (!reactionPicker.contains(e.target)) {
        // Safely remove the reaction picker
        if (reactionPicker.parentNode) {
          document.body.removeChild(reactionPicker);
        }
        document.removeEventListener('click', closeHandler);
      }
    };

    reactions.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      // CSS styles are now handled by the .reaction-picker button class
      btn.onclick = () => {
        reactToDMMessage(messageId, emoji);
        // Safely remove the reaction picker
        if (reactionPicker.parentNode) {
          document.body.removeChild(reactionPicker);
        }
        document.removeEventListener('click', closeHandler);
      };
      reactionPicker.appendChild(btn);
    });

    // Position near the message
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const rect = messageElement.getBoundingClientRect();
      reactionPicker.style.left = `${rect.left}px`;
      reactionPicker.style.top = `${rect.top - 50}px`;
    }

    document.body.appendChild(reactionPicker);

    setTimeout(() => document.addEventListener('click', closeHandler), 100);
  };

  async function reactToDMMessage(messageId, emoji) {
    try {
      const response = await api.post(`/dms/messages/${messageId}/react`, {
        emoji: emoji
      });

      if (response.success) {
        // Update the message reactions in the UI
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          const reactionsContainer = messageElement.querySelector('.dm-message-reactions');

          // Remove existing reactions container
          if (reactionsContainer) {
            reactionsContainer.remove();
          }

          // Add updated reactions if any
          if (response.reactions && Object.keys(response.reactions).length > 0) {
            const newReactionsHtml = Object.entries(response.reactions).map(([emojiKey, users]) => {
              const isActive = users.includes(window.USER_ID);
              return `<span class="dm-reaction ${isActive ? 'active' : ''}" data-emoji="${emojiKey}">${emojiKey} <span class="dm-reaction-count">${users.length}</span></span>`;
            }).join('');

            const newReactionsContainer = document.createElement('div');
            newReactionsContainer.className = 'dm-message-reactions';
            newReactionsContainer.innerHTML = newReactionsHtml;

            const messageContent = messageElement.querySelector('.message-content');
            if (messageContent) {
              messageContent.appendChild(newReactionsContainer);
            } else {
              console.error('Could not find message content element');
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to react to message:', error);
      showNotification('Failed to add reaction', 'error');
    }
  }

  function showNotification(message, type = 'info') {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // =====================================
  // SETTINGS FUNCTIONALITY
  // =====================================

  function initializeSettings() {
    // Load saved settings from localStorage
    loadSettings();

    // Toggle settings
    const toggleSettings = [
      'messageNotifications',
      'dmNotifications',
      'achievementNotifications',
      'soundNotifications',
      'showTimestamps',
      'autoScroll',
      'ctrlEnterToSend',
      'allowDirectMessages',
      'contentFilter',
      'appearOffline',
      'hideProfilePictures'
    ];

    toggleSettings.forEach(settingId => {
      const checkbox = document.getElementById(settingId);
      if (checkbox) {
        checkbox.addEventListener('change', function () {
          setSetting(settingId, this.checked);
          applyToggleSetting(settingId, this.checked);
        });
      }
    });

    // Button event listeners
    document.getElementById('changePasswordBtn')?.addEventListener('click', showChangePasswordModal);
    document.getElementById('exportDataBtn')?.addEventListener('click', showDownloadDataModal);
    document.getElementById('changeThemeBtn')?.addEventListener('click', showThemeModal);
    document.getElementById('logoutBtn')?.addEventListener('click', showLogoutModal);
    document.getElementById('deleteAccountBtn')?.addEventListener('click', showDeleteAccountModal);

    // Avatar event listeners
    document.getElementById('uploadAvatarBtn')?.addEventListener('click', showAvatarUpload);
    document.getElementById('removeAvatarBtn')?.addEventListener('click', removeAvatar);
    document.getElementById('avatarInput')?.addEventListener('change', handleAvatarUpload);
  }

  function loadSettings() {
    // Load settings from localStorage and apply them
    const settings = getSettings();

    // Load current avatar for the profile picture section
    loadCurrentAvatar();

    // Apply toggle settings
    const toggleSettings = [
      'messageNotifications',
      'dmNotifications',
      'achievementNotifications',
      'soundNotifications',
      'showTimestamps',
      'autoScroll',
      'ctrlEnterToSend',
      'allowDirectMessages',
      'contentFilter',
      'appearOffline',
      'hideProfilePictures',
      'developerMode'
    ];

    toggleSettings.forEach(settingId => {
      const checkbox = document.getElementById(settingId);
      if (checkbox) {
        checkbox.checked = settings[settingId];
        applyToggleSetting(settingId, settings[settingId]);
      }
    });
  }

  function getSettings() {
    // Default settings
    const defaults = {
      messageNotifications: true,
      dmNotifications: true,
      achievementNotifications: false,
      soundNotifications: false,
      showTimestamps: true,
      autoScroll: false,
      ctrlEnterToSend: false,
      allowDirectMessages: true,
      contentFilter: true,
      appearOffline: false,
      hideProfilePictures: false
    };

    // Get saved settings from localStorage
    const saved = localStorage.getItem('chatfun_settings');
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Failed to parse saved settings, using defaults');
      }
    }

    return defaults;
  }

  function setSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    localStorage.setItem('chatfun_settings', JSON.stringify(settings));

    // Sync certain settings with server
    const serverSyncSettings = ['allowDirectMessages', 'contentFilter'];
    if (serverSyncSettings.includes(key)) {
      syncSettingWithServer(key, value);
    }
  }

  async function syncSettingWithServer(key, value) {
    try {
      const settingsToSync = {};

      // Map client setting names to server setting names
      const settingMap = {
        'allowDirectMessages': 'allow_direct_messages',
        'contentFilter': 'content_filter'
      };

      const serverKey = settingMap[key] || key;
      settingsToSync[serverKey] = value;

      const response = await window.api.put('/auth/settings', settingsToSync);

      if (response.error) {
        console.error('Failed to sync setting with server:', response.error);
      }
    } catch (error) {
      console.error('Error syncing setting with server:', error);
    }
  }

  function mergeServerSettings(serverSettings) {
    const localSettings = getSettings();

    // Map server setting names to client setting names
    const settingMap = {
      'allow_direct_messages': 'allowDirectMessages',
      'content_filter': 'contentFilter',
      'notifications_enabled': 'messageNotifications'
    };

    let hasChanges = false;

    // Merge server settings into local settings
    for (const [serverKey, value] of Object.entries(serverSettings)) {
      const clientKey = settingMap[serverKey] || serverKey;
      if (localSettings[clientKey] !== value) {
        localSettings[clientKey] = value;
        hasChanges = true;
      }
    }

    // Save merged settings locally
    if (hasChanges) {
      localStorage.setItem('chatfun_settings', JSON.stringify(localSettings));

      // Apply any settings that need immediate UI updates
      for (const [key, value] of Object.entries(localSettings)) {
        applyToggleSetting(key, value);
      }
    }
  }

  function applyToggleSetting(settingId, enabled) {
    const body = document.body;

    switch (settingId) {
      case 'showTimestamps':
        body.classList.toggle('hide-timestamps', !enabled);
        break;
      case 'contentFilter':
        body.classList.toggle('content-filter-disabled', !enabled);
        break;
      case 'ctrlEnterToSend':
        // Re-attach event listeners with new setting
        updateInputEventListeners();
        break;
      case 'appearOffline':
        // Update user's appearance status
        updateAppearanceStatus(enabled);
        break;
      case 'allowDirectMessages':
        // Handle DM enabled/disabled state
        const dmsTab = document.getElementById('dms');
        if (dmsTab && dmsTab.classList.contains('active')) {
          if (!enabled) {
            showDMDisabledScreen();
          } else {
            hideDMDisabledScreen();
            // Reinitialize DM functionality
            setTimeout(() => {
              initializeDMsFunctionality();
            }, 100);
          }
        }
        break;
      case 'hideProfilePictures':
        // Force refresh of displayed avatars when setting changes
        refreshAvatarsDisplay();
        break;
    }
  }

  function refreshAvatarsDisplay() {
    // Refresh chat messages
    fetchMessages();

    // Refresh conversations list
    loadConversationsList();

    // Refresh friends list if visible
    const friendsTab = document.getElementById('friends');
    if (friendsTab && friendsTab.classList.contains('active')) {
      loadFriendsList();
    }

    // Refresh current DM conversation header
    const dmUserName = document.querySelector('.dm-user-name');
    if (dmUserName && dmUserName.textContent) {
      updateDMConversationHeader(dmUserName.textContent);
    }
  }

  async function updateAppearanceStatus(status) {
    // Update the user's appearance status on the server
    try {
      await window.api.post('/friends/user/appearance', {
        appearOffline: status
      });
    } catch (error) {
      console.error('Failed to update appearance status:', error);
    }
  }

  function updateInputEventListeners() {
    // Update chat input listeners
    attachChatEventListeners();

    // Update DM input listeners if DM tab is active
    const dmInput = document.getElementById('dm-input');
    const dmSendButton = document.getElementById('dm-send-button');
    if (dmInput && dmSendButton) {
      // Remove existing listeners by cloning and replacing the elements
      const newDmInput = dmInput.cloneNode(true);
      dmInput.parentNode.replaceChild(newDmInput, dmInput);

      // Re-attach the DM listeners
      newDmInput.addEventListener('keydown', function (e) {
        const settings = getSettings();
        const ctrlEnterMode = settings.ctrlEnterToSend;

        if (ctrlEnterMode) {
          // Ctrl+Enter to send mode
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            sendDMMessage();
          }
        } else {
          // Regular Enter to send mode
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendDMMessage();
          }
        }
      });
    }
  }

  function showChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const form = document.getElementById('changePasswordForm');
    const closeBtn = document.getElementById('changePasswordModalClose');
    const cancelBtn = document.getElementById('cancelChangePassword');
    const confirmBtn = document.getElementById('confirmChangePassword');

    // Reset form
    form.reset();

    // Show modal
    modal.style.display = 'flex';

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Form submission
    confirmBtn.onclick = (e) => {
      e.preventDefault();
      handlePasswordChange();
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      handlePasswordChange();
    };
  }

  function handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    // Validate passwords
    if (newPassword !== confirmNewPassword) {
      alert('New passwords do not match!');
      return;
    }

    if (!validatePassword(newPassword)) {
      alert('Password does not meet the requirements!');
      return;
    }

    // In a real application, this would make an API call
    // For demo purposes, we'll just show a success message
    alert('Password changed successfully! (This is a demo - no actual change was made)');
    closeModal(document.getElementById('changePasswordModal'));
  }

  function validatePassword(password) {
    // Check password requirements
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  }

  function showClearCacheModal() {
    const modal = document.getElementById('clearCacheModal');
    const closeBtn = document.getElementById('clearCacheModalClose');
    const cancelBtn = document.getElementById('cancelClearCache');
    const confirmBtn = document.getElementById('confirmClearCache');

    // Show modal
    modal.style.display = 'flex';

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Confirm button handler
    confirmBtn.onclick = () => {
      clearApplicationCache();
      closeModal(modal);
    };
  }

  function showLogoutModal() {
    const modal = document.getElementById('logoutModal');
    const closeBtn = document.getElementById('logoutModalClose');
    const cancelBtn = document.getElementById('cancelLogout');
    const confirmBtn = document.getElementById('confirmLogout');

    // Show modal
    modal.style.display = 'flex';

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Confirm button handler
    confirmBtn.onclick = () => {
      confirmLogout();
      closeModal(modal);
    };
  }

  function showDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    const closeBtn = document.getElementById('deleteAccountModalClose');
    const cancelBtn = document.getElementById('cancelDeleteAccount');
    const confirmBtn = document.getElementById('confirmDeleteAccount');
    const confirmInput = document.getElementById('deleteConfirmation');

    // Reset modal
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmInput.className = '';

    // Show modal
    modal.style.display = 'flex';

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Input validation
    confirmInput.oninput = () => {
      const isValid = confirmInput.value.toUpperCase() === 'DELETE';
      confirmBtn.disabled = !isValid;
      confirmInput.className = confirmInput.value ? (isValid ? 'valid' : 'invalid') : '';
    };

    // Confirm button handler
    confirmBtn.onclick = () => {
      confirmDeleteAccount();
      closeModal(modal);
    };
  }

  function showDownloadDataModal() {
    const modal = document.getElementById('downloadDataModal');
    const closeBtn = document.getElementById('downloadDataModalClose');
    const cancelBtn = document.getElementById('cancelDownloadData');
    const confirmBtn = document.getElementById('confirmDownloadData');

    // Show modal
    modal.style.display = 'flex';

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Confirm button handler
    confirmBtn.onclick = () => {
      const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
      exportUserData(format);
      closeModal(modal);
    };
  }

  function showThemeModal() {
    const modal = document.getElementById('themeModal');
    const closeBtn = document.getElementById('themeModalClose');
    const cancelBtn = document.getElementById('cancelThemeChange');
    const confirmBtn = document.getElementById('confirmThemeChange');
    const themeSelect = document.getElementById('themeSelect');

    // Populate the dropdown with available themes
    populateThemeDropdown();

    // Show the modal
    modal.style.display = 'block';

    // Set dropdown to current theme (default to chatfun)
    const currentTheme = localStorage.getItem('theme') || 'chatfun';
    themeSelect.value = currentTheme;

    // Close modal handlers
    closeBtn.onclick = () => { modal.style.display = 'none'; };
    cancelBtn.onclick = () => { modal.style.display = 'none'; };

    // Apply theme handler
    confirmBtn.onclick = () => {
      const selectedTheme = themeSelect.value;
      applyTheme(selectedTheme);
      localStorage.setItem('theme', selectedTheme);
      modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = function (event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }

  // =====================================
  // THEME SYSTEM
  // =====================================

  // Define available themes - makes it easy to add new themes
  const AVAILABLE_THEMES = {
    'chatfun': {
      name: 'ChatFun (Default)',
      className: 'chatfun-theme'
    },
    'catppuccin-mocha': {
      name: 'Catppuccin Mocha',
      className: 'catppuccin-mocha-theme'
    },
    'tokyo-night': {
      name: 'Tokyo Night',
      className: 'tokyo-night-theme'
    },
    'dracula': {
      name: 'Dracula',
      className: 'dracula-theme'
    },
    'nord': {
      name: 'Nord',
      className: 'nord-theme'
    },
    'one-dark': {
      name: 'One Dark',
      className: 'one-dark-theme'
    },
    'monokai': {
      name: 'Monokai',
      className: 'monokai-theme'
    },
    'gruvbox-dark': {
      name: 'Gruvbox Dark',
      className: 'gruvbox-dark-theme'
    },
    'github-dark': {
      name: 'GitHub Dark',
      className: 'github-dark-theme'
    }
    // Add new themes here in the future:
    // 'theme-id': {
    //   name: 'Theme Display Name',
    //   className: 'css-class-name'
    // }
  };

  function applyTheme(themeId) {
    const body = document.body;

    // Remove all existing theme classes
    Object.values(AVAILABLE_THEMES).forEach(theme => {
      body.classList.remove(theme.className);
    });

    // Remove legacy theme classes for compatibility
    body.classList.remove('light-theme', 'dark-theme');

    // Apply the new theme
    if (AVAILABLE_THEMES[themeId]) {
      body.classList.add(AVAILABLE_THEMES[themeId].className);
      console.log('Applied theme:', themeId, '->', AVAILABLE_THEMES[themeId].name);
    } else {
      // Fallback to default theme if invalid theme is provided
      console.warn('Unknown theme:', themeId, 'falling back to chatfun');
      body.classList.add(AVAILABLE_THEMES['chatfun'].className);
    }
  }

  function populateThemeDropdown() {
    const themeSelect = document.getElementById('themeSelect');
    if (!themeSelect) return;

    // Clear existing options
    themeSelect.innerHTML = '';

    // Add options for each available theme
    Object.entries(AVAILABLE_THEMES).forEach(([themeId, themeInfo]) => {
      const option = document.createElement('option');
      option.value = themeId;
      option.textContent = themeInfo.name;
      themeSelect.appendChild(option);
    });
  }

  function exportUserData(format = 'json') {
    // Create a downloadable file with user data
    const settings = getSettings();
    const userData = {
      username: window.CURRENT_USERNAME,
      settings: settings,
      exportDate: new Date().toISOString()
    };

    let blob, filename, extension;

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = [
        ['Field', 'Value'],
        ['Username', userData.username],
        ['Export Date', userData.exportDate],
        ['Settings', JSON.stringify(userData.settings)]
      ];
      const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
      blob = new Blob([csvContent], { type: 'text/csv' });
      extension = 'csv';
    } else {
      // Default JSON format
      blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
      extension = 'json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatfun-data-${window.CURRENT_USERNAME}-${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }

  // =====================================
  // AVATAR FUNCTIONALITY
  // =====================================

  function showAvatarUpload() {
    document.getElementById('avatarInput').click();
  }

  function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload a PNG, JPEG, GIF, or WebP image.');
      return;
    }

    // Upload directly
    uploadAvatar(file);

    // Clear the file input
    event.target.value = '';
  }

  async function uploadAvatar(file) {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('avatar', file);

      // Show loading state
      const uploadBtn = document.getElementById('uploadAvatarBtn');
      if (uploadBtn) {
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        uploadBtn.disabled = true;
      }

      // Upload the image
      const token = window.getAuthToken();
      const response = await fetch(window.api.baseURL + '/profile/avatar/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If JSON parsing fails, use the response status text
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      let responseData = null;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.warn('Response is not valid JSON, but upload may have succeeded');
      }

      // Update display and show success
      await loadCurrentAvatar();
      alert('Profile picture uploaded successfully!');

    } catch (error) {
      console.error('Avatar upload failed:', error);
      alert(error.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      // Reset upload button
      const uploadBtn = document.getElementById('uploadAvatarBtn');
      if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> upload';
        uploadBtn.disabled = false;
      }
    }
  }

  async function removeAvatar() {
    const modal = document.getElementById('avatarCropModal');
    const canvas = document.getElementById('cropCanvas');
    const ctx = canvas.getContext('2d');
    const zoomSlider = document.getElementById('zoomSlider');

    // Reset crop parameters
    cropScale = 1;
    cropOffsetX = 0;
    cropOffsetY = 0;
    zoomSlider.value = 1;

    // Load and display image
    const img = new Image();
    img.onload = function () {
      cropImageData = img;

      // Calculate initial positioning to center the image
      const canvasAspect = canvas.width / canvas.height;
      const imageAspect = img.width / img.height;

      let displayWidth, displayHeight;

      if (imageAspect > canvasAspect) {
        // Image is wider - fit to height
        displayHeight = canvas.height;
        displayWidth = displayHeight * imageAspect;
      } else {
        // Image is taller - fit to width
        displayWidth = canvas.width;
        displayHeight = displayWidth / imageAspect;
      }

      // Center the image
      cropOffsetX = (canvas.width - displayWidth) / 2;
      cropOffsetY = (canvas.height - displayHeight) / 2;

      // Set initial scale based on display size
      cropScale = displayWidth / img.width;
      zoomSlider.value = cropScale;

      drawCropPreview();
      modal.style.display = 'flex';
    };
    img.src = URL.createObjectURL(file);

    // Set up event listeners
    setupCropEventListeners();
  }

  function setupCropEventListeners() {
    const canvas = document.getElementById('cropCanvas');
    const zoomSlider = document.getElementById('zoomSlider');
    const cancelBtn = document.getElementById('cancelCrop');
    const confirmBtn = document.getElementById('confirmCrop');
    const closeBtn = document.getElementById('avatarCropClose');
    const modal = document.getElementById('avatarCropModal');

    // Remove existing listeners
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;
    zoomSlider.oninput = null;

    // Zoom slider
    zoomSlider.oninput = function () {
      cropScale = parseFloat(this.value);
      drawCropPreview();
    };

    // Mouse events for dragging
    canvas.onmousedown = function (e) {
      isDragging = true;
      const rect = canvas.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      canvas.onmousemove = function (e) {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        cropOffsetX += currentX - startX;
        cropOffsetY += currentY - startY;

        // Update start position for next move
        startX = currentX;
        startY = currentY;

        drawCropPreview();
      };
    };

    canvas.onmouseup = function () {
      isDragging = false;
      canvas.onmousemove = null;
    };

    // Touch events for mobile
    canvas.ontouchstart = function (e) {
      e.preventDefault();
      isDragging = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const startX = touch.clientX - rect.left;
      const startY = touch.clientY - rect.top;

      canvas.ontouchmove = function (e) {
        e.preventDefault();
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;

        cropOffsetX += currentX - startX;
        cropOffsetY += currentY - startY;

        drawCropPreview();
      };
    };

    canvas.ontouchend = function (e) {
      e.preventDefault();
      isDragging = false;
      canvas.ontouchmove = null;
    };

    // Button events
    cancelBtn.onclick = () => closeCropModal();
    closeBtn.onclick = () => closeCropModal();
    confirmBtn.onclick = () => uploadCroppedImage();

    // Close modal when clicking outside
    modal.onclick = function (e) {
      if (e.target === modal) {
        closeCropModal();
      }
    };
  }

  function drawCropPreview() {
    const canvas = document.getElementById('cropCanvas');
    const ctx = canvas.getContext('2d');

    if (!cropImageData) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scaled dimensions
    const scaledWidth = cropImageData.width * cropScale;
    const scaledHeight = cropImageData.height * cropScale;

    // Draw image with current scale and offset
    ctx.drawImage(
      cropImageData,
      cropOffsetX,
      cropOffsetY,
      scaledWidth,
      scaledHeight
    );
  }

  function closeCropModal() {
    const modal = document.getElementById('avatarCropModal');
    modal.style.display = 'none';

    // Clean up
    if (cropImageData && cropImageData.src) {
      URL.revokeObjectURL(cropImageData.src);
    }
    cropImageData = null;
  }

  async function uploadCroppedImage() {
    try {
      const confirmBtn = document.getElementById('confirmCrop');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

      // Create a new canvas for the cropped image
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d');
      const size = 512; // Final avatar size (higher quality)

      cropCanvas.width = size;
      cropCanvas.height = size;

      // Calculate the crop area (center circle from the preview canvas)
      const previewCanvas = document.getElementById('cropCanvas');
      const centerX = previewCanvas.width / 2;
      const centerY = previewCanvas.height / 2;
      const radius = 100; // Half of crop circle size (200px diameter)

      // Calculate what portion of the original image is visible in the crop circle
      const scaledWidth = cropImageData.width * cropScale;
      const scaledHeight = cropImageData.height * cropScale;

      // Calculate the actual image coordinates for the crop area
      const cropStartX = (centerX - radius - cropOffsetX) / scaledWidth * cropImageData.width;
      const cropStartY = (centerY - radius - cropOffsetY) / scaledHeight * cropImageData.height;
      const cropWidth = (radius * 2) / scaledWidth * cropImageData.width;
      const cropHeight = (radius * 2) / scaledHeight * cropImageData.height;

      // Ensure we don't go outside image bounds
      const clampedX = Math.max(0, Math.min(cropStartX, cropImageData.width - cropWidth));
      const clampedY = Math.max(0, Math.min(cropStartY, cropImageData.height - cropHeight));
      const clampedWidth = Math.min(cropWidth, cropImageData.width - clampedX);
      const clampedHeight = Math.min(cropHeight, cropImageData.height - clampedY);

      // Draw the cropped portion
      cropCtx.drawImage(
        cropImageData,
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight,
        0,
        0,
        size,
        size
      );

      // Convert to blob
      cropCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('avatar', blob, 'avatar.jpg');

        // Upload the cropped image
        const token = window.getAuthToken();
        const response = await fetch('/api/profile/avatar/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        // Close modal and update display
        closeCropModal();
        await loadCurrentAvatar();
        alert('Profile picture uploaded successfully!');

      }, 'image/jpeg', 0.9);

    } catch (error) {
      console.error('Avatar upload failed:', error);
      alert(error.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      const confirmBtn = document.getElementById('confirmCrop');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Upload';
    }
  }

  async function removeAvatar() {
    // Show the delete avatar modal instead of confirm dialog
    const modal = document.getElementById('deleteAvatarModal');
    modal.style.display = 'flex';
  }

  async function performAvatarRemoval() {
    try {
      const removeBtn = document.getElementById('removeAvatarBtn');
      removeBtn.disabled = true;
      removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> removing...';

      await api.delete('/profile/avatar');

      // Update the avatar display
      await loadCurrentAvatar();
      alert('Profile picture removed successfully!');

    } catch (error) {
      console.error('Avatar removal failed:', error);
      alert(error.message || 'Failed to remove profile picture. Please try again.');
    } finally {
      const removeBtn = document.getElementById('removeAvatarBtn');
      removeBtn.disabled = false;
      removeBtn.innerHTML = '<i class="fas fa-trash"></i> remove';
    }
  }

  async function loadCurrentAvatar() {
    try {
      console.log('Loading current avatar...');
      const currentAvatarEl = document.getElementById('currentAvatar');
      const removeBtn = document.getElementById('removeAvatarBtn');

      if (!currentAvatarEl) {
        console.error('currentAvatar element not found');
        return;
      }

      // Get current user data to check for avatar
      const userData = await api.get('/auth/me');
      console.log('User data:', userData);

      if (userData.user.has_avatar && userData.user.avatar_url) {
        // Show actual avatar
        console.log('Showing avatar:', userData.user.avatar_url);
        currentAvatarEl.innerHTML = `<img src="${window.api.baseURL}${userData.user.avatar_url}" alt="Profile Picture" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="default-avatar" style="display: none;"><i class="fas fa-user"></i></div>`;
        removeBtn.style.display = 'block';
        // Update global avatar status
        window.CURRENT_USER_HAS_AVATAR = true;
      } else {
        // Show default avatar
        console.log('Showing default avatar');
        currentAvatarEl.innerHTML = '<div class="default-avatar"><i class="fas fa-user"></i></div>';
        removeBtn.style.display = 'none';
        // Update global avatar status
        window.CURRENT_USER_HAS_AVATAR = false;
      }
    } catch (error) {
      console.error('Failed to load current avatar:', error);
    }
  }

  function getAvatarUrl(userId, hasAvatar) {
    const settings = getSettings();

    // If user has disabled profile pictures, always return null for default avatar
    if (settings.hideProfilePictures) {
      return null;
    }

    // Return avatar URL if user has one
    return hasAvatar ? `${window.api.baseURL}/profile/avatar/${userId}` : null;
  }

  function createAvatarElement(userId, hasAvatar, className = 'message-avatar') {
    if (!hasAvatar) console.log(`Creating avatar element: userId=${userId}, hasAvatar=${hasAvatar}, className=${className}`);
    const avatarUrl = getAvatarUrl(userId, hasAvatar);
    if (!hasAvatar) console.log(`Avatar URL: ${avatarUrl}`);

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

  function showAddFriendModal() {
    const modal = document.getElementById('addFriendModal');
    const closeBtn = document.getElementById('addFriendModalClose');
    const cancelBtn = document.getElementById('cancelAddFriend');
    const confirmBtn = document.getElementById('confirmAddFriend');
    const usernameInput = document.getElementById('friendUsername');
    const errorDiv = document.getElementById('friendUsernameError');

    // Reset modal
    usernameInput.value = '';
    errorDiv.textContent = '';
    confirmBtn.disabled = false;

    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => usernameInput.focus(), 100);

    // Close button handlers
    closeBtn.onclick = () => closeModal(modal);
    cancelBtn.onclick = () => closeModal(modal);

    // Input validation
    usernameInput.oninput = () => {
      errorDiv.textContent = '';
      confirmBtn.disabled = !usernameInput.value.trim();
    };

    // Handle Enter key
    usernameInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !confirmBtn.disabled) {
        confirmBtn.click();
      }
    };

    // Confirm button handler
    confirmBtn.onclick = async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        errorDiv.textContent = 'Please enter a username';
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

      try {
        await sendFriendRequest(username);
        closeModal(modal);
        showNotification('Friend request sent!', 'success');
        // Refresh friend requests
        loadFriendRequests();
      } catch (error) {
        errorDiv.textContent = error.message || 'Failed to send friend request';
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Send Request';
      }
    };
  }

  function confirmLogout() {
    // Clear any session data
    localStorage.removeItem('authToken');
    // Redirect to login page
    window.location.href = 'login.html';
  }

  function confirmDeleteAccount() {
    // This would make an API call to delete the account
    alert('Account deletion functionality would be implemented here');
    // After successful deletion, redirect to home page
    window.location.href = 'index.html';
  }

  function initializeUserData() {
    // Fetch and display user data
    const token = window.getAuthToken();
    if (!token) {
      // No token found, redirect to login
      window.location.href = 'login.html';
      return;
    }

    // Set the bearer token for API requests early
    window.api.bearerToken = token;

    window.api.get('/auth/me')
      .then(data => {
        if (data.user && data.user.username) {
          // Update the global variables that are declared at the top
          window.CURRENT_USERNAME = data.user.username;
          const usernameElement = document.getElementById('username');
          if (usernameElement) {
            usernameElement.textContent = data.user.username;
          }
        }

        if (data.user && data.user.role) {
          window.USER_ROLE = data.user.role;
          window.USER_ID = data.user.uuid;
          window.CURRENT_USER_HAS_AVATAR = data.user.has_avatar || false;
        }

        // Load user settings from server and merge with local settings
        if (data.user && data.user.settings) {
          mergeServerSettings(data.user.settings);
        }

        // Apply status restrictions if user is suspended or terminated
        if (data.user) {
          applyStatusRestrictions(data.user);
        }

        // Load current avatar
        loadCurrentAvatar();

        // Initialize user permissions after role is set
        initializeUserPermissions();
      })
      .catch(error => {
        console.error("Error fetching user data:", error);

        // Check if this is an authentication error
        if (error.message && error.message.includes('401')) {
          console.warn('Token validation failed - redirecting to login');
          // Clear token and redirect (API handler will also do this, but this is a backup)
          window.clearAuthToken();
          window.location.href = 'login.html';
        }
      });
  }

  // Function to refresh user status without full page reload
  function refreshUserStatus() {
    if (!window.api || !window.getAuthToken()) {
      return;
    }

    window.api.get('/auth/me')
      .then(data => {
        if (data.user) {
          // Update global status
          window.USER_STATUS = {
            suspended: data.user.suspended || false,
            suspended_until: data.user.suspended_until,
            suspended_reason: data.user.suspended_reason,
            terminated: data.user.terminated || false,
            terminated_at: data.user.terminated_at,
            terminated_reason: data.user.terminated_reason,
            muted: data.user.muted || false,
            muted_until: data.user.muted_until,
            muted_reason: data.user.muted_reason,
            strikes: data.user.strikes || 0
          };

          // Update account standing display
          updateAccountStanding(data.user);
        }
      })
      .catch(error => {
        console.error("Error refreshing user status:", error);
      });
  }

  // Reply functionality
  function setupReplyFunctionality() {
    // Handle close reply buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-reply')) {
        const replyIndicator = e.target.closest('.reply-indicator');
        if (replyIndicator) {
          const inputContainer = replyIndicator.closest('.dm-input-container, .chat-input-container');
          replyIndicator.remove();
          if (inputContainer) {
            inputContainer.classList.remove('input-container-with-reply');
          }
          currentReplyTo = null;
        }
      }
    });
  }

  // Show reply indicator
  function showReplyIndicator(messageAuthor, messageContent, messageId, inputContainer) {
    // Remove existing reply indicator
    const existingIndicator = inputContainer.querySelector('.reply-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
      inputContainer.classList.remove('input-container-with-reply');
    }

    // Create reply indicator
    const replyIndicator = document.createElement('div');
    replyIndicator.className = 'reply-indicator';
    replyIndicator.innerHTML = `
      <div class="reply-content">
        <span class="reply-icon">↩</span>
        <span class="reply-text">
          Replying to <span class="reply-author">${messageAuthor}</span>: ${messageContent.substring(0, 60)}${messageContent.length > 60 ? '...' : ''}
        </span>
      </div>
      <span class="close-reply">×</span>
    `;

    // Insert as first child of input container
    inputContainer.insertBefore(replyIndicator, inputContainer.firstChild);
    inputContainer.classList.add('input-container-with-reply');

    // Set reply context
    currentReplyTo = messageId;

    // Focus input
    const input = inputContainer.querySelector('input');
    if (input) input.focus();
  }

  // =====================================
  // THEME FUNCTIONALITY
  // =====================================

  function initializeTheme() {
    // Load saved theme from localStorage or default to 'chatfun'
    const savedTheme = localStorage.getItem('theme') || 'chatfun';
    applyTheme(savedTheme);
  }

  // =====================================
  // INITIALIZATION
  // =====================================

  // Initialize all functionality when the page loads
  function initializeApp() {
    // Check if user is logged in
    const token = window.getAuthToken();
    if (!token) {
      // Redirect to login page if not logged in
      console.warn('No authentication token found - redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    // Set the bearer token for API requests early
    window.api.bearerToken = token;

    // Initialize user data first (this will validate the token)
    initializeUserData();

    // Initialize other app functionality
    initializeTabSwitching();
    initializeChatFunctionality();
    initializeContextMenu();
    initializeModals();
    initializeUserActionsListeners();
    initializeReportFunctionality();
    initializeReportsSystem();
    initializeItemsFunctionality();
    initializeFriendsFunctionality();
    initializeDMsFunctionality();
    setupReplyFunctionality();
    initializeSettings();
    initializeTheme();
  }

  // Start the application
  initializeApp();

  // Set up periodic token validation (every 5 minutes)
  setInterval(() => {
    const token = window.getAuthToken();
    if (!token) {
      console.warn('Token lost during session - redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    // Make a lightweight API call to validate token is still valid
    if (window.api) {
      window.api.bearerToken = token;
      window.api.get('/auth/me')
        .catch(error => {
          if (error.message && (error.message.includes('401') || error.message.includes('Token has expired'))) {
            console.warn('Token validation failed during periodic check');
            // API handler will redirect, but this is a backup
          }
        });
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Set up periodic status validation (every 5 seconds)
  setInterval(() => {
    const token = window.getAuthToken();
    if (!token) {
      return; // No token, skip status check
    }

    // Check for status updates
    if (window.api) {
      window.api.bearerToken = token;
      window.api.get('/auth/me')
        .then(data => {
          if (data.user) {
            // Check if status has changed
            const currentStatus = window.USER_STATUS || {};
            const newStatus = {
              suspended: data.user.suspended || false,
              suspended_until: data.user.suspended_until,
              suspended_reason: data.user.suspended_reason,
              terminated: data.user.terminated || false,
              terminated_at: data.user.terminated_at,
              terminated_reason: data.user.terminated_reason,
              muted: data.user.muted || false,
              muted_until: data.user.muted_until,
              muted_reason: data.user.muted_reason,
              strikes: data.user.strikes || 0
            };

            // Check if any status has changed
            const statusChanged = (
              currentStatus.suspended !== newStatus.suspended ||
              currentStatus.terminated !== newStatus.terminated ||
              currentStatus.muted !== newStatus.muted ||
              currentStatus.strikes !== newStatus.strikes ||
              currentStatus.suspended_until !== newStatus.suspended_until ||
              currentStatus.muted_until !== newStatus.muted_until
            );

            if (statusChanged) {
              console.log('User status changed, updating UI...');

              // Update global status
              window.USER_STATUS = newStatus;

              // Update account standing
              updateAccountStanding(data.user);

              // Handle mute status changes
              if (newStatus.muted && newStatus.muted_until) {
                const muteUntilTime = new Date(newStatus.muted_until).getTime();
                const currentTime = Date.now();

                if (muteUntilTime > currentTime && !muteExpiry) {
                  // User was just muted
                  const muteUntilSeconds = Math.floor(muteUntilTime / 1000);
                  muteUser(muteUntilSeconds);
                  muteDMInput(muteUntilSeconds);
                }
              } else if (!newStatus.muted && muteExpiry) {
                // User was just unmuted
                unmuteUser();
                unmuteDMInput();
              }

              // Handle suspension/termination status changes
              if (newStatus.terminated && !currentStatus.terminated) {
                // User was just terminated
                applyStatusRestrictions(data.user);
                showNotification('Your account has been terminated.', 'error');
              } else if (newStatus.suspended && !currentStatus.suspended) {
                // User was just suspended
                applyStatusRestrictions(data.user);
                showNotification('Your account has been suspended.', 'error');
              } else if (!newStatus.suspended && currentStatus.suspended) {
                // User suspension was lifted - refresh page to restore functionality
                showNotification('Your suspension has been lifted. The page will refresh.', 'success');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              }
            }
          }
        })
        .catch(error => {
          // Silently handle errors for status checks to avoid spam
          if (error.message && (error.message.includes('401') || error.message.includes('Token has expired'))) {
            // Token issues will be handled by the main validation above
            return;
          }
          console.debug('Status check failed:', error);
        });
    }
  }, 5 * 1000); // 5 seconds

  // Clean up polling when leaving the page
  window.addEventListener('beforeunload', function () {
    stopMessagePolling();
  });

  // Global variables for user status
  window.USER_STATUS = {
    suspended: false,
    suspended_until: null,
    suspended_reason: null,
    terminated: false,
    terminated_at: null,
    terminated_reason: null,
    strikes: 0
  };

  // Function to update account standing display
  function updateAccountStanding(userData) {
    const currentStrikes = document.getElementById('currentStrikes');
    const strikesDescription = document.getElementById('strikesDescription');
    const punishmentInfo = document.getElementById('punishmentInfo');
    const punishmentText = document.getElementById('punishmentText');
    const punishmentDetails = document.getElementById('punishmentDetails');

    if (!currentStrikes) return;

    const strikes = userData.strikes || 0;
    currentStrikes.textContent = strikes;

    // Update strikes description
    const strikePunishments = {
      0: "Your account is in good standing",
      1: "Warning - 1 strike on record",
      2: "1 day mute - 2 strikes on record",
      3: "2 week mute - 3 strikes on record",
      4: "3 month suspension - 4 strikes on record",
      5: "1 year suspension - 5 strikes on record",
      6: "Account terminated - 6 strikes on record"
    };

    strikesDescription.textContent = strikePunishments[strikes] || `${strikes} strikes on record`;

    // Show punishment info if user has active punishment
    if (userData.suspended || userData.terminated || userData.muted) {
      punishmentInfo.style.display = 'block';

      if (userData.terminated) {
        punishmentText.innerHTML = '<i class="fas fa-ban"></i> Account Terminated';
        punishmentDetails.textContent = userData.terminated_reason || 'No reason specified';
      } else if (userData.suspended) {
        const suspendedUntil = new Date(userData.suspended_until);
        punishmentText.innerHTML = '<i class="fas fa-clock"></i> Account Suspended';
        punishmentDetails.textContent = `Until ${suspendedUntil.toLocaleDateString()} - ${userData.suspended_reason || 'No reason specified'}`;
      } else if (userData.muted) {
        const mutedUntil = new Date(userData.muted_until);
        punishmentText.innerHTML = '<i class="fas fa-volume-mute"></i> Account Muted';
        punishmentDetails.textContent = `Until ${mutedUntil.toLocaleDateString()} - ${userData.muted_reason || 'No reason specified'}`;
      }
    } else {
      punishmentInfo.style.display = 'none';
    }
  }

  // Function to show suspension notice
  function showSuspensionNotice(userData) {
    const suspendedUntil = new Date(userData.suspended_until);
    const reason = userData.suspended_reason || 'No reason specified';

    const noticeHtml = `
      <div class="status-notice-screen">
        <div class="status-notice-content">
          <div class="status-notice-icon suspended">
            <i class="fas fa-clock"></i>
          </div>
          <h2 class="suspended">Account Suspended</h2>
          <p>Your account has been temporarily suspended and you cannot access most features of ChatFun.</p>
          <div class="countdown-container">
            <div class="countdown-label">Time remaining:</div>
            <div class="countdown-time" id="suspensionCountdown">Loading...</div>
          </div>
          <p><strong>Reason:</strong> ${reason}</p>
          <div class="settings-access-note">
            <p><i class="fas fa-cog"></i> You can still access your account settings including account standing information.</p>
          </div>
        </div>
      </div>
    `;

    return noticeHtml;
  }

  // Function to show termination notice
  function showTerminationNotice(userData) {
    const terminatedAt = new Date(userData.terminated_at);
    const reason = userData.terminated_reason || 'No reason specified';

    const noticeHtml = `
      <div class="status-notice-screen">
        <div class="status-notice-content">
          <div class="status-notice-icon terminated">
            <i class="fas fa-ban"></i>
          </div>
          <h2 class="terminated">Account Terminated</h2>
          <p>Your account has been permanently terminated and you can no longer access ChatFun.</p>
          <p><strong>Terminated:</strong> ${terminatedAt.toLocaleDateString()}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <div class="settings-access-note">
            <p><i class="fas fa-cog"></i> You can still access your account settings including account standing information.</p>
          </div>
        </div>
      </div>
    `;

    return noticeHtml;
  }

  // Function to replace tab content with status notices
  function applyStatusRestrictions(userData) {
    // Store user status globally
    window.USER_STATUS = {
      suspended: userData.suspended || false,
      suspended_until: userData.suspended_until,
      suspended_reason: userData.suspended_reason,
      terminated: userData.terminated || false,
      terminated_at: userData.terminated_at,
      terminated_reason: userData.terminated_reason,
      muted: userData.muted || false,
      muted_until: userData.muted_until,
      muted_reason: userData.muted_reason,
      strikes: userData.strikes || 0
    };

    // Update account standing regardless of status
    updateAccountStanding(userData);

    // Check for mute status and apply muting
    if (userData.muted && userData.muted_until) {
      const muteUntilTime = new Date(userData.muted_until).getTime();
      const currentTime = Date.now();

      if (muteUntilTime > currentTime) {
        // User is currently muted
        const muteUntilSeconds = Math.floor(muteUntilTime / 1000);
        muteUser(muteUntilSeconds);
      }
    }

    // If user is terminated or suspended, replace tab content
    if (userData.terminated) {
      const tabsToReplace = ['chat', 'achievements', 'leaderboard', 'items', 'friends', 'dms', 'reports', 'socialspy', 'server-stats', 'other-admin-stuff'];
      const noticeHtml = showTerminationNotice(userData);

      tabsToReplace.forEach(tabId => {
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
          tabElement.innerHTML = noticeHtml;
        }
      });
    } else if (userData.suspended) {
      const tabsToReplace = ['chat', 'achievements', 'leaderboard', 'items', 'friends', 'dms', 'reports', 'socialspy', 'server-stats', 'other-admin-stuff'];
      const noticeHtml = showSuspensionNotice(userData);

      tabsToReplace.forEach(tabId => {
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
          tabElement.innerHTML = noticeHtml;
        }
      });

      // Start countdown timer for suspension
      startSuspensionCountdown(userData.suspended_until);
    }
  }

  // Function to start suspension countdown timer
  function startSuspensionCountdown(suspendedUntil) {
    const endTime = new Date(suspendedUntil).getTime();

    function updateCountdown() {
      const now = new Date().getTime();
      const timeLeft = endTime - now;

      const countdownElement = document.getElementById('suspensionCountdown');
      if (!countdownElement) return;

      if (timeLeft <= 0) {
        countdownElement.textContent = 'Suspension expired - please refresh the page';
        return;
      }

      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      let countdownText = '';
      if (days > 0) {
        countdownText += `${days}d `;
      }
      if (hours > 0 || days > 0) {
        countdownText += `${hours}h `;
      }
      if (minutes > 0 || hours > 0 || days > 0) {
        countdownText += `${minutes}m `;
      }
      countdownText += `${seconds}s`;

      countdownElement.textContent = countdownText;
    }

    // Update immediately and then every second
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);

    // Store interval so it can be cleared if needed
    window.suspensionCountdownInterval = countdownInterval;
  }

  // Function to clear suspension countdown
  function clearSuspensionCountdown() {
    if (window.suspensionCountdownInterval) {
      clearInterval(window.suspensionCountdownInterval);
      window.suspensionCountdownInterval = null;
    }
  }

  // Export functions to global scope for access
  window.updateAccountStanding = updateAccountStanding;
  window.applyStatusRestrictions = applyStatusRestrictions;
  window.clearSuspensionCountdown = clearSuspensionCountdown;
});

