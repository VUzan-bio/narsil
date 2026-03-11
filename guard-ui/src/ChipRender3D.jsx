import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

// ── Drug class colors (hex integers for Three.js) ──
const DRUG_HEX = { RIF: 0x3288bd, INH: 0x66c2a5, EMB: 0xabdda4, PZA: 0xfee08b, FQ: 0xf46d43, AG: 0xd53e4f, CTRL: 0x999999 };
const DRUG_CSS = { RIF: "#3288bd", INH: "#66c2a5", EMB: "#abdda4", PZA: "#fee08b", FQ: "#f46d43", AG: "#d53e4f", CTRL: "#999999" };

// ── Cross-section layer config ──
const LAYERS = [
  { name: "Kapton substrate", height: 2.0, color: 0xD4A76A, roughness: 0.4, label: "Kapton / Paper substrate" },
  { name: "LIG", height: 1.5, color: 0x2D2D2D, roughness: 0.9, label: "LIG (23 Ω/sq, η = 3–6)" },
  { name: "AuNP", height: 0.3, color: 0xFFD700, roughness: 0.2, metalness: 0.8, label: "AuNP (thiol-Au, 170 kJ/mol)" },
];

export default function ChipRender3D({ electrodeLayout, targetDrug, targetStrategy, getEfficiency, results, computeGamma, echemTime, echemKtrans, echemGamma0_mol, T, HEADING, MONO, mobile }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);        // persisted Three.js objects
  const [mode, setMode] = useState(1);  // 1 = overview, 2 = cross-section
  const [selectedPad, setSelectedPad] = useState(null);
  const [hoveredPadIdx, setHoveredPadIdx] = useState(-1);
  const [cas12aActive, setCas12aActive] = useState(false);
  const [tooltipInfo, setTooltipInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Build the full scene ──
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = Math.round(W * 9 / 16);
    container.style.height = H + "px";

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xF8F9FA);
    container.appendChild(renderer.domElement);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);

    // Scene
    const scene = new THREE.Scene();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(-20, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xD4A76A, 0.3);
    scene.add(hemi);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.08 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // ══════════ MODE 1: Chip overview group ══════════
    const chipGroup = new THREE.Group();
    scene.add(chipGroup);

    // A. Chip body (60×30×1)
    const bodyGeo = new THREE.BoxGeometry(60, 1, 30);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xD4A76A, transparent: true, opacity: 0.85, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    chipGroup.add(body);

    // B. Sample prep zone (left side)
    const prepGeo = new THREE.BoxGeometry(12, 0.15, 8);
    const prepMat = new THREE.MeshStandardMaterial({ color: 0x93C5FD, transparent: true, opacity: 0.6 });
    const prep = new THREE.Mesh(prepGeo, prepMat);
    prep.position.set(-22, 0.58, 0);
    chipGroup.add(prep);

    // Magnetic beads in sample prep
    const beadMat = new THREE.MeshStandardMaterial({ color: 0x6B7280, metalness: 0.5 });
    for (let i = 0; i < 12; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), beadMat);
      bead.position.set(-22 + (Math.random() - 0.5) * 10, 0.85, (Math.random() - 0.5) * 6);
      chipGroup.add(bead);
    }

    // C. Central application pad
    const centerGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.2, 24);
    const centerMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.8 });
    const centerPad = new THREE.Mesh(centerGeo, centerMat);
    centerPad.position.set(-10, 0.6, 0);
    chipGroup.add(centerPad);

    // D. Distribution channels from center to grid
    const channelMat = new THREE.MeshStandardMaterial({ color: 0x4B5563, roughness: 0.7 });
    const flatPads = electrodeLayout.flat();
    const padMeshes = [];
    const padPositions = [];

    // Grid positioning: 5 cols × 3 rows, right side of chip
    const gridStartX = 2;
    const gridStartZ = -5;
    const spacingX = 5.5;
    const spacingZ = 5;

    flatPads.forEach((target, idx) => {
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      const px = gridStartX + col * spacingX;
      const pz = gridStartZ + row * spacingZ;
      padPositions.push({ x: px, z: pz, target, row, col });

      // Channel from center to pad
      const dx = px - (-10);
      const dz = pz - 0;
      const len = Math.sqrt(dx * dx + dz * dz);
      const chGeo = new THREE.BoxGeometry(len, 0.08, 0.4);
      const ch = new THREE.Mesh(chGeo, channelMat);
      ch.position.set(-10 + dx / 2, 0.55, dz / 2);
      ch.rotation.y = -Math.atan2(dz, dx);
      chipGroup.add(ch);

      // E. Detection pad
      const drug = targetDrug(target);
      const padColor = DRUG_HEX[drug] || 0x999999;
      const padGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 20);
      const padMat = new THREE.MeshStandardMaterial({ color: padColor, roughness: 0.4 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(px, 0.65, pz);
      padMesh.castShadow = true;
      padMesh.userData = { target, drug, idx, padColor };
      chipGroup.add(padMesh);
      padMeshes.push(padMesh);

      // Strategy indicator: sphere for direct, half for proximity
      const strat = targetStrategy(target);
      const indGeo = new THREE.SphereGeometry(0.3, 8, 8, 0, Math.PI * 2, 0, strat === "Proximity" ? Math.PI / 2 : Math.PI);
      const indMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 });
      const ind = new THREE.Mesh(indGeo, indMat);
      ind.position.set(px, 1.0, pz);
      chipGroup.add(ind);
    });

    // F. Wax barriers between adjacent pads
    const waxMat = new THREE.MeshPhysicalMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.35 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const px = gridStartX + c * spacingX;
        const pz = gridStartZ + r * spacingZ;
        // Right barrier
        if (c < 4) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(spacingX - 3, 0.3, 0.1), waxMat);
          w.position.set(px + spacingX / 2, 0.65, pz);
          chipGroup.add(w);
        }
        // Bottom barrier
        if (r < 2) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, spacingZ - 3), waxMat);
          w.position.set(px, 0.65, pz + spacingZ / 2);
          chipGroup.add(w);
        }
      }
    }

    // G. SWV contact pads along bottom edge
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 16; i++) {
      const cx = -5 + i * 3.5;
      const cz = 16;
      const contactGeo = new THREE.BoxGeometry(1, 0.15, 2);
      const contact = new THREE.Mesh(contactGeo, goldMat);
      contact.position.set(cx, 0.58, cz);
      chipGroup.add(contact);
      // Trace
      if (i < 15) {
        const tgt = padPositions[i];
        if (tgt) {
          const tGeo = new THREE.BoxGeometry(0.2, 0.06, Math.abs(cz - tgt.z));
          const trace = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ color: 0x4B5563 }));
          trace.position.set(cx, 0.52, (cz + tgt.z) / 2);
          chipGroup.add(trace);
        }
      }
    }

    // ══════════ MODE 2: Cross-section group (hidden initially) ══════════
    const crossGroup = new THREE.Group();
    crossGroup.visible = false;
    scene.add(crossGroup);

    // Layer stack
    let yOff = 0;
    LAYERS.forEach(l => {
      const geo = new THREE.BoxGeometry(6, l.height, 6);
      const mat = new THREE.MeshStandardMaterial({ color: l.color, roughness: l.roughness || 0.5, metalness: l.metalness || 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = yOff + l.height / 2;
      mesh.castShadow = true;
      crossGroup.add(mesh);
      yOff += l.height;
    });

    // AuNP spheres on LIG surface
    const auMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i < 40; i++) {
      const au = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), auMat);
      au.position.set((Math.random() - 0.5) * 5, yOff + Math.random() * 0.1, (Math.random() - 0.5) * 5);
      crossGroup.add(au);
    }
    const reporterBaseY = yOff + 0.15;

    // ssDNA reporters + MB spheres + MCH stubs
    const strandMat = new THREE.MeshStandardMaterial({ color: 0x66c2a5 });
    const strandCutMat = new THREE.MeshStandardMaterial({ color: 0x3d7a63 });
    const mbMat = new THREE.MeshStandardMaterial({ color: 0x3288bd, emissive: 0x1a4470, emissiveIntensity: 0.3 });
    const mchMat = new THREE.MeshStandardMaterial({ color: 0xAAAAAA });

    const reporters = [];
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 4.5;
      const z = (Math.random() - 0.5) * 4.5;
      const h = 2.5 + Math.random() * 0.5;
      const rx = (Math.random() - 0.5) * 0.25;
      const rz = (Math.random() - 0.5) * 0.25;

      // Full strand
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 4), strandMat.clone());
      strand.position.set(x, reporterBaseY + h / 2, z);
      strand.rotation.x = rx;
      strand.rotation.z = rz;
      crossGroup.add(strand);

      // MB sphere at tip
      const tipY = reporterBaseY + h;
      const mb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mbMat.clone());
      mb.position.set(x + rz * h * 0.3, tipY, z - rx * h * 0.3);
      crossGroup.add(mb);

      // Cut stub (hidden initially)
      const cutH = h * (0.3 + Math.random() * 0.2);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, cutH, 4), strandCutMat);
      stub.position.set(x, reporterBaseY + cutH / 2, z);
      stub.rotation.x = rx;
      stub.rotation.z = rz;
      stub.visible = false;
      crossGroup.add(stub);

      reporters.push({ strand, mb, stub, fullH: h, cutH, origMbY: mb.position.y });
    }

    // MCH stubs
    for (let i = 0; i < 30; i++) {
      const mch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), mchMat);
      mch.position.set((Math.random() - 0.5) * 4.5, reporterBaseY + 0.15, (Math.random() - 0.5) * 4.5);
      crossGroup.add(mch);
    }

    // ── Camera orbit state ──
    let orbit = { theta: 0.3, phi: -0.45, dist: 90, target: new THREE.Vector3(5, 0, 2) };
    let targetOrbit = { ...orbit, target: orbit.target.clone() };
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const canvas = renderer.domElement;

    const onDown = (e) => { isDragging = true; const p = e.touches ? e.touches[0] : e; prevMouse = { x: p.clientX, y: p.clientY }; };
    const onUp = () => { isDragging = false; };
    const onMove = (e) => {
      if (!isDragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - prevMouse.x;
      const dy = p.clientY - prevMouse.y;
      targetOrbit.theta += dx * 0.005;
      targetOrbit.phi = Math.max(-1.2, Math.min(-0.1, targetOrbit.phi + dy * 0.005));
      prevMouse = { x: p.clientX, y: p.clientY };
    };
    const onWheel = (e) => {
      e.preventDefault();
      targetOrbit.dist = Math.max(20, Math.min(150, targetOrbit.dist + e.deltaY * 0.08));
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchmove", onMove, { passive: true });
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ── Raycaster ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(padMeshes);
      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        stateRef.current._selectPad(ud.idx, ud.target);
      }
    };
    canvas.addEventListener("click", onClick);

    const onHover = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(padMeshes);
      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        canvas.style.cursor = "pointer";
        stateRef.current._setHover(ud.idx, { target: ud.target, drug: ud.drug }, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        canvas.style.cursor = "grab";
        stateRef.current._setHover(-1, null, 0, 0);
      }
    };
    canvas.addEventListener("mousemove", onHover);

    // ── Animation loop ──
    let frameId;
    let time = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.016;

      // Smooth orbit interpolation
      orbit.theta += (targetOrbit.theta - orbit.theta) * 0.08;
      orbit.phi += (targetOrbit.phi - orbit.phi) * 0.08;
      orbit.dist += (targetOrbit.dist - orbit.dist) * 0.08;
      orbit.target.lerp(targetOrbit.target, 0.08);

      camera.position.x = orbit.target.x + orbit.dist * Math.sin(orbit.theta) * Math.cos(orbit.phi);
      camera.position.y = orbit.target.y + orbit.dist * Math.sin(-orbit.phi);
      camera.position.z = orbit.target.z + orbit.dist * Math.cos(orbit.theta) * Math.cos(orbit.phi);
      camera.lookAt(orbit.target);

      // MB pulsing glow
      reporters.forEach((r, i) => {
        if (r.mb.visible) {
          r.mb.material.emissiveIntensity = 0.2 + 0.15 * Math.sin(time * 3.14 + i);
        }
      });

      // Pad hover glow
      padMeshes.forEach((pm, i) => {
        const isHov = i === stateRef.current?._hovIdx;
        pm.material.emissive = isHov ? new THREE.Color(pm.userData.padColor) : new THREE.Color(0x000000);
        pm.material.emissiveIntensity = isHov ? 0.4 : 0;
      });

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ──
    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.round(w * 9 / 16);
      container.style.height = h + "px";
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Store refs for external control ──
    stateRef.current = {
      scene, camera, renderer, chipGroup, crossGroup, padMeshes, padPositions, reporters, orbit, targetOrbit,
      _hovIdx: -1,
      _setHover: (idx, info, x, y) => {
        stateRef.current._hovIdx = idx;
        setHoveredPadIdx(idx);
        if (info) { setTooltipInfo(info); setTooltipPos({ x, y }); }
        else setTooltipInfo(null);
      },
      _selectPad: (idx, target) => {
        setSelectedPad({ idx, target });
        setMode(2);
      },
      _toMode1: () => {
        setMode(1);
        setSelectedPad(null);
        setCas12aActive(false);
      },
    };

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []); // mount once

  // ── React to mode changes ──
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (mode === 1) {
      s.chipGroup.visible = true;
      s.crossGroup.visible = false;
      s.targetOrbit.dist = 90;
      s.targetOrbit.theta = 0.3;
      s.targetOrbit.phi = -0.45;
      s.targetOrbit.target = new THREE.Vector3(5, 0, 2);
    } else if (mode === 2 && selectedPad) {
      s.chipGroup.visible = false;
      s.crossGroup.visible = true;
      s.targetOrbit.dist = 18;
      s.targetOrbit.theta = 0.4;
      s.targetOrbit.phi = -0.35;
      s.targetOrbit.target = new THREE.Vector3(0, 2.5, 0);
    }
  }, [mode, selectedPad]);

  // ── React to Cas12a toggle ──
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.reporters.forEach(r => {
      if (cas12aActive) {
        r.strand.visible = false;
        r.mb.visible = false;
        r.stub.visible = true;
      } else {
        r.strand.visible = true;
        r.mb.visible = true;
        r.stub.visible = false;
      }
    });
  }, [cas12aActive]);

  // Compute ΔI% for selected pad
  const deltaI = selectedPad && computeGamma && echemGamma0_mol
    ? (() => {
        const eff = getEfficiency(selectedPad.target);
        const G = computeGamma(echemTime * 60, eff, echemKtrans);
        return ((1 - G / echemGamma0_mol) * 100).toFixed(1);
      })()
    : null;

  const selDrug = selectedPad ? targetDrug(selectedPad.target) : null;
  const selEff = selectedPad ? getEfficiency(selectedPad.target) : null;

  return (
    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", background: "#F8F9FA" }}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ width: "100%", minHeight: 300 }} />

      {/* ── Mode 1 overlays ── */}
      {mode === 1 && (
        <>
          <div style={{ position: "absolute", top: 12, left: 16, fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: HEADING, textShadow: "0 1px 3px rgba(255,255,255,0.8)" }}>
            GUARD MDR-TB Diagnostic Chip
          </div>
          <div style={{ position: "absolute", top: 12, right: 16, fontSize: 10, color: "#6B7280", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}>
            Click pad to inspect · Drag to rotate · Scroll to zoom
          </div>
          {/* Drug legend */}
          <div style={{ position: "absolute", bottom: 12, left: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(DRUG_CSS).map(([d, c]) => (
              <span key={d} style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: c, background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 4 }}>{d}</span>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 9, color: "#9CA3AF", background: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 4, fontFamily: MONO }}>
            60 × 30 mm
          </div>
        </>
      )}

      {/* ── Mode 2 overlays ── */}
      {mode === 2 && selectedPad && (
        <>
          <div style={{ position: "absolute", top: 12, left: 16, fontSize: 12, fontWeight: 700, color: "#111827", fontFamily: HEADING, textShadow: "0 1px 3px rgba(255,255,255,0.8)" }}>
            {selectedPad.target} · <span style={{ color: DRUG_CSS[selDrug] || "#999" }}>{selDrug}</span> · S_eff = {selEff?.toFixed(3)}
          </div>
          <button
            onClick={() => stateRef.current?._toMode1()}
            style={{ position: "absolute", top: 12, right: 16, fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: `1px solid #E3E8EF`, background: "#fff", cursor: "pointer", fontFamily: HEADING, color: "#374151" }}
          >
            ← Back to chip
          </button>
          {/* Layer labels */}
          <div style={{ position: "absolute", left: 16, top: "40%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "MB (−0.22 V, 2e⁻)", color: "#3288bd" },
              { label: "ssDNA (12–20 nt)", color: "#66c2a5" },
              { label: "MCH backfill", color: "#AAAAAA" },
              { label: "AuNP (thiol-Au)", color: "#FFD700" },
              { label: "LIG (23 Ω/sq)", color: "#2D2D2D" },
              { label: "Kapton substrate", color: "#D4A76A" },
            ].map(l => (
              <div key={l.label} style={{ fontSize: 9, fontFamily: MONO, color: "#374151", background: "rgba(255,255,255,0.88)", padding: "2px 8px", borderRadius: 4, borderLeft: `3px solid ${l.color}` }}>
                {l.label}
              </div>
            ))}
          </div>
          {/* Cas12a toggle + ΔI% */}
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 12, alignItems: "center", background: "rgba(255,255,255,0.92)", padding: "8px 16px", borderRadius: 8, border: "1px solid #E3E8EF" }}>
            <button
              onClick={() => setCas12aActive(!cas12aActive)}
              style={{
                fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: MONO,
                background: cas12aActive ? "#DC2626" : "#16A34A",
                color: "#fff", border: "none",
              }}
            >
              {cas12aActive ? "Reset reporters" : "Activate Cas12a"}
            </button>
            {cas12aActive && deltaI != null && (
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: "#2563EB" }}>
                ΔI% = {deltaI}%
              </span>
            )}
          </div>
        </>
      )}

      {/* ── Tooltip on hover ── */}
      {tooltipInfo && mode === 1 && (
        <div style={{
          position: "absolute", left: tooltipPos.x + 12, top: tooltipPos.y - 10, pointerEvents: "none",
          background: "rgba(255,255,255,0.95)", border: "1px solid #E3E8EF", borderRadius: 6,
          padding: "6px 10px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", zIndex: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: DRUG_CSS[tooltipInfo.drug] || "#333" }}>{tooltipInfo.target}</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>{tooltipInfo.drug} · S_eff = {getEfficiency(tooltipInfo.target).toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}
