(function (global) {
  'use strict';

  var API_BASE = 'http://127.0.0.1:8000';
  var BASE_URL = (global && global.API_BASE_URL) || '';
  var FALLBACK_URL = '';
  var TOKEN_KEY = 'token';

  function safeGetItem(key) {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeSetItem(key, value) {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeRemoveItem(key) {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  function resolveBaseUrl() {
    if (BASE_URL) {
      return BASE_URL;
    }
    return FALLBACK_URL;
  }

  function normalizePath(path) {
    if (!path) {
      return '/';
    }
    return path.startsWith('/') ? path : '/' + path;
  }

  function getToken() {
    return safeGetItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (!token) {
      clearToken();
      return null;
    }
    safeSetItem(TOKEN_KEY, token);
    return token;
  }

  function clearToken() {
    safeRemoveItem(TOKEN_KEY);
  }

  function handleUnauthorized() {
    clearToken();
    try {
      if (!global || !global.location) {
        return;
      }
      var path = (global.location.pathname || '').toLowerCase();
      if (path.indexOf('login.html') !== -1) {
        return;
      }
      global.location.href = 'login.html';
    } catch (err) {
      // ignore
    }
  }

  async function parseJsonSafe(response) {
    var text = '';
    try {
      text = await response.text();
    } catch (err) {
      return null;
    }
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  async function request(path, options) {
    var opts = options || {};
    var method = opts.method || 'GET';
    var body = opts.body;
    var auth = opts.auth !== false;
    var headers = {
      'Content-Type': 'application/json'
    };
    var token = getToken();
    if (auth && token) {
      headers.Authorization = 'Bearer ' + token;
    }

    var url = resolveBaseUrl() + normalizePath(path);
    var fetchOptions = {
      method: method,
      headers: headers
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    var response = await fetch(url, fetchOptions);
    var data = await parseJsonSafe(response);

    if (!response.ok) {
      var detail = null;
      if (data && typeof data === 'object') {
        if (typeof data.detail === 'string') {
          detail = data.detail;
        } else if (typeof data.message === 'string') {
          detail = data.message;
        }
      }
      var message = detail || response.statusText || 'Request failed';
      var error = new Error(String(response.status) + ': ' + message);
      error.status = response.status;
      error.data = data;
      if (response.status === 401) {
        handleUnauthorized();
      }
      throw error;
    }

    return data;
  }

  function signup(email, password) {
    return request('/auth/signup', {
      method: 'POST',
      body: { email: email, password: password },
      auth: false
    });
  }

  function login(email, password) {
    return request('/auth/login', {
      method: 'POST',
      body: { email: email, password: password },
      auth: false
    });
  }

  function monthStart(income, ratio) {
    var safeRatio = (ratio === undefined || ratio === null) ? 1.0 : ratio;
    return request('/month/start', {
      method: 'POST',
      body: { income: income, ratio: safeRatio }
    });
  }

  function monthState() {
    return request('/month/state', { method: 'GET' });
  }

  function charts() {
    return request('/charts', { method: 'GET' });
  }

  async function chat(message, history) {
    console.log('🍋 sending chat:', message);
    var token = getToken();
    var url = API_BASE + '/chat/message';
    var headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    var response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        message: message,
        history: Array.isArray(history) ? history : []
      })
    });
    var data = await parseJsonSafe(response);
    console.log('🍋 chat reply:', data);
    if (!response.ok) {
      var detail = null;
      if (data && typeof data === 'object') {
        if (typeof data.detail === 'string') {
          detail = data.detail;
        } else if (typeof data.message === 'string') {
          detail = data.message;
        }
      }
      var messageText = detail || response.statusText || 'Request failed';
      var error = new Error(String(response.status) + ': ' + messageText);
      error.status = response.status;
      error.data = data;
      if (response.status === 401) {
        handleUnauthorized();
      }
      throw error;
    }
    return { reply: data && typeof data.reply === 'string' ? data.reply : '' };
  }

  function listShopItems() {
    return request('/shop/items', { method: 'GET' });
  }

  function createShopItem(payload) {
    return request('/shop/item', {
      method: 'POST',
      body: payload || {}
    });
  }

  function purchaseItem(itemId) {
    return request('/shop/purchase/' + encodeURIComponent(String(itemId)), { method: 'POST' });
  }

  function listPurchases() {
    return request('/shop/purchases', { method: 'GET' });
  }

  function listTaskInstances(dateStr) {
    return request('/tasks/instances?date=' + encodeURIComponent(dateStr), { method: 'GET' });
  }

  function generateTasks(dateStr) {
    return request('/tasks/generate?date=' + encodeURIComponent(dateStr), { method: 'POST' });
  }

  function createTaskTemplate(payload) {
    return request('/tasks/template', {
      method: 'POST',
      body: payload || {}
    });
  }

  function completeTask(instanceId, note) {
    return request('/tasks/instances/' + encodeURIComponent(String(instanceId)) + '/complete', {
      method: 'POST',
      body: { note: note }
    });
  }

  function skipTask(instanceId) {
    return request('/tasks/instances/' + encodeURIComponent(String(instanceId)) + '/skip', {
      method: 'POST'
    });
  }

  function completeTaskInstance(instanceId, note) {
    return completeTask(instanceId, note);
  }

  function skipTaskInstance(instanceId) {
    return skipTask(instanceId);
  }

  function ensureMonthStarted() {
    return monthState().then(function (state) {
      return { started: true, state: state };
    }).catch(function (err) {
      if (err && err.status === 400) {
        return { started: false, state: null };
      }
      throw err;
    });
  }

  var API = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    request: request,
    signup: signup,
    login: login,
    monthStart: monthStart,
    monthState: monthState,
    charts: charts,
    chat: chat,
    listShopItems: listShopItems,
    createShopItem: createShopItem,
    purchaseItem: purchaseItem,
    listPurchases: listPurchases,
    listTaskInstances: listTaskInstances,
    generateTasks: generateTasks,
    createTaskTemplate: createTaskTemplate,
    completeTask: completeTask,
    skipTask: skipTask,
    completeTaskInstance: completeTaskInstance,
    skipTaskInstance: skipTaskInstance,
    ensureMonthStarted: ensureMonthStarted
  };

  if (global) {
    global.API = API;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.API = API;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
