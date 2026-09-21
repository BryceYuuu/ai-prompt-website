/* ==========================================================================
   书桐 SHUTONG — art engine
   1) 程序化预览图：由种子 + 调色板确定性生成，零外部图片。
      只在卡片没有真实封面时兜底，投稿页的实时预览也用它。
   2) 图标集
   ========================================================================== */

(function (global) {
  'use strict';

  var W = 400, H = 300;

  /* ---------------------------------------------------------- prng ---- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function n(v, d) { return Number(v).toFixed(d === undefined ? 0 : d); }

  var G = {};

  /* ---------------------------------------------------------- neon ---- */
  G.neon = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs>' +
      '<linearGradient id="' + id + 'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p[1] + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + p[1] + '" stop-opacity=".9"/></linearGradient>' +
      '<linearGradient id="' + id + 'ref" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".26"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
      '</defs>';
    s += '<rect x="0" y="20" width="' + W + '" height="200" fill="url(#' + id + 'sky)"/>';
    var x = -8;
    while (x < W) {
      var w = 16 + r() * 34, h = 60 + r() * 140;
      s += '<rect x="' + n(x, 1) + '" y="' + n(232 - h, 1) + '" width="' + n(w, 1) +
        '" height="' + n(h + 10, 1) + '" fill="' + p[0] + '" opacity="' + n(.55 + r() * .45, 2) + '"/>';
      x += w + 3 + r() * 9;
    }
    for (var i = 0; i < 10; i++) {
      var sx = 14 + r() * 368, sy = 78 + r() * 122;
      var sw = 10 + r() * 44, sh = 3 + r() * 5;
      var sc = r() > .48 ? p[2] : p[3];
      s += '<rect x="' + n(sx, 1) + '" y="' + n(sy, 1) + '" width="' + n(sw, 1) +
        '" height="' + n(sh, 1) + '" rx="1" fill="' + sc + '" opacity=".95"/>';
    }
    s += '<rect x="0" y="232" width="' + W + '" height="68" fill="' + p[0] + '"/>';
    for (var k = 0; k < 11; k++) {
      var gx = 10 + r() * 380, gc = r() > .5 ? p[2] : p[3];
      s += '<rect x="' + n(gx, 1) + '" y="232" width="' + n(3 + r() * 22, 1) +
        '" height="' + n(22 + r() * 46, 1) + '" fill="' + gc + '" opacity=".2"/>';
    }
    s += '<rect x="0" y="232" width="' + W + '" height="68" fill="url(#' + id + 'ref)"/>';
    return s;
  };

  /* ---------------------------------------------------------- film ---- */
  G.film = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs><radialGradient id="' + id + 'w" cx=".28" cy=".24" r=".92">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="' + p[1] + '" opacity=".4"/>';
    s += '<ellipse cx="118" cy="88" rx="185" ry="152" fill="url(#' + id + 'w)"/>';
    var cols = [p[1], p[2], p[3]];
    for (var i = 0; i < 4; i++) {
      s += '<ellipse cx="' + n(40 + r() * 320) + '" cy="' + n(60 + r() * 200) + '" rx="' +
        n(50 + r() * 90) + '" ry="' + n(40 + r() * 70) + '" fill="' + cols[i % 3] +
        '" opacity="' + n(.22 + r() * .26, 2) + '"/>';
    }
    s += '<rect x="-40" y="-60" width="86" height="420" fill="' + p[2] +
      '" opacity=".17" transform="rotate(18 40 150)"/>';
    s += '<rect x="330" y="-40" width="120" height="400" fill="' + p[3] +
      '" opacity=".12" transform="rotate(-14 380 150)"/>';
    s += '<rect x="13" y="13" width="' + (W - 26) + '" height="' + (H - 26) +
      '" fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="1"/>';
    return s;
  };

  /* ------------------------------------------------------ hardedge ---- */
  G.hardedge = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cols = [p[1], p[2], p[3], p[0]];
    var gw = W / 6, gh = H / 4;
    for (var gy = 0; gy < 4; gy++) {
      for (var gx = 0; gx < 6; gx++) {
        if (r() < .3) continue;
        var c = cols[Math.floor(r() * cols.length)];
        var x = gx * gw, y = gy * gh;
        if (r() > .55) {
          s += '<rect x="' + n(x, 1) + '" y="' + n(y, 1) + '" width="' + n(gw, 1) +
            '" height="' + n(gh, 1) + '" fill="' + c + '"/>';
        } else {
          s += '<rect x="' + n(x + 7, 1) + '" y="' + n(y + 7, 1) + '" width="' + n(gw - 14, 1) +
            '" height="' + n(gh - 14, 1) + '" fill="none" stroke="' + c + '" stroke-width="3"/>';
        }
      }
    }
    s += '<circle cx="' + n(60 + r() * 280) + '" cy="' + n(60 + r() * 180) + '" r="' +
      n(26 + r() * 40) + '" fill="' + (r() > .5 ? p[2] : p[1]) + '"/>';
    return s;
  };

  /* --------------------------------------------------------- plush ---- */
  G.plush = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs><radialGradient id="' + id + 'p" cx=".4" cy=".34" r=".76">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".9"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>';
    var cols = [p[1], p[2], p[3]];
    for (var i = 0; i < 3; i++) {
      var cx = 80 + r() * 240, cy = 92 + r() * 128, rad = 46 + r() * 54;
      s += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rad) +
        '" fill="' + cols[i % 3] + '" opacity=".75"/>';
      s += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(rad * .7) +
        '" fill="' + p[0] + '" opacity=".26"/>';
      s += '<circle cx="' + n(cx - rad * .3) + '" cy="' + n(cy - rad * .34) + '" r="' +
        n(rad * .44) + '" fill="url(#' + id + 'p)"/>';
    }
    return s;
  };

  /* ---------------------------------------------------------- etch ---- */
  G.etch = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    for (var y = 18; y < H - 8; y += 5 + r() * 3) {
      s += '<line x1="14" y1="' + n(y, 1) + '" x2="' + (W - 14) + '" y2="' + n(y, 1) +
        '" stroke="' + p[1] + '" stroke-width=".7" opacity="' + n(.1 + r() * .22, 2) + '"/>';
    }
    for (var i = 0; i < 5; i++) {
      var cx = 40 + r() * 320, cy = 40 + r() * 210, w = 60 + r() * 90, h = 50 + r() * 80;
      var cnt = 8 + Math.floor(r() * 8);
      for (var k = 0; k < cnt; k++) {
        var off = k * (w / cnt);
        s += '<line x1="' + n(cx + off) + '" y1="' + n(cy) + '" x2="' + n(cx + off - h) +
          '" y2="' + n(cy + h) + '" stroke="' + p[1] + '" stroke-width=".8" opacity=".32"/>';
      }
    }
    s += '<ellipse cx="200" cy="150" rx="170" ry="125" fill="none" stroke="' + p[2] +
      '" stroke-width="1.4" opacity=".5"/>';
    s += '<ellipse cx="200" cy="150" rx="164" ry="119" fill="none" stroke="' + p[2] +
      '" stroke-width=".6" opacity=".35"/>';
    return s;
  };

  /* --------------------------------------------------------- candy ---- */
  G.candy = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cs = [p[1], p[2], p[3]];
    for (var i = 0; i < 5; i++) {
      s += '<circle cx="' + n(50 + r() * 300) + '" cy="' + n(60 + r() * 180) + '" r="' +
        n(40 + r() * 70) + '" fill="' + cs[i % 3] + '" opacity=".88"/>';
    }
    for (var k = 0; k < 3; k++) {
      var cx = 70 + r() * 250, cy = 80 + r() * 150;
      s += '<rect x="' + n(cx) + '" y="' + n(cy) + '" width="' + n(30 + r() * 60) +
        '" height="' + n(30 + r() * 60) + '" rx="' + n(10 + r() * 24) +
        '" fill="' + cs[(k + 1) % 3] + '" opacity=".82"/>';
    }
    return s;
  };

  /* ----------------------------------------------------------- ink ---- */
  G.ink = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<circle cx="' + n(276 + r() * 60) + '" cy="' + n(66 + r() * 30) + '" r="' +
      n(17 + r() * 11) + '" fill="' + p[2] + '" opacity=".3"/>';
    /* 远山：一条压得住的墨脊，缩略图尺寸下也立得住 */
    s += '<path d="M-10 ' + n(120 + r() * 12) + ' Q' + n(90 + r() * 40) + ' ' +
      n(74 + r() * 14) + ' ' + n(196 + r() * 30) + ' ' + n(112 + r() * 10) +
      ' T410 ' + n(124 + r() * 10) + '" fill="none" stroke="' + p[2] +
      '" stroke-width="5" opacity=".5" stroke-linecap="round"/>';
    for (var i = 0; i < 4; i++) {
      var y = 214 - i * 32 - r() * 14;
      var amp = 18 + i * 10;
      var x0 = -10 + r() * 40, x1 = 410 - r() * 40;
      var c1 = 90 + r() * 60, c2 = 250 + r() * 80;
      s += '<path d="M' + n(x0) + ' ' + n(y) + ' Q' + n(c1) + ' ' + n(y - amp) + ' ' +
        n(c2) + ' ' + n(y) + ' T' + n(x1) + ' ' + n(y - 4) + '" fill="none" stroke="' +
        (i < 2 ? p[2] : p[1]) + '" stroke-width="' + n(3.4 - i * .5, 1) + '" opacity="' +
        n(.88 - i * .14, 2) + '" stroke-linecap="round"/>';
    }
    for (var k = 0; k < 3; k++) {
      s += '<rect x="0" y="' + n(150 + k * 34) + '" width="' + W + '" height="' +
        n(14 + r() * 16) + '" fill="' + p[0] + '" opacity=".55"/>';
    }
    return s;
  };

  /* --------------------------------------------------------- glass ---- */
  G.glass = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cs = [p[1], p[2], p[3]];
    for (var i = 0; i < 4; i++) {
      s += '<ellipse cx="' + n(50 + r() * 300) + '" cy="' + n(50 + r() * 200) + '" rx="' +
        n(60 + r() * 70) + '" ry="' + n(50 + r() * 60) + '" fill="' + cs[i % 3] + '" opacity=".55"/>';
    }
    for (var k = 0; k < 3; k++) {
      var x = 40 + r() * 190, y = 40 + r() * 130, w = 110 + r() * 110, h = 70 + r() * 80;
      s += '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) +
        '" rx="16" fill="#ffffff" fill-opacity=".28" stroke="#ffffff" stroke-opacity=".78" stroke-width="1.2"/>';
      s += '<line x1="' + n(x + 16) + '" y1="' + n(y + 18) + '" x2="' + n(x + w - 16) +
        '" y2="' + n(y + 18) + '" stroke="#ffffff" stroke-opacity=".5" stroke-width="1"/>';
    }
    return s;
  };

  /* ---------------------------------------------------------- riso ---- */
  G.riso = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cs = [p[1], p[2], p[3]];
    for (var i = 0; i < 3; i++) {
      var cx = 90 + r() * 220, cy = 80 + r() * 140, rad = 50 + r() * 60;
      s += '<circle cx="' + n(cx - 5) + '" cy="' + n(cy + 6) + '" r="' + n(rad) +
        '" fill="' + cs[i % 3] + '" opacity=".6"/>';
      s += '<circle cx="' + n(cx + 7) + '" cy="' + n(cy - 4) + '" r="' + n(rad) +
        '" fill="' + cs[(i + 1) % 3] + '" opacity=".54"/>';
    }
    for (var gy = 6; gy < H; gy += 18) {
      for (var gx = 6; gx < W; gx += 18) {
        var rad2 = r() * 2.4;
        if (rad2 < .5) continue;
        s += '<circle cx="' + gx + '" cy="' + gy + '" r="' + n(rad2, 1) +
          '" fill="' + p[1] + '" opacity=".2"/>';
      }
    }
    return s;
  };

  /* ---------------------------------------------------------- mini ---- */
  G.mini = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<rect width="' + W + '" height="118" fill="' + p[1] + '" opacity=".32"/>';
    s += '<ellipse cx="200" cy="216" rx="176" ry="62" fill="' + p[1] + '"/>';
    s += '<ellipse cx="200" cy="206" rx="150" ry="48" fill="' + p[2] + '" opacity=".85"/>';
    var cs = [p[2], p[3], p[1]];
    for (var i = 0; i < 12; i++) {
      var cx = 58 + r() * 284, cy = 150 + r() * 68, h = 14 + r() * 38;
      var c = cs[Math.floor(r() * 3)];
      if (r() > .5) {
        s += '<circle cx="' + n(cx) + '" cy="' + n(cy - h) + '" r="' + n(6 + r() * 10) +
          '" fill="' + c + '"/>';
        s += '<rect x="' + n(cx - 2) + '" y="' + n(cy - h + 4) + '" width="4" height="' +
          n(h) + '" fill="' + p[1] + '"/>';
      } else {
        s += '<rect x="' + n(cx - 8) + '" y="' + n(cy - h) + '" width="' + n(16 + r() * 10) +
          '" height="' + n(h) + '" rx="2" fill="' + c + '"/>';
      }
    }
    return s;
  };

  /* ------------------------------------------------------ darkroom ---- */
  G.darkroom = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs><radialGradient id="' + id + 'v" cx=".5" cy=".45" r=".76">' +
      '<stop offset="0" stop-color="' + p[2] + '" stop-opacity=".9"/>' +
      '<stop offset=".55" stop-color="' + p[1] + '" stop-opacity=".62"/>' +
      '<stop offset="1" stop-color="' + p[0] + '" stop-opacity="1"/></radialGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'v)"/>';
    for (var i = 0; i < 4; i++) {
      s += '<ellipse cx="' + n(40 + r() * 320) + '" cy="' + n(40 + r() * 220) + '" rx="' +
        n(30 + r() * 60) + '" ry="' + n(20 + r() * 40) + '" fill="' + p[3] + '" opacity=".07"/>';
    }
    s += '<rect x="26" y="26" width="' + (W - 52) + '" height="' + (H - 52) +
      '" fill="none" stroke="' + p[3] + '" stroke-opacity=".55" stroke-width="2"/>';
    s += '<rect x="36" y="36" width="' + (W - 72) + '" height="' + (H - 72) +
      '" fill="none" stroke="' + p[3] + '" stroke-opacity=".28" stroke-width=".8"/>';
    for (var k = 0; k < 5; k++) {
      var x = 30 + r() * 340;
      s += '<line x1="' + n(x) + '" y1="' + n(20 + r() * 40) + '" x2="' + n(x + (r() * 10 - 5)) +
        '" y2="' + n(240 + r() * 40) + '" stroke="' + p[3] + '" stroke-opacity=".2" stroke-width=".7"/>';
    }
    return s;
  };

  /* ------------------------------------------------------- sketch ----- */
  G.sketch = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    /* 大面积淡排线打底，缩略图下才有「画过」的密度 */
    for (var b = 0; b < 26; b++) {
      var bx = 16 + b * 15;
      s += '<line x1="' + n(bx) + '" y1="34" x2="' + n(bx - 46) + '" y2="272" stroke="' +
        p[1] + '" stroke-width="1" opacity=".12"/>';
    }
    for (var i = 0; i < 3; i++) {
      var o = i * 13;
      s += '<path d="M' + n(110 - o * .3) + ' ' + n(200 + o * .2) + ' C' + n(120 - o) + ' ' +
        n(90 - o) + ' ' + n(280 + o) + ' ' + n(80 - o) + ' ' + n(292 + o * .3) + ' ' +
        n(196 + o * .2) + '" fill="none" stroke="' + p[1] + '" stroke-width="' +
        n(3.6 - i * .7, 1) + '" stroke-linecap="round" opacity="' + n(.95 - i * .2, 2) + '"/>';
    }
    for (var k = 0; k < 9; k++) {
      s += '<line x1="' + n(248 + k * 9) + '" y1="' + n(216 + k * 4) + '" x2="' + n(278 + k * 9) +
        '" y2="' + n(186 + k * 4) + '" stroke="' + p[1] + '" stroke-width="1.3" opacity=".52"/>';
    }
    s += '<path d="M96 238 C150 252 250 252 306 234" fill="none" stroke="' + p[3] +
      '" stroke-width="3.2" stroke-linecap="round"/>';
    for (var m = 0; m < 7; m++) {
      s += '<circle cx="' + n(60 + r() * 280) + '" cy="' + n(50 + r() * 200) + '" r="' +
        n(1.4 + r() * 2, 1) + '" fill="' + p[1] + '" opacity=".4"/>';
    }
    return s;
  };

  /* ------------------------------------------------------- chrome ----- */
  G.chrome = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs><linearGradient id="' + id + 'c" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p[3] + '"/><stop offset=".32" stop-color="' + p[2] + '"/>' +
      '<stop offset=".54" stop-color="' + p[1] + '"/><stop offset=".78" stop-color="' + p[3] + '"/>' +
      '<stop offset="1" stop-color="' + p[2] + '"/></linearGradient></defs>';
    for (var i = 0; i < 7; i++) {
      var y = 30 + i * 36 + r() * 10, amp = 14 + r() * 22;
      s += '<path d="M-10 ' + n(y) + ' C90 ' + n(y - amp) + ' 160 ' + n(y + amp) + ' 210 ' + n(y) +
        ' S330 ' + n(y - amp) + ' 410 ' + n(y) + '" fill="none" stroke="url(#' + id + 'c)" stroke-width="' +
        n(5 + r() * 11, 1) + '" stroke-linecap="round" opacity="' + n(.5 + r() * .45, 2) + '"/>';
    }
    s += '<ellipse cx="200" cy="254" rx="150" ry="26" fill="' + p[3] + '" opacity=".1"/>';
    return s;
  };

  /* -------------------------------------------------------- pixel ----- */
  G.pixel = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cell = 20, cols = W / cell, rows = H / cell;
    var cs = [p[1], p[2], p[3], p[0]];
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        if (r() < .6) continue;
        var c = gy > rows * .62 ? cs[0] : cs[Math.floor(r() * cs.length)];
        s += '<rect x="' + (gx * cell) + '" y="' + (gy * cell) + '" width="' + cell +
          '" height="' + cell + '" fill="' + c + '" opacity="' + n(.6 + r() * .4, 2) + '"/>';
      }
    }
    var sp = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
    for (var i = 0; i < sp.length; i++) {
      s += '<rect x="' + (120 + sp[i][0] * cell) + '" y="' + (100 + sp[i][1] * cell) +
        '" width="' + cell + '" height="' + cell + '" fill="' + p[3] + '"/>';
    }
    return s;
  };

  /* --------------------------------------------------------- soft ----- */
  G.soft = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<defs>' +
      '<radialGradient id="' + id + 's" cx=".38" cy=".34" r=".82">' +
      '<stop offset="0" stop-color="' + p[3] + '" stop-opacity=".95"/>' +
      '<stop offset=".55" stop-color="' + p[2] + '" stop-opacity=".7"/>' +
      '<stop offset="1" stop-color="' + p[1] + '" stop-opacity=".45"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx=".34" cy=".28" r=".52">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".9"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="' + p[1] + '" opacity=".5"/>';
    s += '<ellipse cx="180" cy="140" rx="122" ry="132" fill="url(#' + id + 's)"/>';
    s += '<ellipse cx="150" cy="104" rx="86" ry="76" fill="url(#' + id + 'h)"/>';
    s += '<ellipse cx="200" cy="268" rx="150" ry="30" fill="' + p[0] + '" opacity=".5"/>';
    return s;
  };

  /* --------------------------------------------------------- wire ----- */
  G.wire = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var vx = 200, vy = 110, i;
    for (i = -6; i <= 6; i++) {
      s += '<line x1="' + vx + '" y1="' + vy + '" x2="' + (vx + i * 72) +
        '" y2="320" stroke="' + p[1] + '" stroke-width=".7" opacity=".7"/>';
    }
    for (i = 1; i < 9; i++) {
      var y = vy + Math.pow(i / 8, 1.9) * 200;
      s += '<line x1="-20" y1="' + n(y) + '" x2="420" y2="' + n(y) +
        '" stroke="' + p[1] + '" stroke-width=".7" opacity=".5"/>';
    }
    s += '<path d="M120 190 L120 96 L280 96 L280 190 Z" fill="none" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<path d="M120 96 L152 68 L312 68 L280 96" fill="none" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<path d="M280 190 L312 162 L312 68" fill="none" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<line x1="120" y1="190" x2="152" y2="162" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<line x1="152" y1="162" x2="312" y2="162" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<line x1="152" y1="162" x2="152" y2="68" stroke="' + p[2] + '" stroke-width="1.2"/>';
    s += '<line x1="280" y1="96" x2="280" y2="190" stroke="' + p[3] + '" stroke-width="2.6"/>';
    return s;
  };

  /* ------------------------------------------------------- tropic ----- */
  G.tropic = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    s += '<rect width="' + W + '" height="' + H + '" fill="' + p[1] + '" opacity=".3"/>';
    s += '<path d="M0 300 L180 0 L280 0 L90 300 Z" fill="#ffffff" opacity=".2"/>';
    var cs = [p[1], p[2], p[3]];
    for (var i = 0; i < 9; i++) {
      var cx = 40 + r() * 320, cy = 40 + r() * 220;
      var rot = r() * 360, rx = 26 + r() * 44, ry = 11 + r() * 18;
      var c = cs[Math.floor(r() * 3)];
      s += '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) +
        '" fill="' + c + '" opacity="' + n(.6 + r() * .35, 2) + '" transform="rotate(' +
        n(rot) + ' ' + n(cx) + ' ' + n(cy) + ')"/>';
      s += '<line x1="' + n(cx) + '" y1="' + n(cy) + '" x2="' + n(cx + rx) + '" y2="' + n(cy) +
        '" stroke="' + p[0] + '" stroke-opacity=".35" stroke-width=".8" transform="rotate(' +
        n(rot) + ' ' + n(cx) + ' ' + n(cy) + ')"/>';
    }
    return s;
  };

  /* -------------------------------------------------------- blues ----- */
  G.blues = function (r, p, id) {
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + p[0] + '"/>';
    var cs = [p[1], p[2], p[3], p[0]];
    var y = 0, i = 0;
    while (y < H) {
      var h = 12 + r() * 46;
      s += '<rect x="0" y="' + n(y) + '" width="' + W + '" height="' + n(h) + '" fill="' +
        cs[i % 4] + '" opacity="' + n(.28 + r() * .5, 2) + '"/>';
      y += h; i++;
    }
    var lx = 60 + r() * 280, ly = 40 + r() * 160;
    s += '<circle cx="' + n(lx) + '" cy="' + n(ly) + '" r="3.5" fill="#ffffff" opacity=".9"/>';
    s += '<circle cx="' + n(lx) + '" cy="' + n(ly) + '" r="16" fill="#ffffff" opacity=".12"/>';
    s += '<circle cx="' + n(lx) + '" cy="' + n(ly) + '" r="34" fill="#ffffff" opacity=".06"/>';
    s += '<rect x="' + n(lx - 5) + '" y="' + n(ly) + '" width="10" height="' + n(H - ly) +
      '" fill="#ffffff" opacity=".07"/>';
    return s;
  };

  /* -------------------------------------------------------- render ---- */
  function art(style) {
    if (!style || !style.art) return '';
    var r = mulberry32((style.art.seed || 1) * 7919 + 13);
    var p = style.art.p;
    var uid = 'a' + String(style.id || 'x').replace(/[^a-zA-Z0-9]/g, '');
    var gen = G[style.art.g] || G.soft;
    var body;
    try { body = gen(r, p, uid); } catch (e) { body = G.soft(mulberry32(1), p, uid); }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" ' +
      'role="img" aria-label="' + style.name + ' 风格预览"><title>' + style.name +
      '</title>' + body + '</svg>';
  }

  /* ------------------------------------------------------- icons ------ */
  function ico(paths, extra) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extra ? ' ' + extra : '') + '>' + paths + '</svg>';
  }

  var ICON = {
    search: ico('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
    copy: ico('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0012.5 3h-7A2.5 2.5 0 003 5.5v7A2.5 2.5 0 005.5 15"/>'),
    check: ico('<path d="M4.5 12.5l5 5 10-11"/>'),
    bookmark: ico('<path d="M6 3.8h12a1 1 0 011 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 011-1z"/>'),
    play: ico('<path d="M6 4.5l13 7.5-13 7.5z"/>'),
    /* 筛选：三条递减的横线，通用图形 */
    filter: ico('<path d="M4 7h16"/><path d="M7 12h10"/><path d="M10 17h4"/>'),
    arrowRight: ico('<path d="M4.5 12h14"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/>'),
    arrowLeft: ico('<path d="M19.5 12h-14"/><path d="M11 6.5L5.5 12 11 17.5"/>'),
    chevronDown: ico('<path d="M6 9.5l6 6 6-6"/>'),
    close: ico('<path d="M6 6l12 12M18 6L6 18"/>'),
    plus: ico('<path d="M12 5v14M5 12h14"/>'),
    menu: ico('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    layers: ico('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    cloud: ico('<path d="M7 18a4.5 4.5 0 01-.4-8.98A6 6 0 0118.2 10 4 4 0 0117.5 18H7z"/>'),
    chip: ico('<rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>'),
    sparkle: ico('<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>'),
    external: ico('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'),
    user: ico('<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/>'),
    upload: ico('<path d="M12 16V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>'),
    /* 下载：upload 的镜像 */
    download: ico('<path d="M12 4v12"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>'),
    shield: ico('<path d="M12 3l7.5 3v6c0 4.5-3.2 7.7-7.5 9-4.3-1.3-7.5-4.5-7.5-9V6z"/>'),
    globe: ico('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5S14.4 18.4 12 20.5c-2.4-2.1-3.6-5-3.6-8.5S9.6 6.1 12 3.5z"/>'),
    trend: ico('<path d="M3.5 16.5l5.5-5.5 3.5 3.5 7-7"/><path d="M15 7.5h5v5"/>'),
    lock: ico('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>'),
    filter: ico('<path d="M3.5 6h17"/><path d="M6.5 12h11"/><path d="M10 18h4"/>'),
    grid: ico('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    heart: ico('<path d="M12 20s-7.5-4.7-7.5-10A4.5 4.5 0 0112 6.5 4.5 4.5 0 0119.5 10c0 5.3-7.5 10-7.5 10z"/>'),
    bolt: ico('<path d="M13.5 3L5 13.5h6L10.5 21 19 10.5h-6z"/>'),
    users: ico('<circle cx="9" cy="9" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 5.8a3.5 3.5 0 010 6.4"/><path d="M18 14.6a6.5 6.5 0 013.5 5.4"/>')
  };

  global.HFArt = { art: art, ICON: ICON };

})(window);
