/* Leadoff printout finisher. Runs inside the template on iOS (the app
   only fills the tokens) and the web app runs this same text over its
   injected sheet. It must never throw: a printout with plain styling
   beats no printout. */
(function () {
  // Where each position sits on the field, in % of the field box. The
  // iOS app writes older spots inline that stack the infield on top of
  // itself (SS covered the pitcher); these keep every name clear.
  var SPOTS = {
    P: [50, 63], C: [50, 90], '1B': [77, 62], '2B': [64, 46], SS: [36, 46], '3B': [23, 62],
    LF: [17, 28], CF: [50, 18], RF: [83, 28], LCF: [32, 20], RCF: [68, 20],
    // foul territory beside home: bottom right, bottom left, then low center-right
    UTL1: [85, 87], UTL2: [15, 87], UTL3: [70, 92]
  };
  // The part of the 1000 x 800 field drawing worth showing.
  var VIEW = [50, 95, 900, 680];

  function finish(root) {
    try {
      var i, cells, ths, rows, cards;

      // Bench innings get a shaded cell (both apps print bench as OFF).
      cells = root.querySelectorAll('.lo-table td');
      for (i = 0; i < cells.length; i++) {
        if ((cells[i].textContent || '').trim() === 'OFF') cells[i].classList.add('lo-off');
      }

      // Header reads like the app: #, Player, then plain inning numbers.
      ths = root.querySelectorAll('.lo-table thead th');
      for (i = 0; i < ths.length; i++) {
        var t = (ths[i].textContent || '').trim();
        if (i === 0 && !t) ths[i].textContent = '#';
        else if (t === 'Name') ths[i].textContent = 'Player';
        else if (/^Inn\s+\d+$/.test(t)) ths[i].textContent = t.replace(/^Inn\s+/, '');
      }

      // Rows share the sheet's row budget (print.css --lo-r); the
      // classes step the batting list and drop the notes for big rosters.
      rows = root.querySelectorAll('.lo-table tbody tr').length || root.querySelectorAll('.lo-bat li').length;
      root.style.setProperty('--lo-rows', String(Math.max(1, rows)));
      if (rows >= 17) root.classList.add('lo-rows-xl');
      else if (rows >= 15) root.classList.add('lo-rows-l');
      else if (rows >= 13) root.classList.add('lo-rows-m');
      else if (rows === 12) root.classList.add('lo-rows-s');

      var title = root.querySelector('.lo-title');
      var tlen = title ? (title.textContent || '').trim().length : 0;
      if (tlen > 46) root.classList.add('lo-title-xlong');
      else if (tlen > 30) root.classList.add('lo-title-long');

      // Innings decide the grid (Field by Inning) or the name column (list).
      cards = root.querySelectorAll('.allinnings-card').length;
      if (cards) {
        if (cards <= 2) root.classList.add('lo-inn-xs');
        else if (cards <= 4) root.classList.add('lo-inn-s');
        else if (cards <= 6) { /* 3 x 2, the default */ }
        else if (cards <= 9) root.classList.add('lo-inn-l');
        else root.classList.add('lo-inn-xl');
      } else if (ths.length - 2 >= 9) {
        root.classList.add('lo-inn-l');
      }

      // Crop the drawing to the field itself and let it stretch with its
      // box (.lo-fit in CSS), so each card is mostly field, not margin.
      // Spots are given in the full 1000 x 800 drawing and mapped into
      // the crop, so names stay on their bases at any card shape.
      var svgs = root.querySelectorAll('.field-stage .field-bg');
      for (i = 0; i < svgs.length; i++) {
        svgs[i].setAttribute('viewBox', VIEW.join(' '));
        svgs[i].setAttribute('preserveAspectRatio', 'none');
      }
      var crop = svgs.length ? VIEW : [0, 0, 1000, 800];
      if (svgs.length) root.classList.add('lo-fit');

      // Utility spots (UTL1-3) move from the row under the field into the
      // empty foul corners, so every card is the same height.
      var utlRows = root.querySelectorAll('.allinnings-card .field-utl-row');
      for (i = 0; i < utlRows.length; i++) {
        var host = utlRows[i].parentNode.querySelector('.field-positions');
        if (!host) continue;
        var utl = utlRows[i].querySelectorAll('.field-pos-bubble');
        for (var j = 0; j < utl.length; j++) host.appendChild(utl[j]);
        utlRows[i].parentNode.removeChild(utlRows[i]);
      }

      var bubbles = root.querySelectorAll('.field-positions .field-pos-bubble');
      for (i = 0; i < bubbles.length; i++) {
        var label = bubbles[i].querySelector('.field-pos-label');
        var spot = SPOTS[((label && label.textContent) || '').trim()];
        if (!spot) continue;
        bubbles[i].style.left = ((spot[0] * 10 - crop[0]) / crop[2] * 100).toFixed(2) + '%';
        bubbles[i].style.top = ((spot[1] * 8 - crop[1]) / crop[3] * 100).toFixed(2) + '%';
      }
    } catch (e) { /* keep the plain sheet */ }
  }

  // Share image only (the standalone template on screen): a roster too
  // long for the 1056 x 816 snapshot shrinks to fit instead of cropping.
  function fit() {
    try {
      if (!document.body.classList.contains('lo-doc')) return;
      if (!window.matchMedia || !window.matchMedia('screen').matches) return;
      var sheet = document.querySelector('.lo-print');
      if (!sheet) return;
      sheet.style.zoom = '';
      var over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 1) sheet.style.zoom = String(Math.max(0.6, (window.innerHeight - 44) / (sheet.offsetHeight + 1)));
    } catch (e) {}
  }

  window.loFinish = finish;
  var sheets = document.querySelectorAll('.lo-print:not(.lo-done)');
  for (var k = 0; k < sheets.length; k++) { finish(sheets[k]); sheets[k].classList.add('lo-done'); }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
