(() => {
'use strict';

function cloneTemplate(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

const themeToggle = document.getElementById('themeToggle');
const pathEl      = document.getElementById('pathIndicator');
const flowEl      = document.getElementById('flow');
const dbPanelBody = document.getElementById('dbPanelBody');
const restartBar  = document.getElementById('restartBar');
const restartBtn  = document.getElementById('restartBtn');

const INITIAL_CRUMB = 'Launch';

let stepCount  = 0;
let pathCrumbs = [INITIAL_CRUMB];
let context    = {};

themeToggle.addEventListener('click', () => {
  const root = document.documentElement;
  const current = root.style.colorScheme;
  let isDark;
  if (current === 'light') {
    root.style.colorScheme = 'dark';
    isDark = true;
  } else if (current === 'dark') {
    root.style.colorScheme = 'light';
    isDark = false;
  } else {
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    root.style.colorScheme = prefersDark ? 'light' : 'dark';
    isDark = !prefersDark;
  }
  themeToggle.setAttribute('aria-pressed', String(isDark));
});

function updatePath() {
  const nodes = pathCrumbs.flatMap((c, i) => {
    const crumb = document.createElement('span');
    crumb.className = i === pathCrumbs.length - 1
      ? 'path-indicator__crumb path-indicator__crumb--active'
      : 'path-indicator__crumb';
    crumb.textContent = c;

    if (i < pathCrumbs.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'path-indicator__sep';
      sep.textContent = '\u2192';
      return [crumb, sep];
    }
    return [crumb];
  });
  pathEl.replaceChildren(...nodes);
}

function addCrumb(label) {
  pathCrumbs.push(label);
  updatePath();
}

function addConnector() {
  const conn = document.createElement('div');
  conn.className = 'flow__connector';
  flowEl.appendChild(conn);
}

function showRestart() {
  restartBar.classList.add('restart-bar--visible');
}

function resetDbPanel() {
  dbPanelBody.querySelectorAll('.db-panel__section').forEach(s => s.remove());
  const empty = dbPanelBody.querySelector('.db-panel__empty');
  if (empty) {
    empty.classList.remove('db-panel__empty--hidden');
    empty.textContent = 'No database operations yet.';
  }
}

function updateDbPanel(db, stepNum) {
  if (!db || db.length === 0) return;

  const empty = dbPanelBody.querySelector('.db-panel__empty');
  if (empty) empty.classList.add('db-panel__empty--hidden');

  const section = cloneTemplate('tpl-db-section');
  section.dataset.dbStep = stepNum;
  section.querySelector('.db-panel__step-label').textContent = `Step ${stepNum}`;

  for (const op of db) {
    const opEl = cloneTemplate('tpl-db-op');
    const badge = opEl.querySelector('.db-panel__badge');
    badge.className = `db-panel__badge db-panel__badge--${op.op.toLowerCase()}`;
    badge.textContent = op.op;
    opEl.querySelector('.db-panel__entity').textContent = op.entity;
    section.appendChild(opEl);

    if (op.fields) {
      const fieldsEl = cloneTemplate('tpl-db-fields');
      for (const [k, v] of Object.entries(op.fields)) {
        const fieldEl = cloneTemplate('tpl-db-field');
        const valueSpan = fieldEl.querySelector('span');
        fieldEl.insertBefore(document.createTextNode(`${k}: `), valueSpan);
        valueSpan.textContent = v;
        fieldsEl.appendChild(fieldEl);
      }
      section.appendChild(fieldsEl);
    }

    if (op.note) {
      const noteEl = cloneTemplate('tpl-db-note');
      noteEl.textContent = op.note;
      section.appendChild(noteEl);
    }
  }

  dbPanelBody.appendChild(section);

  const panel = dbPanelBody.closest('.db-panel');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function truncateDbPanel(afterStepNum) {
  dbPanelBody.querySelectorAll('.db-panel__section').forEach(s => {
    if (parseInt(s.dataset.dbStep, 10) > afterStepNum) {
      s.remove();
    }
  });

  if (!dbPanelBody.querySelector('.db-panel__section')) {
    const empty = dbPanelBody.querySelector('.db-panel__empty');
    if (empty) {
      empty.classList.remove('db-panel__empty--hidden');
      empty.textContent = 'No database operations yet.';
    }
  }
}

function rewindToStep(stepEl) {
  while (stepEl.nextElementSibling) {
    stepEl.nextElementSibling.remove();
  }

  stepEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('decision-card--chosen', 'decision-card--dimmed', 'btn--done');
  });

  stepEl.classList.remove('step--past');

  stepCount = parseInt(stepEl.dataset.stepIndex, 10);

  const crumbIndex = parseInt(stepEl.dataset.crumbIndex, 10);
  pathCrumbs = pathCrumbs.slice(0, crumbIndex + 1);
  updatePath();

  restartBar.classList.remove('restart-bar--visible');
  truncateDbPanel(stepCount);

  const savedCtx = stepEl.dataset.context;
  context = savedCtx ? JSON.parse(savedCtx) : {};

  requestAnimationFrame(() => {
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function addStep({ type, actor, title, body, endpoint, outcome, actions, finalState, db }) {
  stepCount++;
  if (flowEl.children.length > 0) addConnector();

  flowEl.querySelectorAll('.step').forEach(s => {
    if (!s.classList.contains('step--past')) {
      s.classList.add('step--past');
    }
  });

  const step = cloneTemplate('tpl-step');
  if (type) step.classList.add(`step--${type}`);

  step.dataset.stepIndex = stepCount;
  step.dataset.crumbIndex = pathCrumbs.length - 1;
  step.dataset.context = JSON.stringify(context);

  const header = step.querySelector('.step__header');
  header.querySelector('.step__number').textContent = stepCount;

  if (actor) {
    const badge = cloneTemplate('tpl-actor-badge');
    badge.classList.add(`actor-badge--${actor.toLowerCase()}`);
    badge.textContent = actor;
    header.appendChild(badge);
  }

  if (title) {
    const titleEl = cloneTemplate('tpl-step-title');
    titleEl.textContent = title;
    header.appendChild(titleEl);
  }

  if (body) {
    const bodyEl = cloneTemplate('tpl-step-body');
    bodyEl.textContent = body;
    step.appendChild(bodyEl);
  }

  if (endpoint) {
    const endpointEl = cloneTemplate('tpl-step-endpoint');
    endpointEl.textContent = endpoint;
    step.appendChild(endpointEl);
  }

  if (outcome) {
    const outcomeEl = cloneTemplate('tpl-step-outcome');
    outcomeEl.textContent = outcome;
    step.appendChild(outcomeEl);
  }

  if (finalState) {
    const fsEl = cloneTemplate('tpl-final-state');
    if (finalState.icon) {
      fsEl.querySelector('.final-state__icon').textContent = finalState.icon;
    } else {
      fsEl.querySelector('.final-state__icon').remove();
    }
    fsEl.querySelector('.final-state__title').textContent = finalState.title;
    fsEl.querySelector('.final-state__desc').textContent = finalState.desc;
    step.appendChild(fsEl);
  }

  if (actions && actions.layout === 'buttons') {
    const wrapper = cloneTemplate('tpl-step-actions');
    for (const item of actions.items) {
      const btn = cloneTemplate('tpl-btn');
      if (item.class) btn.classList.add(item.class);
      btn.dataset.action = item.action;
      btn.textContent = item.label;
      wrapper.appendChild(btn);
    }
    step.appendChild(wrapper);
  }

  if (actions && actions.layout === 'decisions') {
    const grid = cloneTemplate('tpl-decision-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Choose an option');
    for (const item of actions.items) {
      const card = cloneTemplate('tpl-decision-card');
      card.dataset.action = item.action;
      card.querySelector('.decision-card__title').textContent = item.title;
      const descEl = card.querySelector('.decision-card__desc');
      if (item.desc) {
        descEl.textContent = item.desc;
      } else {
        descEl.remove();
      }
      grid.appendChild(card);
    }
    step.appendChild(grid);
  }

  flowEl.appendChild(step);
  updateDbPanel(db, stepCount);

  requestAnimationFrame(() => {
    step.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (actions && actions.handler) {
    const actionEls = step.querySelectorAll('[data-action]');
    actionEls.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;

        actionEls.forEach(b => {
          b.disabled = true;
          if (b === btn) {
            b.classList.add('decision-card--chosen');
            if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'true');
          } else {
            b.classList.add('decision-card--dimmed');
            if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
          }
        });

        if (btn.classList.contains('btn')) {
          btn.disabled = true;
          btn.classList.add('btn--done');
        }

        actions.handler(action);
      });
    });
  }

  step.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    if (!step.classList.contains('step--past')) return;
    rewindToStep(step);
  });

  return step;
}

