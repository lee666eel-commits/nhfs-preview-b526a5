// ponytail: 静态站门帘，挡一般访客，不是真门锁（源码公开）；要真锁改走 Cloudflare Access
(function () {
  var H = '37aacb7ec9eb87ab8535c938c5190266d81e1a97bb452c0cc34cfc9517b15550', K = 'nhfs-preview-ok';
  try { if (sessionStorage.getItem(K) === H) return badge(); } catch (e) {}
  var root = document.documentElement;
  root.style.visibility = 'hidden';
  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.id = 'nhfs-gate';
    box.innerHTML =
      '<style>#nhfs-gate{position:fixed;inset:0;z-index:2147483647;visibility:visible;background:#0E1A14;color:#F4F1EA;display:flex;align-items:center;justify-content:center;padding:16px;font:16px/1.7 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}' +
      '#nhfs-gate .c{max-width:440px;width:100%}#nhfs-gate h1{font-size:20px;margin:0 0 12px}#nhfs-gate p{margin:0 0 10px;font-size:15px;opacity:.9}' +
      '#nhfs-gate form{display:flex;gap:8px;margin-top:18px}#nhfs-gate input{flex:1;min-width:0;padding:12px;font-size:16px;border-radius:8px;border:1px solid #6b7d72;background:#13241b;color:#F4F1EA}' +
      '#nhfs-gate button{padding:12px 18px;font-size:16px;border:0;border-radius:8px;background:#2E7D4F;color:#fff;cursor:pointer}#nhfs-gate .e{color:#ffb4a8;min-height:1.7em;font-size:14px}</style>' +
      '<div class="c"><h1>南华独中新官网 · 改版预览</h1>' +
      '<p>本页面为<b>短期展示用的预览版</b>，内容与版面尚未定稿，<b>并非南华独立中学正式网站</b>，不代表学校正式立场。</p>' +
      '<p>请勿转发链接、截图外传或引用其中内容。展示结束后本网址将随即下架。</p>' +
      '<form><input type="password" placeholder="请输入邀请码" autocomplete="off" aria-label="邀请码"><button>进入</button></form><div class="e" role="alert"></div></div>';
    document.body.appendChild(box);
    var f = box.querySelector('form'), inp = box.querySelector('input'), err = box.querySelector('.e');
    inp.focus();
    f.onsubmit = function (ev) {
      ev.preventDefault();
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(inp.value.trim())).then(function (b) {
        var h = Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
        if (h !== H) { err.textContent = '邀请码不正确'; inp.select(); return; }
        try { sessionStorage.setItem(K, H); } catch (e) {}
        box.remove(); root.style.visibility = ''; badge();
      });
    };
  });
  function badge() {
    document.addEventListener('DOMContentLoaded', add); if (document.body) add();
    function add() {
      if (document.getElementById('nhfs-badge')) return;
      var b = document.createElement('div'); b.id = 'nhfs-badge'; b.textContent = '预览版 · 非正式网站';
      b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483646;background:rgba(14,26,20,.82);color:#fff;font:12px/1 system-ui,sans-serif;padding:6px 9px;border-radius:6px;pointer-events:none';
      document.body.appendChild(b);
    }
  }
})();
