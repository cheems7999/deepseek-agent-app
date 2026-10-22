// api.js — 通用 OpenAI 兼容接口:流式请求 + 连接测试
(function () {
  'use strict';

  function normalizeBaseUrl(u) {
    u = (u || '').trim().replace(/\/+$/, '');
    if (!u) throw new Error('Base URL 不能为空');
    return u;
  }

  function chatCompletionsUrl(baseUrl) {
    return normalizeBaseUrl(baseUrl) + '/chat/completions';
  }

  function buildMessages(config, history) {
    const msgs = [];
    if (config.systemPrompt && String(config.systemPrompt).trim()) {
      msgs.push({ role: 'system', content: config.systemPrompt });
    }
    // 只传 user/assistant,过滤掉空内容与思考过程(思考不进上下文)
    history.forEach(function (m) {
      if (m.role === 'user' || m.role === 'assistant') {
        if (m.content && String(m.content).trim()) {
          msgs.push({ role: m.role, content: m.content });
        }
      }
    });
    if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'user') {
      // 保证最后一条是 user;否则补一个空 user
      msgs.push({ role: 'user', content: '' });
    }
    return msgs;
  }

  function buildBody(config, history, stream) {
    const body = {
      model: config.model,
      messages: buildMessages(config, history),
      stream: !!stream,
    };
    const temp = parseFloat(config.temperature);
    if (!isNaN(temp)) body.temperature = temp;
    const mt = parseInt(config.maxTokens, 10);
    if (!isNaN(mt) && mt > 0) body.max_tokens = mt;
    return body;
  }

  /**
   * 流式对话
   * handlers: { onDelta(text), onReasoning(text), onDone(), onError(err) }
   * 返回 AbortController
   */
  function streamChat(config, history, handlers, signal) {
    const controller = new AbortController();
    const abort = signal || controller.signal;
    const url = chatCompletionsUrl(config.baseUrl);

    (async function () {
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (config.apiKey || ''),
          },
          body: JSON.stringify(buildBody(config, history, true)),
          signal: abort,
        });
      } catch (err) {
        if (err && err.name === 'AbortError') { handlers.onDone && handlers.onDone(); return; }
        handlers.onError && handlers.onError(new Error('网络请求失败: ' + err.message));
        return;
      }

      if (!resp.ok) {
        let detail = '';
        try { detail = (await resp.text()).slice(0, 600); } catch (e) {}
        handlers.onError && handlers.onError(new Error('HTTP ' + resp.status + (detail ? ': ' + detail : '')));
        return;
      }

      if (!resp.body || !resp.body.getReader) {
        // 某些实现不支持流式响应体,退回整段读取
        try {
          const data = await resp.json();
          const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (content) handlers.onDelta && handlers.onDelta(content);
          handlers.onDone && handlers.onDone();
        } catch (e) {
          handlers.onError && handlers.onError(new Error('解析响应失败: ' + e.message));
        }
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      function processLine(line) {
        line = line.trim();
        if (!line.startsWith('data:')) return;
        let data = line.slice(5).trim();
        if (data === '[DONE]') { handlers.onDone && handlers.onDone(); return true; }
        try {
          const json = JSON.parse(data);
          const choice = json.choices && json.choices[0];
          const delta = choice && choice.delta;
          if (delta) {
            if (delta.reasoning_content != null) handlers.onReasoning && handlers.onReasoning(delta.reasoning_content);
            if (delta.content != null) handlers.onDelta && handlers.onDelta(delta.content);
          }
        } catch (e) { /* 忽略无法解析的片段 */ }
        return false;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (processLine(line)) return; // [DONE]
          }
        }
        if (buffer.trim()) processLine(buffer);
        handlers.onDone && handlers.onDone();
      } catch (err) {
        if (err && err.name === 'AbortError') { handlers.onDone && handlers.onDone(); return; }
        handlers.onError && handlers.onError(new Error('读取流失败: ' + err.message));
      }
    })();

    return controller;
  }

  /**
   * 测试连接:发送一条最小请求验证 key/url/model
   */
  async function testConnection(config) {
    const url = chatCompletionsUrl(config.baseUrl);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (config.apiKey || ''),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.text()).slice(0, 600); } catch (e) {}
      throw new Error('HTTP ' + resp.status + (detail ? ': ' + detail : ''));
    }
    const data = await resp.json();
    return data;
  }

  window.API = {
    streamChat: streamChat,
    testConnection: testConnection,
    normalizeBaseUrl: normalizeBaseUrl,
  };
})();
