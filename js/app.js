/**
 * Main Chat Application JavaScript
 * Handles tab switching, chat functionality, user moderation, and context menus
 */

document.addEventListener('DOMContentLoaded', function () {
  // =====================================
  // CONFIGURATION & GLOBAL VARIABLES
  // =====================================

  // Mock user role check (replace with actual authentication logic)
  const USER_ROLE = 'admin'; // Can be 'user', 'mod', or 'admin'
  const CURRENT_USERNAME = document.getElementById('username').textContent;

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const chatInput = document.querySelector('.chat-input');
  const sendButton = document.querySelector('.send-button');
  const chatMessages = document.getElementById('chat-messages');
  const chatInputContainer = document.querySelector('.chat-input-container');

  // Mute functionality variables
  let muteExpiry = null;
  let muteCountdownInterval = null;

  // Context menu variables
  let currentMessageElement = null;
  let currentMessageAuthor = null;
  let currentMessageId = null;

  // =====================================
  // TAB SWITCHING FUNCTIONALITY
  // =====================================

  function initializeTabSwitching() {
    navItems.forEach(item => {
      item.addEventListener('click', function () {
        const tabId = this.getAttribute('data-tab');

        // Remove active class from all nav items and tab contents
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked nav item and corresponding tab content
        this.classList.add('active');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }

  // =====================================
  // USER ROLE PERMISSIONS
  // =====================================

  function initializeUserPermissions() {
    if (USER_ROLE === 'mod' || USER_ROLE === 'admin') {
      document.querySelectorAll('.mod-only').forEach(element => {
        element.style.display = 'flex';
      });
    }

    if (USER_ROLE === 'admin') {
      document.querySelectorAll('.admin-only').forEach(element => {
        element.style.display = 'flex';
      });

      document.querySelectorAll('.admin-only-action').forEach(element => {
        element.style.display = 'block';
      });
    }
  }  // =====================================
  // MUTE FUNCTIONALITY
  // =====================================

  function muteUser(expiryEpochSeconds) {
    muteExpiry = expiryEpochSeconds * 1000; // Convert to milliseconds

    // Replace input with countdown
    chatInputContainer.innerHTML = `
      <div class="mute-countdown-container">
        <span class="mute-message">You are muted for: </span>
        <span class="mute-timer" id="muteTimer"></span>
      </div>
    `;

    // Start countdown
    updateMuteCountdown();
    muteCountdownInterval = setInterval(updateMuteCountdown, 1000);
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

    // Restore original input
    chatInputContainer.innerHTML = `
      <input type="text" class="chat-input" placeholder="type your message..." maxlength="200">
      <button class="send-button">send</button>
    `;

    // Reattach event listeners
    attachChatEventListeners();
  }

  // =====================================
  // CHAT FUNCTIONALITY
  // =====================================

  function sendMessage() {
    // Check if user is muted
    if (muteExpiry && Date.now() < muteExpiry) {
      return; // User is still muted, don't send message
    }

    const currentChatInput = document.querySelector('.chat-input');
    if (!currentChatInput) return; // Input not available (user might be muted)

    const message = currentChatInput.value.trim();
    if (!message) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.setAttribute('data-author', CURRENT_USERNAME);
    messageDiv.setAttribute('data-message-id', Date.now().toString());
    messageDiv.innerHTML = `
      <span class="message-user">${CURRENT_USERNAME}:</span>
      <span class="message-text">${message}</span>
      <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    currentChatInput.value = '';
  }

  function attachChatEventListeners() {
    const currentSendButton = document.querySelector('.send-button');
    const currentChatInput = document.querySelector('.chat-input');

    if (currentSendButton) {
      currentSendButton.addEventListener('click', sendMessage);
    }

    if (currentChatInput) {
      currentChatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }
  }

  function initializeChatFunctionality() {
    attachChatEventListeners();
  }

  // =====================================
  // CONTEXT MENU FUNCTIONALITY  
  // =====================================

  function initializeContextMenu() {
    const contextMenu = document.getElementById('messageContextMenu');
    const reportMenuItem = document.getElementById('reportMessage');
    const deleteMenuItem = document.getElementById('deleteMessage');
    const userActionsMenuItem = document.getElementById('userActions');

    // Context menu event listeners
    document.addEventListener('contextmenu', function (e) {
      const messageElement = e.target.closest('.message');
      if (messageElement && messageElement.parentElement.id === 'chat-messages') {
        e.preventDefault();

        currentMessageElement = messageElement;
        currentMessageAuthor = messageElement.getAttribute('data-author');
        currentMessageId = messageElement.getAttribute('data-message-id');

        // Show/hide menu items based on permissions
        const isOwnMessage = currentMessageAuthor === CURRENT_USERNAME;
        const isMod = USER_ROLE === 'mod' || USER_ROLE === 'admin';
        const isAdmin = USER_ROLE === 'admin';

        // Report message: show for everyone, but not for own messages
        const showReport = !isOwnMessage;
        reportMenuItem.style.display = showReport ? 'block' : 'none';

        // Delete message: show for mods/admins and message author
        const showDelete = isMod || isOwnMessage;
        deleteMenuItem.style.display = showDelete ? 'block' : 'none';

        // User actions: show for mods/admins, but not for own messages
        const showUserActions = isMod && !isOwnMessage;
        userActionsMenuItem.style.display = showUserActions ? 'block' : 'none';

        // Only show context menu if at least one item is visible
        if (showReport || showDelete || showUserActions) {
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
    });
  }

  // =====================================
  // MODAL FUNCTIONALITY
  // =====================================

  function initializeModals() {
    const reportModal = document.getElementById('reportModal');
    const deleteModal = document.getElementById('deleteModal');
    const userActionsModal = document.getElementById('userActionsModal');

    const reportMenuItem = document.getElementById('reportMessage');
    const deleteMenuItem = document.getElementById('deleteMessage');
    const userActionsMenuItem = document.getElementById('userActions');

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

    // User actions functionality
    userActionsMenuItem.addEventListener('click', function () {
      const contextMenu = document.getElementById('messageContextMenu');
      contextMenu.style.display = 'none';
      document.getElementById('targetUsername').textContent = currentMessageAuthor;

      // Reset form
      resetUserActionsForm();
      toggleActionFields();
      userActionsModal.style.display = 'flex';
    });

    // Modal close handlers
    initializeModalCloseHandlers(reportModal, deleteModal, userActionsModal);
  }

  function initializeModalCloseHandlers(reportModal, deleteModal, userActionsModal) {
    // Delete modal event listeners
    document.getElementById('deleteModalClose').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirmDelete').addEventListener('click', function () {
      if (currentMessageElement) {
        currentMessageElement.remove();
      }
      closeModal(deleteModal);
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
    if (muteChecked && currentMessageAuthor === CURRENT_USERNAME) {
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
      reportedBy: CURRENT_USERNAME,
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

  // Example function to mute a user (can be called from admin actions)
  // Usage: muteUserWithCountdown(Math.floor(Date.now() / 1000) + 300); // Mute for 5 minutes
  window.muteUserWithCountdown = muteUser;

  // =====================================
  // INITIALIZATION
  // =====================================

  // Initialize all functionality when the page loads
  function initializeApp() {
    initializeTabSwitching();
    initializeUserPermissions();
    initializeChatFunctionality();
    initializeContextMenu();
    initializeModals();
    initializeUserActionsListeners();
    initializeReportFunctionality();
  }

  // Start the application
  initializeApp();
});