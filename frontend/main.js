// main.js — ES module with dendrogram + background-video + JS-driven audio-synced waveform

import { csvData }  from "./data.js";
import { LINK_MAP, LINK_COLOR_MAP } from "./links.js";
import { ImageStream } from "./imageStream.js";

if (!csvData.length) {
  console.warn("csvData empty – abort");
} else {
  init();
}

function init() {
  // Initialize image stream
  const imageStream = new ImageStream();
  window.imageStream = imageStream; // Make globally available
  document.body.appendChild(imageStream.container);

  /* ---------- CONSTANTS ---------- */
  const RING_RADIUS    = [0,150,300,450,500,600];
  const MEDIA_SET      = new Set(["Anime","Manga","VideoGames","Comics","Series","Movies"]);
  const CX = 700, CY = 700;
  const LABEL_DISTANCE = 12;
  const TEXT_PADDING   = 4;  // for potential future use
  const OVERRIDE_OFFSET = {
    CostumedPlay: { x:  0,  y: 28 },
    Anime:        { x:  4,  y:  0 },
    Anonymous:    { x: -16, y:  0 }
  };

  /* ---------- ELEMENT REFS ---------- */
  const svg         = document.getElementById("svgContainer");
  const bgVideo     = document.getElementById("bgVideo");
  const controls    = document.getElementById("videoControls");
  const playBtn     = document.getElementById("playPause");
  const progressBar = document.getElementById("progress");

  bgVideo.controls = false;
  bgVideo.classList.remove("show");
  controls.classList.remove("show");

  bgVideo.muted = true;
  bgVideo.volume = 1;

  /* ---------- AUDIO & ANALYSER SETUP ---------- */
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source   = audioCtx.createMediaElementSource(bgVideo);
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 256;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  /* ---------- MUTE-TOGGLE ON CSS WAVEFORM ---------- */
  const waveform = document.getElementById("waveform");
  if (waveform) {
    waveform.addEventListener("click", () => {
      bgVideo.muted = !bgVideo.muted;
    });
  }

  /* ---------- JS-DRIVEN AUDIO SYNC FOR WAVEFORM ---------- */
  const bars = Array.from(document.querySelectorAll('#waveform [class^="wave"]'));
  function updateBars() {
    requestAnimationFrame(updateBars);
    analyser.getByteFrequencyData(dataArray);
    bars.forEach((bar, i) => {
      const v = dataArray[i] || 0;
      const scale = 0.2 + (v / 255) * 1.0;
      bar.style.transform = `scaleY(${scale})`;
    });
  }
  updateBars();

  /* ---------- PLAY/PAUSE BUTTON SYNC ---------- */
  playBtn.addEventListener("click", () => {
    // Control playback if marquee is visible or video is playing
    if (document.querySelector('.image-stream.show') || !bgVideo.paused) {
      bgVideo.muted = false;
      audioCtx.resume();
      
      // Toggle video playback
      if (bgVideo.paused) {
        bgVideo.play();
        // Resume marquee animation
        if (window.imageStream) {
          const sequences = window.imageStream.track.querySelectorAll('.image-sequence');
          sequences.forEach(seq => {
            seq.style.animationPlayState = 'running';
          });
        }
      } else {
        bgVideo.pause();
        // Pause marquee animation
        if (window.imageStream) {
          const sequences = window.imageStream.track.querySelectorAll('.image-sequence');
          sequences.forEach(seq => {
            seq.style.animationPlayState = 'paused';
          });
        }
      }
    }
  });

  bgVideo.addEventListener("play", () => {
    playBtn.textContent = "❚❚";
    // Resume marquee animation
    if (window.imageStream) {
      const sequences = window.imageStream.track.querySelectorAll('.image-sequence');
      sequences.forEach(seq => {
        seq.style.animationPlayState = 'running';
      });
    }
  });

  bgVideo.addEventListener("pause", () => {
    playBtn.textContent = "▶︎";
    // Pause marquee animation
    if (window.imageStream) {
      const sequences = window.imageStream.track.querySelectorAll('.image-sequence');
      sequences.forEach(seq => {
        seq.style.animationPlayState = 'paused';
      });
    }
  });

  /* ---------- DYNAMIC PROGRESS BAR ---------- */
  bgVideo.addEventListener("loadedmetadata", () => {
    progressBar.min   = 0;
    progressBar.max   = bgVideo.duration;
    progressBar.step  = 0.01;
    progressBar.value = 0;
  });
  bgVideo.addEventListener("timeupdate", () => {
    progressBar.value = bgVideo.currentTime;
  });
  progressBar.addEventListener("input", () => {
    bgVideo.currentTime = progressBar.value;
  });

  /* ---------- SVG SETUP ---------- */
  const viewport   = SVG("g", { id: "viewport" }, svg);
  const edgesLayer = SVG("g", {}, viewport);
  const nodesLayer = SVG("g", {}, viewport);

  function SVG(tag, attrs = {}, parent) {
    const SVG_NS   = "http://www.w3.org/2000/svg";
    const XLINK_NS = "http://www.w3.org/1999/xlink";
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) {
      if (k === "xlink:href") el.setAttributeNS(XLINK_NS, "href", attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  const polar = (angle, r) => {
    const rad = (angle - 90) * Math.PI / 180;
    return [ CX + r * Math.cos(rad), CY + r * Math.sin(rad) ];
  };

  function toDiagramCoords(x, y) {
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const ctm = viewport.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: CX, y: CY };
  }

  /* ---------- CSV PARSING & TREE BUILDING ---------- */
  function parseCSV(txt) {
    const lines = txt.split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("/*"));
    const head = lines.shift().split(",").map(s => s.trim());
    return lines.map(l => {
      const cols = l.split(","), row = {};
      head.forEach((h,i) => {
        row[h] = cols[i]?.replace(/^"|"$/g,"").trim() || "";
      });
      return row;
    });
  }

  function buildTree(rows) {
    const map = new Map();
    const rootFake = { name: "root", children: [] };
    map.set("root", rootFake);
    rows.forEach(r => {
      let parent = rootFake, cur = "";
      r.id.split(".").forEach(seg => {
        cur = cur ? `${cur}.${seg}` : seg;
        if (!map.has(cur)) map.set(cur, { name: seg, fullPath: cur, children: [] });
        const node = map.get(cur);
        if (node.parent !== parent) {
          node.parent = parent;
          parent.children.push(node);
        }
        parent = node;
      });
    });
    const real = [...map.values()].find(n => n.name === "CostumedPlay");
    rootFake.children = [real];
    real.parent = null;
    return real;
  }

  function BFSDepth(root) {
    root.depth = 0;
    const q = [root];
    while (q.length) {
      const n = q.shift();
      n.children.forEach(ch => {
        if (ch.depth != null) return;
        let d = n.depth + 1;
        if (MEDIA_SET.has(ch.name)) d = 4;
        if (n.depth === 4)          d = 5;
        ch.depth = Math.min(d, 5);
        q.push(ch);
      });
    }
  }

/* ---------- RENDER EDGES ---------- */
function renderEdges(nodes) {
  nodes.forEach(ch => {
    const p = ch.parent;
    if (!p || p.name === "root") return;
    const [px, py] = polar(p.angleDeg, RING_RADIUS[p.depth]);
    let d;
    if (ch.depth === 5) {
      const ar        = RING_RADIUS[p.depth] + 50;
      const [ax, ay]  = polar(p.angleDeg, ar);
      const [cx, cy]  = polar(ch.angleDeg, RING_RADIUS[5]);
      const mid1      = (RING_RADIUS[p.depth] + ar) / 2;
      const [c1x, c1y]= polar(p.angleDeg, mid1);
      const mid2      = (ar + RING_RADIUS[5]) / 2;
      const [c2x, c2y]= polar(ch.angleDeg, mid2);
      d = `M${px},${py}C${c1x},${c1y} ${c1x},${c1y} ${ax},${ay}C${c2x},${c2y} ${c2x},${c2y} ${cx},${cy}`;
    } else {
      const [nx, ny]  = polar(ch.angleDeg, RING_RADIUS[ch.depth]);
      const mid       = (RING_RADIUS[p.depth] + RING_RADIUS[ch.depth]) / 2;
      const [c1x, c1y]= polar(p.angleDeg, mid);
      const [c2x, c2y]= polar(ch.angleDeg, mid);
      d = `M${px},${py}C${c1x},${c1y} ${c2x},${c2y} ${nx},${ny}`;
    }
    SVG("path", { class: "link", d }, edgesLayer);
  });
}

/* ---------- RENDER NODES (only colored ones clickable) ---------- */
function renderNodes(nodes, focus) {
  nodes.forEach(n => {
    // 1) compute position
    const [nx, ny] = polar(n.angleDeg, RING_RADIUS[n.depth]);
    n.x = nx; n.y = ny;

    // 2) create root group
    const g = SVG("g", { transform: `translate(${nx} ${ny})` }, nodesLayer);
    g.addEventListener("click", e => {
      if (e.target.closest("a")) return;
      e.stopPropagation();
      focus(nx, ny);
    });

    // 3) determine styling classes & rotation
    const cls = n.depth === 0 ? "node--root"
              : n.depth <= 3 ? "node--category"
              : n.depth === 4 ? "node--mediaType"
                               : "node--popLeaf";
    const rot  = n.depth === 0
               ? 0
               : (n.angleDeg < 180 ? n.angleDeg - 90 : n.angleDeg + 90);
    const xOff = n.depth === 0
               ? 0
               : (n.angleDeg < 180 ? LABEL_DISTANCE : -LABEL_DISTANCE);
    const anchor = n.depth === 0
                 ? "middle"
                 : (xOff > 0 ? "start" : "end");
    const dy = n.depth === 0 ? "-1em" : ".31em";
    const rotG = SVG("g", { transform: `rotate(${rot})` }, g);

    // 4) link vs group container
    const linkColor   = LINK_COLOR_MAP[n.name];
    const isClickable = Boolean(linkColor);
    const href        = LINK_MAP[`${n.name}_video`] || LINK_MAP[n.name];
    const container   = isClickable
      ? SVG("a", { "xlink:href": href, style: "cursor:pointer" }, rotG)
      : SVG("g", {}, rotG);
    if (isClickable) {
      container.classList.add("link-node");
      container.style.setProperty("--link-color", linkColor);
    }

    // 5) circle element
    const circleEl = SVG("circle", { r: 4, class: `node ${cls}` }, container);
    if (isClickable) {
      circleEl.dataset.defaultFill = linkColor;
      circleEl.style.fill          = linkColor;
    } else {
      circleEl.dataset.defaultFill = "#CCCCCC";
      circleEl.style.fill          = "#CCCCCC";
    }

    // 6) link click behavior
    if (isClickable) {
      container.addEventListener("click", e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault(); e.stopPropagation();

        // clear previous active state
        nodesLayer.querySelectorAll("a.active").forEach(a => a.classList.remove("active"));
        nodesLayer.querySelectorAll("circle").forEach(c => {
          c.classList.remove("active-node");
          c.style.fill = c.dataset.defaultFill;
        });

        // activate this node
        container.classList.add("active");
        circleEl.classList.add("active-node");
        circleEl.style.fill = circleEl.dataset.defaultFill;

        // Show video and controls
        bgVideo.classList.add("show");
        controls.classList.add("show");
        
        // play video
        bgVideo.muted = false;
        audioCtx.resume();
        if (!bgVideo.src.includes(href)) {
          bgVideo.src = href;
        }
        // Always start from the beginning
        bgVideo.currentTime = 0;
        
        // Show image stream
        if (window.imageStream) {
          window.imageStream.show();
        }
        
        // Start video immediately
        bgVideo.play().catch(() => {});
      });
    }

    // 7) text label (DINdong font, no inline fill)
    const xAdj = OVERRIDE_OFFSET[n.name]?.x || 0;
    const yAdj = OVERRIDE_OFFSET[n.name]?.y || 0;
    const txt = SVG("text", {
      x: xOff + xAdj,
      y: yAdj,
      dy,
      "text-anchor": anchor,
      style: [
        "font-family: 'DINdong', 'Inter', sans-serif",
        "font-size: 10px"
      ].join(";")
    }, container);
    txt.textContent = n.name;

    // end of this node
  });
}

