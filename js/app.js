// Tab switching functionality
document.addEventListener('DOMContentLoaded', function () {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

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

  // Mock user role check (replace with actual authentication logic)
  const userRole = 'admin'; // Can be 'user', 'mod', or 'admin'
  const currentUsername = document.getElementById('username').textContent;

  if (userRole === 'mod') {
    document.querySelector('.mod-only').style.display = 'flex';
  }

  if (userRole === 'admin') {
    document.querySelector('.admin-only').style.display = 'flex';
    document.querySelectorAll('.admin-only-action').forEach(element => {
      element.style.display = 'block';
    });
  }

  // Chat functionality
  const chatInput = document.querySelector('.chat-input');
  const sendButton = document.querySelector('.send-button');
  const chatMessages = document.getElementById('chat-messages');
  const chatInputContainer = document.querySelector('.chat-input-container');

  // Mute functionality
  let muteExpiry = null;
  let muteCountdownInterval = null;

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
    const newChatInput = document.querySelector('.chat-input');
    const newSendButton = document.querySelector('.send-button');

    newSendButton.addEventListener('click', sendMessage);
    newChatInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  function sendMessage() {
    // Check if user is muted
    if (muteExpiry && Date.now() < muteExpiry) {
      return; // User is still muted, don't send message
    }

    const currentChatInput = document.querySelector('.chat-input');
    if (!currentChatInput) return; // Input not available (user might be muted)

    const message = currentChatInput.value.trim();
    if (message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.setAttribute('data-author', currentUsername);
      messageDiv.setAttribute('data-message-id', Date.now().toString());
      messageDiv.innerHTML = `
              <span class="message-user">${currentUsername}:</span>
              <span class="message-text">${message}</span>
              <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            `;
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      currentChatInput.value = '';
    }
  }

  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Example function to mute a user (can be called from admin actions)
  // Usage: muteUserWithCountdown(Math.floor(Date.now() / 1000) + 300); // Mute for 5 minutes
  window.muteUserWithCountdown = muteUser;

  // Context Menu Functionality
  const contextMenu = document.getElementById('messageContextMenu');
  const reportMenuItem = document.getElementById('reportMessage');
  const deleteMenuItem = document.getElementById('deleteMessage');
  const userActionsMenuItem = document.getElementById('userActions');

  // Modals
  const reportModal = document.getElementById('reportModal');
  const deleteModal = document.getElementById('deleteModal');
  const userActionsModal = document.getElementById('userActionsModal');

  let currentMessageElement = null;
  let currentMessageAuthor = null;
  let currentMessageId = null;

  // Context menu event listeners
  document.addEventListener('contextmenu', function (e) {
    const messageElement = e.target.closest('.message');
    if (messageElement && messageElement.parentElement.id === 'chat-messages') {
      e.preventDefault();

      currentMessageElement = messageElement;
      currentMessageAuthor = messageElement.getAttribute('data-author');
      currentMessageId = messageElement.getAttribute('data-message-id');

      // Show/hide menu items based on permissions
      const isOwnMessage = currentMessageAuthor === currentUsername;
      const isMod = userRole === 'mod' || userRole === 'admin';
      const isAdmin = userRole === 'admin';

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

  // Report message functionality
  reportMenuItem.addEventListener('click', function () {
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
    contextMenu.style.display = 'none';
    deleteModal.style.display = 'flex';
  });

  // User actions functionality
  userActionsMenuItem.addEventListener('click', function () {
    contextMenu.style.display = 'none';
    document.getElementById('targetUsername').textContent = currentMessageAuthor;

    // Reset form
    document.getElementById('muteUser').checked = false;
    document.getElementById('warnUser').checked = false;
    document.getElementById('banUser').checked = false;
    document.getElementById('muteDuration').value = '5';
    document.getElementById('muteReason').value = '';
    document.getElementById('warnReason').value = '';
    document.getElementById('banReason').value = '';
    document.getElementById('banDuration').value = '1440';

    // Show/hide duration and reason fields based on checkbox state
    toggleActionFields();

    userActionsModal.style.display = 'flex';
  });

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

  // Add event listeners for checkboxes to toggle field visibility
  document.getElementById('muteUser').addEventListener('change', toggleActionFields);
  document.getElementById('warnUser').addEventListener('change', toggleActionFields);
  document.getElementById('banUser').addEventListener('change', toggleActionFields);

  // Modal close functionality
  function closeModal(modal) {
    modal.style.display = 'none';
  }

  // Delete modal event listeners
  document.getElementById('deleteModalClose').addEventListener('click', function () {
    closeModal(deleteModal);
  });

  document.getElementById('cancelDelete').addEventListener('click', function () {
    closeModal(deleteModal);
  });

  document.getElementById('confirmDelete').addEventListener('click', function () {
    if (currentMessageElement) {
      currentMessageElement.remove();
    }
    closeModal(deleteModal);
  });

  // User actions modal event listeners
  document.getElementById('userActionsModalClose').addEventListener('click', function () {
    closeModal(userActionsModal);
  });

  document.getElementById('cancelUserActions').addEventListener('click', function () {
    closeModal(userActionsModal);
  });

  document.getElementById('confirmUserActions').addEventListener('click', function () {
    const muteUserChecked = document.getElementById('muteUser').checked;
    const warnUserChecked = document.getElementById('warnUser').checked;
    const banUserChecked = document.getElementById('banUser').checked;

    // Check if at least one action is selected
    if (!muteUserChecked && !warnUserChecked && !banUserChecked) {
      alert('Please select at least one action to apply.');
      return;
    }

    // Validate required fields for selected actions
    let validationErrors = [];

    if (muteUserChecked) {
      const muteReason = document.getElementById('muteReason').value.trim();
      if (!muteReason) {
        validationErrors.push('Mute reason is required');
      }
    }

    if (warnUserChecked) {
      const warnReason = document.getElementById('warnReason').value.trim();
      if (!warnReason) {
        validationErrors.push('Warning reason is required');
      }
    }

    if (banUserChecked) {
      const banReason = document.getElementById('banReason').value.trim();
      if (!banReason) {
        validationErrors.push('Ban reason is required');
      }
    }

    if (validationErrors.length > 0) {
      alert('Please fix the following errors:\n• ' + validationErrors.join('\n• '));
      return;
    }

    // Get form values
    const muteDuration = document.getElementById('muteDuration').value;
    const muteReason = document.getElementById('muteReason').value;
    const warnReason = document.getElementById('warnReason').value;
    const banReason = document.getElementById('banReason').value;
    const banDuration = document.getElementById('banDuration').value;

    // Apply the actions
    if (muteUserChecked && currentMessageAuthor === currentUsername) {
      // If muting the current user, apply the mute with countdown
      const muteSeconds = parseInt(muteDuration) * 60; // Convert minutes to seconds
      const expiryTime = Math.floor(Date.now() / 1000) + muteSeconds;
      muteUser(expiryTime);
    }

    // Create action summary
    let actionSummary = [];
    if (muteUserChecked) {
      actionSummary.push(`Muted for ${muteDuration} minutes: ${muteReason}`);
    }
    if (warnUserChecked) {
      actionSummary.push(`Warning: ${warnReason}`);
    }
    if (banUserChecked) {
      const banDurationText = banDuration === '0' ? 'permanently' : `for ${banDuration} minutes`;
      actionSummary.push(`Banned ${banDurationText}: ${banReason}`);
    }

    // Show confirmation
    console.log('User actions applied to', currentMessageAuthor + ':', actionSummary);

    // Here you would typically send the action to the server
    console.log('User actions data:', {
      target: currentMessageAuthor,
      mute: muteUserChecked ? {
        duration: muteDuration,
        reason: muteReason
      } : null,
      warn: warnUserChecked ? {
        reason: warnReason
      } : null,
      ban: banUserChecked ? {
        reason: banReason,
        duration: banDuration
      } : null
    });

    closeModal(userActionsModal);
  });

  // Report Modal Functionality
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

  // Character count for description
  document.getElementById('reportDescription').addEventListener('input', updateCharacterCount);

  // Update submit button when reason is selected
  document.querySelectorAll('input[name="reportReason"]').forEach(radio => {
    radio.addEventListener('change', updateSubmitButton);
  });

  // Report modal close handlers
  document.getElementById('reportModalClose').addEventListener('click', function () {
    closeModal(reportModal);
  });

  document.getElementById('cancelReport').addEventListener('click', function () {
    closeModal(reportModal);
  });

  // Report submission
  document.getElementById('submitReport').addEventListener('click', function () {
    const selectedReason = document.querySelector('input[name="reportReason"]:checked');
    const description = document.getElementById('reportDescription').value;
    
    if (!selectedReason) {
      return; // Should not happen due to button being disabled
    }

    // Create report data
    const reportData = {
      messageId: currentMessageId,
      reportedUser: currentMessageAuthor,
      reportedBy: currentUsername,
      reason: selectedReason.value,
      description: description.trim(),
      timestamp: new Date().toISOString(),
      messageContent: document.getElementById('reportedMessageContent').textContent
    };

    // Here you would typically send the report to the server
    console.log('Report submitted:', reportData);

    // Show success feedback (you could replace this with a toast notification)
    const submitButton = document.getElementById('submitReport');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-check"></i> Report Sent';
    submitButton.disabled = true;
    
    setTimeout(() => {
      submitButton.innerHTML = originalText;
      closeModal(reportModal);
      
      // You could show a success toast here
      console.log('Report has been sent to moderators for review.');
    }, 1500);
  });

  // Close modals when clicking outside
  window.addEventListener('click', function (e) {
    if (e.target === reportModal) {
      closeModal(reportModal);
    }
    if (e.target === deleteModal) {
      closeModal(deleteModal);
    }
    if (e.target === userActionsModal) {
      closeModal(userActionsModal);
    }
  });

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
});