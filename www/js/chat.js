// chat.js — 会话/消息管理、流式渲染、导出
(function () {
  'use strict';

  let activeId = null;
  let streaming = false;
  let abortController = null;
  let streamingConvId = null;
  let streamingMsgId = null;

  const el = {
    messages: document.getElementById('messages'),
    convList: document.getElementById('conv-list'),
    emptyState: document.getElementById('empty-state'),
    title: document.getElementById('chat-title'),
    hint: document.getElementById('composer-hint'),
  };

  function saveActiveId() {
    const ui = Store.getUI();
    ui.activeConversationId = activeId;
    Store.saveUI(ui);
  }

  function currentConversation() {
    return activeId ? Store.getConversation(activeId) : null;
  }

  function init() {
    const ui = Store.getUI();
    const convs = Store.getConversations();
    if (ui.activeConversationId && Store.getConversation(ui.activeConversationId)) {
      activeId = ui.activeConversationId;
    } else if (convs.length) {
      activeId = convs[0].id;
    } else {
      activeId = null;
    }
    saveActiveId();
    renderList();
    renderMessages();
  }

  function newConversation() {
    const conv = Store.createConversation();
    activeId = conv.id;
    saveActiveId();
    renderList();
    renderMessages();
    return conv;
  }

  function switchConversation(id) {
    if (streaming) { window.toast && toast('生成中,请先停止或等待完成'); return; }
    activeId = id;
    saveActiveId();
    renderList();
    renderMessages();
  }

  function deleteConversation(id) {
    if (streaming && streamingConvId === id) { stopStreaming(); }
    Store.deleteConversation(id);
    if (activeId === id) {
      const convs = Store.getConversations();
      activeId = convs.length ? convs[0].id : null;
      saveActiveId();
    }
    renderList();
    renderMessages();
  }

  function renderList() {
    const convs = Store.getConversations();
    el.convList.innerHTML = '';
    if (!convs.length) {
      el.convList.innerHTML = '<div class="conv-empty">暂无会话</div>';
      return;
    }
    convs.forEach(function (c) {
      const item = document.createElement('div');
      item.className = 'conv-item' + (c.id === activeId ? ' active' : '');
      item.dataset.id = c.id;
      const title = document.createElement('span');
      title.className = 'conv-title';
      title.textContent = c.title || '新对话';
      const del = document.createElement('button');
      del.className = 'conv-del';
      del.textContent = '✕';
      del.title = '删除会话';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteConversation(c.id);
      });
      item.appendChild(title);
      item.appendChild(del);
      item.addEventListener('click', function () { switchConversation(c.id); });
      el.convList.appendChild(item);
    });
  }

  function scrollToBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderMessage(m) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'msg-user' : 'msg-assistant');
    wrap.dataset.msgId = m.id;
    if (m.role === 'assistant') {
      if (m.reasoning) {
        const thinking = document.createElement('details');
        thinking.className = 'msg-thinking';
        const summary = document.createElement('summary');
        summary.textContent = '🧠 思考过程';
        const body = document.createElement('div');
        body.className = 'thinking-body';
        body.textContent = m.reasoning;
        thinking.appendChild(summary);
        thinking.appendChild(body);
        wrap.appendChild(thinking);
      }
      const content = document.createElement('div');
      content.className = 'msg-content';
      content.appendChild(Markdown.render(m.content));
      wrap.appendChild(content);
    } else {
      const content = document.createElement('div');
      content.className = 'msg-content';
      content.textContent = m.content;
      wrap.appendChild(content);
    }
    return wrap;
  }

  function renderMessages() {
    el.messages.innerHTML = '';
    const conv = currentConversation();
    if (!conv || !conv.messages.length) {
      el.emptyState.hidden = false;
      el.title.textContent = '新对话';
      return;
    }
    el.emptyState.hidden = true;
    el.title.textContent = conv.title || '新对话';
    conv.messages.forEach(function (m) {
      el.messages.appendChild(renderMessage(m));
    });
    scrollToBottom();
  }

  function persist(conv) {
    Store.updateConversation(conv.id, function () { return conv; });
  }

  function addMessage(conv, role, content, reasoning) {
    const msg = { id: Store.uuid(), role: role, content: content || '', reasoning: reasoning || '' };
    conv.messages.push(msg);
    return msg;
  }

  // ---- 发送 ----
  function send(text) {
    text = (text || '').trim();
    if (!text || streaming) return;
    const cfg = Store.getConfig();
    if (!cfg.apiKey) {
      toast('请先在设置中填写 API Key');
      window.openSettings && openSettings();
      return;
    }
    if (!cfg.model) {
      toast('请先在设置中填写模型名称');
      window.openSettings && openSettings();
      return;
    }

    let conv = currentConversation();
    if (!conv) conv = newConversation();

    if (!conv.title || conv.title === '新对话') {
      conv.title = text.slice(0, 24) + (text.length > 24 ? '…' : '');
    }

    addMessage(conv, 'user', text);
    const assistantMsg = addMessage(conv, 'assistant', '', '');
    persist(conv);

    renderList();
    renderMessages();

    streaming = true;
    streamingConvId = conv.id;
    streamingMsgId = assistantMsg.id;
    el.hint.textContent = '正在生成…';
    window.setStreamingUI && setStreamingUI(true);

    const messages = conv.messages.slice();
    let accContent = '';
    let accReasoning = '';
    let lastRender = 0;

    abortController = API.streamChat(cfg, messages, {
      onDelta: function (chunk) { accContent += chunk; updateStreamingMessage(); },
      onReasoning: function (chunk) { accReasoning += chunk; updateStreamingMessage(); },
      onDone: function () { finalize(accContent, accReasoning, null); },
      onError: function (err) {
        if (!accContent) accContent = '⚠️ ' + (err && err.message ? err.message : '请求失败');
        finalize(accContent, accReasoning, err);
      },
    });

    function updateStreamingMessage() {
      const now = Date.now();
      if (accContent && now - lastRender < 50) return; // 节流
      const conv2 = Store.getConversation(streamingConvId);
      if (!conv2) return;
      const msg = conv2.messages.find(function (m) { return m.id === streamingMsgId; });
      if (!msg) return;
      msg.content = accContent;
      msg.reasoning = accReasoning;
      updateMessageDOM(msg);
      lastRender = now;
      scrollToBottom();
    }
  }

  function updateMessageDOM(msg) {
    const node = el.messages.querySelector('[data-msg-id="' + msg.id + '"]');
    if (!node || msg.role !== 'assistant') return;

    let content = node.querySelector('.msg-content');
    let thinking = node.querySelector('.msg-thinking');

    if (msg.reasoning) {
      if (!thinking) {
        thinking = document.createElement('details');
        thinking.className = 'msg-thinking';
        const summary = document.createElement('summary');
        summary.textContent = '🧠 思考过程';
        const body = document.createElement('div');
        body.className = 'thinking-body';
        thinking.appendChild(summary);
        thinking.appendChild(body);
        node.insertBefore(thinking, node.firstChild);
      }
      thinking.querySelector('.thinking-body').textContent = msg.reasoning;
    }

    if (!content) {
      content = document.createElement('div');
      content.className = 'msg-content';
      node.appendChild(content);
    }
    content.innerHTML = '';
    content.appendChild(Markdown.render(msg.content));
    if (streaming && msg.id === streamingMsgId) {
      const cur = document.createElement('span');
      cur.className = 'cursor-blink';
      content.appendChild(cur);
    }
  }

  function finalize(content, reasoning, err) {
    const conv = Store.getConversation(streamingConvId);
    if (conv) {
      const msg = conv.messages.find(function (m) { return m.id === streamingMsgId; });
      if (msg) { msg.content = content; msg.reasoning = reasoning; }
      Store.updateConversation(conv.id, function () { return conv; });
    }
    streaming = false;
    streamingConvId = null;
    streamingMsgId = null;
    abortController = null;
    el.hint.textContent = '';
    window.setStreamingUI && setStreamingUI(false);
    renderMessages();
    renderList();
  }

  function stopStreaming() {
    if (abortController) abortController.abort();
  }

  function isStreaming() { return streaming; }

  // ---- 导出 ----
  function conversationToMarkdown(conv) {
    const lines = [];
    lines.push('# ' + (conv.title || '对话'));
    lines.push('_时间: ' + new Date(conv.createdAt).toLocaleString() + '_');
    lines.push('');
    conv.messages.forEach(function (m) {
      if (m.role === 'user') {
        lines.push('## 👤 用户');
        lines.push('');
        lines.push(m.content);
      } else if (m.role === 'assistant') {
        lines.push('## 🤖 助手');
        lines.push('');
        if (m.reasoning) {
          lines.push('<details><summary>思考过程</summary>');
          lines.push('');
          lines.push('```');
          lines.push(m.reasoning);
          lines.push('```');
          lines.push('');
          lines.push('</details>');
          lines.push('');
        }
        lines.push(m.content);
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  function exportConversation(id) {
    const conv = Store.getConversation(id);
    if (!conv) { toast('没有可导出的会话'); return; }
    const md = conversationToMarkdown(conv);
    const filename = (conv.title || '对话').replace(/[\\/:*?"<>|]/g, '_') + '.md';
    saveFile(md, filename);
  }

  function exportAll() {
    const convs = Store.getConversations();
    if (!convs.length) { toast('没有可导出的会话'); return; }
    const parts = convs.map(function (c) { return conversationToMarkdown(c); });
    const md = parts.join('\n\n---\n\n');
    const filename = 'deepseek-agent-导出-' + new Date().toISOString().slice(0, 10) + '.md';
    saveFile(md, filename);
  }

  function saveFile(markdown, filename) {
    const D = window.DSA;
    if (D && D.isNative && D.Filesystem && D.Share) {
      D.Filesystem.writeFile({
        path: filename,
        data: markdown,
        directory: D.Directory.Cache,
        encoding: D.Encoding.UTF8,
      }).then(function (result) {
        return D.Share.share({ title: filename, text: filename, files: [result.uri] });
      }).then(function () {
        toast('已生成导出文件');
      }).catch(function (e) {
        toast('导出失败: ' + (e && e.message ? e.message : '未知错误'));
      });
      return;
    }
    // 浏览器:Blob 下载
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
      toast('已开始下载');
    } catch (e) {
      toast('导出失败: ' + e.message);
    }
  }

  window.Chat = {
    init: init,
    newConversation: newConversation,
    switchConversation: switchConversation,
    deleteConversation: deleteConversation,
    send: send,
    stopStreaming: stopStreaming,
    isStreaming: isStreaming,
    exportConversation: exportConversation,
    exportAll: exportAll,
    renderList: renderList,
  };
})();