const IDENTITY_BODY = {
  email: 'Looks up the email via network "auth-provider" to check if a full account already exists.',
  social: 'Looks up the identity via network "google" (scoped by app key) to check if a full account already exists.',
  console: 'Looks up the PSN identity to check if a full account already exists. Console UIDs are globally unique.',
};

const IDENTITY_DB = {
  email: [
    { op: 'READ', entity: 'UserAccount', fields: { email: '"player@example.com"' }, note: 'Query by email GSI' },
  ],
  social: [
    { op: 'READ', entity: 'LinkedSocial', fields: { SK: '"app#my-app-key#social#google#uid#3001"' }, note: 'Query by app + social provider + uid' },
  ],
  console: [
    { op: 'READ', entity: 'LinkedConsole', fields: { SK: '"console#header#PLAYSTATION#uid#2001"' }, note: 'Query by console platform + uid' },
  ],
};

const PROMOTE_BODY = {
  email: 'Guest account promoted to full account in-place. Email set via network "auth-provider". Same user_id.',
  social: 'Guest account promoted to full account in-place. Identity linked via network "google". Same user_id.',
  console: 'Guest account promoted to full account in-place. PSN console linked. Same user_id.',
};

const PROMOTE_LINK_OPS = {
  email: [
    { op: 'UPDATE', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', email: '"player@example.com"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Email set on account (verified via network "auth-provider")' },
    { op: 'CREATE', entity: 'LinkedProfile', fields: { PK: '"usr_001"', SK: '"profile#provider#authprovider#id#ap_01"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'OTP identity via network "auth-provider"' },
  ],
  social: [
    { op: 'CREATE', entity: 'LinkedSocial', fields: { PK: '"usr_001"', SK: '"app#my-app-key#social#google#uid#3001"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Social identity via network "google", scoped by app key' },
  ],
  console: [
    { op: 'CREATE', entity: 'LinkedConsole', fields: { PK: '"usr_001"', SK: '"console#header#PLAYSTATION#uid#2001"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'PSN linked \u2014 globally unique UID' },
  ],
};

const LINK_BODY = {
  email: 'Full account absorbs the guest Steam link and Game ID. Email identity linked via network "auth-provider". Guest account deactivated.',
  social: 'Full account absorbs the guest Steam link and Game ID. Identity linked via network "google". Guest account deactivated.',
  console: 'Full account absorbs the guest Steam link and Game ID. PSN console linked. Guest account deactivated.',
};

const LINK_LINK_OPS = {
  email: [
    { op: 'UPDATE', entity: 'UserAccount', fields: { PK: '"usr_002"', SK: '"header"', email: '"player@example.com"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Email set on full account (verified via network "auth-provider")' },
    { op: 'CREATE', entity: 'LinkedProfile', fields: { PK: '"usr_002"', SK: '"profile#provider#authprovider#id#ap_01"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'OTP identity via network "auth-provider"' },
  ],
  social: [
    { op: 'CREATE', entity: 'LinkedSocial', fields: { PK: '"usr_002"', SK: '"app#my-app-key#social#google#uid#3001"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Social identity via network "google" on full account, scoped by app key' },
  ],
  console: [
    { op: 'CREATE', entity: 'LinkedConsole', fields: { PK: '"usr_002"', SK: '"console#header#PLAYSTATION#uid#2001"', active: '"true"', createdAt: '"2026-03-11T14:35:22.178Z"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'PSN linked to full account \u2014 globally unique UID' },
  ],
};

const FLOW = {
  start: {
    type: 'info',
    actor: 'Console',
    title: 'Player launches the game',
    body: 'Steam SDK provides a platform token. Client sends it to the server.',
    endpoint: 'POST /oauth/token (token-exchange)',
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'platformLookup' }],
    },
  },

  platformLookup: {
    crumb: 'Platform lookup',
    type: 'decision',
    actor: 'Server',
    title: 'Look up Steam ID',
    body: 'Server looks up the Steam platform UID. Is it linked to an existing account?',
    db: [
      { op: 'READ', entity: 'LinkedPlatform', fields: { SK: '"platform#header#STEAM#uid#1001"' }, note: 'Query by platform + uid' },
    ],
    actions: {
      layout: 'decisions',
      items: [
        { title: 'Not linked', desc: 'Steam ID is not linked to any account.', action: 'not-linked', next: 'notLinked' },
        { title: 'Linked (guest)', desc: 'Steam ID is already linked to a guest account.', action: 'linked-guest', next: 'linkedGuest' },
      ],
    },
  },

  notLinked: {
    crumb: 'Not linked',
    type: '',
    actor: 'Server',
    title: 'No account found for this Steam ID',
    body: 'No LinkedPlatform record exists. A new guest account will be created.',
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'createGuest' }],
    },
  },

  linkedGuest: {
    crumb: 'Linked (guest)',
    type: '',
    actor: 'Server',
    title: 'Steam ID linked to a guest account',
    body: 'LinkedPlatform record found. Points to a guest account.',
    db: [
      { op: 'READ', entity: 'LinkedPlatform', fields: { PK: '"usr_001"', SK: '"platform#header#STEAM#uid#1001"', active: '"true"', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' } },
      { op: 'READ', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', email: 'null', verified: 'false', active: 'true', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' }, note: 'verified: false \u2192 guest' },
    ],
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'signInGuest' }],
    },
  },

  createGuest: {
    crumb: 'CREATE_GUEST',
    type: 'event',
    actor: 'Server',
    title: 'Create guest account + sign in',
    body: 'New guest account created. Player signed in immediately.',
    outcome: 'CREATE_GUEST + SIGN_IN_GUEST',
    db: [
      { op: 'CREATE', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', email: 'null', verified: 'false', active: 'true', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' } },
      { op: 'CREATE', entity: 'GuestAccount', fields: { PK: '"usr_001"', SK: '"guest"', active: '"true"', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' } },
      { op: 'CREATE', entity: 'LinkedPlatform', fields: { PK: '"usr_001"', SK: '"platform#header#STEAM#uid#1001"', active: '"true"', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' } },
    ],
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--success', next: 'guestSession' }],
    },
  },

  signInGuest: {
    crumb: 'SIGN_IN_GUEST',
    type: 'event',
    actor: 'Server',
    title: 'Sign in to guest account',
    body: 'Player signed into their existing guest account.',
    outcome: 'SIGN_IN_GUEST',
    db: [
      { op: 'READ', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', email: 'null', verified: 'false', active: 'true', createdAt: '"2026-03-11T14:32:07.041Z"', updatedAt: '"2026-03-11T14:32:07.041Z"' } },
      { op: 'UPDATE', entity: 'GuestAccount', fields: { PK: '"usr_001"', SK: '"guest"', active: '"true"', updatedAt: '"2026-03-11T14:32:09.817Z"' } },
    ],
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--success', next: 'guestSession' }],
    },
  },

  guestSession: {
    crumb: 'Guest session',
    type: 'decision',
    actor: 'Console',
    title: 'Guest session active',
    body: 'Player is in a guest session. Upgrade to a full account?',
    actions: {
      layout: 'decisions',
      items: [
        { title: 'Continue playing', desc: 'Stay in guest mode. No account upgrade.', action: 'no-upgrade', next: 'continueGuest' },
        { title: 'Upgrade account', desc: 'Link to a full account for cross-device play, recovery, etc.', action: 'upgrade', next: 'upgradeChoice' },
      ],
    },
  },

  continueGuest: {
    crumb: 'Continue guest',
    type: 'end',
    title: 'Continue Playing (Guest)',
    terminal: true,
    finalState: {
      icon: '\uD83C\uDFAE',
      title: 'Guest Session Active',
      desc: 'Player continues in guest mode. They can choose to upgrade at any time in the future.',
    },
  },

  upgradeChoice: {
    crumb: 'Upgrade',
    type: 'decision',
    actor: 'Console',
    title: 'Choose upgrade method',
    body: 'How will the player verify their identity?',
    actions: {
      layout: 'decisions',
      items: [
        { title: 'Network (OTP)', desc: 'Device Code flow with network "auth-provider". Email one-time password.', action: 'email', next: 'deviceCodeEmail', setContext: { method: 'email' } },
        { title: 'Network (Social)', desc: 'Device Code flow with network "google". Scoped by app key.', action: 'social', next: 'deviceCodeSocial', setContext: { method: 'social' } },
        { title: 'Link Console (PSN)', desc: 'Link another console platform. Console UIDs are globally unique.', action: 'console', next: 'deviceCodeConsole', setContext: { method: 'console' } },
      ],
    },
  },

  deviceCodeEmail: {
    crumb: 'Network (OTP)',
    type: '',
    actor: 'Console',
    title: 'Device Code Flow \u2014 Network (OTP)',
    body: 'Player completes verification via network "auth-provider" (email OTP). Client exchanges the device code for a token.',
    endpoint: 'POST /oauth/token (device-code)',
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'identityMatch' }],
    },
  },

  deviceCodeSocial: {
    crumb: 'Network (Social)',
    type: '',
    actor: 'Console',
    title: 'Device Code Flow \u2014 Network (Social)',
    body: 'Player authenticates via network "google". Client exchanges the device code for a token. Scoped by app key.',
    endpoint: 'POST /oauth/token (device-code)',
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'identityMatch' }],
    },
  },

  deviceCodeConsole: {
    crumb: 'Console (PSN)',
    type: '',
    actor: 'Console',
    title: 'Device Code Flow \u2014 PSN Link',
    body: 'Player links their PlayStation Network account. Client exchanges the device code for a token. Console UIDs are globally unique.',
    endpoint: 'POST /oauth/token (device-code)',
    actions: {
      layout: 'buttons',
      items: [{ label: 'Next \u2192', action: 'next', class: 'btn--primary', next: 'identityMatch' }],
    },
  },

  identityMatch: {
    crumb: 'Identity check',
    type: 'decision',
    actor: 'Server',
    title: 'Check: does this identity match an existing account?',
    resolve: (ctx) => {
      return { body: IDENTITY_BODY[ctx.method], db: IDENTITY_DB[ctx.method] };
    },
    actions: {
      layout: 'decisions',
      items: [
        { title: 'No match', desc: 'No existing full account found. Promote the guest account in-place.', action: 'no-match', next: 'promoteGuest' },
        { title: 'Match found', desc: 'An existing full account already uses this identity.', action: 'match', next: 'linkGuest' },
      ],
    },
  },

  promoteGuest: {
    crumb: 'PROMOTE',
    type: 'event',
    actor: 'Server',
    title: 'Promote guest to full account',
    outcome: 'PROMOTE_GUEST',
    terminal: true,
    resolve: (ctx) => {
      const method = ctx.method;
      const isVerified = method === 'email' ? 'true' : 'false';

      const sharedOps = [
        { op: 'UPDATE', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', verified: isVerified, updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: isVerified === 'true' ? 'Promoted + verified \u2014 now a full account' : 'Promoted \u2014 not verified (no email)' },
        { op: 'UPDATE', entity: 'GuestAccount', fields: { PK: '"usr_001"', SK: '"guest"', active: '"false"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Soft-deactivated \u2014 retained for rollback' },
      ];

      return {
        body: PROMOTE_BODY[method],
        db: [...PROMOTE_LINK_OPS[method], ...sharedOps],
      };
    },
    finalState: {
      icon: '\u2705',
      title: 'Account Promoted',
      desc: 'Same user_id. Now a full account. Guest record kept for rollback.',
    },
  },

  linkGuest: {
    crumb: 'LINK',
    type: 'event',
    actor: 'Server',
    title: 'Link guest to existing full account',
    outcome: 'LINK_GUEST',
    terminal: true,
    resolve: (ctx) => {
      const method = ctx.method;
      const isVerified = method === 'email' ? 'true' : 'false';

      const sharedOps = [
        { op: 'UPDATE', entity: 'LinkedPlatform', fields: { PK: '"usr_002" \u2190 moved', SK: '"platform#header#STEAM#uid#1001"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Steam re-parented to full account' },
        { op: 'UPDATE', entity: 'UserAccount', fields: { PK: '"usr_002"', SK: '"header"', verified: isVerified, active: 'true', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: isVerified === 'true' ? 'Full account \u2014 now owns platform + verified' : 'Full account \u2014 now owns platform (not verified)' },
        { op: 'UPDATE', entity: 'UserAccount', fields: { PK: '"usr_001"', SK: '"header"', active: 'false', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Guest account deactivated' },
        { op: 'UPDATE', entity: 'GuestAccount', fields: { PK: '"usr_001"', SK: '"guest"', active: '"false"', updatedAt: '"2026-03-11T14:35:22.178Z"' }, note: 'Soft-deactivated \u2014 retained for rollback' },
      ];

      return {
        body: LINK_BODY[method],
        db: [...LINK_LINK_OPS[method], ...sharedOps],
      };
    },
    finalState: {
      icon: '\uD83D\uDD17',
      title: 'Accounts Linked',
      desc: 'Steam + Game ID moved to the full account. Guest records kept for rollback. Player continues under the full account\u2019s user_id.',
    },
  },
};

function renderNode(nodeId) {
  const node = FLOW[nodeId];
  if (!node) throw new Error(`Unknown flow node: ${nodeId}`);

  if (node.crumb) addCrumb(node.crumb);

  const resolved = node.resolve ? node.resolve(context) : {};
  const stepDef = { ...node, ...resolved };

  if (stepDef.actions) {
    stepDef.actions = {
      ...stepDef.actions,
      handler: (action) => {
        const item = node.actions.items.find(i => i.action === action);
        if (item.setContext) Object.assign(context, item.setContext);
        if (item.next) {
          renderNode(item.next);
        } else if (node.terminal) {
          showRestart();
        }
      },
    };
  }

  addStep(stepDef);

  if (node.terminal) showRestart();
}

function resetFlow() {
  flowEl.innerHTML = '';
  stepCount = 0;
  pathCrumbs = [INITIAL_CRUMB];
  context = {};
  updatePath();
  restartBar.classList.remove('restart-bar--visible');
  resetDbPanel();
  renderNode('start');
}

restartBtn.addEventListener('click', resetFlow);
renderNode('start');
})();
