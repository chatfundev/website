document.addEventListener('DOMContentLoaded', function () {
  // =====================================
  // CONFIGURATION & GLOBAL VARIABLES
  // =====================================

  // User Information - make them global properties
  window.USER_ROLE = null;
  window.CURRENT_USERNAME = null;

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
    if (window.USER_ROLE === 'mod' || window.USER_ROLE === 'admin' || window.USER_ROLE === 'owner') {
      console.log("Mod access!");
      document.querySelectorAll('.mod-only').forEach(element => {
        element.style.display = 'flex';
      });
    }

    if (window.USER_ROLE === 'admin' || window.USER_ROLE === 'owner') {
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

  let lastMessageId = null;
  let messagePollingInterval = null;

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
        return;
      }

      // Set the bearer token for this request
      api.bearerToken = token;

      // Send message to server
      await api.post('/messages', { content: message });

      // Clear input on successful send
      currentChatInput.value = '';

    } catch (error) {
      console.error('Failed to send message:', error);
      // Could show an error message to user here
    }
  }

  async function fetchMessages() {
    try {
      const token = getAuthToken();
      if (!token) {
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
    }
  }

  function updateChatMessages(messages) {
    // Clear existing messages
    chatMessages.innerHTML = '';

    messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.setAttribute('data-author', message.username);
      messageDiv.setAttribute('data-message-id', message.uuid);

      // Format timestamp
      const timestamp = new Date(message.timestamp);
      const timeString = timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      badgeIcons = {
        mod: '<i class="fa fa-shield"></i>',
        admin: '<i class="fa fa-tools"></i>',
        owner: '<i class="fa fa-crown"></i>',
        shadowbanned: '<i class="fa fa-user-slash"></i>'
      }

      // Add badge if exists
      let badgeHtml = '';
      if (message.badge) {
        badgeHtml = `<span class="message-role">[${badgeIcons[message.badge]} ${message.badge}]</span> `;
      }

      messageDiv.innerHTML = `
        <div class="message-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
          <span class="message-user">${badgeHtml}${message.username}:</span>
          <span class="message-text">${message.content}</span>
          <span class="message-time">${timeString}</span>
        </div>
      `;

      chatMessages.appendChild(messageDiv);
    });

    // Auto-scroll to bottom if enabled and user is at or near the bottom
    const settings = getSettings();
    if (settings.autoScroll) {
      const scrollPosition = chatMessages.scrollTop;
      const scrollHeight = chatMessages.scrollHeight;
      const clientHeight = chatMessages.clientHeight;
      const threshold = 100;

      const isNearBottom = scrollPosition >= (scrollHeight - clientHeight - threshold);
      if (isNearBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
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
        const isMod = window.USER_ROLE === 'mod' || window.USER_ROLE === 'admin';
        const isAdmin = window.USER_ROLE === 'admin';

        // Report message: show for everyone, but not for own messages
        const showReport = !isOwnMessage;
        reportMenuItem.style.display = showReport ? 'block' : 'none';

        // Delete message: show for mods/admins and message author
        const showDelete = isMod || isOwnMessage;
        deleteMenuItem.style.display = showDelete ? 'block' : 'none';

        // User actions: show for mods/admins, but not for own messages
        const showUserActions = isMod && !isOwnMessage;
        userActionsMenuItem.style.display = showUserActions ? 'block' : 'none';

        // Hide undo actions for regular messages
        undoReportActionsMenuItem.style.display = 'none';

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
  }  // =====================================
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

    // Undo report actions functionality
    undoReportActionsMenuItem.addEventListener('click', function () {
      const contextMenu = document.getElementById('messageContextMenu');
      contextMenu.style.display = 'none';
      showUndoReportModal(currentMessageElement);
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
    // Accept friend request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('accept-friend-btn') || e.target.parentElement.classList.contains('accept-friend-btn')) {
        const requestItem = e.target.closest('.friend-request-item');
        const friendName = requestItem.querySelector('.friend-name').textContent;

        // Simulate accepting friend request
        console.log(`Accepted friend request from ${friendName}`);

        // Remove from requests (in real app, this would update the server)
        requestItem.remove();

        // Update request count
        updateRequestCount();

        // Show success message
        showFriendActionMessage(`You are now friends with ${friendName}!`, 'success');
      }
    });

    // Decline friend request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('decline-friend-btn') || e.target.parentElement.classList.contains('decline-friend-btn')) {
        const requestItem = e.target.closest('.friend-request-item');
        const friendName = requestItem.querySelector('.friend-name').textContent;

        // Simulate declining friend request
        console.log(`Declined friend request from ${friendName}`);

        // Remove from requests
        requestItem.remove();

        // Update request count
        updateRequestCount();

        // Show message
        showFriendActionMessage(`Declined friend request from ${friendName}`, 'info');
      }
    });

    // Cancel outgoing request
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('cancel-request-btn') || e.target.parentElement.classList.contains('cancel-request-btn')) {
        const requestItem = e.target.closest('.friend-request-item');
        const friendName = requestItem.querySelector('.friend-name').textContent;

        // Simulate canceling friend request
        console.log(`Canceled friend request to ${friendName}`);

        // Remove from requests
        requestItem.remove();

        // Show message
        showFriendActionMessage(`Canceled friend request to ${friendName}`, 'info');
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

  function updateRequestCount() {
    const incomingRequests = document.querySelectorAll('.incoming-requests .friend-request-item');
    const requestCountSpan = document.querySelector('.request-count');
    const incomingTabBtn = document.querySelector('[data-request-type="incoming"]');

    const count = incomingRequests.length;
    requestCountSpan.textContent = `${count} pending`;

    // Update the tab button text
    if (incomingTabBtn) {
      incomingTabBtn.innerHTML = `<i class="fas fa-arrow-down"></i> Incoming (${count})`;
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

  let currentDMConversation = 'player123';

  function initializeDMsFunctionality() {
    // Initialize conversation switching
    initializeConversationSwitching();

    // Initialize DM messaging
    initializeDMMessaging();

    // Initialize conversation search
    initializeConversationSearch();
  }

  function initializeConversationSwitching() {
    const conversationItems = document.querySelectorAll('.conversation-item');

    conversationItems.forEach(item => {
      item.addEventListener('click', function () {
        const conversationId = this.getAttribute('data-conversation');
        switchDMConversation(conversationId);
      });
    });
  }

  function switchDMConversation(conversationId) {
    const conversationItems = document.querySelectorAll('.conversation-item');

    // Remove active class from all conversations
    conversationItems.forEach(item => item.classList.remove('active'));

    // Add active class to selected conversation
    const activeConversation = document.querySelector(`[data-conversation="${conversationId}"]`);
    if (activeConversation) {
      activeConversation.classList.add('active');

      // Remove unread badge
      const unreadBadge = activeConversation.querySelector('.unread-badge');
      if (unreadBadge) {
        unreadBadge.remove();
      }
    }

    // Update conversation header
    updateDMConversationHeader(conversationId);

    // Load conversation messages (in a real app, this would fetch from server)
    loadDMConversation(conversationId);

    // Update current conversation
    currentDMConversation = conversationId;
  }

  function updateDMConversationHeader(conversationId) {
    const dmUserName = document.querySelector('.dm-user-name');
    const dmUserStatus = document.querySelector('.dm-user-status');

    // Mock user data (in real app, this would come from user data)
    const userStatuses = {
      'player123': { name: 'player123', status: 'Online', statusClass: 'online' },
      'gamer456': { name: 'gamer456', status: 'Online', statusClass: 'online' },
      'social_butterfly': { name: 'social_butterfly', status: 'Idle - 15 min', statusClass: 'idle' },
      'chat_lover': { name: 'chat_lover', status: 'Playing ChatFun', statusClass: 'online' },
      'sleepy_gamer': { name: 'sleepy_gamer', status: 'Last seen 2 hours ago', statusClass: 'offline' }
    };

    const userData = userStatuses[conversationId] || { name: conversationId, status: 'Unknown', statusClass: 'offline' };

    dmUserName.textContent = userData.name;
    dmUserStatus.textContent = userData.status;

    // Update status indicator
    const statusIndicator = document.querySelector('.dm-user-avatar .status-indicator');
    if (statusIndicator) {
      statusIndicator.className = `status-indicator ${userData.statusClass}`;
    }
  }

  function loadDMConversation(conversationId) {
    const dmMessages = document.getElementById('dm-messages');

    // Mock conversations (in real app, this would be fetched from server)
    const conversations = {
      'player123': [
        { type: 'received', text: 'Hey! How\'s it going?', time: '2:30 PM' },
        { type: 'sent', text: 'Pretty good! Just got that rare item from the forge!', time: '2:32 PM' },
        { type: 'received', text: 'Nice! Which one did you get?', time: '2:33 PM' },
        { type: 'sent', text: 'The lightning dagger! It\'s worth 75 coins', time: '2:34 PM' },
        { type: 'received', text: 'Awesome! Thanks for helping me with that boss earlier by the way', time: '2:44 PM' },
        { type: 'received', text: 'Thanks for the help earlier!', time: '2:45 PM' }
      ],
      'gamer456': [
        { type: 'received', text: 'Hey want to team up for some battles?', time: '1:15 PM' },
        { type: 'sent', text: 'Sure! I\'m free right now', time: '1:16 PM' },
        { type: 'received', text: 'Great! Meet you in the arena', time: '1:18 PM' },
        { type: 'sent', text: 'On my way!', time: '1:19 PM' },
        { type: 'received', text: 'Want to play later?', time: '1:30 PM' }
      ],
      'social_butterfly': [
        { type: 'received', text: 'Did you see the new update?', time: '11:45 AM' },
        { type: 'sent', text: 'Yes! The new features look amazing', time: '11:47 AM' },
        { type: 'received', text: 'I know right! Can\'t wait to try them', time: '11:48 AM' },
        { type: 'sent', text: 'Same here! Talk to you later', time: '12:10 PM' },
        { type: 'received', text: 'See you tomorrow!', time: '12:15 PM' }
      ],
      'chat_lover': [
        { type: 'received', text: 'LMAO that was hilarious! 😂', time: '11:30 AM' },
        { type: 'sent', text: 'I know right? I couldn\'t stop laughing', time: '11:32 AM' },
        { type: 'received', text: 'That was hilarious! 😂', time: '11:45 AM' }
      ],
      'sleepy_gamer': [
        { type: 'sent', text: 'Hey, still up for that game?', time: 'Yesterday 10:30 PM' },
        { type: 'received', text: 'Sorry, getting pretty tired', time: 'Yesterday 10:45 PM' },
        { type: 'sent', text: 'No worries! Sleep well', time: 'Yesterday 10:46 PM' },
        { type: 'received', text: 'Good night!', time: 'Yesterday 10:47 PM' }
      ]
    };

    const messages = conversations[conversationId] || [];

    // Clear existing messages
    dmMessages.innerHTML = '';

    // Add messages
    messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `dm-message ${message.type}`;

      let avatarHtml = '';
      if (message.type === 'received') {
        avatarHtml = `
          <div class="dm-message-avatar">
            <i class="fas fa-user"></i>
          </div>
        `;
      } else if (message.type === 'sent') {
        avatarHtml = `
          <div class="dm-message-avatar">
            <i class="fas fa-user"></i>
          </div>
        `;
      }

      messageDiv.innerHTML = `
        ${avatarHtml}
        <div class="dm-message-content">
          <div class="dm-message-bubble">
            <span class="dm-message-text">${message.text}</span>
            <span class="dm-message-time">${message.time}</span>
          </div>
        </div>
      `;

      dmMessages.appendChild(messageDiv);
    });

    // Scroll to bottom
    dmMessages.scrollTop = dmMessages.scrollHeight;
  }

  function initializeDMMessaging() {
    const dmInput = document.querySelector('.dm-input');
    const dmSendButton = document.querySelector('.dm-send-button');

    function sendDMMessage() {
      if (!dmInput.value.trim()) return;

      const message = dmInput.value.trim();
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add message to conversation
      addDMMessage('sent', message, currentTime);

      // Clear input
      dmInput.value = '';

      // Simulate response after a short delay (for demo purposes)
      setTimeout(() => {
        const responses = [
          'That sounds great!',
          'I agree!',
          'Haha, nice one!',
          'Interesting point!',
          'Thanks for letting me know!',
          'Cool!',
          'Awesome!',
          'Got it!',
          'Sure thing!',
          'No problem!'
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const responseTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        addDMMessage('received', randomResponse, responseTime);
      }, 1000 + Math.random() * 2000);
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
  }

  function addDMMessage(type, text, time) {
    const dmMessages = document.getElementById('dm-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `dm-message ${type}`;

    let avatarHtml = '';
    if (type === 'received') {
      avatarHtml = `
        <div class="dm-message-avatar">
          <i class="fas fa-user"></i>
        </div>
      `;
    } else if (type === 'sent') {
      avatarHtml = `
        <div class="dm-message-avatar">
          <i class="fas fa-user"></i>
        </div>
      `;
    }

    messageDiv.innerHTML = `
      ${avatarHtml}
      <div class="dm-message-content">
        <div class="dm-message-bubble">
          <span class="dm-message-text">${text}</span>
          <span class="dm-message-time">${time}</span>
        </div>
      </div>
    `;

    dmMessages.appendChild(messageDiv);
    dmMessages.scrollTop = dmMessages.scrollHeight;
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

  // =====================================
  // SETTINGS FUNCTIONALITY
  // =====================================

  function initializeSettings() {
    // Load saved settings from localStorage
    loadSettings();

    // Message history limit
    const messageHistoryLimit = document.getElementById('messageHistoryLimit');
    messageHistoryLimit.addEventListener('change', function () {
      setSetting('messageHistoryLimit', this.value);
    });

    // Toggle settings
    const toggleSettings = [
      'messageNotifications',
      'dmNotifications',
      'achievementNotifications',
      'soundNotifications',
      'showTimestamps',
      'autoScroll',
      'ctrlEnterToSend',
      'showOnlineStatus',
      'allowDirectMessages',
      'contentFilter'
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
    document.getElementById('logoutBtn')?.addEventListener('click', showLogoutModal);
    document.getElementById('deleteAccountBtn')?.addEventListener('click', showDeleteAccountModal);
  }

  function loadSettings() {
    // Load settings from localStorage and apply them
    const settings = getSettings();

    // Apply message history limit
    const messageHistoryLimit = document.getElementById('messageHistoryLimit');
    if (messageHistoryLimit) {
      messageHistoryLimit.value = settings.messageHistoryLimit;
    }

    // Apply toggle settings
    const toggleSettings = [
      'messageNotifications',
      'dmNotifications',
      'achievementNotifications',
      'soundNotifications',
      'showTimestamps',
      'autoScroll',
      'ctrlEnterToSend',
      'showOnlineStatus',
      'allowDirectMessages',
      'contentFilter',
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
      messageHistoryLimit: '100',
      messageNotifications: true,
      dmNotifications: true,
      achievementNotifications: false,
      soundNotifications: false,
      showTimestamps: true,
      autoScroll: true,
      ctrlEnterToSend: false,
      showOnlineStatus: true,
      allowDirectMessages: true,
      contentFilter: true
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
      // Add more toggle implementations as needed
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
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function confirmLogout() {
    // Clear any session data
    localStorage.removeItem('chatfun_auth_token');
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
    if (!token) return;

    // Set the bearer token for API requests
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
        }
      })
      .catch(error => {
        console.error("Error fetching user data:", error);
      });
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
      window.location.href = 'login.html';
      return;
    }

    initializeUserData();
    initializeTabSwitching();
    initializeUserPermissions();
    initializeChatFunctionality();
    initializeContextMenu();
    initializeModals();
    initializeUserActionsListeners();
    initializeReportFunctionality();
    initializeReportsSystem();
    initializeItemsFunctionality();
    initializeFriendsFunctionality();
    initializeDMsFunctionality();
    initializeSettings();
  }

  // Start the application
  initializeApp();

  // Clean up polling when leaving the page
  window.addEventListener('beforeunload', function () {
    stopMessagePolling();
  });
});
