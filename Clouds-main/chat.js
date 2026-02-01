(function () {
  'use strict';

  var STORAGE_KEY = 'lemoney_chat_history';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function safeSessionGet() {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function safeSessionSet(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      // ignore
    }
  }

  function loadHistory() {
    var raw = safeSessionGet();
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.text === 'string' && typeof item.role === 'string';
      });
    } catch (err) {
      return [];
    }
  }

  function saveHistory(history) {
    safeSessionSet(JSON.stringify(history));
  }

  function getReplyText(data) {
    if (!data || typeof data !== 'object') return '';
    return data.reply || data.response || data.text || '';
  }

  function createElement(tag, attrs, text) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') {
          el.className = attrs[key];
        } else if (key === 'textContent') {
          el.textContent = attrs[key];
        } else {
          el.setAttribute(key, attrs[key]);
        }
      });
    }
    if (text) {
      el.textContent = text;
    }
    return el;
  }

  function injectChatWidget() {
    if (document.getElementById('lemon-chat-toggle')) {
      return;
    }

    var toggle = createElement('button', { id: 'lemon-chat-toggle', type: 'button', 'aria-label': 'Open Lemon chat' });
    var toggleIcon = createElement('img', { id: 'lemon-chat-icon', src: 'Graphics/lemonie happy.png', alt: 'Lemon chat' });
    toggle.appendChild(toggleIcon);

    var panel = createElement('div', { id: 'lemon-chat-panel', className: 'lemon-chat-hidden' });
    var header = createElement('div', { id: 'lemon-chat-header' });
    var title = createElement('div', { id: 'lemon-chat-title' }, 'Lemon 🍋');
    var closeBtn = createElement('button', { id: 'lemon-chat-close', type: 'button', 'aria-label': 'Close chat' }, '×');

    header.appendChild(title);
    header.appendChild(closeBtn);

    var messages = createElement('div', { id: 'lemon-chat-messages' });

    var inputRow = createElement('div', { id: 'lemon-chat-input-row' });
    var input = createElement('input', { id: 'lemon-chat-input', type: 'text', placeholder: 'Ask Lemon...' });
    var sendBtn = createElement('button', { id: 'lemon-chat-send', type: 'button' }, 'Send');

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputRow);

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    var history = loadHistory();
    history.forEach(function (item) {
      appendMessage(messages, history, item.role, item.text, true);
    });

    function openPanel() {
      panel.classList.remove('lemon-chat-hidden');
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }

    function closePanel() {
      panel.classList.add('lemon-chat-hidden');
    }

    toggle.addEventListener('click', function () {
      if (panel.classList.contains('lemon-chat-hidden')) {
        openPanel();
      } else {
        closePanel();
      }
    });

    closeBtn.addEventListener('click', closePanel);

    function appendMessage(container, historyStore, role, text, skipSave) {
      var bubble = createElement('div', { className: 'lemon-chat-bubble lemon-chat-' + role });
      bubble.textContent = text;
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
      if (!skipSave) {
        historyStore.push({ role: role, text: text });
        saveHistory(historyStore);
      }
      return bubble;
    }

    async function sendMessage() {
      var text = input.value.trim();
      if (!text) return;

      input.value = '';
      sendBtn.disabled = true;
      input.disabled = true;

      appendMessage(messages, history, 'user', text, false);
      var typingBubble = appendMessage(messages, history, 'assistant', 'thinking...', true);
      typingBubble.classList.add('lemon-chat-typing');

      var replyText = '';
      try {
        if (!window.API || typeof window.API.chat !== 'function') {
          throw new Error('Chat unavailable.');
        }
        var response = await window.API.chat(text);
        replyText = getReplyText(response);
        if (!replyText) {
          replyText = 'No response.';
        }
      } catch (err) {
        if (err && err.status === 401) {
          replyText = 'Please log in.';
        } else {
          replyText = err && err.message ? err.message : 'Unable to reach chat.';
        }
      }

      if (typingBubble && typingBubble.parentNode) {
        typingBubble.parentNode.removeChild(typingBubble);
      }
      var replyBubble = appendMessage(messages, history, 'assistant', replyText, false);
      if (typeof replyText === 'string' && replyText.startsWith('ERROR:')) {
        replyBubble.classList.add('lemon-chat-error');
        replyBubble.style.background = '#fff1f0';
        replyBubble.style.borderColor = '#ffa39e';
        replyBubble.style.color = '#b91c1c';
      }

      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  onReady(injectChatWidget);
})();
