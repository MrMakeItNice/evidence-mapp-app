/* Globe topic discovery: browser-only navigation; no inferred geographic markers. */
(() => {
  'use strict';
  const form = document.getElementById('globe-explore-form');
  const input = document.getElementById('globe-explore-query');
  const panel = document.getElementById('globe-explore-panel');
  const title = document.getElementById('globe-explore-title');
  const summary = document.getElementById('globe-explore-summary');
  const links = document.getElementById('globe-explore-links');
  const status = document.getElementById('globe-explore-status');
  const close = document.getElementById('globe-explore-close');
  if (![form, input, panel, title, summary, links, status, close].every(Boolean)) return;
  const globeArea = panel.closest('.globe-area');
  if (!globeArea) return;

  const lenses = {
    rabbit: {
      title: 'Rabbit Holes · explore mysteries',
      summary: 'Follow open questions and competing interpretations alongside documented cases. A shared topic does not prove a connection.',
      links: [['Explore Rabbit Holes', './rabbit-hole.html'], ['Review documented Case Files', './discover.html'], ['Open Evidence Board', './evidence-board.html']]
    },
    cases: {
      title: 'Case Files · documented investigations',
      summary: 'Explore published case records and examine the underlying citations before drawing conclusions.',
      links: [['Browse Case Files', './discover.html'], ['Inspect Paper Trails', './paper-trails.html'], ['Open Evidence Board', './evidence-board.html']]
    },
    records: {
      title: 'Documents · inspect provenance',
      summary: 'Trace publicly available sources and declassified records. An authentic document does not verify every claim inside it.',
      links: [['Explore Paper Trails', './paper-trails.html'], ['Search published records', './global-search.html'], ['Inspect Connections', './connection-explorer.html']]
    },
    connections: {
      title: 'Connections · inspect evidence',
      summary: 'Explore recorded associations while distinguishing documented links from thematic similarities and unverified hypotheses.',
      links: [['Open Connection Explorer', './connection-explorer.html'], ['Open Evidence Board', './evidence-board.html'], ['Browse Case Files', './discover.html']]
    }
  };

  function classify(value) {
    const normalized = value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    if (/^(rabbit[ -]?holes?|mysteries|mystery atlas)$/.test(normalized)) return 'rabbit';
    if (/^(cases?|case files?|investigations?)$/.test(normalized)) return 'cases';
    if (/^(declassified (files?|records?)|documents?|sources?|paper trails?|government records?)$/.test(normalized)) return 'records';
    if (/^(connections?|relationships?|relationship map)$/.test(normalized)) return 'connections';
    return 'topic';
  }

  input.addEventListener('input', () => input.setCustomValidity(''));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!query) {
      input.setCustomValidity('Enter a topic or choose a research shortcut.');
      input.reportValidity();
      input.focus();
      return;
    }
    input.setCustomValidity('');
    const lens = classify(query);
    const data = lenses[lens] || {
      title: 'Explore a research topic',
      summary: 'Search the published archive for matching investigations. External discovery results remain unverified research leads.',
      links: [['Search for “' + query + '”', './global-search.html?q=' + encodeURIComponent(query)], ['Browse Rabbit Holes', './rabbit-hole.html'], ['Open Evidence Board', './evidence-board.html']]
    };
    title.textContent = data.title;
    summary.textContent = data.summary;
    links.replaceChildren();
    for (const [label, href] of data.links) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label + ' ↗';
      links.append(link);
    }
    panel.hidden = false;
    globeArea.classList.add('globe-lens-open');
    panel.focus();
    status.textContent = data.title + ' opened beside the globe. Choose a research destination.';
  });

  // Shortcut buttons use the same validated submit path as typed queries.
  for (const button of form.querySelectorAll('[data-globe-topic]')) {
    button.addEventListener('click', () => {
      input.value = button.dataset.globeTopic;
      input.setCustomValidity('');
      form.requestSubmit();
    });
  }

  function closeLens() {
    if (panel.hidden) return;
    panel.hidden = true;
    globeArea.classList.remove('globe-lens-open');
    input.focus();
    status.textContent = 'Research lens closed. Search another topic.';
  }

  close.addEventListener('click', closeLens);
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    closeLens();
  });
})();
