// voice.js — 语音输入:浏览器用 Web Speech API,APK 用原生插件
(function () {
  'use strict';

  function webSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  function nativeSupported() {
    return !!(window.DSA && window.DSA.isNative && window.DSA.SpeechRecognition);
  }

  /**
   * 返回 'native' | 'web' | null
   */
  function detect() {
    if (nativeSupported()) return 'native';
    if (webSupported()) return 'web';
    return null;
  }

  let currentHandle = null; // { stop() }

  function stop() {
    if (currentHandle && currentHandle.stop) {
      try { currentHandle.stop(); } catch (e) {}
    }
    currentHandle = null;
  }

  /**
   * 开始语音输入
   * opts: { onPartial(text), onResult(text), onError(msg), onEnd() }
   * 返回 handle { stop() }
   */
  async function start(opts) {
    stop();
    opts = opts || {};
    const kind = detect();

    if (kind === 'web') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      let finalText = '';
      rec.onresult = function (e) {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        const combined = finalText + interim;
        opts.onPartial && opts.onPartial(combined);
        if (finalText) opts.onResult && opts.onResult(finalText);
      };
      rec.onerror = function (e) {
        let msg = '语音识别出错';
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') msg = '麦克风权限被拒绝';
        else if (e.error === 'no-speech') msg = '没有检测到语音';
        else if (e.error === 'network') msg = '语音服务网络错误';
        else if (e.error) msg = '语音识别错误: ' + e.error;
        opts.onError && opts.onError(msg);
      };
      rec.onend = function () { currentHandle = null; opts.onEnd && opts.onEnd(); };
      try { rec.start(); } catch (e) { opts.onError && opts.onError('无法启动语音: ' + e.message); return null; }
      currentHandle = { stop: function () { try { rec.stop(); } catch (e) {} } };
      return currentHandle;
    }

    if (kind === 'native') {
      const SR = window.DSA.SpeechRecognition;
      try {
        const avail = await SR.available();
        if (!avail || !avail.available) { opts.onError && opts.onError('当前设备不支持语音识别'); return null; }
        try { await SR.requestPermissions(); } catch (e) {}
        let handle = null;
        handle = await SR.addListener('partialResults', function (data) {
          const text = (data && data.matches && data.matches[0]) || '';
          if (text) opts.onPartial && opts.onPartial(text);
        });
        await SR.start({ language: 'zh-CN', maxResults: 5, partialResults: true, popup: false });
        currentHandle = {
          stop: async function () {
            try { await SR.stop(); } catch (e) {}
            try { if (handle && handle.remove) await handle.remove(); } catch (e) {}
            currentHandle = null;
            opts.onEnd && opts.onEnd();
          },
        };
        return currentHandle;
      } catch (e) {
        opts.onError && opts.onError('语音启动失败: ' + e.message);
        return null;
      }
    }

    opts.onError && opts.onError('语音输入不可用');
    return null;
  }

  window.Voice = {
    detect: detect,
    start: start,
    stop: stop,
  };
})();
