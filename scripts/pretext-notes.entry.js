import { prepareInlineFlow, walkInlineFlowLines } from './vendor/pretext/inline-flow.ts';

const MAX_NOTE_WIDTH = 392;
const MIN_NOTE_WIDTH = 220;
const NOTE_CHROME_WIDTH = 28;
const CHIP_CHROME_WIDTH = 18;

const TEXT_STYLES = {
  body: {
    className: 'pretext-frag pretext-frag--body',
    extraWidth: 0,
    font: '500 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  accent: {
    className: 'pretext-frag pretext-frag--accent',
    extraWidth: 0,
    font: '600 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  muted: {
    className: 'pretext-frag pretext-frag--muted',
    extraWidth: 0,
    font: '500 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
};

const CHIP_CLASS_NAMES = {
  cue: 'pretext-chip pretext-chip--cue',
  note: 'pretext-chip pretext-chip--note',
  pulse: 'pretext-chip pretext-chip--pulse',
};

const CHIP_FONT = '600 10px "SF Mono", ui-monospace, Menlo, Monaco, monospace';

const NOTE_CONTENT = {
  news: {
    en: [
      { kind: 'chip', label: 'field note', tone: 'note' },
      { kind: 'text', text: ' motors gossip, ', style: 'body' },
      { kind: 'chip', label: 'wire loop', tone: 'cue' },
      { kind: 'text', text: ' keeps time, and ', style: 'body' },
      { kind: 'chip', label: 'tick-tock', tone: 'pulse' },
      { kind: 'text', text: ' still insists it arrived first.', style: 'muted' },
    ],
    ko: [
      { kind: 'chip', label: 'field note', tone: 'note' },
      { kind: 'text', text: ' 모터는 수군거리고, ', style: 'body' },
      { kind: 'chip', label: 'wire loop', tone: 'cue' },
      { kind: 'text', text: ' 는 박자를 잡고, ', style: 'body' },
      { kind: 'chip', label: 'tick-tock', tone: 'pulse' },
      { kind: 'text', text: ' 은 아직도 자기가 먼저 시작했다고 우깁니다.', style: 'muted' },
    ],
  },
  recordings: {
    en: [
      { kind: 'chip', label: 'listening mode', tone: 'note' },
      { kind: 'text', text: ' ', style: 'body' },
      { kind: 'chip', label: 'headphones', tone: 'cue' },
      { kind: 'text', text: ' recommended, ', style: 'body' },
      { kind: 'chip', label: 'room tone', tone: 'pulse' },
      { kind: 'text', text: ' counts as a collaborator, and ', style: 'body' },
      { kind: 'chip', label: 'do not shuffle', tone: 'cue' },
      { kind: 'text', text: ' is only half a joke.', style: 'muted' },
    ],
    ko: [
      { kind: 'chip', label: 'listening mode', tone: 'note' },
      { kind: 'text', text: ' ', style: 'body' },
      { kind: 'chip', label: 'headphones', tone: 'cue' },
      { kind: 'text', text: ' 권장, ', style: 'body' },
      { kind: 'chip', label: 'room tone', tone: 'pulse' },
      { kind: 'text', text: ' 도 협업자로 취급하고, ', style: 'body' },
      { kind: 'chip', label: 'do not shuffle', tone: 'cue' },
      { kind: 'text', text: ' 는 농담 같지만 반쯤 진심입니다.', style: 'muted' },
    ],
  },
};

const preparedCache = new Map();
let scheduled = false;

function getLang() {
  return document.documentElement.lang.startsWith('ko') ? 'ko' : 'en';
}

function prepareNote(specs) {
  const classNames = specs.map((spec) =>
    spec.kind === 'chip' ? CHIP_CLASS_NAMES[spec.tone] : TEXT_STYLES[spec.style].className,
  );

  const flow = prepareInlineFlow(
    specs.map((spec) => {
      if (spec.kind === 'chip') {
        return {
          text: spec.label,
          font: CHIP_FONT,
          break: 'never',
          extraWidth: CHIP_CHROME_WIDTH,
        };
      }

      const style = TEXT_STYLES[spec.style];
      return {
        text: spec.text,
        font: style.font,
        extraWidth: style.extraWidth,
      };
    }),
  );

  return { classNames, flow };
}

function getPreparedNote(key, lang) {
  const cacheKey = `note:${key}:${lang}`;
  if (preparedCache.has(cacheKey)) return preparedCache.get(cacheKey);

  const specs = NOTE_CONTENT[key]?.[lang];
  if (!specs) return null;

  const prepared = prepareNote(specs);
  preparedCache.set(cacheKey, prepared);
  return prepared;
}

function layoutPreparedNote(prepared, maxWidth) {
  const lines = [];
  let widestLine = 0;

  walkInlineFlowLines(prepared.flow, maxWidth, (line) => {
    widestLine = Math.max(widestLine, line.width);
    lines.push({
      fragments: line.fragments.map((fragment) => ({
        className: prepared.classNames[fragment.itemIndex],
        leadingGap: fragment.gapBefore,
        text: fragment.text,
      })),
    });
  });

  return { lines, widestLine };
}

function buildNoteRows(lines) {
  const fragment = document.createDocumentFragment();

  for (const line of lines) {
    const row = document.createElement('div');
    row.className = 'pretext-note__row';

    for (const part of line.fragments) {
      const span = document.createElement('span');
      span.className = part.className;
      span.textContent = part.text;
      if (part.leadingGap > 0) span.style.marginLeft = `${part.leadingGap}px`;
      row.appendChild(span);
    }

    fragment.appendChild(row);
  }

  return fragment;
}

function measureContentWidth(el) {
  if (!el) return document.documentElement.clientWidth;
  const cs = getComputedStyle(el);
  const pad = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
  return Math.max(0, el.clientWidth - pad);
}

function renderNote(node) {
  const key = node.dataset.pretextNote;
  const lang = getLang();
  const prepared = getPreparedNote(key, lang);

  if (!prepared) {
    node.hidden = true;
    return;
  }

  // clientWidth includes the parent's padding, which the note cannot use.
  const parentWidth = measureContentWidth(node.parentElement);
  // The rendered note is availableWidth + NOTE_CHROME_WIDTH, so the chrome has
  // to come out of the budget here — subtracting less overflowed the viewport
  // on narrow screens. The floor is also capped to what the parent can hold.
  const contentBudget = parentWidth - NOTE_CHROME_WIDTH;
  const availableWidth = Math.max(
    Math.min(MIN_NOTE_WIDTH, contentBudget),
    Math.min(MAX_NOTE_WIDTH, contentBudget)
  );
  const { lines, widestLine } = layoutPreparedNote(prepared, availableWidth);

  if (lines.length === 0) {
    node.hidden = true;
    return;
  }

  node.hidden = false;
  node.textContent = '';
  node.appendChild(buildNoteRows(lines));
  const noteWidth = Math.min(
    parentWidth,
    availableWidth + NOTE_CHROME_WIDTH,
    Math.ceil(widestLine) + NOTE_CHROME_WIDTH
  );
  node.style.width = `${noteWidth}px`;
}

function renderAll() {
  scheduled = false;

  document.querySelectorAll('.pretext-note[data-pretext-note]').forEach((node) => {
    if (node instanceof HTMLDivElement) renderNote(node);
  });
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(renderAll);
}

function init() {
  const selectors = ['.pretext-note[data-pretext-note]'];

  if (!selectors.some((selector) => document.querySelector(selector))) return;

  scheduleRender();
  window.addEventListener('resize', scheduleRender);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(init, init);
    } else {
      init();
    }
  });
} else if (document.fonts?.ready) {
  document.fonts.ready.then(init, init);
} else {
  init();
}