/* ---------- LINK CLICK HANDLERS ---------- */
function handleNodeClick(node) {
  if (LINK_MAP[`${node.name}_video`]) {
    handleVideoLink(`/assets/videos/${LINK_MAP[`${node.name}_video`]}`);
  }
}

/* ---------- BUILD & LAYOUT ---------- */
const rows = parseCSV(csvData);
const root = buildTree(rows);
BFSDepth(root);
const all = [];
(function dfs(n) { all.push(n); n.children.forEach(dfs); })(root);

const buckets = new Map([[0,[]],[1,[]],[2,[]],[3,[]],[4,[]],[5,[]]]);
all.forEach(n => buckets.get(n.depth).push(n));
buckets.get(0)[0].angleDeg = 0;
[1,2,3,4,5].forEach(d => {
  buckets.get(d)
    .sort((a,b) => a.fullPath.localeCompare(b.fullPath))
    .forEach((n,i) => { n.angleDeg = 360 * i / buckets.get(d).length; });
});

/* ---------- PAN/ZOOM & FOCUS (responsive initial scale) ---------- */
const INIT_FILL_VW = 225;  // Back to original for proper zoom
let minS = 0.15, maxS = 5;
let scale = Math.min(
  maxS,
  Math.max(
    minS,
    (window.innerWidth * (INIT_FILL_VW / 100)) / 1400
  )
);
let vx = CX * (1 - scale), vy = CY * (1 - scale), flyID = null;
const update = () => viewport.setAttribute("transform", `translate(${vx} ${vy}) scale(${scale})`);

