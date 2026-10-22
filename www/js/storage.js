// storage.js — localStorage 持久化(配置 / 会话 / UI 状态)
(function () {
  'use strict';

  const KEYS = {
    config: 'dsa_config',
    conversations: 'dsa_conversations',
    ui: 'dsa_ui',
  };

  const DEFAULT_CONFIG = {
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-flash',
    temperature: 0.7,
    systemPrompt: '你是一个乐于助人的助手。',
    maxTokens: 4096,
  };

  const DEFAULT_UI = {
    theme: 'auto', // 'auto' | 'light' | 'dark'
    activeConversationId: null,
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed', e);
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ---- 配置 ----
  function getConfig() {
    const cfg = read(KEYS.config, {});
    return Object.assign({}, DEFAULT_CONFIG, cfg);
  }
  function saveConfig(cfg) {
    write(KEYS.config, Object.assign({}, DEFAULT_CONFIG, cfg));
  }

  // ---- 会话 ----
  function getConversations() {
    const list = read(KEYS.conversations, []);
    return Array.isArray(list) ? list : [];
  }
  function saveConversations(list) {
    write(KEYS.conversations, list);
  }
  function getConversation(id) {
    return getConversations().find(function (c) { return c.id === id; }) || null;
  }
  function createConversation() {
    const conv = {
      id: uuid(),
      title: '新对话',
      createdAt: Date.now(),
      messages: [],
    };
    const list = getConversations();
    list.unshift(conv);
    saveConversations(list);
    return conv;
  }
  function updateConversation(id, updater) {
    const list = getConversations();
    const idx = list.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return null;
    const updated = updater(list[idx]);
    list[idx] = updated;
    saveConversations(list);
    return updated;
  }
  function deleteConversation(id) {
    saveConversations(getConversations().filter(function (c) { return c.id !== id; }));
  }

  // ---- UI 状态 ----
  function getUI() {
    return Object.assign({}, DEFAULT_UI, read(KEYS.ui, {}));
  }
  function saveUI(ui) {
    write(KEYS.ui, Object.assign({}, DEFAULT_UI, ui));
  }

  window.Store = {
    KEYS: KEYS,
    getConfig: getConfig,
    saveConfig: saveConfig,
    getConversations: getConversations,
    saveConversations: saveConversations,
    getConversation: getConversation,
    createConversation: createConversation,
    updateConversation: updateConversation,
    deleteConversation: deleteConversation,
    getUI: getUI,
    saveUI: saveUI,
    uuid: uuid,
  };
})();
