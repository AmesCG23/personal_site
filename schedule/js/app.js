(function () {
  var APPS_SCRIPT_URL = (window.SCHEDULE_CONFIG || {}).appsScriptUrl || '';

  var loadingMsg = document.getElementById('loading-msg');
  var errorBanner = document.getElementById('error-banner');
  var app = document.getElementById('app');
  var pollTitleEl = document.getElementById('poll-title');
  var nameInput = document.getElementById('name-input');
  var daysGrid = document.getElementById('days-grid');
  var submitBtn = document.getElementById('submit-btn');
  var saveStatus = document.getElementById('save-status');

  var HEAT_RGB = '58, 107, 66'; // forest green; keep in sync with --heat in css/schedule.css

  var poll = new URLSearchParams(window.location.search).get('poll');
  var state = { title: '', days: [], responses: [] };
  var loadedForName = null; // normalized name whose selections are currently loaded into the checkboxes

  function showError(message) {
    loadingMsg.hidden = true;
    app.hidden = true;
    errorBanner.hidden = false;
    errorBanner.textContent = message;
  }

  function normalizeName(name) {
    return name.trim().toLowerCase();
  }

  function findResponse(name) {
    var normalized = normalizeName(name);
    if (!normalized) return null;
    return state.responses.find(function (r) {
      return normalizeName(r.name) === normalized;
    }) || null;
  }

  function render() {
    pollTitleEl.textContent = state.title;

    var total = state.responses.length;
    var existing = findResponse(nameInput.value);
    var checkedDates = existing
      ? state.days.filter(function (d, i) { return existing.days[i]; }).map(function (d) { return d.date; })
      : Array.prototype.slice.call(daysGrid.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) {
          return cb.dataset.date;
        });

    daysGrid.innerHTML = '';
    state.days.forEach(function (day, i) {
      var names = state.responses.filter(function (r) { return r.days[i]; }).map(function (r) { return r.name; });
      var count = names.length;
      var alpha = total > 0 ? count / total : 0;

      var row = document.createElement('div');
      row.className = 'day-row';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.date = day.date;
      checkbox.checked = checkedDates.indexOf(day.date) !== -1;
      checkbox.id = 'day-' + i;

      var label = document.createElement('label');
      label.className = 'day-label';
      label.htmlFor = checkbox.id;
      label.textContent = day.label;

      var heat = document.createElement('div');
      heat.className = 'heat-cell';
      heat.tabIndex = 0;
      heat.style.background = 'rgba(' + HEAT_RGB + ', ' + (0.12 + alpha * 0.75) + ')';
      heat.textContent = count === 0 ? '—' : String(count);
      heat.dataset.names = count === 0 ? 'No one yet' : names.join('\n');
      heat.setAttribute('aria-label', count + ' free: ' + (names.join(', ') || 'no one yet'));

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(heat);
      daysGrid.appendChild(row);
    });
  }

  function loadFromServer(data) {
    state.title = data.title;
    state.days = data.days;
    state.responses = data.responses;
    render();
  }

  nameInput.addEventListener('input', function () {
    var normalized = normalizeName(nameInput.value);
    if (normalized === loadedForName) return;

    var existing = findResponse(nameInput.value);
    if (existing) {
      loadedForName = normalized;
      render();
    } else if (loadedForName !== null) {
      // Checkboxes currently reflect a different, previously-matched person's picks.
      // Clear them so those picks don't get attributed to whoever is typed next.
      loadedForName = null;
      Array.prototype.forEach.call(daysGrid.querySelectorAll('input[type="checkbox"]'), function (cb) {
        cb.checked = false;
      });
    }
  });

  submitBtn.addEventListener('click', function () {
    var name = nameInput.value.trim();
    if (!name) {
      saveStatus.textContent = 'Enter your name first.';
      saveStatus.style.color = 'var(--accent)';
      nameInput.focus();
      return;
    }

    var selectedDates = Array.prototype.slice
      .call(daysGrid.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function (cb) { return cb.dataset.date; });

    submitBtn.disabled = true;
    saveStatus.style.color = '';
    saveStatus.textContent = 'Saving…';

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ poll: poll, name: name, days: selectedDates })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        submitBtn.disabled = false;
        if (data.error) {
          saveStatus.style.color = 'var(--accent)';
          saveStatus.textContent = data.error;
          return;
        }
        loadedForName = normalizeName(name);
        loadFromServer(data);
        saveStatus.style.color = '';
        saveStatus.textContent = 'Saved.';
      })
      .catch(function () {
        submitBtn.disabled = false;
        saveStatus.style.color = 'var(--accent)';
        saveStatus.textContent = 'Could not save — check your connection and try again.';
      });
  });

  function init() {
    if (!poll) {
      showError('No poll specified. Add ?poll=<slug> to the URL.');
      return;
    }
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('PASTE_') === 0) {
      showError('This poll is not connected to a Google Sheet yet (config.js needs an Apps Script URL).');
      return;
    }

    fetch(APPS_SCRIPT_URL + '?poll=' + encodeURIComponent(poll))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          showError(data.error);
          return;
        }
        loadingMsg.hidden = true;
        app.hidden = false;
        loadFromServer(data);
      })
      .catch(function () {
        showError('Could not load this poll — check your connection and try again.');
      });
  }

  init();
})();