window.addEventListener("resize", () => {
  scale = Math.min(
    maxS,
    Math.max(
      minS,
      (window.innerWidth * (INIT_FILL_VW / 100)) / 1400
    )
  );
  vx = CX * (1 - scale);
  vy = CY * (1 - scale);
  update();
});

function focus(wx, wy) {
  if (flyID) cancelAnimationFrame(flyID);
  const endVX = CX - wx * scale, endVY = CY - wy * scale;
  const startVX = vx, startVY = vy;
  const dist = Math.hypot(endVX - startVX, endVY - startVY);
  const D = Math.min(600, Math.max(150, dist * 0.5)), t0 = performance.now();
  (function anim(now) {
    const t = Math.min(1, (now - t0) / D);
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
    vx = startVX + (endVX - startVX) * ease;
    vy = startVY + (endVY - startVY) * ease;
    update();
    if (t < 1) flyID = requestAnimationFrame(anim);
  })(t0);
}

// initial draw
renderEdges(all);
renderNodes(all, focus);
update();

/* ---------- VIDEO END: clear active & reset fills ---------- */
bgVideo.addEventListener("ended", () => {
    // Hide image stream
    if (window.imageStream) {
        window.imageStream.hide();
    }
    
    // Hide video and controls
    bgVideo.classList.remove("show");
    controls.classList.remove("show");
    
    // Clear active states
    nodesLayer.querySelectorAll("a.active").forEach(a => a.classList.remove("active"));
    nodesLayer.querySelectorAll("circle").forEach(c => {
        c.classList.remove("active-node");
        c.style.fill = c.dataset.defaultFill || "#CCCCCC";
    });
});

