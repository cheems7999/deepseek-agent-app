// markdown.js — Markdown 渲染 + 代码高亮 + 复制按钮
(function () {
  'use strict';

  // 全局配置:换行转 <br>,GFM 表格等
  if (window.marked && marked.setOptions) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  function copyText(text, btn) {
    const done = function (ok) {
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = ok ? '✓ 已复制' : '失败';
        setTimeout(function () { btn.textContent = orig; }, 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      // 降级:execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
  }

  /**
   * 渲染 markdown 文本,返回带 .markdown 类的 DOM 元素
   */
  function renderMarkdown(text) {
    const src = text == null ? '' : String(text);
    const div = document.createElement('div');
    div.className = 'markdown';
    if (!window.marked) {
      div.textContent = src;
      return div;
    }
    let html = '';
    try {
      html = marked.parse(src);
    } catch (e) {
      html = '';
      div.textContent = src;
      return div;
    }
    div.innerHTML = html;

    // 代码高亮
    if (window.hljs) {
      div.querySelectorAll('pre code').forEach(function (code) {
        try { hljs.highlightElement(code); } catch (e) {}
      });
    }

    // 复制按钮
    div.querySelectorAll('pre').forEach(function (pre) {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '复制';
      btn.addEventListener('click', function () {
        const code = pre.querySelector('code');
        copyText(code ? code.innerText : pre.innerText, btn);
      });
      pre.appendChild(btn);
    });

    return div;
  }

  window.Markdown = {
    render: renderMarkdown,
    copyText: copyText,
  };
})();
