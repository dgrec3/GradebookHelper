/**
 * Runs in the PAGE context (not content script context).
 * Wraps XMLHttpRequest so the content script can learn each assignment's
 * points possible, which the scoresheet DOM doesn't show.
 *
 * Privacy: responses are parsed here, in the page, and only
 * { assignmentId: pointsPossible } pairs are passed on. Student names,
 * scores and every other field never leave this function. That keeps the
 * extension's data footprint minimal and easy to explain to store reviewers.
 */
(function () {
  if (window.__ptpGradeHighlighterXhrWrapped) {
    return;
  }
  window.__ptpGradeHighlighterXhrWrapped = true;

  const origSend = XMLHttpRequest.prototype.send;

  // Recursively walk any JSON value looking for assignment records.
  // Points live in _assignmentsections[0].scoreentrypoints.
  function collectPoints(value, points) {
    if (!value || typeof value !== 'object') return;

    if (value.assignmentid != null &&
        Array.isArray(value._assignmentsections) &&
        value._assignmentsections.length > 0) {
      const pts = parseFloat(value._assignmentsections[0].scoreentrypoints);
      if (!Number.isNaN(pts)) {
        points[String(value.assignmentid)] = pts;
      }
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') collectPoints(child, points);
    }
  }

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        // responseText throws for non-text responseTypes (blob, arraybuffer…).
        const responseText = this.responseText;

        // Avoid parsing obviously non-JSON responses.
        if (typeof responseText !== 'string') return;
        const trimmed = responseText.trimStart();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;

        const points = Object.create(null);
        collectPoints(JSON.parse(responseText), points);
        if (Object.keys(points).length === 0) return; // nothing useful in this response

        window.dispatchEvent(new CustomEvent('__ptp_xhr__', {
          detail: { points: { ...points } }
        }));
      } catch (e) { /* not JSON, skip */ }
    });
    return origSend.apply(this, arguments);
  };
})();
