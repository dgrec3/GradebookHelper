/**
 * Runs in the PAGE context (not content script context).
 * Wraps XMLHttpRequest to intercept API responses and relay
 * assignment pointspossible data back to the content script.
 */
(function () {
  if (window.__ptpGradeHighlighterXhrWrapped) {
    return;
  }
  window.__ptpGradeHighlighterXhrWrapped = true;

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ptpUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const responseText = this.responseText;

        // Avoid parsing obviously non-JSON responses.
        if (typeof responseText !== 'string') return;
        const trimmed = responseText.trimStart();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;

        const data = JSON.parse(responseText);
        window.dispatchEvent(new CustomEvent('__ptp_xhr__', {
          detail: { url: this._ptpUrl, data: data }
        }));
      } catch (e) { /* not JSON, skip */ }
    });
    return origSend.apply(this, arguments);
  };
})();
