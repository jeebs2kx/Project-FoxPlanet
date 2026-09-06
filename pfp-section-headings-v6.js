(() => {
  'use strict';

  const VERSION = '8.0.0';
  if (window.__pfpSectionHeadingsV6 === VERSION) return;
  window.__pfpSectionHeadingsV6 = VERSION;


  function headingKind(text) {
    const value = String(text || '').trim().toLowerCase();

    if (/map\s*\+\s*model|hits|debug|tool|viewer|browser|gallery|explorer|patcher|converter|editor|setup|trigger|warp|compare|import|model|object|character|animation|texture|asset|audio|music|voice|sound|sfx|musyx|sequence|cinematic|animcurv|objseq|documentation/.test(value)) {
      return 'other';
    }

    if (/\bmaps?\b|\blevels?\b|\bareas?\b/.test(value)) return 'maps';
    return 'other';
  }

  function detectListTheme(scroll) {
    const ownText = String(scroll.textContent || '').toLowerCase();
    const panel = scroll.closest('.sfa-list, .sfa-left-menu, .sfa-right-menu');
    const panelText = String(panel?.textContent || ownText).toLowerCase();
    const value = `${ownText} ${panelText}`;

    if (/dinosaur\s+planet|(?:^|\s)dp\s*:/.test(value)) return 'dp';
    if (/star\s+fox\s+adventures|(?:^|\s)sfa\s*:|\bkiosk\b|\bfinal\s+maps?\b|\bearly\s+2001\b|\bearly\s+2002\b/.test(value)) return 'sfa';

    return document.body?.dataset?.gameTheme === 'dp' ? 'dp' : 'sfa';
  }

  function doGameSwitch(game) {
    try {
      const sceneSelect = window.main && window.main.ui && window.main.ui.sceneSelect;
      if (sceneSelect && typeof sceneSelect.onGameLogoClicked === 'function') {
        sceneSelect.onGameLogoClicked(game);
        return;
      }
      if (window.main && typeof window.main.setActiveGame === 'function') {
        window.main.setActiveGame(game);
      }
    } catch (_) {}
  }

  function makeLogoButton(game, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pfp-game-logo-button pfp-game-logo-${game}`;
    button.dataset.game = game;
    button.title = `Switch to ${title}`;
    button.setAttribute('aria-label', `Switch to ${title}`);

    const label = document.createElement('span');
    label.className = 'pfp-game-text-logo';
    label.textContent = title.toUpperCase();
    button.appendChild(label);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doGameSwitch(game);
    });
    button.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    return button;
  }

  function updateGameSwitcherActive(switcher) {
    const active = document.body?.dataset?.gameTheme === 'dp' ? 'dp' : 'sfa';
    switcher.querySelectorAll('.pfp-game-logo-button').forEach((button) => {
      const isActive = button.dataset.game === active;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function decorateGameSwitcher(scroll) {
    const rows = Array.from(scroll.children);
    let headingRow = rows.find((row) => {
      const header = row.querySelector('span.header');
      return header && /MAP\s*\+\s*MODEL\s+VIEWER\s+FOR\s+SFA\s+AND\s+DP/i.test(header.textContent || '');
    });
    if (!headingRow) headingRow = rows.find((row) => row.dataset.pfpGameSwitchHeader === '1');
    if (!headingRow) return;

    headingRow.dataset.pfpGameSwitchHeader = '1';
    headingRow.classList.add('pfp-game-switch-heading');

    const header = headingRow.querySelector('span.header');
    if (!header) return;

    let switcher = header.querySelector('.pfp-game-switcher');
    if (!switcher) {
      header.textContent = '';
      switcher = document.createElement('div');
      switcher.className = 'pfp-game-switcher';
      switcher.appendChild(makeLogoButton('sfa', 'Star Fox Adventures'));

      const divider = document.createElement('span');
      divider.className = 'pfp-game-logo-divider';
      divider.setAttribute('aria-hidden', 'true');
      switcher.appendChild(divider);

      switcher.appendChild(makeLogoButton('dp', 'Dinosaur Planet'));
      header.appendChild(switcher);
    }
    updateGameSwitcherActive(switcher);

    // hide the old name rows, the buttons do that job now
    for (const row of rows) {
      const text = row.querySelector('span.text');
      const label = String(text?.textContent || '').trim();
      if (label === 'Star Fox Adventures' || label === 'Dinosaur Planet') {
        row.classList.add('pfp-game-group-row');
      }
    }
  }

  function decorate(root = document) {
    if (!document.body) return;

    document.body.classList.add('pfp-headings-v6');
    document.body.classList.remove(
      'pfp-headings-v3', 'pfp-headings-v4', 'pfp-headings-v5',
      'pfp-visual-v2', 'pfp-visual-overhaul',
      'pfp-heading-theme-dp', 'pfp-heading-theme-sfa'
    );

    root.querySelectorAll('.sfa-list-scroll').forEach((scroll) => {
      const theme = detectListTheme(scroll);
      scroll.classList.toggle('pfp-list-theme-dp', theme === 'dp');
      scroll.classList.toggle('pfp-list-theme-sfa', theme !== 'dp');

      Array.from(scroll.children).forEach((row) => {
        const header = row.querySelector('span.header');
        if (!header) return;
        row.classList.add('pfp-section-heading');
        if (row.dataset.pfpGameSwitchHeader !== '1') {
          row.dataset.pfpHeadingKind = headingKind(header.textContent);
        }
      });

      decorateGameSwitcher(scroll);
    });
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-game-theme'],
  });
  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('hashchange', schedule, true);
})();
