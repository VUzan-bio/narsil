import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, ExternalLink, FlaskConical,
  Grid3x3, Lock, RefreshCw, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ReferenceLine,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import { T, FONT, HEADING, MONO } from "../tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { Badge, Btn, tooltipStyle, gaussianKDE } from "../components/ui/index.jsx";
import { CollapsibleSection } from "../components/CollapsibleSection";
import {
  listJobs, compareScorers, getThermoProfile, getThermoStandalone, getAblation,
  getNucleaseProfiles, getNucleaseComparison, getEnzymes,
} from "../api";

const ResearchPage = ({ connected }) => {
  const mobile = useIsMobile();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [comparison, setComparison] = useState(null);
  const [modelA, setModelA] = useState("heuristic");
  const [modelB, setModelB] = useState("compass_ml");
  const [comparing, setComparing] = useState(false);
  const [thermoTarget, setThermoTarget] = useState("");
  const [thermoStandaloneSeq, setThermoStandaloneSeq] = useState("TCGGTCAACCCCGACAGC");
  const [thermoMode, setThermoMode] = useState("standalone"); // "standalone" | "panel"
  const [thermoData, setThermoData] = useState(null);
  const [thermoLoading, setThermoLoading] = useState(false);
  const [thermoShowWT, setThermoShowWT] = useState(true);
  const [ablation, setAblation] = useState([]);
  const [sciBgOpen, setSciBgOpen] = useState(false);
  const [nucleaseProfiles, setNucleaseProfiles] = useState(null);
  const [nucleaseCoverage, setNucleaseCoverage] = useState(null);
  const [nucleaseLoading, setNucleaseLoading] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState(null);

  useEffect(() => {
    if (connected) {
      listJobs().then(({ data }) => {
        if (data) {
          const completed = (data.jobs || data || []).filter(j => j.status === "completed");
          setJobs(completed);
          if (completed.length > 0 && !selectedJob) setSelectedJob(completed[0].job_id);
        }
      });
      getAblation().then(({ data }) => { if (data) setAblation(data); });
      getNucleaseProfiles().then(({ data }) => { if (data?.profiles) setNucleaseProfiles(data.profiles); });
    }
  }, [connected]);

  const handleCompare = async () => {
    if (!selectedJob) return;
    setComparing(true);
    const { data } = await compareScorers(selectedJob, modelA, modelB);
    if (data) setComparison(data);
    setComparing(false);
  };

  const handleThermo = async (label) => {
    if (!selectedJob || !label) return;
    setThermoLoading(true);
    setThermoTarget(label);
    setThermoMode("panel");
    const { data } = await getThermoProfile(selectedJob, label);
    if (data) setThermoData(data);
    setThermoLoading(false);
  };

  const handleThermoStandalone = async () => {
    const seq = thermoStandaloneSeq.trim().toUpperCase();
    if (!seq || seq.length < 15) return;
    setThermoLoading(true);
    setThermoTarget(seq);
    setThermoMode("standalone");
    const { data } = await getThermoStandalone(seq);
    if (data) setThermoData(data);
    setThermoLoading(false);
  };

  // Research-specific styles
  const RS = {
    bg: T.bgSub, cardBg: T.bg, border: T.border, text: T.text,
    muted: T.textSec, accent: T.primary, positive: T.success, negative: T.danger,
    mutLine: T.text, wtLine: T.textTer, seedBg: `${T.primary}0A`,
    snpLine: T.danger, barrier: "#D97706",
  };
  const rTooltip = { background: "#fff", border: `1px solid ${T.border}`, borderRadius: "3px", fontSize: "11px", fontFamily: MONO, color: T.text, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const selectStyle = { padding: "6px 10px", borderRadius: "4px", border: `1px solid ${RS.border}`, fontSize: "12px", fontFamily: FONT, background: RS.cardBg, color: RS.text };
  const btnStyle = { padding: "6px 14px", borderRadius: "4px", border: "none", background: RS.accent, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" };
  const thStyle = { padding: "8px 12px", fontWeight: 600, color: RS.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${RS.border}` };
  const tdStyle = { padding: "8px 12px", fontSize: "12px", fontFamily: FONT, color: RS.text };

  // Heuristic feature weights for waterfall chart
  // Approximate default weights for M.tb; actual values are organism-specific
  const HEURISTIC_WEIGHTS = [
    { name: "Seed position", key: "seed", weight: 0.30 },
    { name: "GC content", key: "gc", weight: 0.20 },
    { name: "Secondary struct.", key: "ss", weight: 0.15 },
    { name: "Off-target", key: "ot", weight: 0.20 },
    { name: "Thermo. stability", key: "thermo", weight: 0.15 },
  ];

  // Position importance (approximate RLPA/heuristic seed weights)
  const POS_WEIGHTS = Array.from({ length: 20 }, (_, i) => {
    const pos = i + 1;
    if (pos <= 4) return 1.0;
    if (pos <= 8) return 0.7 - (pos - 5) * 0.08;
    if (pos <= 12) return 0.35 - (pos - 9) * 0.04;
    return 0.18 - (pos - 13) * 0.015;
  });

  return (
    <div style={{ padding: mobile ? "24px 16px" : "32px 40px", background: RS.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: RS.accent, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Research</div>
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: RS.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>Scoring R&D Sandbox</h2>
        <p style={{ fontSize: "13px", color: RS.muted, marginTop: "8px", lineHeight: 1.7, maxWidth: "720px" }}>
          Experimental workspace for scoring model development. Results here are exploratory; they inform model selection and feature engineering but do not affect production panel design. All thermodynamic calculations use nearest-neighbor parameters (Sugimoto et al. 1995 for Watson-Crick RNA:DNA hybrids; Sugimoto et al. 2000 for RNA:DNA mismatch penalties; SantaLucia 1998 for DNA:DNA duplex stability) and are approximations of the true molecular energetics.
        </p>
      </div>

      {/* Job selector */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: RS.muted }}>Panel run:</span>
        <select value={selectedJob} onChange={(e) => { setSelectedJob(e.target.value); setComparison(null); setThermoData(null); }} style={selectStyle}>
          {jobs.length === 0 && <option value="">No completed jobs</option>}
          {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.name || j.job_id}</option>)}
        </select>
      </div>

      {/* ═══ Section 1: Scorer Comparison Lab ═══ */}
      <CollapsibleSection title="Scorer Comparison Lab" defaultOpen={true}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
          <select value={modelA} onChange={(e) => setModelA(e.target.value)} style={selectStyle}>
            <option value="heuristic">Heuristic</option>
            <option value="compass_ml">Compass-ML</option>
            <option value="compass_ml_diagnostic">Compass-ML Diagnostic</option>
          </select>
          <span style={{ fontSize: "12px", color: RS.muted, fontWeight: 600 }}>vs</span>
          <select value={modelB} onChange={(e) => setModelB(e.target.value)} style={selectStyle}>
            <option value="compass_ml">Compass-ML</option>
            <option value="heuristic">Heuristic</option>
            <option value="compass_ml_diagnostic">Compass-ML Diagnostic</option>
          </select>
          <button onClick={handleCompare} disabled={comparing || !selectedJob} style={{ ...btnStyle, opacity: comparing || !selectedJob ? 0.5 : 1 }}>
            {comparing ? "Comparing..." : "Compare"}
          </button>
        </div>

        {comparison && (() => {
          const { targets, summary } = comparison;
          const scoresA = targets.map(t => t.model_a.score || 0);
          const scoresB = targets.map(t => t.model_b.score || 0);
          const kdeA = gaussianKDE(scoresA, 0.06, 80);
          const kdeB = gaussianKDE(scoresB, 0.06, 80);
          const kdeOverlay = kdeA.map((p, i) => ({ x: p.x, a: p.density, b: kdeB[i]?.density || 0 }));
          return (
            <div>
              {/* Summary metrics */}
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "12px 16px" }}>
                  <div style={{ fontSize: "11px", color: RS.muted, fontWeight: 600, marginBottom: "4px" }}>KENDALL TAU</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: RS.text, fontFamily: FONT }}>{summary.kendall_tau?.toFixed(3) ?? "–"}</div>
                  <div style={{ fontSize: "10px", color: RS.muted, marginTop: "2px" }}>1.0 = identical ranking, 0 = unrelated</div>
                </div>
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "12px 16px" }}>
                  <div style={{ fontSize: "11px", color: RS.muted, fontWeight: 600, marginBottom: "4px" }}>MEAN SCORE DELTA</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: summary.mean_score_delta > 0 ? RS.positive : summary.mean_score_delta < 0 ? RS.negative : RS.text, fontFamily: FONT }}>
                    {summary.mean_score_delta > 0 ? "+" : ""}{summary.mean_score_delta?.toFixed(4) || "0"}
                  </div>
                  <div style={{ fontSize: "10px", color: RS.muted, marginTop: "2px" }}>Average score change (B - A)</div>
                </div>
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "12px 16px" }}>
                  <div style={{ fontSize: "11px", color: RS.muted, fontWeight: 600, marginBottom: "4px" }}>DIAGNOSTIC IMPACT</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: RS.text, lineHeight: 1.5 }}>
                    {summary.dropped.length === 0 && summary.gained.length === 0
                      ? `Both models: ${summary.above_threshold_a}/${summary.total_targets} above 0.4. No panel change.`
                      : <>
                          {summary.dropped.length > 0 && <div style={{ color: RS.negative }}>Dropped: {summary.dropped.join(", ")}</div>}
                          {summary.gained.length > 0 && <div style={{ color: RS.positive }}>Gained: {summary.gained.join(", ")}</div>}
                        </>
                    }
                  </div>
                </div>
              </div>

              {/* Comparison table */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", overflow: "hidden", marginBottom: "20px" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left" }}>Target</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Drug</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Strategy</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Score A</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Score B</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Delta</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Disc</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Rank A</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Rank B</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Rank Delta</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Thermo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((t, i) => {
                        const bigShift = Math.abs(t.rank_delta || 0) >= 3;
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${RS.border}`, fontWeight: bigShift ? 700 : 400 }}>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{t.label}</td>
                            <td style={{ ...tdStyle, color: RS.muted }}>{t.drug || "N/A"}</td>
                            <td style={{ ...tdStyle, color: RS.muted, fontSize: "11px" }}>{t.strategy || "N/A"}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{t.model_a.score?.toFixed(3) ?? "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{t.model_b.score?.toFixed(3) ?? "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: t.score_delta > 0 ? RS.positive : t.score_delta < 0 ? RS.negative : RS.muted }}>
                              {t.score_delta != null ? `${t.score_delta > 0 ? "+" : ""}${t.score_delta.toFixed(3)}` : "–"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center", color: RS.muted }}>{t.model_a.disc != null ? `${t.model_a.disc}x` : "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>#{t.model_a.rank ?? "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>#{t.model_b.rank ?? "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "center", color: t.rank_delta > 0 ? RS.positive : t.rank_delta < 0 ? RS.negative : RS.muted }}>
                              {t.rank_delta != null ? (t.rank_delta > 0 ? `▲${t.rank_delta}` : t.rank_delta < 0 ? `▼${Math.abs(t.rank_delta)}` : "–") : "N/A"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button onClick={() => handleThermo(t.label)} style={{ background: "none", border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "2px 8px", cursor: "pointer", fontSize: "10px", color: RS.accent, fontWeight: 600 }}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Score distribution KDE overlay */}
              {!mobile && (
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Score Distribution Comparison</div>
                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>Overlaid KDE curves showing how each model distributes scores across candidates.</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={kdeOverlay} margin={{ top: 5, right: 15, bottom: 20, left: 15 }}>
                      <defs>
                        <linearGradient id="kdeCompA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={RS.accent} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={RS.accent} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="kdeCompB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={RS.barrier} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={RS.barrier} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: RS.muted, fontFamily: MONO }} tickCount={11} axisLine={{ stroke: RS.border }} tickLine={false} />
                      <YAxis hide domain={[0, "auto"]} />
                      <Tooltip contentStyle={rTooltip} formatter={(v) => [v.toFixed(4), "Density"]} labelFormatter={(l) => `Score: ${l}`} />
                      <Area type="monotone" dataKey="a" stroke={RS.accent} strokeWidth={2} fill="url(#kdeCompA)" name={comparison.model_a} isAnimationActive={false} />
                      <Area type="monotone" dataKey="b" stroke={RS.barrier} strokeWidth={2} fill="url(#kdeCompB)" name={comparison.model_b} isAnimationActive={false} strokeDasharray="6 3" />
                      <Legend wrapperStyle={{ fontSize: "11px", fontFamily: MONO }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* ═══ Section 2: R-Loop Thermodynamic Explorer ═══ */}
      <CollapsibleSection title="R-Loop Thermodynamic Explorer" defaultOpen={false}>
        {/* Scientific background toggle */}
        <div style={{ marginBottom: "16px" }}>
          <button onClick={() => setSciBgOpen(!sciBgOpen)} style={{ background: "none", border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", color: RS.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            {sciBgOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Scientific Background
          </button>
          {sciBgOpen && (
            <div style={{ marginTop: "10px", padding: "16px 20px", background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", fontSize: "12px", color: RS.muted, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 10px 0" }}>R-loop formation is the rate-limiting step of CRISPR-Cas12a target recognition (Strohkendl et al., Molecular Cell 2018; 2024). The crRNA spacer hybridises to the target strand of dsDNA, displacing the non-target strand, in a sequential PAM-proximal to PAM-distal process. Each dinucleotide step contributes a free energy increment that depends on the base-pair identity (nearest-neighbor model).</p>
              <p style={{ margin: "0 0 10px 0" }}>Zhang et al. (Nucleic Acids Research 2024, DOI: 10.1093/nar/gkae1124) demonstrated a linear correlation between Cas12a trans-cleavage kinetics and the free energy change required to unwind the crRNA spacer and DNA target from their self-folded states to a hybridisation-competent conformation. This "unwinding cost" is the dominant predictor of trans-cleavage rate.</p>
              <p style={{ margin: "0 0 10px 0" }}>CRISPRzip (Offerhaus et al., bioRxiv 2025) formalises SpCas9 R-loop formation as movement through a sequence-dependent free-energy landscape, combining nearest-neighbor RNA:DNA hybrid energetics with protein-mediated contributions inferred from high-throughput kinetics. The nearest-neighbor energetics framework is adaptable to Cas12a, though the protein-mediated contributions and R-loop directionality differ between the two enzymes.</p>
              <p style={{ margin: "0 0 10px 0" }}>Aris et al. (Nature Communications 2025, DOI: 10.1038/s41467-025-57703-y) established a four-state kinetic model for Cas12a R-loop dynamics using single-molecule measurements, showing that R-loop formation is dynamic and reversible, with supercoiling-dependent interrogation.</p>
              <p style={{ margin: 0, fontSize: "11px", color: "#a3a3a3" }}>The profiles shown here use the Sugimoto et al. (1995) nearest-neighbor parameters for Watson-Crick RNA:DNA hybrid thermodynamics, Sugimoto et al. (2000) for RNA:DNA mismatch penalties, and the SantaLucia (1998) unified parameters for DNA:DNA duplex stability. These are approximations. The true free-energy landscape includes protein-mediated contributions, supercoiling effects, and PAM-proximal protein contacts that stabilise early R-loop intermediates beyond what nucleic acid thermodynamics alone predict.</p>
            </div>
          )}
        </div>

        {/* Target input; dual mode */}
        {!thermoData && !thermoLoading && (
          <div style={{ fontSize: "12px", color: RS.muted }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: "0", marginBottom: "12px" }}>
              {[{ key: "standalone", label: "Standalone (enter sequence)" }, { key: "panel", label: "Panel-linked (select target)" }].map(m => (
                <button key={m.key} onClick={() => setThermoMode(m.key)} style={{ background: thermoMode === m.key ? RS.accent : "transparent", color: thermoMode === m.key ? "#fff" : RS.muted, border: `1px solid ${thermoMode === m.key ? RS.accent : RS.border}`, padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", borderRadius: m.key === "standalone" ? "6px 0 0 6px" : "0 6px 6px 0" }}>{m.label}</button>
              ))}
            </div>

            {thermoMode === "standalone" ? (
              <div>
                <div style={{ marginBottom: "6px" }}>Enter a DNA spacer sequence (15–30 nt) to compute the R-loop free energy profile:</div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input value={thermoStandaloneSeq} onChange={(e) => setThermoStandaloneSeq(e.target.value.toUpperCase().replace(/[^ATCG]/g, ""))} placeholder="e.g. TCGGTCAACCCCGACAGC" style={{ ...selectStyle, flex: 1, maxWidth: "320px", fontFamily: MONO, letterSpacing: "0.04em" }} />
                  <button onClick={handleThermoStandalone} disabled={thermoStandaloneSeq.trim().length < 15} style={{ ...btnStyle, opacity: thermoStandaloneSeq.trim().length < 15 ? 0.5 : 1 }}>Compute</button>
                </div>
                <div style={{ fontSize: "10px", color: "#a3a3a3", marginTop: "4px" }}>Pre-filled: rpoB_S531L spacer (18 nt). No panel run needed.</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "6px" }}>Select a target from a completed panel run, or enter a target label:</div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input value={thermoTarget} onChange={(e) => setThermoTarget(e.target.value)} placeholder="e.g. rpoB_S531L" style={{ ...selectStyle, flex: 1, maxWidth: "240px" }} />
                  <button onClick={() => handleThermo(thermoTarget)} disabled={!thermoTarget || !selectedJob} style={{ ...btnStyle, opacity: !thermoTarget || !selectedJob ? 0.5 : 1 }}>Load</button>
                </div>
                {!selectedJob && <div style={{ fontSize: "10px", color: "#dc2626", marginTop: "4px" }}>No completed panel run selected. Switch to Standalone mode or run a panel first.</div>}
              </div>
            )}
          </div>
        )}
        {thermoLoading && <div style={{ fontSize: "12px", color: RS.muted }}>Computing thermodynamic profile...</div>}

        {thermoData && (() => {
          const mp = thermoData.mutant_profile;
          const wp = thermoData.wildtype_profile;
          const ppDg = thermoData.per_position_dg || [];
          const sc = thermoData.scalars || {};
          const eb = thermoData.energy_budget || {};
          const snpPos = thermoData.snp_position;

          // Build chart data for cumulative profile
          const cumData = (mp?.cumulative_dg || mp?.positions || []).map((val, i) => {
            const pos = mp?.positions ? mp.positions[i] : i + 1;
            const mutDg = mp?.cumulative_dg ? mp.cumulative_dg[i] : val;
            const wtDg = wp?.cumulative_dg ? wp.cumulative_dg[i] : null;
            return { pos, mutant: mutDg, wildtype: thermoShowWT ? wtDg : null };
          });

          // Per-position bar data
          const barData = ppDg.map((dg, i) => ({
            pos: i + 1,
            dg,
            isSeed: i + 1 <= 8,
            isSnp: i + 1 === snpPos,
          }));

          // Energy budget for horizontal bars
          const budgetItems = [
            { label: "crRNA spacer unfolding", value: eb.spacer_unfolding_cost || 0, color: RS.barrier, type: "cost" },
            { label: "dsDNA target unwinding", value: eb.target_unwinding_cost || 0, color: RS.negative, type: "cost" },
            { label: "R-loop hybrid formation", value: eb.hybrid_formation_dg || 0, color: RS.positive, type: "gain" },
          ];
          const netDg = eb.net_dg || 0;

          return (
            <div>
              {/* Header with target info and clear button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text }}>{thermoTarget}</div>
                  <div style={{ fontSize: "11px", color: RS.muted, fontFamily: MONO }}>{thermoData.crrna_spacer || thermoData.spacer_dna} | PAM: {thermoData.pam_seq}{snpPos ? ` | SNP pos: ${snpPos}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {wp && (
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: RS.muted, cursor: "pointer" }}>
                      <input type="checkbox" checked={thermoShowWT} onChange={(e) => setThermoShowWT(e.target.checked)} />
                      MUT vs WT
                    </label>
                  )}
                  <button onClick={() => { setThermoData(null); setThermoTarget(""); }} style={{ background: "none", border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "3px 10px", cursor: "pointer", fontSize: "11px", color: RS.muted }}>Clear</button>
                </div>
              </div>

              {/* Metrics row */}
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(3, 1fr)" : "repeat(7, 1fr)", gap: "8px", marginBottom: "20px" }}>
                {[
                  { label: "Hybrid dG", value: `${(eb.hybrid_formation_dg || 0).toFixed(2)} kcal/mol`, tip: "RNA:DNA hybrid formation energy (what the cumulative profile shows)" },
                  { label: "Net dG (nucleic acid)", value: `${(eb.net_dg || 0).toFixed(2)} kcal/mol`, tip: "hybrid + unwinding + unfolding; excludes protein stabilisation" },
                  { label: "Seed dG (1-8)", value: `${(sc.seed_dg || 0).toFixed(2)} kcal/mol`, tip: "Free energy of seed region hybridization" },
                  { label: "Tm (hybrid)", value: `${(sc.melting_tm || 0).toFixed(1)}\u00B0C`, tip: "Melting temperature of RNA:DNA hybrid" },
                  { label: "Unwinding cost", value: `+${((sc.target_unwinding || 0) + (sc.spacer_unfolding || 0)).toFixed(2)} kcal/mol`, tip: "Total cost: spacer unfolding + target unwinding" },
                  { label: "GC content", value: `${sc.gc_content || 0}%`, tip: "GC percentage of spacer" },
                  { label: "SNP barrier", value: sc.snp_barrier != null ? `+${Number(sc.snp_barrier).toFixed(2)} kcal/mol` : "N/A", tip: "Energy penalty at mismatch position (discrimination basis)" },
                ].map(m => (
                  <div key={m.label} style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "10px 12px" }} title={m.tip}>
                    <div style={{ fontSize: "9px", color: RS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: RS.text, fontFamily: FONT, marginTop: "2px" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart A: Cumulative R-Loop Free Energy Profile */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Cumulative R-Loop Free Energy Profile</div>
                <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
                  Cumulative dG along the R-loop from PAM-proximal (position 1) to PAM-distal. Steeper descent = stronger binding. Nearest-neighbor approximations (+-0.5 kcal/mol per step).
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={cumData} margin={{ top: 10, right: 20, bottom: 25, left: 20 }}>
                    <defs>
                      <linearGradient id="thermoMutFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={RS.mutLine} stopOpacity={0.05} />
                        <stop offset="100%" stopColor={RS.mutLine} stopOpacity={0.01} />
                      </linearGradient>
                      {/* Seed region highlight */}
                      <linearGradient id="seedHighlight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={RS.accent} stopOpacity={0.06} />
                        <stop offset="40%" stopColor={RS.accent} stopOpacity={0.06} />
                        <stop offset="40%" stopColor={RS.accent} stopOpacity={0} />
                        <stop offset="100%" stopColor={RS.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="pos" tick={{ fontSize: 11, fill: RS.muted, fontFamily: MONO }} axisLine={{ stroke: RS.border }} tickLine={false} label={{ value: "Position (PAM-proximal \u2192 PAM-distal)", position: "insideBottom", offset: -12, fontSize: 11, fill: RS.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: RS.muted, fontFamily: MONO }} axisLine={false} tickLine={false} label={{ value: "Cumulative dG (kcal/mol)", angle: -90, position: "insideLeft", offset: 5, fontSize: 11, fill: RS.muted }} />
                    <Tooltip contentStyle={rTooltip} formatter={(v, name) => [`${v?.toFixed(2)} kcal/mol`, name === "mutant" ? "Mutant" : "Wildtype"]} labelFormatter={(l) => `Position ${l}`} />
                    {snpPos && <ReferenceLine x={snpPos} stroke={RS.snpLine} strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `SNP (pos ${snpPos})`, position: "insideTopRight", fontSize: 10, fill: RS.snpLine, fontWeight: 600 }} />}
                    <ReferenceLine x={8.5} stroke={RS.accent} strokeDasharray="2 4" strokeWidth={0.5} strokeOpacity={0.4} />
                    <Area type="monotone" dataKey="mutant" stroke={RS.mutLine} strokeWidth={2} fill="url(#thermoMutFill)" name="mutant" isAnimationActive={false} dot={false} />
                    {thermoShowWT && wp && <Line type="monotone" dataKey="wildtype" stroke={RS.wtLine} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="wildtype" isAnimationActive={false} />}
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: "16px", marginTop: "6px", fontSize: "10px", color: RS.muted }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "16px", height: "2px", background: RS.mutLine }} />
                    <span>Mutant (perfect match)</span>
                  </div>
                  {wp && thermoShowWT && <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "16px", height: "2px", background: RS.wtLine, borderTop: "1px dashed" }} />
                    <span>Wildtype (mismatch at SNP)</span>
                  </div>}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "8px", height: "8px", background: RS.seedBg, border: `1px solid ${RS.accent}33`, borderRadius: "2px" }} />
                    <span>Seed region (1-8)</span>
                  </div>
                </div>
                {/* Discrimination annotation */}
                {wp && thermoShowWT && sc.snp_barrier != null && (
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: RS.seedBg, borderRadius: "4px", fontSize: "11px", color: RS.text, lineHeight: 1.6 }}>
                    <strong>Thermodynamic discrimination:</strong> The mismatch at position {snpPos} creates a +{Number(sc.snp_barrier).toFixed(2)} kcal/mol barrier in the wildtype R-loop.
                    {snpPos <= 4 ? " At this seed position, the barrier occurs early in R-loop propagation, likely causing complete R-loop collapse (Strohkendl et al., 2018)." : snpPos <= 8 ? " Within the seed region, this barrier significantly impedes R-loop extension." : " At this PAM-distal position, the barrier occurs after substantial R-loop formation and may be partially tolerated."}
                  </div>
                )}
              </div>

              {/* Chart B: Per-Position Energy Contribution */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Per-Position Energy Contribution</div>
                <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
                  dG contribution per dinucleotide step. GC-rich positions contribute more negative dG (taller bars downward). The mismatch position shows a positive bar (destabilising).
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                    <XAxis dataKey="pos" tick={{ fontSize: 11, fill: RS.muted, fontFamily: MONO }} axisLine={{ stroke: RS.border }} tickLine={false} label={{ value: "Position", position: "insideBottom", offset: -10, fontSize: 11, fill: RS.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: RS.muted, fontFamily: MONO }} axisLine={false} tickLine={false} label={{ value: "dG (kcal/mol)", angle: -90, position: "insideLeft", offset: 5, fontSize: 10, fill: RS.muted }} />
                    <Tooltip contentStyle={rTooltip} formatter={(v) => [`${v?.toFixed(2)} kcal/mol`, "dG step"]} labelFormatter={(l) => `Position ${l}`} />
                    <ReferenceLine y={0} stroke={RS.border} strokeWidth={1} />
                    <Bar dataKey="dg" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.isSnp ? RS.snpLine : entry.isSeed ? RS.accent : RS.muted} fillOpacity={entry.isSnp ? 0.9 : entry.isSeed ? 0.7 : 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart C: Unwinding Cost Decomposition */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Unwinding Cost Decomposition</div>
                <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
                  Energy budget following Zhang et al. (NAR 2024). Net dG correlates linearly with trans-cleavage rate.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {budgetItems.map(item => {
                    const maxAbs = Math.max(...budgetItems.map(b => Math.abs(b.value)), 1);
                    const pct = Math.min(Math.abs(item.value) / maxAbs * 100, 100);
                    return (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "180px", fontSize: "12px", color: RS.muted, textAlign: "right", flexShrink: 0 }}>{item.label}</div>
                        <div style={{ flex: 1, height: "24px", background: "#f5f5f5", borderRadius: "4px", position: "relative", overflow: "hidden" }}>
                          <div style={{
                            position: "absolute", top: 0, left: item.type === "gain" ? 0 : undefined, right: item.type === "cost" ? 0 : undefined,
                            width: `${pct}%`, height: "100%", background: item.color, opacity: 0.2, borderRadius: "4px",
                          }} />
                          <div style={{ position: "absolute", top: 0, left: item.type === "gain" ? 0 : undefined, right: item.type === "cost" ? 0 : undefined, width: `${pct}%`, height: "100%", display: "flex", alignItems: "center", justifyContent: item.type === "gain" ? "flex-end" : "flex-start", padding: "0 8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: FONT, color: item.color }}>{item.value > 0 ? "+" : ""}{item.value.toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{ width: "60px", fontSize: "10px", color: RS.muted, flexShrink: 0 }}>{item.type === "cost" ? "cost" : "gain"}</div>
                      </div>
                    );
                  })}
                  {/* Net line */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: `1px solid ${RS.border}`, paddingTop: "8px", marginTop: "4px" }}>
                    <div style={{ width: "180px", fontSize: "12px", fontWeight: 600, color: RS.text, textAlign: "right" }}>Net dG (nucleic acid)</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: FONT, color: netDg < 0 ? RS.positive : RS.negative }}>{netDg.toFixed(2)} kcal/mol</span>
                      <span style={{ fontSize: "11px", color: RS.muted, marginLeft: "8px" }}>{netDg < -15 ? "strongly favourable" : netDg < -5 ? "moderately favourable" : netDg < 0 ? "weakly favourable" : "unfavourable without protein"}</span>
                    </div>
                    <div style={{ width: "60px" }} />
                  </div>
                </div>
                {/* Protein stabilisation note */}
                {netDg >= 0 && (
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: RS.seedBg, borderRadius: "4px", fontSize: "11px", color: RS.text, lineHeight: 1.6 }}>
                    <strong>Note:</strong> The positive net dG indicates that nucleic acid thermodynamics alone do not favour R-loop formation at this target. Cas12a protein provides substantial additional stabilisation (estimated order of magnitude: 10+ kcal/mol) through PAM recognition, REC domain contacts, and conformational coupling (Strohkendl et al. 2018, 2024). The exact protein contribution for Cas12a has not been directly measured in free-energy units. The hybrid dG ({(eb.hybrid_formation_dg || 0).toFixed(2)} kcal/mol) remains the best available predictor of relative guide performance across candidates, as the protein contribution is approximately constant.
                  </div>
                )}
                {/* References */}
                <div style={{ marginTop: "12px", fontSize: "10px", color: "#a3a3a3" }}>
                  {(thermoData.references || []).join(" | ")}
                </div>
              </div>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* ═══ Section 3: Ablation Tracker ═══ */}
      <CollapsibleSection title="Ablation Tracker" defaultOpen={false}>
        {ablation.length === 0 ? (
          <div style={{ fontSize: "12px", color: RS.muted }}>No ablation data available.</div>
        ) : (() => {
          // Build scatter data; only rows with both kim and ed rho
          const scatterPts = ablation.filter(r => r.kim_rho != null && r.ed_rho != null);
          const allPts = ablation.map(r => ({ ...r, ed_rho: r.ed_rho ?? 0 }));
          const productionRow = ablation.find(r => r.notes && r.notes.toLowerCase().includes("production"));

          // Simple Pareto frontier (non-dominated points)
          const pareto = [];
          for (const p of scatterPts) {
            const dominated = scatterPts.some(q => q.kim_rho >= p.kim_rho && q.ed_rho >= p.ed_rho && (q.kim_rho > p.kim_rho || q.ed_rho > p.ed_rho));
            if (!dominated) pareto.push(p);
          }
          pareto.sort((a, b) => a.kim_rho - b.kim_rho);

          const DOT_COLORS = ["#2563eb", "#7c3aed", "#d97706", "#dc2626", "#16a34a", "#0891b2", "#e11d48"];

          return (
            <div>
              {/* Scatter plot */}
              {!mobile && scatterPts.length > 1 && (
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Cis vs Trans Cleavage Correlation</div>
                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
                    Each model plotted by Kim 2018 rho (cis-cleavage) vs EasyDesign rho (trans-cleavage). Top-right = best all-rounder. Star = production checkpoint.
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                      <XAxis type="number" dataKey="kim_rho" name="Kim rho" domain={[0.38, 0.55]} tick={{ fontSize: 11, fontFamily: MONO, fill: RS.muted }} axisLine={{ stroke: RS.border }} tickLine={false} label={{ value: "Kim rho (cis)", position: "insideBottom", offset: -16, fontSize: 11, fill: RS.muted }} />
                      <YAxis type="number" dataKey="ed_rho" name="ED rho" domain={[-0.05, 0.65]} tick={{ fontSize: 11, fontFamily: MONO, fill: RS.muted }} axisLine={false} tickLine={false} label={{ value: "ED rho (trans)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: RS.muted }} />
                      <Tooltip contentStyle={rTooltip} content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div style={{ ...rTooltip, padding: "10px 14px" }}>
                            <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "4px" }}>{d.label}</div>
                            <div>Kim rho: {d.kim_rho?.toFixed(3)}</div>
                            <div>ED rho: {d.ed_rho?.toFixed(3)}</div>
                            <div style={{ fontSize: "10px", color: "#a3a3a3", marginTop: "4px" }}>{d.notes}</div>
                          </div>
                        );
                      }} />
                      {/* Pareto frontier line */}
                      {pareto.length > 1 && (
                        <Line data={pareto} dataKey="ed_rho" stroke={RS.accent} strokeWidth={1} strokeDasharray="6 4" dot={false} isAnimationActive={false} type="monotone" />
                      )}
                      <Scatter data={scatterPts} isAnimationActive={false}>
                        {scatterPts.map((entry, i) => {
                          const isProd = productionRow && entry.label === productionRow.label;
                          return <Cell key={i} fill={DOT_COLORS[i % DOT_COLORS.length]} r={isProd ? 8 : 5} stroke={isProd ? RS.accent : "#fff"} strokeWidth={isProd ? 2.5 : 1.5} />;
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  {/* Labels for each point */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
                    {scatterPts.map((p, i) => {
                      const isProd = productionRow && p.label === productionRow.label;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <div style={{ width: isProd ? 10 : 8, height: isProd ? 10 : 8, borderRadius: "50%", background: DOT_COLORS[i % DOT_COLORS.length], border: isProd ? `2px solid ${RS.accent}` : "none" }} />
                          <span style={{ fontSize: "10px", color: RS.muted, fontWeight: isProd ? 700 : 400 }}>{p.label}{isProd ? " *" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Insight box */}
              <div style={{ padding: "12px 16px", background: RS.seedBg, borderRadius: "4px", fontSize: "12px", color: RS.text, lineHeight: 1.7, marginBottom: "16px" }}>
                <strong>Key finding:</strong> Models optimised for cis-cleavage gene editing (Kim 2018 benchmark) show near-zero predictive value for diagnostic trans-cleavage (rho = 0.04, COMPASS internal evaluation). The production checkpoint (multi-dataset, no domain adversarial) achieves rho = 0.55 on trans-cleavage while retaining rho = 0.49 on cis-cleavage; the best all-rounder across both benchmarks. Domain-adversarial training (Ganin et al., JMLR 2016) is counter-productive: forcing domain invariance destroys trans-cleavage-specific signal.
              </div>

              {/* Table */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left" }}>Model</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Features</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Kim rho</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>ED rho</th>
                        <th style={{ ...thStyle, textAlign: "left" }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ablation.map((row, i) => {
                        const isProd = row.notes && row.notes.toLowerCase().includes("production");
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${RS.border}`, background: isProd ? RS.seedBg : "transparent" }}>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                              {row.label}
                              {isProd && <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 600, color: RS.accent, background: `${RS.accent}15`, padding: "2px 6px", borderRadius: "3px", fontFamily: FONT }}>PRODUCTION</span>}
                            </td>
                            <td style={{ ...tdStyle, color: RS.muted, fontFamily: FONT, fontSize: "11px" }}>{row.features}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{row.kim_rho?.toFixed(3) ?? "–"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: row.ed_rho ? RS.text : "#d4d4d4" }}>{row.ed_rho?.toFixed(3) ?? "–"}</td>
                            <td style={{ ...tdStyle, color: RS.muted, fontFamily: FONT, fontSize: "11px" }}>{row.notes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* ═══ Section 4: Feature Importance Analysis ═══ */}
      <CollapsibleSection title="Feature Importance Analysis" defaultOpen={false}>
        <div style={{ fontSize: "12px", color: RS.muted, marginBottom: "16px", lineHeight: 1.6 }}>
          Approximate feature contributions to the scoring model. Position importance reflects seed-region weighting (positions 1-4 most critical for R-loop nucleation). The waterfall shows additive contributions from the heuristic scorer components.
        </div>

        {/* 4A: Position importance heatmap */}
        <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px", marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Position Importance</div>
          <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
            Learned importance weight per spacer position. Dark = high importance. Seed region (1-8) drives R-loop nucleation.
          </div>
          <div style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
            {POS_WEIGHTS.map((w, i) => {
              const h = Math.max(w * 50, 4);
              const opacity = 0.15 + w * 0.85;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }} title={`Position ${i + 1}: weight ${w.toFixed(2)}`}>
                  <div style={{ width: "100%", height: `${h}px`, background: RS.accent, opacity, borderRadius: "2px 2px 0 0", minWidth: "12px" }} />
                  <div style={{ fontSize: "9px", color: i < 8 ? RS.accent : RS.muted, fontFamily: MONO, marginTop: "3px", fontWeight: i < 4 ? 700 : 400 }}>{i + 1}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "10px", color: RS.muted }}>
            <span style={{ fontWeight: 600, color: RS.accent }}>Seed (1-8)</span>
            <span>Mid (9-14)</span>
            <span>PAM-distal (15-20)</span>
          </div>
        </div>

        {/* 4B: Feature contribution waterfall */}
        <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px 24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Heuristic Feature Breakdown</div>
          <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "14px" }}>
            Additive contribution of each heuristic scoring component. Weights represent relative importance in the composite score.
          </div>
          {(() => {
            // Use thermo data if available, otherwise show generic weights
            const baseScore = 0.50;
            const features = HEURISTIC_WEIGHTS.map(f => {
              let contrib = 0;
              if (thermoData && thermoData.scalars) {
                const sc = thermoData.scalars;
                if (f.key === "seed") contrib = sc.seed_dg ? Math.min(Math.abs(sc.seed_dg) / 30, 0.2) : 0.08;
                else if (f.key === "gc") contrib = sc.gc_content ? (sc.gc_content > 40 && sc.gc_content < 70 ? 0.06 : -0.02) : 0.04;
                else if (f.key === "ss") contrib = sc.spacer_unfolding ? -(sc.spacer_unfolding / 20) : -0.02;
                else if (f.key === "ot") contrib = 0.08;
                else if (f.key === "thermo") contrib = sc.net_dg ? Math.min(Math.abs(sc.net_dg) / 100, 0.1) : 0.03;
              } else {
                contrib = f.weight * 0.3 * (f.key === "ss" ? -1 : 1);
              }
              return { ...f, contrib: +contrib.toFixed(3) };
            });
            let running = baseScore;
            const waterfall = [{ name: "Base score", value: baseScore, running: baseScore, isBase: true }];
            for (const f of features) {
              running += f.contrib;
              waterfall.push({ name: f.name, value: f.contrib, running: +running.toFixed(3), isBase: false });
            }
            waterfall.push({ name: "Final score", value: running, running: +running.toFixed(3), isBase: true });

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {waterfall.map((item, i) => {
                  const maxVal = Math.max(...waterfall.map(w => Math.abs(w.value)));
                  const pct = Math.min(Math.abs(item.value) / 1.0 * 100, 100);
                  const isPositive = item.value >= 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "140px", fontSize: "12px", color: item.isBase ? RS.text : RS.muted, fontWeight: item.isBase ? 700 : 400, textAlign: "right", flexShrink: 0 }}>{item.name}</div>
                      <div style={{ flex: 1, height: "22px", position: "relative" }}>
                        {item.isBase ? (
                          <div style={{ position: "absolute", left: 0, top: 0, width: `${item.value * 100}%`, height: "100%", background: RS.accent, opacity: 0.15, borderRadius: "3px" }} />
                        ) : (
                          <div style={{
                            position: "absolute",
                            left: isPositive ? `${(item.running - item.value) * 100}%` : `${item.running * 100}%`,
                            top: 0,
                            width: `${Math.abs(item.value) * 100}%`,
                            height: "100%",
                            background: isPositive ? RS.positive : RS.negative,
                            opacity: 0.25,
                            borderRadius: "3px",
                          }} />
                        )}
                      </div>
                      <div style={{ width: "80px", fontSize: "12px", fontFamily: FONT, fontWeight: item.isBase ? 800 : 600, color: item.isBase ? RS.text : (isPositive ? RS.positive : RS.negative), textAlign: "right", flexShrink: 0 }}>
                        {item.isBase ? item.value.toFixed(3) : `${isPositive ? "+" : ""}${item.value.toFixed(3)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </CollapsibleSection>

      {/* ═══ Section 5: Platform Roadmap ═══ */}
      <CollapsibleSection title="Platform Roadmap" defaultOpen={false}>
        <p style={{ fontSize: "12px", color: RS.muted, marginBottom: "16px", lineHeight: 1.7 }}>
          Planned capabilities aligned with development milestones. Each module builds on experimental data collected during validation studies.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "14px" }}>
          {[
            {
              icon: <RefreshCw size={18} />,
              title: "Active Learning Loop",
              desc: "Feed experimental measurements back into Compass-ML. Fluorescence or electrochemical data recalibrates activity predictions, closing the gap between in silico and platform-specific signal.",
              milestone: "Phase 1; Experimental validation",
              ready: true,
            },
            {
              icon: <Zap size={18} />,
              title: "Electrochemical Transfer Function",
              desc: "Model the relationship between solution-phase trans-cleavage and surface-tethered MB reporter degradation on LIG electrodes.",
              milestone: "Phase 2; Electrode characterisation",
              ready: false,
            },
            {
              icon: <Grid3x3 size={18} />,
              title: "Spatial Multiplexing Optimiser",
              desc: "Assign targets to electrode pads on the spatially addressed array, minimising electrochemical crosstalk. Replaces solution-phase M8 when using in-situ complexation.",
              milestone: "Phase 2–3; Array fabrication",
              ready: false,
            },
            {
              icon: <FlaskConical size={18} />,
              title: "Nuclease Adaptation Engine",
              desc: "Swap Cas12a variants via transfer learning. Freeze sequence encoders, fine-tune RLPA attention and output heads on variant-specific data.",
              milestone: "Phase 3; Variant screening",
              ready: false,
            },
          ].map((card, i) => (
            <div key={i} style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ color: card.ready ? RS.positive : RS.muted }}>{card.icon}</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: RS.text, fontFamily: HEADING }}>{card.title}</div>
              </div>
              <p style={{ fontSize: "12px", color: RS.muted, lineHeight: 1.7, margin: "0 0 12px" }}>{card.desc}</p>
              <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "8px" }}>
                <strong>Milestone:</strong> {card.milestone}
              </div>
              <span style={{
                display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px",
                background: card.ready ? `${RS.positive}18` : `${RS.muted}18`,
                color: card.ready ? RS.positive : RS.muted,
              }}>
                {card.ready ? "Ready to start" : "Planned"}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══ Section 6: Nuclease Comparison ═══ */}
      <CollapsibleSection title="Nuclease Variant Comparison" defaultOpen={false}>
        <p style={{ fontSize: "12px", color: RS.muted, marginBottom: "16px", lineHeight: 1.7, maxWidth: "800px" }}>
          Compare Cas12a variants on the current 14-target MDR-TB panel. PAM coverage is computed by running COMPASS's M2 PAM scanner against the
          H37Rv genome with each variant's published PAM set. Scoring and discrimination columns show whether Compass-ML has been trained on data
          for that variant; "Retraining required" indicates the scoring model needs variant-specific experimental data before predictions are valid.
        </p>

        {/* Load coverage button */}
        {!nucleaseCoverage && (
          <button
            onClick={() => {
              setNucleaseLoading(true);
              getNucleaseComparison().then(({ data }) => {
                if (data) {
                  setNucleaseProfiles(Object.values(data.profiles));
                  setNucleaseCoverage(data.coverage);
                }
                setNucleaseLoading(false);
              });
            }}
            disabled={nucleaseLoading}
            style={{ ...btnStyle, marginBottom: "16px", opacity: nucleaseLoading ? 0.6 : 1 }}
          >
            {nucleaseLoading ? "Scanning PAMs..." : "Run PAM Coverage Comparison"}
          </button>
        )}

        {/* Profile summary table (always shown if profiles loaded) */}
        {nucleaseProfiles && (
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: 900 }}>
              <thead>
                <tr>
                  {["Variant", "Mutations", "PAM Set", "Targets", "PAM Deserts", "Scoring", "Disc."].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nucleaseProfiles.map(p => {
                  const cov = nucleaseCoverage?.[p.id];
                  const isExpanded = expandedVariant === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={() => setExpandedVariant(isExpanded ? null : p.id)}
                        style={{ cursor: "pointer", borderBottom: `1px solid ${RS.border}`, background: isExpanded ? RS.seedBg : "transparent" }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {p.display_name}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: "11px" }}>
                          {p.mutations ? p.mutations.join("/") : "\u2014"}
                        </td>
                        <td style={{ ...tdStyle, fontSize: "11px" }}>
                          {p.pam_canonical.join(", ")}
                          {p.pam_total_count > p.pam_canonical.length && (
                            <span style={{ color: RS.accent, marginLeft: "4px" }}>+{p.pam_total_count - p.pam_canonical.length}</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {cov && !cov.error ? (
                            <span style={{ fontWeight: 600, color: cov.targets_with_pam === cov.targets_total ? RS.positive : RS.barrier }}>
                              {cov.targets_with_pam}/{cov.targets_total}
                            </span>
                          ) : cov?.error ? (
                            <span style={{ color: RS.muted, fontSize: "10px" }}>{cov.error.split("; ")[0]}</span>
                          ) : (
                            <span style={{ color: RS.muted }}>–</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontSize: "10px" }}>
                          {cov && !cov.error ? (
                            cov.pam_desert_targets?.length > 0 ? (
                              <span style={{ color: RS.negative }}>{cov.pam_desert_targets.join(", ")}</span>
                            ) : (
                              <span style={{ color: RS.positive }}>None</span>
                            )
                          ) : "N/A"}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                            background: p.scoring_trained ? `${RS.positive}18` : `${RS.barrier}18`,
                            color: p.scoring_trained ? RS.positive : RS.barrier,
                          }}>
                            {p.scoring_trained ? "Trained" : "Retraining required"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                            background: p.scoring_trained ? `${RS.positive}18` : `${RS.barrier}18`,
                            color: p.scoring_trained ? RS.positive : RS.barrier,
                          }}>
                            {p.scoring_trained ? "Trained" : "Retraining required"}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded variant detail card */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{ padding: "16px 20px", background: RS.seedBg, borderBottom: `1px solid ${RS.border}` }}>
                              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
                                {/* Left: Profile details */}
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: 600, color: RS.text, marginBottom: "8px", fontFamily: HEADING }}>
                                    {p.display_name}
                                  </div>
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>Organism:</strong> {p.organism}
                                  </div>
                                  {p.mutations && (
                                    <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                      <strong>Mutations:</strong> {p.mutations.join(", ")}
                                    </div>
                                  )}
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>PAM:</strong> {p.pam_note}
                                  </div>
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>Seed:</strong> {p.seed_note}
                                  </div>
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>SNV discrimination:</strong> {p.snv_discrimination}
                                  </div>
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>Divalent cation:</strong> {p.divalent_cation}
                                  </div>
                                  <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                    <strong>Temperature:</strong> {p.optimal_temp}\u00b0C optimal
                                    {p.temperature?.active_range_C && ` (active ${p.temperature.active_range_C[0]}\u2013${p.temperature.active_range_C[1]}\u00b0C)`}
                                  </div>
                                  {p.kinetics?.note && (
                                    <div style={{ fontSize: "11px", color: RS.muted, marginBottom: "6px" }}>
                                      <strong>Kinetics:</strong> {p.kinetics.note}
                                    </div>
                                  )}
                                </div>

                                {/* Right: Seed region heatmap */}
                                <div>
                                  <div style={{ fontSize: "11px", fontWeight: 600, color: RS.muted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    Seed Region Profile (positions 1\u201320)
                                  </div>
                                  <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
                                    {Array.from({ length: 20 }, (_, i) => {
                                      const pos = i + 1;
                                      const isCritical = p.seed_positions.includes(pos);
                                      const isTolerant = p.tolerant_positions.includes(pos);
                                      const intensity = isCritical ? 1.0 : isTolerant ? 0.15 : 0.45;
                                      return (
                                        <div key={pos} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                          <div style={{
                                            width: "24px", height: "24px", borderRadius: "3px",
                                            background: `rgba(37, 99, 235, ${intensity})`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "9px", fontFamily: MONO, fontWeight: 600,
                                            color: intensity > 0.5 ? "#fff" : RS.text,
                                          }}>
                                            {pos}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "10px", color: RS.muted }}>
                                    <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: "rgba(37,99,235,1.0)", verticalAlign: "middle", marginRight: "4px" }} />Critical</span>
                                    <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: "rgba(37,99,235,0.45)", verticalAlign: "middle", marginRight: "4px" }} />Intermediate</span>
                                    <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: "rgba(37,99,235,0.15)", verticalAlign: "middle", marginRight: "4px" }} />Tolerant</span>
                                  </div>
                                </div>
                              </div>

                              {/* References */}
                              <div style={{ marginTop: "12px", borderTop: `1px solid ${RS.border}`, paddingTop: "10px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 600, color: RS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>References</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                  {p.references.map((ref, ri) => (
                                    <a
                                      key={ri}
                                      href={ref.doi ? `https://doi.org/${ref.doi}` : "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        fontSize: "10px", padding: "3px 8px", borderRadius: "4px",
                                        background: `${RS.accent}10`, color: RS.accent, textDecoration: "none",
                                        border: `1px solid ${RS.accent}30`,
                                      }}
                                      title={ref.data}
                                    >
                                      {ref.short} <ExternalLink size={8} style={{ verticalAlign: "middle" }} />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Per-target coverage detail (shown after comparison run) */}
        {nucleaseCoverage && (() => {
          const variants = Object.values(nucleaseCoverage).filter(v => !v.error && v.per_target);
          if (variants.length === 0) return null;
          const allTargets = variants[0].per_target.map(t => t.target);
          return (
            <div style={{ overflowX: "auto", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: RS.text, marginBottom: "8px", fontFamily: HEADING }}>Per-Target PAM Availability</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Target</th>
                    <th style={thStyle}>Drug</th>
                    {variants.map(v => <th key={v.variant_id} style={thStyle}>{v.display_name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allTargets.map((targetName, ti) => (
                    <tr key={targetName} style={{ borderBottom: `1px solid ${RS.border}` }}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontSize: "11px" }}>{targetName}</td>
                      <td style={{ ...tdStyle, fontSize: "10px" }}>{variants[0].per_target[ti]?.drug || ""}</td>
                      {variants.map(v => {
                        const t = v.per_target[ti];
                        return (
                          <td key={v.variant_id} style={tdStyle}>
                            {t ? (
                              <span style={{
                                fontWeight: 600,
                                color: t.n_direct > 0 ? RS.positive : t.n_total > 0 ? RS.barrier : RS.negative,
                              }}>
                                {t.n_direct > 0 ? `${t.n_direct} direct` : t.n_total > 0 ? "proximity" : "none"}
                              </span>
                            ) : "\u2014"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Scientific insight box */}
        <div style={{ background: `${RS.barrier}10`, border: `1px solid ${RS.barrier}30`, borderRadius: "4px", padding: "12px 16px", marginTop: "8px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertTriangle size={16} color={RS.barrier} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: RS.text, marginBottom: "4px" }}>Mg{"\u00b2\u207a"} Concentration Inverts Seed Specificity</div>
              <p style={{ fontSize: "11px", color: RS.muted, lineHeight: 1.7, margin: 0 }}>
                Nguyen et al. (2024, NAR 52:9343) showed that at low Mg{"\u00b2\u207a"} ({"\u2264"}1 mM), seed mismatches become more tolerated
                while PAM-distal mismatches become less tolerated, partially inverting the canonical specificity pattern.
                The standard 10 mM MgCl{"\u2082"} used in most published assays may not reflect diagnostic buffer conditions.
                Buffer Mg{"\u00b2\u207a"} optimisation is a critical experimental variable for achieving reliable SNV discrimination.
              </p>
              <a
                href="https://doi.org/10.1093/nar/gkae613"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "10px", color: RS.accent, textDecoration: "none", marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                DOI: 10.1093/nar/gkae613 <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </div>

        {/* CasDx1 note */}
        <div style={{ background: `${RS.muted}08`, border: `1px solid ${RS.border}`, borderRadius: "4px", padding: "12px 16px", marginTop: "10px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <Lock size={14} color={RS.muted} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: "11px", color: RS.muted, lineHeight: 1.7, margin: 0 }}>
              <strong>CasDx1</strong> (Mammoth Biosciences) showed superior SNV discrimination in SARS-CoV-2 detection
              (Fasching et al. 2022, J Clin Microbiol) but its PAM specificity and biochemical parameters are proprietary
              and cannot be configured. 97.3% SNP concordance on 261 clinical samples.
            </p>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

export { ResearchPage };
