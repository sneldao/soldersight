/* "The Scan" — shared choreography helpers. Each scene calls seq() with
   [t_ms, fn] steps; capture just records the page for its duration. */
const TL = [];
function seq(...steps) {
  for (const [t, fn] of steps) TL.push([t, fn]);
}
function run() {
  for (const [t, fn] of TL) setTimeout(fn, t);
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }
function on(sel) { $$(sel).forEach(e => e.classList.add("on")); }
function off(sel) { $$(sel).forEach(e => e.classList.remove("on")); }

/* type text into el at chars/sec, then resolve */
function typeIn(el, text, cps = 28) {
  return new Promise(res => {
    el.textContent = "";
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(iv); res(); }
    }, 1000 / cps);
  });
}

/* place reticle at x,y center, size scale */
function reticleAt(x, y, s = 1) {
  const r = $("#ret");
  r.style.left = x + "px"; r.style.top = y + "px";
  r.style.transform = `scale(${s})`;
  r.classList.add("on");
}
function reticleOff() { $("#ret").classList.remove("on"); }

function stampAt(x, y, text, green = false) {
  const s = document.createElement("div");
  s.className = "stamp" + (green ? " green" : "");
  s.textContent = text;
  s.style.left = x + "px"; s.style.top = y + "px";
  document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add("on"));
  return s;
}

/* HUD boilerplate injected by each scene's title */
function hud(tag) {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="vignette"></div><div class="scanlines"></div>
    <div class="sweep" id="sweep"></div>
    <div class="hud"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
      <div class="tag">${tag}</div>
      <div class="stamp-clock" id="clock">SOLDERSIGHT · EVAL</div></div>
    <div class="reticle" id="ret"><div class="ring r1"></div><div class="ring r2"></div></div>`);
}
function sweep() { const s = $("#sweep"); s.classList.remove("on"); void s.offsetWidth; s.classList.add("on"); }
