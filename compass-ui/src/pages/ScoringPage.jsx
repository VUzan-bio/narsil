import React, { useState, useEffect, useRef } from "react";
import {
  BarChart3, Brain, ChevronDown, ChevronRight, Cpu, ExternalLink, Loader2, RefreshCw, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ReferenceLine,
} from "recharts";
import { T, FONT, HEADING, MONO } from "../tokens";
import { useIsMobile } from "../hooks/useIsMobile";
import { Badge, Btn, tooltipStyle } from "../components/ui/index.jsx";
import { SCORING_FEATURES } from "../mockData";
import { listScoringModels } from "../api";

const ScoringPage = ({ connected }) => {
  const mobile = useIsMobile();
  const [models, setModels] = useState([]);
  const [showApiRef, setShowApiRef] = useState(false);
  const [openBlocks, setOpenBlocks] = useState({ heuristic: true, narsilml: false, discrimination: false, bjepa: false });
  const scoringRefs = useRef({});

  const toggleBlock = (k) => setOpenBlocks(prev => {
    const willOpen = !prev[k];
    if (willOpen) {
      setTimeout(() => {
        scoringRefs.current[k]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
    return { ...prev, [k]: willOpen };
  });

  useEffect(() => {
    if (connected) {
      listScoringModels().then(({ data }) => { if (data) setModels(data); });
    }
  }, [connected]);

  /* Reusable collapsible block header */
  const ScoringBlock = ({ id, icon: Icon, title, badge, badgeVariant, dashed, dimmed, children }) => {
    const isOpen = openBlocks[id];
    return (
      <div ref={el => { scoringRefs.current[id] = el; }} style={{ background: T.bg, border: `1px ${dashed ? "dashed" : "solid"} ${T.border}`, borderRadius: "4px", marginBottom: "12px", overflow: "hidden", opacity: dimmed ? 0.85 : 1 }}>
        <button onClick={() => toggleBlock(id)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px",
          background: T.bgSub, border: "none", cursor: "pointer", fontFamily: FONT, textAlign: "left",
        }}>
          <div style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isOpen ? <ChevronDown size={14} color={T.textSec} /> : <ChevronRight size={14} color={T.textSec} />}
          </div>
          <Icon size={18} color={T.primary} />
          <span style={{ fontSize: "15px", fontWeight: 600, color: T.text, fontFamily: HEADING, flex: 1 }}>{title}</span>
          {badge && <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "3px", background: badgeVariant === "success" ? "#dcfce7" : T.primaryLight, color: badgeVariant === "success" ? "#059669" : T.primary, fontFamily: FONT }}>{badge}</span>}
          <span style={{ fontSize: "10px", color: T.textTer, flexShrink: 0 }}>{isOpen ? "collapse" : "expand"}</span>
        </button>
        {isOpen && <div style={{ padding: mobile ? "16px" : "20px 24px", borderTop: `1px solid ${T.border}` }}>{children}</div>}
      </div>
    );
  };

  return (
    <div style={{ padding: mobile ? "24px 16px" : "32px 40px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: T.primary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Models</div>
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: T.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>Scoring Models</h2>
        <p style={{ fontSize: "13px", color: T.textSec, marginTop: "4px" }}>Heuristic and ML-based candidate scoring</p>
      </div>

      {/* ── Heuristic Model ── */}
      <ScoringBlock id="heuristic" icon={Brain} title="Heuristic Model (Default)" badge="Active" badgeVariant="success">
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, marginBottom: "16px", marginTop: 0 }}>
          Position-weighted composite scoring across 5 biophysical features. This is the default scoring model used by the COMPASS pipeline.
        </p>

        <div style={{ background: T.bgSub, borderRadius: "4px", overflow: "hidden" }}>
          {SCORING_FEATURES.map((f, i) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < SCORING_FEATURES.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ width: 140, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${f.weight * 100}%`, height: "100%", background: T.primary, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.primary, width: 50, textAlign: "right" }}>{(f.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "16px", fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
          <strong>Formula:</strong> composite = {"\u03a3"}(feature_score {"\u00d7"} weight) where each feature_score {"\u2208"} [0, 1]
        </div>
      </ScoringBlock>

      {/* ── Compass-ML ── */}
      <ScoringBlock id="narsilml" icon={Cpu} title="Compass-ML" badge="Recommended" badgeVariant="success">
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, marginBottom: "16px", marginTop: 0 }}>
          Dual-branch neural network combining a target-DNA CNN with RNA Foundation Model (RNA-FM) embeddings for crRNA secondary structure.
          R-Loop Propagation Attention (RLPA) encodes the biophysics of Cas12a's directional R-loop formation into the architecture.
          Dual-branch CNN + RNA-FM with R-Loop Propagation Attention (RLPA) and 9-class PAM encoding. Trained on 15,000 cis-cleavage measurements from Kim et al. (2018) with flanking shuffle augmentation. Activity score serves as primary ranking; heuristic provides independent biophysical QC.
        </p>

        {/* Architecture branches */}
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Branch Ablation (Kim 2018 cross-library)</div>
        <div style={{ background: T.bgSub, borderRadius: "4px", overflow: "hidden", marginBottom: "20px" }}>
          {[
            { name: "CNN only (baseline)", rho: "0.740", delta: null },
            { name: "+ PAM encoding (9-class)", rho: "0.741", delta: "+0.2%" },
            { name: "+ RNA-FM embeddings", rho: "0.744", delta: "+0.5%" },
            { name: "+ RLPA attention", rho: "0.745", delta: "+0.7%" },
            { name: "Best single seed (production)", rho: "0.750", delta: "+1.3%" },
          ].map((f, i, arr) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: FONT, color: T.text, width: 55, textAlign: "right" }}>{f.rho}</span>
              {f.delta ? (
                <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: FONT, color: T.success, width: 55, textAlign: "right" }}>{f.delta}</span>
              ) : (
                <span style={{ width: 55, textAlign: "right", fontSize: "11px", color: T.textTer }}>baseline</span>
              )}
            </div>
          ))}
        </div>

        {/* Architecture details */}
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Architecture</div>
        <div style={{ background: T.bgSub, borderRadius: "4px", overflow: "hidden" }}>
          {[
            ["Architecture", "CNN (k=3,5,7) + RNA-FM (640\u219264) + RLPA + PAM (9-class)"],
            ["CNN input", "One-hot 34nt (PAM + spacer + context)"],
            ["RNA-FM input", "Pre-cached 640-dim embeddings (frozen, 23M sequences)"],
            ["PAM encoding", "9-class learned embedding (Kleinstiver 2019 enAsCas12a)"],
            ["Training data", "Kim 2018 HT1-1 (15K guides) + flanking shuffle augmentation"],
            ["Parameters", "235K (CNN ~65K, RNA-FM proj ~41K, RLPA ~35K, PAM ~1K, heads ~8K)"],
            ["Val \u03c1", "0.750 (best of 3 seeds, Kim 2018 HT1-2)"],
            ["Ablation", "CNN 0.740 \u2192 +PAM 0.741 \u2192 +RNA-FM 0.744 \u2192 +RLPA 0.745"],
            ["Augmentation", "Flanking shuffle (p=0.3) + label noise (\u03c3=0.02)"],
            ["Loss", "Huber + differentiable Spearman (annealed)"],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "12px" }}>
              <span style={{ color: T.textSec, fontWeight: 500 }}>{k}</span>
              <span style={{ fontWeight: 600, color: T.text, fontSize: "12px" }}>{v}</span>
            </div>
          ))}
        </div>
      </ScoringBlock>

      {/* ── Discrimination Prediction (moved above B-JEPA) ── */}
      <ScoringBlock id="discrimination" icon={TrendingUp} title="Discrimination Prediction" badge="Trained" badgeVariant="success">
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 16px" }}>
          Gradient-boosted model (XGBoost) trained on 6,136 paired MUT/WT trans-cleavage measurements from the EasyDesign dataset (Huang et al. 2024, LbCas12a).
          Predicts the discrimination ratio ({"\u0394"}log-k between perfect-match and single-mismatch targets) from 18 thermodynamic features encoding mismatch position, chemistry, R-loop energetics, and sequence context.
        </p>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Performance (3-fold stratified CV, guide-level split)</div>
        <div style={{ background: T.bgSub, borderRadius: "4px", overflow: "hidden", marginBottom: "16px" }}>
          {[
            { name: "Heuristic baseline", rmse: "0.641", corr: "0.298", delta: null },
            { name: "XGBoost 15 features (v1)", rmse: "0.540", corr: "0.459", delta: "\u221215% RMSE" },
            { name: "XGBoost 18 features (v2, production)", rmse: "0.520", corr: "0.565", delta: "\u221219% RMSE" },
          ].map((f, i, arr) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <span style={{ fontSize: "12px", fontFamily: FONT, color: T.textSec, width: 80, textAlign: "right" }}>RMSE {f.rmse}</span>
              <span style={{ fontSize: "12px", fontFamily: FONT, color: T.text, fontWeight: 600, width: 55, textAlign: "right" }}>r={f.corr}</span>
              {f.delta ? (
                <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: FONT, color: T.success, width: 75, textAlign: "right" }}>{f.delta}</span>
              ) : (
                <span style={{ width: 75, textAlign: "right", fontSize: "11px", color: T.textTer }}>baseline</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Top Features (by importance)</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Seed \u0394G", desc: "R-loop stability at seed" },
            { label: "Total hybrid \u0394G", desc: "Full RNA:DNA energy" },
            { label: "Cumulative \u0394G", desc: "Energy at mismatch pos" },
            { label: "Energy ratio", desc: "|cum. \u0394G| / \u0394\u0394G" },
            { label: "GC content", desc: "Spacer GC fraction" },
          ].map(f => (
            <div key={f.label} style={{ background: T.bgSub, borderRadius: "4px", padding: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: T.primary }}>{f.label}</div>
              <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: T.textTer, lineHeight: 1.6 }}>
          Training data: EasyDesign (Huang et al. 2024). Features: R-loop {"\u0394"}G profiles (Sugimoto 1995 NN params), mismatch {"\u0394\u0394"}G penalties (Sugimoto 2000), position sensitivity (Strohkendl 2018). Guide-level CV split prevents data leakage.
        </div>
      </ScoringBlock>

      {/* ── B-JEPA (teaser) ── */}
      <ScoringBlock id="bjepa" icon={Brain} title="B-JEPA" badge="In development" dashed dimmed>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 16px" }}>
          Self-supervised foundation model using Joint-Embedding Predictive Architecture with latent grounding; pretrained on 6,326 complete bacterial reference genomes (10M fragments {"\u00d7"} 2048bp).
          Dynamic JEPA{"\u2192"}MLM loss scheduling: JEPA shapes high-dimensional representation space (RankMe {">"}450), then masked language modeling drives token-level genomic feature learning.
          Per-dimension variance floor prevents representational collapse. Targets downstream Cas12a guide efficiency prediction and MDR-TB drug resistance classification.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
          {[
            { label: "Pretraining", value: "6,326 bacterial genomes (NCBI RefSeq)" },
            { label: "Fragments", value: "10M (2048bp window, 512bp stride)" },
            { label: "Architecture", value: "12L \u00d7 576D \u00d7 9H encoder, 6L \u00d7 384D predictor" },
            { label: "Parameters", value: "64.3M" },
            { label: "Training", value: "v7.0" },
            { label: "Target \u03c1", value: "> 0.60" },
          ].map(s => (
            <div key={s.label} style={{ background: T.bgSub, borderRadius: "4px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, fontFamily: FONT }}>{s.value}</div>
            </div>
          ))}
        </div>
      </ScoringBlock>

      {/* API models; hidden by default, developer-only */}
      {models.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <button onClick={() => setShowApiRef(!showApiRef)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: T.textTer, padding: "6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
            <ChevronDown size={14} style={{ transform: showApiRef ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
            API Reference ({models.length} models)
          </button>
          {showApiRef && (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "4px", padding: "24px", marginTop: "8px" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: T.text, fontFamily: HEADING, marginBottom: "12px" }}>Available Models from API</div>
              {models.map((m) => (
                <div key={m.id || m.name} style={{ padding: "12px", borderRadius: "4px", border: `1px solid ${T.borderLight}`, marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600, color: T.text }}>{m.name}</div>
                  {m.description && <div style={{ fontSize: "12px", color: T.textSec, marginTop: "4px" }}>{m.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export { ScoringPage };
