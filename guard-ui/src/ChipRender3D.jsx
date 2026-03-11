import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

const DRUG_HEX = { RIF: 0x3288bd, INH: 0x66c2a5, EMB: 0xabdda4, PZA: 0xfee08b, FQ: 0xf46d43, AG: 0xd53e4f, CTRL: 0x888888 };
const addAt = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
const DRUG_CSS = { RIF: "#3288bd", INH: "#66c2a5", EMB: "#abdda4", PZA: "#fee08b", FQ: "#f46d43", AG: "#d53e4f", CTRL: "#888888" };

// Inline SWV for mini voltammogram preview
const miniSWV = (Gamma, G0) => {
  const nFRT = (2 * 96485) / (8.314 * 310.15);
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const E = -0.05 - i * 0.004375;
    const xp = nFRT * (E + 0.025 - (-0.22));
    const xm = nFRT * (E - 0.025 - (-0.22));
    pts.push({ E, I: (Gamma / G0) * (1 / (1 + Math.exp(xp)) - 1 / (1 + Math.exp(xm))) * 3.0 });
  }
  return pts;
};

export default function ChipRender3D({ electrodeLayout, targetDrug, targetStrategy, getEfficiency, results, computeGamma, echemTime, echemKtrans, echemGamma0_mol, HEADING, MONO }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [mode, setMode] = useState(1);
  const [selectedPad, setSelectedPad] = useState(null);
  const [cas12aActive, setCas12aActive] = useState(false);
  const [tooltipInfo, setTooltipInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [incubationMin, setIncubationMin] = useState(echemTime);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = Math.round(W * 9 / 16);
    container.style.height = H + "px";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0xF8F9FA);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);
    const scene = new THREE.Scene();

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xFFF5E6, 0.75);
    key.position.set(-30, 50, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1; key.shadow.camera.far = 200;
    key.shadow.camera.left = -50; key.shadow.camera.right = 50;
    key.shadow.camera.top = 50; key.shadow.camera.bottom = -50;
    key.shadow.bias = -0.001;
    scene.add(key);
    scene.add(new THREE.DirectionalLight(0xE6F0FF, 0.3).translateX(40).translateY(30).translateZ(-20));
    scene.add(new THREE.DirectionalLight(0xFFFFFF, 0.2).translateY(20).translateZ(-50));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.15 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1; ground.receiveShadow = true;
    scene.add(ground);

    // ══════════ MODE 1: CHIP OVERVIEW ══════════
    const chipGroup = new THREE.Group();
    scene.add(chipGroup);

    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xC8943E, roughness: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.4, transparent: true, opacity: 0.92 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(65, 1.5, 35), bodyMat);
    body.castShadow = true; body.receiveShadow = true;
    chipGroup.add(body);

    // Sample prep well
    const wellMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const channelMat = new THREE.MeshStandardMaterial({ color: 0x2D2D2D, roughness: 0.8 });
    const waxRimMat = new THREE.MeshPhysicalMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5, roughness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, metalness: 0.85, roughness: 0.15 });

    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(15, 0.1, 12), wellMat), -22, 0.76, 0);
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.05, 11.5), new THREE.MeshStandardMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.35 })), -22, 0.82, 0);
    const beadMat = new THREE.MeshStandardMaterial({ color: 0x4B5563, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 15; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), beadMat);
      b.position.set(-22 + (Math.random() - 0.5) * 12, 0.95, (Math.random() - 0.5) * 9);
      chipGroup.add(b);
    }

    // Prep channel + central pad
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 0.5), channelMat), -11, 0.78, 0);
    addAt(chipGroup, new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.08, 32), wellMat), -6, 0.76, 0);
    const cRim = new THREE.Mesh(new THREE.TorusGeometry(2, 0.12, 8, 32), waxRimMat);
    cRim.rotation.x = Math.PI / 2; cRim.position.set(-6, 0.9, 0);
    chipGroup.add(cRim);
    addAt(chipGroup, new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xC8943E, transparent: true, opacity: 0.4, side: THREE.DoubleSide })), -6, 1.1, 0);

    // Detection pads — 5×3 grid
    const flatPads = electrodeLayout.flat();
    const padMeshes = [];
    const padPositions = [];
    const gX = 5, gZ = -7, sX = 6, sZ = 7;

    // Enhancement 1: Non-crossing L-shaped distribution channels
    for (let r = 0; r < 3; r++) {
      const rz = gZ + r * sZ;
      // Horizontal trunk
      addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(sX * 4 + 4, 0.06, 0.4), channelMat), gX + sX * 2, 0.78, rz);
      if (r === 1) {
        // Middle row: straight from center
        addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(gX + 7, 0.06, 0.35), channelMat), (-6 + gX) / 2, 0.78, 0);
      } else {
        // Top/bottom: vertical then horizontal (no crossing)
        addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, Math.abs(rz)), channelMat), -4, 0.78, rz / 2);
        addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(gX + 5, 0.06, 0.35), channelMat), (-4 + gX) / 2 + 0.5, 0.78, rz);
      }
    }

    // Enhancement 2: Recessed wells with drug glow rings
    flatPads.forEach((target, idx) => {
      const row = Math.floor(idx / 5), col = idx % 5;
      const px = gX + col * sX, pz = gZ + row * sZ;
      padPositions.push({ x: px, z: pz, target, row, col });
      const drug = targetDrug(target);
      const padColor = DRUG_HEX[drug] || 0x888888;

      // Recessed well wall
      const ww = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, side: THREE.DoubleSide }));
      ww.position.set(px, 0.45, pz); chipGroup.add(ww);

      // LIG floor
      addAt(chipGroup, new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.08, 24), wellMat), px, 0.15, pz);

      // Drug glow ring (emissive)
      const gr = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 24), new THREE.MeshStandardMaterial({ color: padColor, emissive: padColor, emissiveIntensity: 0.35, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      gr.rotation.x = -Math.PI / 2; gr.position.set(px, 0.20, pz); chipGroup.add(gr);

      // AuNP hemispheres
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, rd = Math.random() * 1.3;
        const au = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1 }));
        au.position.set(px + Math.cos(a) * rd, 0.19, pz + Math.sin(a) * rd); chipGroup.add(au);
      }

      // Wax rim
      const pr = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.1, 6, 24), waxRimMat);
      pr.rotation.x = Math.PI / 2; pr.position.set(px, 0.80, pz); chipGroup.add(pr);

      // Lyophilized pellet
      addAt(chipGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xF5F0E0, roughness: 0.8, transparent: true, opacity: 0.6 })), px, 0.45, pz);

      // Raycast mesh
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 1.0, 16), new THREE.MeshBasicMaterial({ visible: false }));
      pm.position.set(px, 0.5, pz); pm.userData = { target, drug, idx, padColor };
      chipGroup.add(pm); padMeshes.push(pm);
    });

    // Enhancement 7: Shared counter electrode — visible LIG strip with tick marks
    const ceMat = new THREE.MeshStandardMaterial({ color: 0x2D2D2D, roughness: 0.7, metalness: 0.15 });
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 22), ceMat), gX + sX * 4 + 4, 0.78, 0);
    for (let r = 0; r < 3; r++) {
      addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.15), goldMat), gX + sX * 4 + 4, 0.85, gZ + r * sZ);
    }

    // Enhancement 6 + 1: Contact pads flush with chip edge, non-crossing traces
    const edgeZ = 17;
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        const pi = r * 5 + c;
        const pad = padPositions[pi];
        if (!pad) continue;
        const cx = pad.x + (r - 1) * 0.6; // slight offset per row keeps traces parallel
        addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 2.5), goldMat), cx, 0.78, edgeZ);
        // Vertical trace from pad down to contact (parallel = no crossing)
        const traceLen = edgeZ - 1.5 - pad.z;
        if (traceLen > 0.5) {
          addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, traceLen), channelMat), cx, 0.76, pad.z + traceLen / 2);
        }
        // Small horizontal jog if offset
        const dx = cx - pad.x;
        if (Math.abs(dx) > 0.1) {
          addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx) + 0.1, 0.04, 0.2), channelMat), (cx + pad.x) / 2, 0.76, pad.z);
        }
      }
    }
    // CE contact (16th)
    const ceX = gX + sX * 4 + 4;
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 2.5), goldMat), ceX, 0.78, edgeZ);
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, edgeZ - 11), channelMat), ceX, 0.76, (edgeZ + 11) / 2 - 3);

    // Insertion guide ridge
    addAt(chipGroup, new THREE.Mesh(new THREE.BoxGeometry(58, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xB8860B, roughness: 0.4, metalness: 0.3 })), 10, 0.78, 17.5);

    // ══════════ MODE 2: CROSS-SECTION ══════════
    const crossGroup = new THREE.Group();
    crossGroup.visible = false;
    scene.add(crossGroup);

    // Enhancement 3: Cylindrical cross-section with porous LIG + discrete AuNP
    const secR = 3.5;

    // Kapton substrate
    const kapM = new THREE.Mesh(new THREE.CylinderGeometry(secR, secR, 2.0, 32), new THREE.MeshStandardMaterial({ color: 0xD4A76A, roughness: 0.35 }));
    kapM.position.y = 1.0; kapM.castShadow = true; crossGroup.add(kapM);

    // LIG layer (porous)
    const ligM = new THREE.Mesh(new THREE.CylinderGeometry(secR, secR, 1.5, 32), new THREE.MeshStandardMaterial({ color: 0x2D2D2D, roughness: 0.9 }));
    ligM.position.y = 2.75; ligM.castShadow = true; crossGroup.add(ligM);
    // Pore texture
    const poreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * (secR - 0.3);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6), poreMat);
      p.position.set(Math.cos(a) * rr, 3.5 + Math.random() * 0.05, Math.sin(a) * rr);
      crossGroup.add(p);
    }

    // AuNP base layer
    addAt(crossGroup, new THREE.Mesh(new THREE.CylinderGeometry(secR, secR, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.2, metalness: 0.8 })), 0, 3.575, 0);

    // Discrete AuNP hemispheres
    const auSurf = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.1 });
    for (let i = 0; i < 35; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * (secR - 0.2);
      const au = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), auSurf);
      au.position.set(Math.cos(a) * rr, 3.65, Math.sin(a) * rr); crossGroup.add(au);
    }

    // MCH backfill film
    addAt(crossGroup, new THREE.Mesh(new THREE.CylinderGeometry(secR - 0.05, secR - 0.05, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0xBBBBBB, transparent: true, opacity: 0.3, roughness: 0.5 })), 0, 3.69, 0);

    const baseY = 3.73;

    // ssDNA reporters: curved segments, thiol linkers, MB tips
    const strandMat = new THREE.MeshStandardMaterial({ color: 0x66c2a5 });
    const mbMat = new THREE.MeshStandardMaterial({ color: 0x3288bd, emissive: 0x1a4470, emissiveIntensity: 0.3 });
    const thiolMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.7, roughness: 0.2 });
    const cutMat = new THREE.MeshStandardMaterial({ color: 0x3d7a63 });
    const mchStub = new THREE.MeshStandardMaterial({ color: 0xAAAAAA });

    const reporters = [];
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * (secR * 2 - 1);
      const z = (Math.random() - 0.5) * (secR * 2 - 1);
      if (x * x + z * z > (secR - 0.5) ** 2) continue;

      const h = 2.5 + Math.random() * 0.5;
      const rx = (Math.random() - 0.5) * 0.25;
      const rz = (Math.random() - 0.5) * 0.25;

      // Thiol linker (gold sphere at base)
      const th = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), thiolMat);
      th.position.set(x, baseY, z); crossGroup.add(th);

      // Curved ssDNA: 4 segments
      const segs = [];
      const nSeg = 4, segH = h / nSeg;
      for (let s = 0; s < nSeg; s++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, segH, 4), strandMat.clone());
        const curve = Math.sin((s + 0.5) / nSeg * Math.PI) * 0.15;
        seg.position.set(x + curve * Math.cos(i), baseY + s * segH + segH / 2, z + curve * Math.sin(i));
        seg.rotation.x = rx + Math.sin(s * 1.2) * 0.08;
        seg.rotation.z = rz + Math.cos(s * 0.9) * 0.08;
        seg.userData._rx0 = seg.rotation.x;
        seg.userData._rz0 = seg.rotation.z;
        crossGroup.add(seg); segs.push(seg);
      }

      // MB sphere
      const mb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mbMat.clone());
      mb.position.set(x + rz * h * 0.3, baseY + h, z - rx * h * 0.3);
      crossGroup.add(mb);

      // Cut stub (Cas12a activated)
      const cutH = h * (0.3 + Math.random() * 0.2);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, cutH, 4), cutMat);
      st.position.set(x, baseY + cutH / 2, z); st.rotation.x = rx; st.rotation.z = rz;
      st.visible = false; crossGroup.add(st);

      reporters.push({ segs, mb, stub: st, thiol: th });
    }
    // MCH stubs
    for (let i = 0; i < 30; i++) {
      const mx = (Math.random() - 0.5) * (secR * 2 - 1), mz = (Math.random() - 0.5) * (secR * 2 - 1);
      if (mx * mx + mz * mz > (secR - 0.3) ** 2) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), mchStub);
      m.position.set(mx, baseY + 0.15, mz); crossGroup.add(m);
    }

    // ── Camera orbit ──
    let orbit = { theta: 0.3, phi: -0.45, dist: 90, target: new THREE.Vector3(10, 0, 2) };
    let tgtOrbit = { theta: 0.3, phi: -0.45, dist: 90, target: new THREE.Vector3(10, 0, 2) };
    let isDragging = false, prevMouse = { x: 0, y: 0 };
    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();

    const onDown = (e) => { isDragging = true; const p = e.touches ? e.touches[0] : e; prevMouse = { x: p.clientX, y: p.clientY }; };
    const onUp = () => { isDragging = false; };
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      if (!isDragging) {
        const mx = ((p.clientX - rect.left) / rect.width) * 2 - 1;
        const my = -((p.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
        const hits = raycaster.intersectObjects(padMeshes);
        if (hits.length > 0) {
          const ud = hits[0].object.userData;
          canvas.style.cursor = "pointer";
          stateRef.current._hovIdx = ud.idx;
          setTooltipInfo({ target: ud.target, drug: ud.drug });
          setTooltipPos({ x: p.clientX - rect.left, y: p.clientY - rect.top });
        } else {
          canvas.style.cursor = "grab";
          stateRef.current._hovIdx = -1;
          setTooltipInfo(null);
        }
      }
      if (!isDragging) return;
      const dx = p.clientX - prevMouse.x, dy = p.clientY - prevMouse.y;
      tgtOrbit.theta += dx * 0.005;
      tgtOrbit.phi = Math.max(-1.3, Math.min(-0.08, tgtOrbit.phi + dy * 0.005));
      prevMouse = { x: p.clientX, y: p.clientY };
    };
    const onWheel = (e) => { e.preventDefault(); tgtOrbit.dist = Math.max(15, Math.min(150, tgtOrbit.dist + e.deltaY * 0.08)); };
    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
      const hits = raycaster.intersectObjects(padMeshes);
      if (hits.length > 0) stateRef.current._selectPad(hits[0].object.userData.idx, hits[0].object.userData.target);
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchmove", onMove, { passive: true });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onClick);

    // Animation
    let frameId, time = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.016;
      orbit.theta += (tgtOrbit.theta - orbit.theta) * 0.07;
      orbit.phi += (tgtOrbit.phi - orbit.phi) * 0.07;
      orbit.dist += (tgtOrbit.dist - orbit.dist) * 0.07;
      orbit.target.lerp(tgtOrbit.target instanceof THREE.Vector3 ? tgtOrbit.target : new THREE.Vector3(tgtOrbit.target.x, tgtOrbit.target.y, tgtOrbit.target.z), 0.07);
      camera.position.x = orbit.target.x + orbit.dist * Math.sin(orbit.theta) * Math.cos(orbit.phi);
      camera.position.y = orbit.target.y + orbit.dist * Math.sin(-orbit.phi);
      camera.position.z = orbit.target.z + orbit.dist * Math.cos(orbit.theta) * Math.cos(orbit.phi);
      camera.lookAt(orbit.target);

      reporters.forEach((r, i) => {
        r.segs.forEach((seg, si) => {
          if (seg.visible) {
            seg.rotation.x = seg.userData._rx0 + Math.sin(time * 1.9 + i * 0.7 + si * 0.5) * 0.04;
            seg.rotation.z = seg.userData._rz0 + Math.cos(time * 1.5 + i * 1.1 + si * 0.3) * 0.04;
          }
        });
        if (r.mb.visible) r.mb.material.emissiveIntensity = 0.2 + 0.15 * Math.sin(time * 3.14 + i);
      });
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth, h2 = Math.round(w * 9 / 16);
      container.style.height = h2 + "px";
      renderer.setSize(w, h2);
      camera.aspect = w / h2; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    stateRef.current = {
      chipGroup, crossGroup, reporters, padMeshes, orbit, tgtOrbit,
      _hovIdx: -1,
      _selectPad: (idx, target) => { setSelectedPad({ idx, target }); setMode(2); },
      _toMode1: () => { setMode(1); setSelectedPad(null); setCas12aActive(false); },
    };

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onResize);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Mode transitions
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (mode === 1) {
      s.chipGroup.visible = true; s.crossGroup.visible = false;
      s.tgtOrbit.dist = 90; s.tgtOrbit.theta = 0.3; s.tgtOrbit.phi = -0.45;
      s.tgtOrbit.target = new THREE.Vector3(10, 0, 2);
    } else {
      s.chipGroup.visible = false; s.crossGroup.visible = true;
      s.tgtOrbit.dist = 16; s.tgtOrbit.theta = 0.4; s.tgtOrbit.phi = -0.3;
      s.tgtOrbit.target = new THREE.Vector3(0, 3.5, 0);
    }
  }, [mode, selectedPad]);

  // Cas12a toggle
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.reporters.forEach(r => {
      r.segs.forEach(seg => { seg.visible = !cas12aActive; });
      r.mb.visible = !cas12aActive;
      r.stub.visible = cas12aActive;
    });
  }, [cas12aActive]);

  // Enhancement 4: Dynamic GUARD data
  const selDrug = selectedPad ? targetDrug(selectedPad.target) : null;
  const selEff = selectedPad ? getEfficiency(selectedPad.target) : null;
  const selStrat = selectedPad ? targetStrategy(selectedPad.target) : null;
  const selR = selectedPad ? results.find(x => x.label === selectedPad.target) : null;
  const selDisc = selR?.disc && selR.disc < 900 ? selR.disc : null;
  const selScore = selR?.ensembleScore || selR?.score || null;
  const selCoAmp = (() => {
    if (!selectedPad) return null;
    const gs = [["rpoB_H445Y","rpoB_H445D"],["rpoB_S450L","rpoB_S450W"],["katG_S315T","katG_S315N"],["embB_M306V","embB_M306I"]];
    const g = gs.find(g => g.includes(selectedPad.target));
    return g ? g.find(x => x !== selectedPad.target) : null;
  })();

  const deltaI = selectedPad && computeGamma && echemGamma0_mol ? (() => {
    const G = computeGamma(incubationMin * 60, getEfficiency(selectedPad.target), echemKtrans);
    return ((1 - G / echemGamma0_mol) * 100).toFixed(1);
  })() : null;

  // Enhancement 5: Mini SWV data
  const swvData = selectedPad ? (() => {
    const G_after = computeGamma(incubationMin * 60, getEfficiency(selectedPad.target), echemKtrans);
    return { before: miniSWV(echemGamma0_mol, echemGamma0_mol), after: miniSWV(G_after, echemGamma0_mol) };
  })() : null;

  const svgPath = (pts, w, h) => {
    if (!pts?.length) return "";
    const maxI = Math.max(...pts.map(p => Math.abs(p.I)), 0.001);
    return pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (Math.abs(p.I) / maxI) * h * 0.85 - h * 0.05;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", background: "#F8F9FA" }}>
      <div ref={mountRef} style={{ width: "100%", minHeight: 280 }} />

      {mode === 1 && (
        <>
          <div style={{ position: "absolute", top: 12, left: 16, fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: HEADING, textShadow: "0 1px 3px rgba(255,255,255,0.9)" }}>
            GUARD MDR-TB Diagnostic Chip
          </div>
          <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, color: "#6B7280", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}>
            Click pad to inspect · Drag to rotate · Scroll to zoom
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(DRUG_CSS).map(([d, c]) => (
              <span key={d} style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.88)", padding: "2px 7px", borderRadius: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />{d}
              </span>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 9, color: "#9CA3AF", background: "rgba(255,255,255,0.88)", padding: "2px 8px", borderRadius: 4, fontFamily: MONO }}>65 × 35 mm</div>
        </>
      )}

      {mode === 2 && selectedPad && (
        <>
          {/* Enhancement 4: Expanded info panel */}
          <div style={{ position: "absolute", top: 12, left: 16, background: "rgba(255,255,255,0.93)", padding: "10px 16px", borderRadius: 8, border: "1px solid #E3E8EF", maxWidth: 260 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: HEADING }}>
              {selectedPad.target} · <span style={{ color: DRUG_CSS[selDrug] || "#888" }}>{selDrug}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", fontFamily: MONO, marginTop: 3, lineHeight: 1.6 }}>
              S_eff = {selEff?.toFixed(3)}{selScore != null && ` · Score = ${selScore.toFixed(2)}`}{selDisc ? ` · D = ${selDisc.toFixed(1)}×` : ""}<br />
              {selStrat} detection{selCoAmp && ` · co-amplicon: ${selCoAmp}`}
              {selR?.hasPrimers && <span style={{ color: "#16A34A" }}> · RPA primers</span>}
            </div>
          </div>

          <button onClick={() => stateRef.current?._toMode1()} style={{ position: "absolute", top: 12, right: 16, fontSize: 11, fontWeight: 600, padding: "7px 16px", borderRadius: 6, border: "1px solid #E3E8EF", background: "#fff", cursor: "pointer", fontFamily: HEADING, color: "#374151" }}>
            ← Back to chip
          </button>

          {/* Layer labels */}
          <div style={{ position: "absolute", left: 16, top: "40%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "MB (E° = −0.22 V, n = 2)", color: "#3288bd" },
              { label: "ssDNA reporter (12–20 nt)", color: "#66c2a5" },
              { label: "Thiol linker (Au–S)", color: "#FFD700" },
              { label: "MCH backfill", color: "#AAAAAA" },
              { label: "AuNP hemispheres", color: "#FFD700" },
              { label: "LIG (porous, 23 Ω/sq)", color: "#2D2D2D" },
              { label: "Kapton (125 μm)", color: "#D4A76A" },
            ].map(l => (
              <div key={l.label} style={{ fontSize: 9, fontFamily: MONO, color: "#374151", background: "rgba(255,255,255,0.9)", padding: "3px 8px", borderRadius: 4, borderLeft: `3px solid ${l.color}`, lineHeight: 1.3 }}>← {l.label}</div>
            ))}
          </div>

          {/* Enhancement 5: Mini SWV voltammogram */}
          {swvData && (
            <div style={{ position: "absolute", bottom: 60, right: 16, background: "rgba(255,255,255,0.93)", padding: "6px 10px", borderRadius: 8, border: "1px solid #E3E8EF" }}>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: "#6B7280", marginBottom: 3 }}>SWV Preview</div>
              <svg width={120} height={60} viewBox="0 0 120 60">
                <path d={svgPath(swvData.before, 120, 60)} fill="none" stroke="#93C5FD" strokeWidth="1.5" />
                <path d={svgPath(swvData.after, 120, 60)} fill="none" stroke="#2563EB" strokeWidth="1.5" />
                <line x1="0" y1="58" x2="120" y2="58" stroke="#D1D5DB" strokeWidth="0.5" />
                <text x="2" y="57" fontSize="6" fill="#9CA3AF">−0.05</text>
                <text x="95" y="57" fontSize="6" fill="#9CA3AF">−0.40 V</text>
              </svg>
              <div style={{ fontSize: 8, color: "#9CA3AF", fontFamily: MONO, display: "flex", gap: 10, marginTop: 2 }}>
                <span><span style={{ color: "#93C5FD" }}>—</span> baseline</span>
                <span><span style={{ color: "#2563EB" }}>—</span> t={incubationMin}m</span>
              </div>
            </div>
          )}

          {/* Cas12a toggle + incubation slider */}
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 12, alignItems: "center", background: "rgba(255,255,255,0.94)", padding: "8px 18px", borderRadius: 8, border: "1px solid #E3E8EF", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => setCas12aActive(!cas12aActive)} style={{
              fontSize: 11, fontWeight: 700, padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontFamily: MONO,
              background: cas12aActive ? "#DC2626" : "#16A34A", color: "#fff", border: "none", transition: "background 0.2s",
            }}>
              {cas12aActive ? "Reset reporters" : "Activate Cas12a"}
            </button>
            {cas12aActive && deltaI != null && (
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: "#2563EB" }}>ΔI% = {deltaI}%</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#6B7280", fontFamily: MONO }}>t =</span>
              <input type="range" min="5" max="60" step="5" value={incubationMin} onChange={e => setIncubationMin(+e.target.value)} style={{ width: 80, accentColor: "#2563EB" }} />
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: "#374151", minWidth: 32 }}>{incubationMin} min</span>
            </div>
          </div>
        </>
      )}

      {tooltipInfo && mode === 1 && (
        <div style={{ position: "absolute", left: tooltipPos.x + 14, top: tooltipPos.y - 12, pointerEvents: "none", background: "rgba(255,255,255,0.96)", border: "1px solid #E3E8EF", borderRadius: 6, padding: "8px 12px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", zIndex: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: DRUG_CSS[tooltipInfo.drug] || "#333" }}>{tooltipInfo.target}</div>
          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
            {tooltipInfo.drug} · S_eff = {getEfficiency(tooltipInfo.target).toFixed(3)}
            {(() => { const r = results.find(x => x.label === tooltipInfo.target); return r?.disc && r.disc < 900 ? ` · D = ${r.disc.toFixed(1)}×` : ""; })()}
          </div>
          <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 1 }}>{targetStrategy(tooltipInfo.target)} detection</div>
        </div>
      )}
    </div>
  );
}
