// SolderSight — "No Answer Key" scene figures
// Fig 1: the board — a defective trace lights up under inspection
// Fig 2: the testimony — the inspection terminal writes its own confession
// Fig 3: the gate — Sapling's arm comes down on the ship lane

FIGS.push({
  id: 'board', name: 'The board', hint: 'Click the board · space re-inspects',
  aria: 'Isometric circuit board on an inspection plate. One trace is broken; scanning lights the gap.',
  mount(stage, api) {
    const K = api.iso.frame([[0,0,0],[300,0,0],[0,230,0],[300,230,0],[150,115,60]]);
    const { TOP, FRONT, box, rect } = K;
    let svg = box(0,0,0, 300,230,8, 12);                                   // ground plate
    svg += `<g transform="${TOP(12,12,8)}"><rect class="detail" x="0" y="0" width="276" height="206" rx="6"/></g>`;
    svg += box(40,40,8, 220,150,5, 3);                                     // the PCB
    // traces + pads on the board top plane (local 220x150)
    let t = `<g transform="${TOP(40,40,13)}">`;
    for (const y of [24, 44, 104, 124]) {
      t += `<rect class="detail" x="10" y="${y}" width="200" height="3" rx="1"/>`;
    }
    for (const x of [30, 70, 150, 190]) {
      t += `<rect class="detail" x="${x}" y="14" width="3" height="122" rx="1"/>`;
    }
    t += `<rect class="detail" x="88" y="58" width="34" height="34" rx="2" fill="none"/>`;        // chip outline
    t += `<rect class="detail" x="160" y="52" width="20" height="14" rx="1" fill="none"/>`;
    t += `<circle class="detail" cx="52" cy="70" r="9" fill="none"/><circle class="detail" cx="52" cy="70" r="3"/>`;
    // the defective street at y=74: two stubs with an 8-unit gap at x=96..104
    t += `<rect id="board-stub-a" class="detail" x="10" y="72.5" width="86" height="3"/>`;
    t += `<rect id="board-stub-b" class="detail" x="104" y="72.5" width="106" height="3"/>`;
    t += `<path id="board-crack" class="detail" d="M93 82 l5 -6 -3 6 5 -6 -3 6 5 -6" fill="none" stroke-width="1.6"/>`;
    t += `<circle id="board-halo" class="halo" cx="100" cy="74" r="26" filter="url(#bloom)"/>`;
    t += `<circle id="board-dot" class="halo" cx="100" cy="74" r="6" filter="url(#glow)"/>`;
    t += `</g>`;
    svg += t;
    // scan gantry: two posts + a carriage bar over the board
    svg += box(24,40,8, 10,150,44, 3);
    svg += box(266,40,8, 10,150,44, 3);
    svg += `<g id="board-beam">${box(24,86,52, 252,10,8, 3)}</g>`;
    svg += `<g transform="${FRONT(24,96,60)}"><rect class="detail" x="0" y="0" width="252" height="2"/></g>`;
    // scan light under the beam
    svg += `<g transform="${TOP(34,86,52)}"><rect id="board-scan" class="halo" x="0" y="0" width="232" height="10" filter="url(#bloom)"/></g>`;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;

    const st = { lit: false };
    const halo = stage.querySelector('#board-halo'), scan = stage.querySelector('#board-scan');
    const dot = stage.querySelector('#board-dot');
    const stubA = stage.querySelector('#board-stub-a'), stubB = stage.querySelector('#board-stub-b');
    const crack = stage.querySelector('#board-crack');
    function render() {
      halo.classList.toggle('hot', st.lit); scan.classList.toggle('hot', st.lit);
      dot.classList.toggle('hot', st.lit);
      stubA.classList.toggle('lit', st.lit); stubB.classList.toggle('lit', st.lit);
      crack.classList.toggle('lit', st.lit);
      api.power(st.lit);
      api.readout(st.lit ? 'open circuit · trace gap at cell (96,74)' : 'awaiting scan');
    }
    const inspect = () => { st.lit = true; render(); };
    stage.addEventListener('click', inspect);
    render();
    return { key: e => (e.key === ' ' || e.key === 'Enter') ? (inspect(), true) : false,
             demo: () => api.after(400, inspect) };
  },
});

