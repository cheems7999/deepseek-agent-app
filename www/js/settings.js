// settings.js — API 设置弹窗
(function () {
  'use strict';

  const el = {
    modal: document.getElementById('settings-modal'),
    backdrop: document.getElementById('settings-backdrop'),
    baseUrl: document.getElementById('set-base-url'),
    apiKey: document.getElementById('set-api-key'),
    model: document.getElementById('set-model'),
    temperature: document.getElementById('set-temperature'),
    tempVal: document.getElementById('temp-val'),
    maxTokens: document.getElementById('set-max-tokens'),
    system: document.getElementById('set-system'),
    testResult: document.getElementById('test-result'),
  };

  function open() {
    const cfg = Store.getConfig();
    el.baseUrl.value = cfg.baseUrl || '';
    el.apiKey.value = cfg.apiKey || '';
    el.model.value = cfg.model || '';
    el.temperature.value = cfg.temperature != null ? cfg.temperature : 0.7;
    el.tempVal.textContent = el.temperature.value;
    el.maxTokens.value = cfg.maxTokens || '';
    el.system.value = cfg.systemPrompt || '';
    el.testResult.hidden = true;
    el.modal.hidden = false;
    el.backdrop.hidden = false;
    el.backdrop.classList.add('show');
  }

  function close() {
    el.modal.hidden = true;
    el.backdrop.hidden = true;
    el.backdrop.classList.remove('show');
  }

  function readForm() {
    return {
      baseUrl: el.baseUrl.value.trim(),
      apiKey: el.apiKey.value.trim(),
      model: el.model.value.trim(),
      temperature: parseFloat(el.temperature.value),
      systemPrompt: el.system.value,
      maxTokens: parseInt(el.maxTokens.value, 10) || 0,
    };
  }

  function save() {
    const cfg = readForm();
    if (!cfg.baseUrl) { toast('Base URL 不能为空'); return; }
    if (!cfg.apiKey) { toast('API Key 不能为空'); return; }
    if (!cfg.model) { toast('模型名称不能为空'); return; }
    Store.saveConfig(cfg);
    close();
    toast('设置已保存');
  }

  function test() {
    const cfg = readForm();
    el.testResult.hidden = false;
    el.testResult.className = 'test-result';
    el.testResult.textContent = '正在测试连接…';
    API.testConnection(cfg).then(function () {
      el.testResult.className = 'test-result ok';
      el.testResult.textContent = '✅ 连接成功,配置可用';
    }).catch(function (e) {
      el.testResult.className = 'test-result err';
      el.testResult.textContent = '❌ ' + (e && e.message ? e.message : '连接失败');
    });
  }

  function bind() {
    document.getElementById('btn-close-settings').addEventListener('click', close);
    document.getElementById('btn-save-settings').addEventListener('click', save);
    document.getElementById('btn-test').addEventListener('click', test);
    el.backdrop.addEventListener('click', close);

    el.temperature.addEventListener('input', function () {
      el.tempVal.textContent = el.temperature.value;
    });

    document.getElementById('btn-toggle-key').addEventListener('click', function () {
      const isPass = el.apiKey.type === 'password';
      el.apiKey.type = isPass ? 'text' : 'password';
      this.textContent = isPass ? '🙈 隐藏' : '👁 显示';
    });

    // 预设 base URL
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const p = btn.dataset.preset;
        if (p === 'deepseek') el.baseUrl.value = 'https://api.deepseek.com';
        else if (p === 'deepseek-v1') el.baseUrl.value = 'https://api.deepseek.com/v1';
      });
    });

    // 预设模型
    document.querySelectorAll('[data-model]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.model.value = btn.dataset.model;
      });
    });
  }

  window.Settings = { open: open, close: close, bind: bind };
  window.openSettings = open;
})();
