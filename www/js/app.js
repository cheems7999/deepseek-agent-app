// app.js — 入口:主题、侧栏、输入、语音、事件绑定
(function () {
  'use strict';

  // ---- Toast ----
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }
  window.toast = toast;

  // ---- 主题 ----
  function applyTheme() {
    const ui = Store.getUI();
    let effective = ui.theme;
    if (effective === 'auto') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = effective;
    const light = document.getElementById('hljs-light');
    const dark = document.getElementById('hljs-dark');
    if (light && dark) {
      light.disabled = effective !== 'light';
      dark.disabled = effective !== 'dark';
    }
    const btn = document.getElementById('btn-theme');
    btn.textContent = effective === 'dark' ? '🌙' : (effective === 'light' ? '☀️' : '🌓');
    btn.title = '主题: ' + (ui.theme === 'auto' ? '跟随系统' : ui.theme === 'dark' ? '深色' : '浅色') + '(点击切换)';
  }

  function cycleTheme() {
    const ui = Store.getUI();
    const order = ['auto', 'light', 'dark'];
    const idx = order.indexOf(ui.theme);
    ui.theme = order[(idx + 1) % order.length];
    Store.saveUI(ui);
    applyTheme();
    toast('主题: ' + (ui.theme === 'auto' ? '跟随系统' : ui.theme === 'dark' ? '深色' : '浅色'));
  }

  // 跟随系统变化
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (Store.getUI().theme === 'auto') applyTheme();
    });
  }

  // ---- 输入区 ----
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('btn-send');
  const voiceBtn = document.getElementById('btn-voice');
  const composerHint = document.getElementById('composer-hint');

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }

  function setStreamingUI(on) {
    if (on) {
      sendBtn.textContent = '■';
      sendBtn.title = '停止生成';
      sendBtn.classList.add('stop');
    } else {
      sendBtn.textContent = '➤';
      sendBtn.title = '发送';
      sendBtn.classList.remove('stop');
    }
  }
  window.setStreamingUI = setStreamingUI;

  function doSend() {
    if (Chat.isStreaming()) { Chat.stopStreaming(); return; }
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoResize();
    Chat.send(text);
  }

  // ---- 语音 ----
  let recording = false;
  function toggleVoice() {
    if (recording) { Voice.stop(); return; }
    const kind = Voice.detect();
    if (!kind) { toast('当前环境不支持语音输入'); return; }
    recording = true;
    voiceBtn.classList.add('recording');
    composerHint.textContent = '正在聆听…(再点一次结束)';
    Voice.start({
      onPartial: function (text) {
        input.value = text;
        autoResize();
      },
      onResult: function () {},
      onError: function (msg) {
        recording = false;
        voiceBtn.classList.remove('recording');
        composerHint.textContent = '';
        toast(msg);
      },
      onEnd: function () {
        recording = false;
        voiceBtn.classList.remove('recording');
        composerHint.textContent = '';
      },
    });
  }

  // ---- 侧栏(移动端抽屉)----
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  function openSidebar() {
    sidebar.classList.add('open');
    sidebarBackdrop.classList.add('show');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('show');
  }

  // ---- 绑定 ----
  function bind() {
    Settings.bind();
    Chat.init();
    applyTheme();

    document.getElementById('btn-theme').addEventListener('click', cycleTheme);
    document.getElementById('btn-settings').addEventListener('click', function () { Settings.open(); });
    document.getElementById('btn-go-settings').addEventListener('click', function () { Settings.open(); });
    document.getElementById('btn-menu').addEventListener('click', openSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);
    document.getElementById('btn-new-chat').addEventListener('click', function () { Chat.newConversation(); closeSidebar(); });

    // 点击会话项后关闭抽屉
    document.getElementById('conv-list').addEventListener('click', function (e) {
      if (e.target.closest('.conv-item')) closeSidebar();
    });

    sendBtn.addEventListener('click', doSend);
    voiceBtn.addEventListener('click', toggleVoice);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        doSend();
      }
    });
    input.addEventListener('input', autoResize);

    // 导出
    document.getElementById('btn-export').addEventListener('click', function () {
      const id = Store.getUI().activeConversationId;
      if (id && Store.getConversation(id)) Chat.exportConversation(id);
      else toast('当前没有可导出的会话');
    });
    document.getElementById('btn-export-all').addEventListener('click', function () {
      Chat.exportAll();
      closeSidebar();
    });

    // 快捷键:Ctrl+N 新建
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        Chat.newConversation();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