FIGS.push({
  id: 'testimony', name: 'The testimony', hint: 'Click the terminal · space prints the verdict',
  aria: 'Isometric inspection terminal. Its screen types the model\u2019s own note, then clears the board to ship.',
  mount(stage, api) {
    const K = api.iso.frame([[0,0,0],[280,0,0],[0,220,0],[280,220,0],[140,110,140]]);
    const { TOP, FRONT, box } = K;
    let svg = box(0,0,0, 280,220,8, 12);                                   // desk plate
    svg += `<g transform="${TOP(12,12,8)}"><rect class="detail" x="0" y="0" width="256" height="196" rx="6"/></g>`;
    // terminal body with front screen
    svg += box(40,55,8, 200,90,120, 6);
    svg += `<g transform="${FRONT(40,145,128)}">
      <rect id="test-glass" class="face glass" x="12" y="10" width="176" height="92" rx="4"/>
      <clipPath id="test-clip"><rect x="12" y="10" width="176" height="92" rx="4"/></clipPath>
      <g clip-path="url(#test-clip)">
        <text id="test-l1" class="scr" x="20" y="34" font-size="11">crop 03 · gpt-4o-mini</text>
        <text id="test-l2" class="scr scr-accent" x="20" y="56" font-size="11">"visible short circuit"</text>
        <text id="test-l3" class="scr" x="20" y="78" font-size="11">disposition: ship as-is</text>
      </g>
      <rect id="test-halo" class="halo" x="-30" y="-20" width="240" height="140" filter="url(#bloom)"/>
    </g>`;
    // stamp lever beside the terminal
    svg += box(244,120,8, 18,18,54, 4);
    svg += `<g id="test-stamp">${box(236,112,62, 34,34,10, 3)}</g>`;
    svg += `<g transform="${FRONT(236,146,72)}"><rect class="detail" x="0" y="0" width="34" height="3"/></g>`;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;

    const st = { on: false };
    const glass = stage.querySelector('#test-glass'), halo = stage.querySelector('#test-halo');
    const lines = ['#test-l1','#test-l2','#test-l3'].map(s => stage.querySelector(s));
    lines.forEach(l => l.style.opacity = 0);
    function render() {
      glass.classList.toggle('hot', st.on); halo.classList.toggle('hot', st.on);
      api.power(st.on); api.readout(st.on ? 'testimony on record' : 'terminal idle');
    }
    function print() {
      if (st.on) return; st.on = true; render();
      lines.forEach((l, i) => api.after(500 + i * 700, () => { l.style.opacity = 1; api.flash(l); }));
    }
    stage.addEventListener('click', print);
    render();
    return { key: e => (e.key === ' ' || e.key === 'Enter') ? (print(), true) : false,
             demo: () => api.after(300, print) };
  },
});

FIGS.push({
  id: 'gate', name: 'The gate', hint: 'Click the gate · space drops the arm',
  aria: 'Isometric inspection gate over a board lane. The verifier drops the arm; the BLOCK lamp lights.',
  mount(stage, api) {
    const K = api.iso.frame([[0,0,0],[320,0,0],[0,220,0],[320,220,0],[160,110,150]]);
    const { TOP, FRONT, SIDE, box, rect } = K;
    let svg = box(0,0,0, 320,220,8, 12);                                   // floor plate
    svg += `<g transform="${TOP(12,12,8)}"><rect class="detail" x="0" y="0" width="296" height="196" rx="6"/></g>`;
    // the lane: a belt strip across the floor
    svg += `<g transform="${TOP(0,80,8)}"><rect class="detail" x="0" y="0" width="320" height="56"/></g>`;
    for (const x of [20, 60, 100, 140, 180, 220, 260, 300]) {
      svg += `<g transform="${TOP(x,80,8)}"><rect class="detail" x="0" y="0" width="2" height="56"/></g>`;
    }
    // a small board stopped before the gate
    svg += box(60,92,8, 64,36,4, 2);
    svg += `<g transform="${TOP(60,92,12)}">
      <rect class="detail" x="6" y="6" width="52" height="3"/><rect class="detail" x="6" y="16" width="52" height="3"/>
      <rect class="detail" x="6" y="26" width="30" height="3"/>
    </g>`;
    // gate posts + crossbeam
    svg += box(150,72,8, 14,14,118, 3);
    svg += box(150,140,8, 14,14,118, 3);
    svg += box(150,72,126, 14,82,10, 3);
    // sign on the beam's long side face
    svg += `<g transform="${SIDE(164,72,136)}">
      <rect id="gate-sign" class="face glass" x="8" y="0.5" width="66" height="9" rx="1.5"/>
      <text id="gate-word" class="scr scr-accent" x="16" y="7.5" font-size="6.5" letter-spacing="1.5">BLOCK</text>
    </g>`;
    // the arm — dropped across the lane
    svg += `<g id="gate-arm">${box(164,100,34, 96,8,10, 2)}</g>`;
    svg += `<g transform="${TOP(164,100,44)}"><rect class="detail" x="4" y="1" width="12" height="6"/><rect class="detail" x="28" y="1" width="12" height="6"/><rect class="detail" x="52" y="1" width="12" height="6"/><rect class="detail" x="76" y="1" width="12" height="6"/></g>`;
    // beacon on the near post
    svg += `<g transform="${FRONT(150,86,126)}"><circle id="gate-lamp" class="led" cx="7" cy="4" r="4" filter="url(#soft)"/></g>`;
    svg += `<g transform="${FRONT(150,86,126)}"><circle id="gate-halo" class="halo" cx="7" cy="4" r="16" filter="url(#bloom)"/></g>`;
    stage.setAttribute('viewBox', K.viewBox); stage.innerHTML = svg;

    const st = { down: false };
    const lamp = stage.querySelector('#gate-lamp'), halo = stage.querySelector('#gate-halo');
    const sign = stage.querySelector('#gate-sign'), word = stage.querySelector('#gate-word');
    const arm = stage.querySelector('#gate-arm');
    arm.style.transition = 'transform .5s cubic-bezier(.6,0,.8,.4)';
    arm.style.transform = 'translateY(-40px)';
    function render() {
      lamp.classList.toggle('hot', st.down); halo.classList.toggle('hot', st.down);
      sign.classList.toggle('hot', st.down); word.style.opacity = st.down ? 1 : 0;
      api.power(st.down); api.readout(st.down ? 'violation 0.84 · lane blocked' : 'lane open');
    }
    const drop = () => { if (st.down) return; st.down = true; arm.style.transform = 'translateY(0px)'; api.after(450, render); };
    stage.addEventListener('click', drop);
    render();
    return { key: e => (e.key === ' ' || e.key === 'Enter') ? (drop(), true) : false,
             demo: () => api.after(300, drop) };
  },
});
