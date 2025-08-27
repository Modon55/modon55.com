(function(){
  const BASE_SPEED  = 0.7;
  const NOISE       = 0.0012;
  const DAMPING     = 0.992;
  const MAX_SPEED   = 1;
  const LINK_DIST   = 160;
  const K_NEAREST   = 3;
  const LINE_WIDTH  = 0.55;
  const LINE_ALPHA  = 0.2;

  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search);
  const linkMap = { yt: 'yt', tw: 'tw', don: 'don' };
  Object.entries(linkMap).forEach(([param, id]) => {
    const el = document.getElementById(id);
    if (el && params.get(param)) el.href = params.get(param);
  });

  const observed = document.querySelectorAll('[data-animate]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.2 });
  observed.forEach(el => io.observe(el));

  const c = document.getElementById('fx');
  const ctx = c.getContext('2d');

  const isMobile = matchMedia('(max-width: 768px)').matches;
  const DPR_CAP = isMobile ? 1.25 : 2;

  let w = 0, h = 0, dpr = 1;
  let cssW = 0, cssH = 0, prevDpr = 0;

  function getViewportSize() {
    const vp = window.visualViewport;
    return {
      w: vp ? vp.width  : window.innerWidth,
      h: vp ? vp.height : window.innerHeight
    };
  }

  function resizeCanvas(force = false) {
    const { w: vw, h: vh } = getViewportSize();
    const nextDpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    const cssChanged = Math.abs(vw - cssW) > 0.5 || Math.abs(vh - cssH) > 0.5;
    const dprChanged = Math.abs(nextDpr - prevDpr) > 0.01;
    const newW = Math.round(vw * nextDpr);
    const newH = Math.round(vh * nextDpr);
    const changed = force || cssChanged || dprChanged || newW !== w || newH !== h;

    cssW = vw; cssH = vh; prevDpr = nextDpr;
    if (!changed) return;

    const sx = w ? newW / w : 1;
    const sy = h ? newH / h : 1;

    c.width = newW;
    c.height = newH;
    c.style.width = vw + 'px';
    c.style.height = vh + 'px';

    if (w && h && parts) {
      for (let i = 0; i < parts.length; i++) {
        parts[i].x *= sx;
        parts[i].y *= sy;
      }
    }

    w = newW; h = newH;
    dpr = nextDpr;

    const areaOld = w * h, areaNew = newW * newH;
    const areaJump = areaOld ? Math.abs(areaNew - areaOld) / areaOld : 0;
    if (dprChanged || areaJump > 0.35) {

      const n = parts.length;
      parts = Array.from({ length: n }, spawn);
    }
  }

  let resizeQueued = false;
  function queueResize(force=false){
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resizeCanvas(force); });
  }
  window.addEventListener('resize', () => queueResize(false), { passive:true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => queueResize(false), { passive:true });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueResize(true); });

  const BASE_DENSITY = isMobile ? 18000 : 12000;
  const MAX_COUNT    = isMobile ? 110 : 160;
  const count = Math.min(MAX_COUNT, Math.floor((innerWidth * innerHeight) / BASE_DENSITY));
  let parts = Array.from({ length: count }, spawn);

  function spawn(){
    const speed = BASE_SPEED * dpr || (BASE_SPEED * 1);
    return {
      x: Math.random() * (w || innerWidth),
      y: Math.random() * (h || innerHeight),
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r: (Math.random() * 1.8 + 0.6) * (dpr || 1)
    };
  }

  let mx = 0, my = 0, hasPointer = false;
  const updatePointer = (e) => {
    hasPointer = true;
    if (e.touches && e.touches[0]) {
      mx = e.touches[0].clientX * dpr;
      my = e.touches[0].clientY * dpr;
    } else {
      mx = e.clientX * dpr;
      my = e.clientY * dpr;
    }
  };
  window.addEventListener('mousemove', updatePointer, { passive:true });
  window.addEventListener('touchmove', updatePointer, { passive:true });
  window.addEventListener('touchstart', updatePointer, { passive:true });

  queueResize(true);

  function step(){
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];

      a.vx += (Math.random() - 0.5) * NOISE;
      a.vy += (Math.random() - 0.5) * NOISE;

      if (hasPointer) {
        const dx = mx - a.x;
        const dy = my - a.y;
        const dist2 = dx*dx + dy*dy;
        const influence = (130 * dpr);
        if (dist2 < influence * influence) {
          const d = Math.sqrt(dist2) + 1e-4;
          const force = (1 - d / influence) * 0.6;
          a.vx -= (dx / d) * force * 0.06;
          a.vy -= (dy / d) * force * 0.06;
          const tx = -dy / d, ty = dx / d;
          a.vx += tx * 0.015 * force;
          a.vy += ty * 0.015 * force;
        }
      }

      a.x += a.vx;
      a.y += a.vy;

      a.vx *= DAMPING;
      a.vy *= DAMPING;
      const maxSp = MAX_SPEED * dpr;
      const sp2 = a.vx*a.vx + a.vy*a.vy;
      if (sp2 > maxSp*maxSp) {
        const s = Math.sqrt(sp2);
        a.vx = (a.vx / s) * maxSp;
        a.vy = (a.vy / s) * maxSp;
      }

      if (a.x < -10) a.x = w + 10;
      if (a.x > w + 10) a.x = -10;
      if (a.y < -10) a.y = h + 10;
      if (a.y > h + 10) a.y = -10;
    }

    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      ctx.beginPath();
      ctx.fillStyle = 'rgba(239,35,60,0.9)';
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const linkDistPx = isMobile ? Math.round(LINK_DIST * 0.9) : LINK_DIST;
    const maxDist = (linkDistPx * dpr);
    const maxDist2 = maxDist * maxDist;

    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      let nearest = [];

      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;

        if (d2 < maxDist2) {
          const alpha = LINE_ALPHA * (1 - d2 / maxDist2);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(217,4,41,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = LINE_WIDTH * dpr;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        if (nearest.length < K_NEAREST) {
          nearest.push([j, d2]);
          nearest.sort((m,n)=> m[1]-n[1]);
        } else if (d2 < nearest[nearest.length-1][1]) {
          nearest[nearest.length-1] = [j, d2];
          nearest.sort((m,n)=> m[1]-n[1]);
        }
      }

      for (const [j, d2] of nearest) {
        if (d2 >= maxDist2) {
          const alpha = (LINE_ALPHA * 0.45) * (1 - Math.min(d2 / (maxDist2*2), 0.999));
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(217,4,41,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = (LINE_WIDTH * 0.9) * dpr;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(parts[j].x, parts[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);  
})();

const letters = document.querySelectorAll('.glitch span');
if (letters.length) {
  letters.forEach(l => l.classList.add('lamp-on'));

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function bulbFlicker(letter) {
    const cycles = 2 + Math.floor(Math.random() * 4);
    for (let i=0; i<cycles; i++) {
      letter.classList.replace('lamp-on','lamp-off');
      await sleep(50 + Math.random()*120);
      letter.classList.replace('lamp-off','lamp-on');
      await sleep(60 + Math.random()*180);
    }
    if (Math.random() < 0.3) {
      letter.classList.replace('lamp-on','lamp-off');
      await sleep(200 + Math.random()*400);
      letter.classList.replace('lamp-off','lamp-on');
    }
  }

  letters.forEach(letter=>{
    (async function loop(){
      while(true){
        await sleep(5000 + Math.random()*9000);
        await bulbFlicker(letter);
      }
    })();
  });
}