/* ---------- CLICK-AWAY: close video or recenter ---------- */
svg.addEventListener("click", e => {
  if (e.target.closest("a")) return;
  
  // Check if marquee is open
  if (window.imageStream && window.imageStream.container.classList.contains('show')) {
    // Hide image stream
    window.imageStream.hide();
    
    // Hide video and controls
    bgVideo.classList.remove("show");
    controls.classList.remove("show");
    bgVideo.pause();
    bgVideo.currentTime = 0;
    
    // Clear active states
    nodesLayer.querySelectorAll("a.active").forEach(a => a.classList.remove("active"));
    nodesLayer.querySelectorAll("circle").forEach(c => {
      c.classList.remove("active-node");
      c.style.fill = c.dataset.defaultFill || "#CCCCCC";
    });
  } else {
    const { x, y } = toDiagramCoords(e.clientX, e.clientY);
    focus(x, y);
  }
});

/* ---------- ZOOM BUTTONS ---------- */
document.getElementById("zoomIn").addEventListener("click", () => zoom(1.2));
document.getElementById("zoomOut").addEventListener("click", () => zoom(0.8));
function zoom(f) {
  const next = Math.max(minS, Math.min(maxS, scale * f));
  vx = CX - (CX - vx) * (next / scale);
  vy = CY - (CY - vy) * (next / scale);
  scale = next;
  update();
}

