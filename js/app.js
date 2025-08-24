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
    const undoReportActionsMenuItem = document.getElementById('undoReportActions');

    // Context menu event listeners
    document.addEventListener('contextmenu', function (e) {
      const messageElement = e.target.closest('.message');
      const reportItemElement = e.target.closest('.report-item');

      // Handle message context menu
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
      // Handle report item context menu
      else if (reportItemElement && reportItemElement.closest('#reports')) {
        e.preventDefault();

        // Only show context menu for mods/admins
        const isMod = USER_ROLE === 'mod' || USER_ROLE === 'admin';
        if (!isMod) return;

        // Set current target to the reported user
        currentMessageAuthor = reportItemElement.getAttribute('data-reported-user');
        currentMessageElement = reportItemElement; // Store report element reference
        currentMessageId = null; // No specific message ID for reports

        const reportStatus = reportItemElement.getAttribute('data-status');

        // Hide message-specific options
        reportMenuItem.style.display = 'none';
        deleteMenuItem.style.display = 'none';

        // Show user actions only for pending reports
        const showUserActions = reportStatus === 'pending';
        userActionsMenuItem.style.display = showUserActions ? 'block' : 'none';

        // Show undo actions only for completed reports
        const showUndoActions = reportStatus === 'completed';
        undoReportActionsMenuItem.style.display = showUndoActions ? 'block' : 'none';

        // Only show context menu if at least one item is visible
        if (showUserActions || showUndoActions) {
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

    reportDiv.innerHTML = `
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
    initializeReportsSystem();
  }

  // Start the application
  initializeApp();
});
