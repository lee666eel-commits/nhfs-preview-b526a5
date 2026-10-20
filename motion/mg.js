/* 南华 · 迎领之路 —— 动态图形
   一切画面都由 render(t) 依时间 t（秒）算出：同一份代码供滚动播放、自动播放、逐帧导出 MP4。
   没有 CSS transition/animation，随机数用固定种子，所以任何一帧都可以精确重现。
   幕次：壹 光（1936）→ 贰 降落校园 → 叁 学生是主体 → 肆 走进南华 → 伍 灯塔与四种力量 → 陆 领导力年轮 → 柒 迎领（天亮） */
(function () {
  'use strict';
  var T = 33;                                   // 总长（秒）
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, x)); };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var out3 = function (k) { return 1 - Math.pow(1 - k, 3); };
  var out5 = function (k) { return 1 - Math.pow(1 - k, 5); };
  var in3 = function (k) { return k * k * k; };
  var io3 = function (k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  var back = function (k) { var c = 1.6, d = c + 1; return 1 + d * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  // 阻尼弹簧：dt 秒后从 0 走向 1（会略微冲过头再回来）
  var spring = function (dt, f, z) {
    if (dt <= 0) return 0; f = f || 2; z = z || .38;
    var w = 2 * Math.PI * f;
    return 1 - Math.exp(-z * w * dt) * Math.cos(w * Math.sqrt(1 - z * z) * dt);
  };
  var rng = function (s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  var CHAR = {   // 立绘原尺寸与颈部切线（与 _build/prep.py 一致）；eyes＝眼睑框 [x0,y0,x1,y1]（立绘像素）
    girl: { w: 482, h: 1384, neck: 346, px: .44, skin: '#F7C095', eyes: [[99, 199, 151, 263], [207, 197, 274, 260]], ph: 0 },
    boy: { w: 432, h: 1349, neck: 344, px: .5, skin: '#EFC49D', eyes: [[111, 190, 163, 252], [224, 188, 266, 253]], ph: 1.3 }
  };
  // 眨眼：约每 3.4 秒一次，偶尔连眨两下（确定性）
  function blink(t, ph) {
    var c = (t + ph) % 3.4, pulse = function (x) { return x > 0 && x < .16 ? Math.sin(x / .16 * Math.PI) : 0; };
    var b = pulse(c - 2.9); if (Math.floor((t + ph) / 3.4) % 3 === 1) b = Math.max(b, pulse(c - 3.12));
    return b;
  }
  // 吉祥物出场表：[起点秒, 在场者]（g 女 / b 男）。两人同框只在「学生是主体」(叁) 与终章报名 (柒) 之前
  var CAST = [[0, 'g'], [5, 'b'], [8.7, 'gb'], [13.4, 'g'], [18.2, 'b'], [24.5, 'g'], [28.8, 'gb']];
  var LABELS = [['学生', '主体'], ['教师', '引路人'], ['家长', '港湾'], ['学校', '灯塔']];
  var RINGS = ['个人', '团队', '社区', '社会与家国', '民族与文化'];
  var CARDS = [['stone', '南华独中'], ['pool', '校园泳池'], ['block', '校舍'], ['arch', '牌楼']];

  function chars(s, cls) { return s.split('').map(function (c) { return '<span class="ch' + (cls ? ' ' + cls : '') + '">' + (c === ' ' ? '&nbsp;' : c) + '</span>'; }).join(''); }

  function create(root, opt) {
    opt = opt || {};
    var A = opt.base || '';
    var crest = opt.crest || (A + '../assets/img/crest-color.png');
    root.classList.add('mg');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', '动态图形：南华独中，一九三六年创校。学生是主体；教师是引路人，家长是港湾，学校是灯塔；领导力由个人、团队、社区、社会与家国到民族与文化，一圈一圈长出来；根系本土，枝繁叶茂。迎领每一个孩子。');
    root.innerHTML =
      '<canvas data-k="back"></canvas>' +
      '<div class="photo" data-k="aerial"><img alt="" src="' + A + 'assets/aerial.webp"></div>' +
      '<div class="photo" data-k="front"><img alt="" src="' + A + 'assets/front.webp"></div>' +
      '<div class="scrim" data-k="scrim"></div><div class="night" data-k="night"></div>' +
      '<div class="L planet" data-k="planet"><img alt="" src="' + A + 'assets/planet.webp"></div>' +
      '<div class="full flash" data-k="flash"></div><div class="L beam" data-k="beam"></div><div class="L core" data-k="core"></div>' +
      '<svg class="rings" data-k="svg"></svg>' +
      CARDS.map(function (c, i) { return '<div class="card" data-k="card' + i + '"><img alt="" src="' + A + 'assets/' + c[0] + '.webp"><b>' + c[1] + '</b></div>'; }).join('') +
      LABELS.map(function (l, i) { return '<div class="lab" data-k="lab' + i + '"><b>' + l[0] + '</b><i>' + l[1] + '</i></div>'; }).join('') +
      RINGS.map(function (r, i) { return '<div class="rlab" data-k="rl' + i + '">' + r + '</div>'; }).join('') +
      // 壹
      '<div class="t vcol big" data-k="s1a" style="color:var(--gold)">' + chars('一九三六') + '</div>' +
      '<div class="t vcol sub" data-k="s1b">' + chars('曼绒先贤点燃华教灯火') + '</div>' +
      '<div class="t latin" data-k="s1c">Nan Hwa High School · Manjung, Perak</div>' +
      '<div class="t latin" data-k="s2a">Lot 2446, Kg. Sungai Wangi · Ayer Tawar</div>' +
      // 叁
      '<div class="t big shadow" data-k="s3h">' + chars('学生是主体') + '</div>' +
      '<div class="t sub shadow" data-k="s3s">学生的未来，是我们的目标，<br>也是我们的承诺。</div>' +
      // 肆
      '<div class="t big shadow" data-k="s4h">' + chars('一步一步，走进南华') + '</div>' +
      // 伍
      '<div class="t big" data-k="s5h">' + chars('四种力量，与孩子同行') + '</div>' +
      '<div class="t big" data-k="s5x">' + chars('学校是灯塔，是指引，也是「迎领」') + '</div>' +
      // 陆
      '<div class="t big" data-k="s6h">' + chars('领导力，像年轮') + '<br>' + chars('一圈一圈长出来') + '</div>' +
      '<div class="t big" data-k="s6x" style="color:var(--gold)">' + chars('根系本土，枝繁叶茂') + '</div>' +
      '<div class="t sub" data-k="s6y">学子福泽，众生繁盛</div>' +
      '<canvas data-k="front2"></canvas>' +
      '<div class="shade" data-k="shg"></div><div class="shade" data-k="shb"></div>' +
      ['girl', 'boy'].map(function (n) {
        return '<div class="char" data-k="' + n + '"><img class="body" alt="" src="' + A + 'assets/' + n + '-body.webp"><div class="head"><img alt="" src="' + A + 'assets/' + n + '-head.webp"><i class="lid"></i><i class="lid"></i></div></div>';
      }).join('') +
      // 柒（纸面）
      '<img class="crest" data-k="crest" alt="" src="' + crest + '">' +
      '<div class="t big" data-k="s7h" style="color:#17201B">' + chars('南华独立中学') + '</div>' +
      '<div class="t latin" data-k="s7l" style="color:#7A7263">Nan Hwa High School · Since 1936</div>' +
      '<div class="t big" data-k="s7x" style="color:var(--zhu)">' + chars('迎领每一个孩子') + '</div>' +
      '<div class="cta" data-k="cta"><a class="p" href="https://nanhwa.eschool.edu.my/newreg/" target="_blank" rel="noopener">线上报名</a>' +
      '<a class="q" href="https://wa.me/601164646267" target="_blank" rel="noopener">WhatsApp +60 11-6464 6267</a></div>' +
      '<div class="seal" data-k="seal">南华迎领</div>';

    var $ = {};
    root.querySelectorAll('[data-k]').forEach(function (el) { $[el.dataset.k] = el; });
    var cb = $.back.getContext('2d'), cf = $.front2.getContext('2d');
    var L = {}, size = {};
    var R = rng(1936), dust = [];
    for (var i = 0; i < 80; i++) dust.push({ x: R(), y: R(), vx: (R() - .5) * .006, vy: .004 + R() * .012, r: .5 + R() * 1.7, a: .25 + R() * .5, ph: R() * 6.28, f: .6 + R() * 1.4 });
    var blobPh = [R() * 6, R() * 6, R() * 6];
    var splat = []; for (i = 0; i < 14; i++) splat.push({ a: R() * 6.28, d: .25 + R() * .5, r: .006 + R() * .02, t: .15 + R() * .9 });

    // 枝条：从角色身后向上分叉（固定种子）
    function branches(x, y, ang, len, depth, out, r) {
      var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      var bend = (r() - .5) * len * .5;
      out.push({ d: 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' Q' + ((x + x2) / 2 + bend).toFixed(1) + ' ' + ((y + y2) / 2 - bend * .3).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1), depth: depth, x: x2, y: y2, len: len });
      if (depth >= 5) return;
      var n = depth < 2 ? 2 : (r() < .7 ? 2 : 3);
      for (var k = 0; k < n; k++) branches(x2, y2, ang + (k - (n - 1) / 2) * (.42 + r() * .25) + (r() - .5) * .2, len * (.68 + r() * .12), depth + 1, out, r);
    }

    function measure(el) { return { w: el.offsetWidth, h: el.offsetHeight }; }
    // 以锚点 (ax, ay) 放置元素；s 缩放，r 旋转（度），o 透明度
    function pos(el, x, y, s, r, o, ax, ay) {
      var m = size[el.dataset.k] || measure(el);
      ax = ax === undefined ? .5 : ax; ay = ay === undefined ? .5 : ay;
      el.style.transformOrigin = (m.w * ax) + 'px ' + (m.h * ay) + 'px';
      el.style.transform = 'translate(' + (x - m.w * ax).toFixed(2) + 'px,' + (y - m.h * ay).toFixed(2) + 'px) rotate(' + (r || 0).toFixed(3) + 'deg) scale(' + (s === undefined ? 1 : s).toFixed(4) + ')';
      el.style.opacity = o === undefined ? 1 : clamp(o);
    }
    // 逐字入场：每个字依次从下方弹起
    function kinetic(el, t, t0, stagger, dist) {
      var cs = el.children, on = 0;
      for (var k = 0; k < cs.length; k++) {
        var p = spring(t - t0 - k * stagger, 1.6, .5);
        cs[k].style.transform = 'translateY(' + ((1 - p) * dist).toFixed(2) + 'px)';
        cs[k].style.opacity = clamp((t - t0 - k * stagger) / .25);
        if (t > t0 + k * stagger) on++;
      }
      return on;
    }
    function fontPx(el, px) { el.style.fontSize = px + 'px'; }

    function layout() {
      var W = root.clientWidth, H = root.clientHeight;
      if (!W || !H) return;
      var dpr = Math.min(window.devicePixelRatio || 1, opt.dpr || 2);
      [$.back, $.front2].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      cb.setTransform(dpr, 0, 0, dpr, 0, 0); cf.setTransform(dpr, 0, 0, dpr, 0, 0);
      var P = H > W * 1.05, u = Math.min(W, H) / 100;
      root.style.setProperty('--u', u + 'px');
      L = { W: W, H: H, P: P, u: u, diag: Math.hypot(W, H) };
      L.D1 = P ? W * .8 : H * .66;
      L.pc = P ? [W / 2, H * .38] : [W / 2, H * .5];
      L.Hc = P ? Math.min(H * .4, W * 1.05) : H * .52;   // 年轮/枝条的尺度
      L.Hm = P ? H * .2 : H * .28;                          // 吉祥物身高：全片固定，小于画面三分之一
      L.gy = H * .965;
      L.src = P ? [W / 2, H * .5] : [W / 2, H * .4];
      // 字号
      fontPx($.s1a, u * (P ? 11 : 9)); fontPx($.s1b, u * (P ? 3.4 : 2.6)); fontPx($.s1c, u * (P ? 3.6 : 2.6)); fontPx($.s2a, u * (P ? 3.4 : 2.4));
      fontPx($.s3h, u * (P ? 13 : 10)); fontPx($.s3s, u * (P ? 3.8 : 2.8));
      fontPx($.s4h, u * (P ? 8 : 6.4));
      fontPx($.s5h, u * (P ? 6.4 : 5.2)); fontPx($.s5x, u * (P ? 5 : 4.8));
      fontPx($.s6h, u * (P ? 5.6 : 5.4)); fontPx($.s6x, u * (P ? 8.6 : 7.6)); fontPx($.s6y, u * (P ? 3.6 : 3));
      fontPx($.s7h, u * (P ? 13 : 9.6)); fontPx($.s7l, u * (P ? 3.8 : 2.8)); fontPx($.s7x, u * (P ? 6.4 : 4.4));
      fontPx($.seal, u * (P ? 3.4 : 2.4)); $.seal.style.height = '2.3em'; $.seal.style.width = '2.3em'; $.seal.style.padding = '.12em .1em';
      $.s3s.style.whiteSpace = 'nowrap';
      $.cta.style.width = P ? (W * .9) + 'px' : 'auto'; $.cta.style.fontSize = (u * (P ? 2.3 : 1.4)) + 'px';
      if (P) { fontPx($.s5x, u * 5); }
      $.s5x.style.whiteSpace = P ? 'normal' : 'nowrap'; $.s5x.style.width = P ? (W * .86) + 'px' : 'auto'; $.s5x.style.textAlign = 'center';
      $.s6h.style.whiteSpace = P ? 'normal' : 'nowrap'; $.s6h.style.width = P ? (W * .8) + 'px' : 'auto'; $.s6h.style.textAlign = P ? 'center' : 'left';
      // 卡片
      var cw = P ? W * .62 : W * .25;
      CARDS.forEach(function (c, i) { var el = $['card' + i]; el.style.width = cw + 'px'; el.style.height = (cw * .75 + u * 2.6) + 'px'; });
      // 角色
      ['girl', 'boy'].forEach(function (n) {
        var c = CHAR[n], el = $[n], w = L.Hm * c.w / c.h;
        el.style.width = w + 'px'; el.style.height = L.Hm + 'px';
        el.style.setProperty('--px', (c.px * 100) + '%'); el.style.setProperty('--py', (L.Hm * c.neck / c.h) + 'px');
        size[n] = { w: w, h: L.Hm };
        var kx = w / c.w, lids = el.querySelectorAll('.lid');
        c.eyes.forEach(function (e, i) { var s = lids[i].style; s.left = e[0] * kx + 'px'; s.top = e[1] * kx + 'px'; s.width = (e[2] - e[0]) * kx + 'px'; s.height = (e[3] - e[1]) * kx + 'px'; s.background = c.skin; s.boxShadow = '0 0 ' + (3 * kx) + 'px ' + (2 * kx) + 'px ' + c.skin; s.setProperty('--lw', Math.max(1.5, 5 * kx) + 'px'); });
      });
      $.crest.style.height = (P ? H * .09 : H * .19) + 'px'; $.crest.style.width = 'auto';
      // 年轮与枝条（SVG 用像素坐标）
      var cy = L.gy - L.Hc * .55, r0 = L.Hc * .62, r5 = Math.max(r0 * 1.6, cy - H * (P ? .1 : .07));
      L.rc = [W / 2, cy]; L.rr = RINGS.map(function (_, k) { return r0 + (r5 - r0) * k / 4; });
      var svg = '<g data-g="br"></g>' + L.rr.map(function (r, k) {
        var C = 2 * Math.PI * r;
        return '<circle data-c="' + k + '" cx="' + (W / 2) + '" cy="' + cy + '" r="' + r + '" transform="rotate(-90 ' + (W / 2) + ' ' + cy + ')" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" stroke-width="' + (u * (.34 - k * .04)) + '"/>';
      }).join('') +
        '<path data-g="ground" d="M' + (W / 2) + ' ' + L.gy + ' L' + (-W * .05) + ' ' + L.gy + ' M' + (W / 2) + ' ' + L.gy + ' L' + (W * 1.05) + ' ' + L.gy + '" stroke-width="' + (u * .22) + '"/>';
      $.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      $.svg.innerHTML = svg;
      var br = [], r = rng(90);
      [-.62, -.32, 0, .32, .62].forEach(function (d) { branches(W / 2 + d * L.Hc * .25, cy - L.Hc * .05, -Math.PI / 2 + d * 1.3, L.Hc * (P ? .2 : .26), 0, br, r); });
      L.br = br;
      $.svg.querySelector('[data-g="br"]').innerHTML = br.map(function (b, k) {
        return '<path data-b="' + k + '" d="' + b.d + '" stroke-width="' + Math.max(.6, u * (.32 - b.depth * .05)) + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>' +
          (b.depth === 5 ? '<circle data-l="' + k + '" cx="' + b.x.toFixed(1) + '" cy="' + b.y.toFixed(1) + '" r="' + (u * .45) + '" style="fill:#E3B24F;stroke:none" opacity="0"/>' : '');
      }).join('');
      $.ground = $.svg.querySelector('[data-g="ground"]');
      var gl = W * 1.1; $.ground.setAttribute('stroke-dasharray', gl); $.ground.setAttribute('stroke-dashoffset', gl / 2 + W * .05);
      L.gl = gl;
      // 量尺寸（字号定了才量）
      root.querySelectorAll('.t,.lab,.rlab,.card,.cta,.seal,.crest').forEach(function (el) { size[el.dataset.k] = measure(el); });
      if (lastT !== null) render(lastT);
    }

    function inkBlob(ctx, x, y, R, t, wob) {
      ctx.beginPath();
      for (var k = 0; k <= 160; k++) {
        var a = k / 160 * Math.PI * 2;
        var rr = R * (1 + wob * (.035 * Math.sin(5 * a + blobPh[0] + t * 1.3) + .022 * Math.sin(11 * a + blobPh[1] - t * 2.1) + .012 * Math.sin(23 * a + blobPh[2])));
        k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }

    var lastT = null;
    function render(t) {
      lastT = t;
      if (!L.W) return;
      var W = L.W, H = L.H, P = L.P, u = L.u, k, i, p;

      /* ---------- 背景画布：纸 → 墨晕开成夜 ---------- */
      cb.clearRect(0, 0, W, H);
      var ink = out3(seg(t, .25, 2.4));
      if (ink < 1) {
        cb.fillStyle = '#F4EFE4'; cb.fillRect(0, 0, W, H);
        cb.fillStyle = '#0E1A14';
        var drop = out5(seg(t, 0, .3));
        if (drop > 0) inkBlob(cb, L.pc[0], L.pc[1], u * 1.2 * drop + ink * L.diag * 1.02, t, 1 + ink * 2);
        splat.forEach(function (s) { var q = out3(seg(t, s.t, s.t + .4)); if (q > 0) { cb.beginPath(); cb.arc(L.pc[0] + Math.cos(s.a) * s.d * L.diag * .35, L.pc[1] + Math.sin(s.a) * s.d * L.diag * .35, s.r * L.diag * q, 0, 7); cb.fill(); } });
      } else { cb.fillStyle = '#0E1A14'; cb.fillRect(0, 0, W, H); }

      /* ---------- 壹 · 1936 · 小行星 ---------- */
      var pin = seg(t, 1.0, 2.6), dive = seg(t, 5.2, 7.0);
      var pd = L.D1 * lerp(.42, 1, back(pin)) * lerp(1, 9, in3(dive));
      var prot = lerp(-60, 0, out3(pin)) + t * 5 + 140 * in3(dive);
      $.planet.style.transform = 'translate(' + (L.pc[0] - 500) + 'px,' + (L.pc[1] - 500) + 'px) rotate(' + prot.toFixed(2) + 'deg) scale(' + (pd / 1000).toFixed(4) + ')';
      $.planet.style.opacity = clamp(seg(t, 1.0, 1.6)) * (1 - seg(t, 6.3, 7.0));

      var s1out = 1 - seg(t, 4.6, 5.3);
      var wa = size.s1a ? size.s1a.w : 0, wb = size.s1b ? size.s1b.w : 0;
      var colBX = P ? W / 2 - u * 6 : L.pc[0] + L.D1 * .56 + u * 4 + wb / 2;
      var colX = colBX + wb / 2 + u * 2.4 + wa / 2, colY = P ? H * .74 : L.pc[1];
      var n1 = $.s1a.children;
      for (k = 0; k < n1.length; k++) { p = out3(seg(t, 1.9 + k * .16, 2.5 + k * .16)); n1[k].style.opacity = p; n1[k].style.transform = 'translateY(' + ((1 - p) * -u * 2) + 'px)'; }
      pos($.s1a, colX, colY, 1, 0, s1out);
      var n2 = $.s1b.children;
      for (k = 0; k < n2.length; k++) { n2[k].style.opacity = seg(t, 2.6 + k * .07, 2.9 + k * .07); }
      pos($.s1b, colBX, colY + u * 2, 1, 0, s1out);
      pos($.s1c, W / 2, P ? H * .95 : H * .9, 1, 0, seg(t, 3.2, 3.9) * s1out);
      // 印章：落下压印
      var st = seg(t, 3.6, 3.9), stamp = t < 3.6 ? 0 : (t < 3.9 ? lerp(2.4, .92, in3(st)) : lerp(.92, 1, out3(seg(t, 3.9, 4.15))));
      var sealOut = t < 20 ? s1out : 0;
      var sy = colY + (size.s1a ? size.s1a.h * .5 : 0) + u * 3.2;
      if (t < 20) pos($.seal, colX, sy, stamp || .001, -4, clamp(st * 3) * sealOut);

      /* ---------- 贰 · 降落：小行星 → 鸟瞰 → 校门 ---------- */
      var aIn = seg(t, 6.0, 7.0), aTilt = io3(seg(t, 7.6, 8.9));
      $.aerial.style.opacity = aIn * (1 - seg(t, 8.3, 8.9));
      $.aerial.firstChild.style.transform = 'translate(-50%,-50%) perspective(1600px) rotateX(' + (aTilt * 58).toFixed(2) + 'deg) translateY(' + (aTilt * -18) + '%) scale(' + (lerp(2.6, 1.12, out3(seg(t, 6.0, 7.8))) + aTilt * .5).toFixed(4) + ') rotate(' + (lerp(30, 0, out3(seg(t, 6.0, 7.8)))).toFixed(2) + 'deg)';
      var fl = t < 6.55 ? out3(seg(t, 5.9, 6.55)) : 1 - out3(seg(t, 6.55, 7.5));
      $.flash.style.opacity = fl;
      pos($.s2a, W / 2, P ? H * .9 : H * .88, 1, 0, seg(t, 6.6, 7.1) * (1 - seg(t, 8.0, 8.5)));
      var fIn = seg(t, 8.2, 9.0);
      var pan = io3(seg(t, 13.4, 18.4));
      $.front.style.opacity = fIn * (1 - seg(t, 18.0, 19.0));
      $.front.firstChild.style.transform = 'translate(-50%,-50%) scale(' + (lerp(1.3, 1.16, out3(seg(t, 8.2, 12))) + pan * .06).toFixed(4) + ') translateX(' + (pan * -5) + '%)';
      $.scrim.style.opacity = seg(t, 8.6, 9.6) * (1 - seg(t, 18.0, 19.0));
      $.night.style.opacity = seg(t, 17.4, 19.0) * (1 - seg(t, 28.6, 28.8));

      /* ---------- 叁 · 学生是主体 ---------- */
      var s3out = seg(t, 12.9, 13.5);
      var lx = W * .07;
      if (P) {
        kinetic($.s3h, t, 9.6, .09, u * 6); pos($.s3h, W / 2, H * .16 - s3out * u * 4, 1, 0, 1 - s3out);
        pos($.s3s, W / 2, H * .25, 1, 0, seg(t, 10.7, 11.4) * (1 - s3out)); $.s3s.style.textAlign = 'center';
      } else {
        kinetic($.s3h, t, 9.6, .09, u * 6); pos($.s3h, lx, H * .37 - s3out * u * 4, 1, 0, 1 - s3out, 0, .5);
        pos($.s3s, lx, H * .52 + (1 - out3(seg(t, 10.7, 11.5))) * u * 2, 1, 0, seg(t, 10.7, 11.4) * (1 - s3out), 0, .5);
      }

      /* ---------- 肆 · 走进南华 ---------- */
      var s4out = seg(t, 17.6, 18.2);
      if (P) {
        kinetic($.s4h, t, 13.8, .06, u * 5); pos($.s4h, W / 2, H * .15, 1, 0, 1 - s4out);
      } else {
        kinetic($.s4h, t, 13.8, .06, u * 5); pos($.s4h, lx, H * .2, 1, 0, 1 - s4out, 0, .5);
      }
      CARDS.forEach(function (c, i) {
        var el = $['card' + i], t0 = 14.1 + i * .95, q = seg(t, t0, t0 + 3.8), m = size['card' + i];
        var x = lerp(W + m.w * .7, -m.w * .7, lerp(q, io3(q), .35));
        var y = P ? H * (i % 2 ? .43 : .31) : H * (i % 2 ? .6 : .47);
        var ry = lerp(24, -24, q), rz = (i % 2 ? 1 : -1) * 3 + Math.sin(q * 6) * 1.5;
        el.style.transformOrigin = '50% 50%';
        el.style.transform = 'translate(' + (x - m.w / 2) + 'px,' + (y - m.h / 2) + 'px) perspective(1400px) rotateY(' + ry + 'deg) rotate(' + rz + 'deg)';
        el.style.opacity = q > 0 && q < 1 ? clamp(Math.min(q * 8, (1 - q) * 8)) : 0;
      });

      /* ---------- 伍 · 灯塔与四种力量 ---------- */
      var bIn = seg(t, 18.6, 19.4), bOut = seg(t, 24.0, 24.8);
      var ang = LABELS.map(function (_, i) {
        var lp = labPos(i); return Math.atan2(lp[1] - L.src[1], lp[0] - L.src[0]) * 180 / Math.PI;
      });
      for (i = 1; i < 4; i++) while (ang[i] < ang[i - 1]) ang[i] += 360;
      var keys = [[18.6, ang[0] - 80], [19.6, ang[0]], [20.6, ang[1]], [21.6, ang[2]], [22.6, ang[3]], [24.8, ang[3] + 250]];
      var bang = keys[0][1];
      for (i = 0; i < keys.length - 1; i++) if (t >= keys[i][0]) bang = lerp(keys[i][1], keys[i + 1][1], io3(seg(t, keys[i][0], keys[i + 1][0])));
      var bs = (P ? L.diag * 1.1 : L.diag * 1.05) / 4000 * 2;
      $.beam.style.transform = 'translate(' + (L.src[0] - 2000) + 'px,' + (L.src[1] - 2000) + 'px) rotate(' + (bang + 90 - 9).toFixed(2) + 'deg) scale(' + bs.toFixed(4) + ')';
      $.beam.style.opacity = bIn * (1 - bOut);
      var cs = (u * 30 / 200) * (1 + .06 * Math.sin(t * 3)) * lerp(.4, 1, out3(bIn));
      $.core.style.transform = 'translate(' + (L.src[0] - 100) + 'px,' + (L.src[1] - 100) + 'px) scale(' + cs.toFixed(4) + ')';
      $.core.style.opacity = bIn * (1 - seg(t, 28.0, 29.0)) * .9;
      LABELS.forEach(function (_, i) {
        var tk = 19.6 + i, lp = labPos(i), pp = spring(t - tk + .15, 1.8, .45);
        pos($['lab' + i], lp[0], lp[1], lerp(.55, 1, pp), 0, seg(t, tk - .15, tk + .15) * (1 - bOut));
        $['lab' + i].style.color = i === 3 ? '#F6D58A' : '#F4EFE4';
      });
      var hk = P ? [W / 2, H * .085] : [W / 2, H * .1];
      kinetic($.s5h, t, 18.9, .05, u * 4); pos($.s5h, hk[0], hk[1] + u * 2, 1, 0, 1 - seg(t, 22.6, 23.0));
      kinetic($.s5x, t, 22.9, .04, u * 4); pos($.s5x, hk[0], hk[1] + u * 2, 1, 0, seg(t, 22.85, 22.9) * (1 - seg(t, 24.1, 24.6)));

      /* ---------- 陆 · 领导力年轮 + 枝繁叶茂 ---------- */
      var circles = $.svg.querySelectorAll('circle[data-c]'), rOut = seg(t, 28.6, 29.4);
      for (k = 0; k < circles.length; k++) {
        var c0 = 24.7 + k * .5, dq = out3(seg(t, c0, c0 + 1.0)), C = 2 * Math.PI * L.rr[k];
        circles[k].setAttribute('stroke-dashoffset', (C * (1 - dq)).toFixed(1));
        var lit = t < c0 + 1.2 ? 1 : lerp(1, .4, seg(t, c0 + 1.2, c0 + 2));
        circles[k].setAttribute('opacity', (dq > 0 ? lit : 0) * (1 - rOut));
        var rp = spring(t - c0 - .55, 2, .45);
        pos($['rl' + k], L.rc[0], L.rc[1] - L.rr[k], lerp(.6, 1, rp), 0, seg(t, c0 + .45, c0 + .7) * (1 - seg(t, 26.8, 27.1)));
      }
      var bq = seg(t, 26.9, 28.5), paths = $.svg.querySelectorAll('path[data-b]');
      for (k = 0; k < paths.length; k++) {
        var b = L.br[+paths[k].dataset.b], d0 = b.depth / 6;
        var pq = clamp((bq - d0 * .8) / .2);
        paths[k].setAttribute('stroke-dashoffset', (1 - out3(pq)).toFixed(3));
        paths[k].setAttribute('opacity', (pq > 0 ? .85 : 0) * (1 - rOut));
      }
      $.svg.querySelectorAll('circle[data-l]').forEach(function (lf, j) {
        var q = spring(t - 28.2 - (j % 7) * .04, 2.2, .4); lf.setAttribute('opacity', (t > 28.2 ? .9 : 0) * (1 - rOut)); lf.setAttribute('transform', 'translate(' + lf.getAttribute('cx') * (1 - q) + ' ' + lf.getAttribute('cy') * (1 - q) + ') scale(' + q + ')');
      });
      $.ground.setAttribute('stroke-dashoffset', (L.gl / 2 + W * .05) * (1 - out3(seg(t, 26.7, 27.7))));
      $.ground.setAttribute('opacity', (t > 26.7 ? .8 : 0) * (1 - rOut));
      if (P) {
        kinetic($.s6h, t, 24.7, .035, u * 4); pos($.s6h, W / 2, H * .12, 1, 0, 1 - seg(t, 26.8, 27.2));
      } else {
        kinetic($.s6h, t, 24.7, .05, u * 4); pos($.s6h, lx, H * .42, 1, 0, 1 - seg(t, 26.8, 27.2), 0, .5);
      }
      kinetic($.s6x, t, 27.0, .08, u * 6);
      var x6 = P ? [W / 2, H * .1] : [W / 2, H * .13];
      pos($.s6x, x6[0], x6[1], 1, 0, seg(t, 26.95, 27.0) * (1 - seg(t, 28.5, 29.0)));
      pos($.s6y, x6[0], x6[1] + u * (P ? 9 : 7.5), 1, 0, seg(t, 27.8, 28.3) * (1 - seg(t, 28.5, 29.0)));

      /* ---------- 前景画布：金尘 + 天亮（纸面从灯塔处晕开） ---------- */
      cf.clearRect(0, 0, W, H);
      var dawn = out3(seg(t, 28.7, 30.1));
      if (dawn > 0) {
        cf.fillStyle = '#F4EFE4';
        if (dawn < 1) inkBlob(cf, L.src[0], L.src[1], dawn * L.diag * .75, t, 2.5); else cf.fillRect(0, 0, W, H);
      }
      var dustAmt = t < 5 ? .9 : t < 9 ? .55 : t < 18.4 ? .2 : t < 28.7 ? lerp(.3, 1, seg(t, 18.4, 20)) : lerp(1, .45, seg(t, 28.7, 30));
      dust.forEach(function (d) {
        var x = ((d.x + d.vx * t) % 1 + 1) % 1 * W, y = ((d.y - d.vy * t) % 1 + 1) % 1 * H;
        var a = d.a * dustAmt * (.55 + .45 * Math.sin(t * d.f + d.ph));
        cf.beginPath(); cf.arc(x, y, d.r * u * .22, 0, 7);
        cf.fillStyle = t > 29.5 ? 'rgba(181,133,60,' + (a * .6) + ')' : 'rgba(240,200,110,' + a + ')'; cf.fill();
      });

      /* ---------- 角色：站定不动，只在换幕时交替淡入淡出 ----------
         女左男右，各幕轮流一人在场暗示换章；两人同框只留给最重要的两处——「学生是主体」与终章报名，
         且比那行字早半拍出现。只保留眨眼，不位移、不弹跳、不放大。 */
      ['girl', 'boy'].forEach(function (n, j) {
        var el = $[n], m = size[n], side = j ? 1 : -1;
        var v = CAST[0][1].indexOf(n[0]) >= 0 ? 1 : 0;
        for (var c = 1; c < CAST.length; c++) v = lerp(v, CAST[c][1].indexOf(n[0]) >= 0 ? 1 : 0, seg(t, CAST[c][0] - .2, CAST[c][0] + .2));
        var cx = W / 2 + side * W * (P ? .36 : .43), gy = P ? H * .985 : L.gy;
        el.style.transformOrigin = '0 0';
        el.style.transform = 'translate(' + (cx - m.w / 2).toFixed(2) + 'px,' + (gy - m.h).toFixed(2) + 'px)';
        el.style.opacity = v;
        el.style.visibility = v > 0 ? 'visible' : 'hidden';
        var bl = blink(t, CHAR[n].ph), lids = el.querySelectorAll('.lid');
        lids[0].style.transform = lids[1].style.transform = 'scaleY(' + bl.toFixed(3) + ')';
        var sh = $[j ? 'shb' : 'shg'], sw = m.w * 1.3;
        sh.style.transform = 'translate(' + (cx - 50) + 'px,' + (gy - 12) + 'px) scale(' + (sw / 100).toFixed(3) + ',' + (sw / 100 * .5).toFixed(3) + ')';
        sh.style.opacity = v * (t > 29.5 ? .5 : .8);
      });

      /* ---------- 柒 · 迎领 ---------- */
      var cr = spring(t - 29.8, 1.6, .42);
      var fy = P ? [H * .09, H * .18, H * .235, H * .29, H * .37] : [H * .21, H * .4, H * .49, H * .59, H * .73];
      pos($.crest, W / 2, fy[0], lerp(.4, 1, cr), lerp(-25, 0, out3(seg(t, 29.8, 30.6))), seg(t, 29.8, 30.1));
      kinetic($.s7h, t, 30.1, .07, u * 4); pos($.s7h, W / 2, fy[1], 1, 0, seg(t, 30.05, 30.1));
      pos($.s7l, W / 2, fy[2], 1, 0, seg(t, 30.6, 31.1));
      kinetic($.s7x, t, 30.8, .08, u * 3); pos($.s7x, W / 2, fy[3], 1, 0, seg(t, 30.75, 30.8));
      pos($.cta, W / 2, fy[4] + (1 - out3(seg(t, 31.3, 31.9))) * u * 2, 1, 0, seg(t, 31.3, 31.8));
      $.cta.style.pointerEvents = t > 31.3 ? 'auto' : 'none';
      if (t >= 20) {
        var s2 = seg(t, 31.7, 31.95), stamp2 = t < 31.7 ? 0 : (t < 31.95 ? lerp(2.4, .92, in3(s2)) : lerp(.92, 1, out3(seg(t, 31.95, 32.2))));
        var m7 = size.s7h || { w: 0 };
        pos($.seal, P ? W / 2 + W * .36 : W / 2 + m7.w / 2 + u * 3.6, P ? fy[0] : fy[1], stamp2 || .001, -4, clamp(s2 * 3));
      }
    }

    function labPos(i) {
      var W = L.W, H = L.H;
      var lp = L.P ? [[.2, .47], [.25, .29], [.75, .29], [.8, .47]] : [[.18, .73], [.2, .33], [.8, .33], [.82, .73]];
      return [lp[i][0] * W, lp[i][1] * H];
    }

    layout();
    var ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    return { render: render, layout: layout, duration: T, el: root };
  }

  /* 播放器：scroll（随滚动，带惯性）| film（自动循环）| still（静止某一帧） */
  function mount(root, opt) {
    opt = opt || {};
    var mg = create(root, opt), mode = opt.mode || 'scroll';
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || mode === 'still') { mg.render(opt.t === undefined ? T : opt.t); return mg; }
    var cur = 0, target = 0, visible = true, start = null;
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(root);
    function progress() {
      var track = opt.track || root.parentElement.parentElement, r = track.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    }
    function tick(now) {
      if (!visible) return;
      if (mode === 'film') {
        if (start === null) start = now;
        var loop = T + 2;                       // 片尾多停 2 秒再重播
        cur = Math.min(T, ((now - start) / 1000) % loop);
      } else {
        target = progress() * T;
        cur += (target - cur) * .12;
        if (Math.abs(target - cur) < .002) cur = target;
      }
      mg.render(cur);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return mg;
  }

  window.NanhwaMG = { create: create, mount: mount, duration: T };
})();
