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

  function sendMessage() {
    const message = chatInput.value.trim();
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
      chatInput.value = '';
    }
  }

  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Context Menu Functionality
  const contextMenu = document.getElementById('messageContextMenu');
  const deleteMenuItem = document.getElementById('deleteMessage');
  const userActionsMenuItem = document.getElementById('userActions');

  // Modals
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

      // Delete message: show for mods/admins and message author
      const showDelete = isMod || isOwnMessage;
      deleteMenuItem.style.display = showDelete ? 'block' : 'none';

      // User actions: show for mods/admins, but not for own messages
      const showUserActions = isMod && !isOwnMessage;
      userActionsMenuItem.style.display = showUserActions ? 'block' : 'none';

      // Only show context menu if at least one item is visible
      if (showDelete || showEdit || showUserActions) {
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
    document.getElementById('warnReason').value = '';
    document.getElementById('banReason').value = '';

    userActionsModal.style.display = 'flex';
  });

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
    const muteUser = document.getElementById('muteUser').checked;
    const warnUser = document.getElementById('warnUser').checked;
    const banUser = document.getElementById('banUser').checked;
    const muteDuration = document.getElementById('muteDuration').value;
    const warnReason = document.getElementById('warnReason').value;
    const banReason = document.getElementById('banReason').value;

    // Apply the actions

    closeModal(userActionsModal);
  });

  // Close modals when clicking outside
  window.addEventListener('click', function (e) {
    if (e.target === deleteModal) {
      closeModal(deleteModal);
    }
    if (e.target === userActionsModal) {
      closeModal(userActionsModal);
    }
  });
});