// Modified video handling for links
function handleVideoLink(videoPath) {
  bgVideo.src = videoPath;
  bgVideo.classList.add("show");
  controls.classList.add("show");
  bgVideo.muted = false;
  audioCtx.resume();
  
  // Show image stream
  if (window.imageStream) {
    window.imageStream.show();
  }
  
  bgVideo.play().catch(() => {
    console.warn("Video playback failed");
  });
}

// Ensure header behavior integrates seamlessly
const pageTitle = document.getElementById('pageTitle');
const pageTitleWrapper = document.querySelector('.pageTitle-wrapper');

pageTitleWrapper.addEventListener('click', () => {
  pageTitle.classList.toggle('fullscreen');
});

document.addEventListener('mousemove', (e) => {
  const rect = pageTitle.getBoundingClientRect();
  if (pageTitle.classList.contains('fullscreen') && (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  )) {
    pageTitle.classList.remove('fullscreen');
  }
});

/* ---------- NODE CLICK: show video ---------- */
nodesLayer.addEventListener("click", e => {
  const link = e.target.closest("a");
  if (!link) return;

  e.preventDefault();
  const videoSrc = link.getAttribute("href");
  
  // Update video source and show
  bgVideo.src = videoSrc;
  bgVideo.classList.add("show");
  controls.classList.add("show");
  
  // Show image stream
  window.imageStream.show();
  
  // Update active states
  nodesLayer.querySelectorAll("a.active").forEach(a => a.classList.remove("active"));
  link.classList.add("active");
  
  // Update node appearance
  const circle = link.querySelector("circle");
  if (circle) {
    circle.classList.add("active-node");
    circle.style.fill = "#000000";
  }
  
  // Play video
  bgVideo.play();
});

// Width control
const widthToggle = document.getElementById("widthToggle");
const widths = ["20vw", "25vw", "33vw", "50vw", "100vh", "10vw"];
let currentWidthIndex = 0; // Start with 20vw

widthToggle.addEventListener("click", () => {
    // Only proceed if video is active
    if (!bgVideo.classList.contains("show")) return;

    // Cycle to next width
    currentWidthIndex = (currentWidthIndex + 1) % widths.length;
    const newWidth = widths[currentWidthIndex];
    
    // Update button text
    widthToggle.textContent = newWidth;
    
    // Update image stream width
    if (window.imageStream) {
        window.imageStream.setWidth(newWidth);
        // Ensure stream stays visible
        window.imageStream.show();
    }
});
} // end init()
