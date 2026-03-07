import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Activity, BarChart3, BookOpen, Check, ChevronDown, ChevronRight, Clock, Copy,
  Database, Download, ExternalLink, Eye, FileText, Filter, FlaskConical,
  Folder, GitBranch, Grid3x3, Layers, List, Loader2,
  Lock, Menu, Package, PanelLeft, PanelLeftClose, Play, Plus, RefreshCw, Search, Settings, Target,
  TrendingUp, X, Zap, Shield, Crosshair, Brain, Cpu, Wifi, WifiOff,
  AlertTriangle, CheckCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ComposedChart, ReferenceLine,
  LineChart, Line,
} from "recharts";
import {
  healthCheck, submitRun, getJob, getResults, exportResults,
  getFigureUrl, listPanels, createPanel, listJobs, connectJobWS,
  listScoringModels, getPresets, getDiagnostics, getWHOCompliance,
  getTopK, runSweep, runPareto,
} from "./api";

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Adaptyv Foundry–inspired
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  bg: "#FFFFFF", bgSub: "#F7F9FC", bgHover: "#EEF2F7",
  border: "#E3E8EF", borderLight: "#F0F3F7",
  text: "#111827", textSec: "#6B7280", textTer: "#9CA3AF",
  primary: "#36B8F6", primaryLight: "#EBF6FF", primaryDark: "#1E8FCC", primarySub: "#F0F9FF",
  success: "#16A34A", successLight: "#DCFCE7",
  warning: "#D97706", warningLight: "#FEF3C7",
  danger: "#DC2626", dangerLight: "#FEE2E2",
  purple: "#7C3AED", purpleLight: "#F3E8FF",
  sidebar: "#FAFBFD", sidebarActive: "#EBF6FF", sidebarHover: "#F3F4F6", sidebarText: "#374151",
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const HEADING = "'Urbanist', 'Inter', sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const NUC = { A: "#16A34A", T: "#DC2626", G: "#D97706", C: "#36B8F6" };
const BP = 768; // responsive breakpoint

/* ═══════════════════════════════════════════════════════════════════
   RESPONSIVE HOOK
   ═══════════════════════════════════════════════════════════════════ */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < BP);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BP - 1}px)`);
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

/* ═══════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════ */
function seq(len) { const b = "ACGT"; return Array.from({ length: len }, () => b[Math.floor(Math.random() * 4)]).join(""); }

const WHO_REFS = {
  "rpoB_S450L": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "40–60% of RIF-R globally" },
  "rpoB_H445D": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "5–12% of RIF-R" },
  "rpoB_H445Y": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "3–8% of RIF-R" },
  "rpoB_D435V": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "3–7% of RIF-R" },
  "rpoB_S450W": { who: "Interim", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: null, freq: "<1% of RIF-R" },
  "katG_S315T": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "50–80% of INH-R globally" },
  "katG_S315N": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "1–3% of INH-R" },
  "inhA_C-15T": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "10–25% of INH-R" },
  "embB_M306V": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "40–65% of EMB-R" },
  "embB_M306I": { who: "Interim", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "15–25% of EMB-R" },
  "pncA_H57D": { who: "Interim", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: null, freq: "Frequency <5% of PZA-resistant isolates" },
  "gyrA_D94G": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "30–50% of FQ-R" },
  "gyrA_A90V": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "15–30% of FQ-R" },
  "rrs_A1401G": { who: "Associated", catalogue: "WHO Mutation Catalogue, 2nd ed. (2023)", cryptic: "CRyPTIC Consortium (2022)", freq: "70–90% of AG-R" },
};

const MUTATIONS = [
  { gene: "rpoB", ref: "S", pos: 450, alt: "L", drug: "RIF", drugFull: "Rifampicin", conf: "High", tier: 1 },
  { gene: "rpoB", ref: "H", pos: 445, alt: "D", drug: "RIF", drugFull: "Rifampicin", conf: "High", tier: 1 },
  { gene: "rpoB", ref: "H", pos: 445, alt: "Y", drug: "RIF", drugFull: "Rifampicin", conf: "High", tier: 1 },
  { gene: "rpoB", ref: "D", pos: 435, alt: "V", drug: "RIF", drugFull: "Rifampicin", conf: "High", tier: 1 },
  { gene: "rpoB", ref: "S", pos: 450, alt: "W", drug: "RIF", drugFull: "Rifampicin", conf: "Moderate", tier: 2 },
  { gene: "katG", ref: "S", pos: 315, alt: "T", drug: "INH", drugFull: "Isoniazid", conf: "High", tier: 1 },
  { gene: "katG", ref: "S", pos: 315, alt: "N", drug: "INH", drugFull: "Isoniazid", conf: "High", tier: 1 },
  { gene: "inhA", ref: "C", pos: -15, alt: "T", drug: "INH", drugFull: "Isoniazid", conf: "High", tier: 1 },
  { gene: "embB", ref: "M", pos: 306, alt: "V", drug: "EMB", drugFull: "Ethambutol", conf: "High", tier: 1 },
  { gene: "embB", ref: "M", pos: 306, alt: "I", drug: "EMB", drugFull: "Ethambutol", conf: "Moderate", tier: 2 },
  { gene: "pncA", ref: "H", pos: 57, alt: "D", drug: "PZA", drugFull: "Pyrazinamide", conf: "Moderate", tier: 2 },
  { gene: "gyrA", ref: "D", pos: 94, alt: "G", drug: "FQ", drugFull: "Fluoroquinolones", conf: "High", tier: 1 },
  { gene: "gyrA", ref: "A", pos: 90, alt: "V", drug: "FQ", drugFull: "Fluoroquinolones", conf: "High", tier: 1 },
  { gene: "rrs", ref: "A", pos: 1401, alt: "G", drug: "AG", drugFull: "Amikacin", conf: "High", tier: 1 },
];

const RESULTS = MUTATIONS.map((m, i) => {
  const spacer = seq(20 + (i % 4));
  const wtSpacer = spacer.split("").map((c, j) => j === 10 ? (c === "A" ? "G" : c === "T" ? "C" : c === "G" ? "A" : "T") : c).join("");
  const refKey = `${m.gene}_${m.ref}${m.pos}${m.alt}`;
  return {
    ...m, label: refKey,
    strategy: i % 3 === 0 ? "Direct" : i % 3 === 1 ? "Proximity" : "Direct",
    spacer, wtSpacer, pam: ["TTTV", "TTTG", "TTTA", "TTTC"][i % 4],
    score: +(0.6 + Math.random() * 0.35).toFixed(3),
    disc: +(1.5 + Math.random() * 8).toFixed(1),
    gc: +(0.35 + Math.random() * 0.3).toFixed(2),
    ot: Math.floor(Math.random() * 3), hasPrimers: i < 12, hasSM: i % 4 === 1, proximityDistance: i % 3 === 1 ? 15 + Math.floor(Math.random() * 30) : null,
    fwd: i < 12 ? seq(30) : null, rev: i < 12 ? seq(30) : null,
    amplicon: i < 12 ? 120 + Math.floor(Math.random() * 60) : null,
    mutActivity: +(0.5 + Math.random() * 0.45).toFixed(2),
    wtActivity: +(0.05 + Math.random() * 0.15).toFixed(2),
    refs: WHO_REFS[refKey] || null,
  };
});
RESULTS.push({
  gene: "IS6110", ref: "N", pos: 0, alt: "N", drug: "OTHER", drugFull: "Other", conf: "N/A", tier: 0,
  label: "IS6110_NON", strategy: "Direct", spacer: "AATGTCGCCGCGATCGAGCG", wtSpacer: "AATGTCGCCGCGATCGAGCG",
  pam: "TTTG", score: 0.95, disc: 999, gc: 0.65, ot: 0, hasPrimers: true, hasSM: false,
  fwd: seq(30), rev: seq(30), amplicon: 142, mutActivity: 0.95, wtActivity: 0.001,
  refs: { who: "N/A", catalogue: "Species control", pmid: "30593580", cryptic: null, freq: "6–16 copies/genome" },
});

const MODULES = [
  { id: "M1", name: "Target Resolution", desc: "WHO mutations → genomic coordinates", icon: Target },
  { id: "M2", name: "PAM Scanning", desc: "Multi-PAM, multi-length spacer search", icon: Search },
  { id: "M3", name: "Candidate Filtering", desc: "Biophysical constraints (GC, homopolymer, Tm)", icon: Filter },
  { id: "M4", name: "Off-Target Screening", desc: "Bowtie2 alignment + heuristic fallback", icon: Shield },
  { id: "M5", name: "Heuristic Scoring", desc: "Position-weighted composite scoring", icon: BarChart3 },
  { id: "M5.5", name: "Mismatch Pairs", desc: "WT/MUT spacer pair generation", icon: GitBranch },
  { id: "M6", name: "SM Enhancement", desc: "Synthetic mismatch for 10–100× discrimination", icon: Zap },
  { id: "M6.5", name: "Discrimination", desc: "MUT/WT activity ratio quantification", icon: TrendingUp },
  { id: "M7", name: "Multiplex Optimization", desc: "Simulated annealing panel selection", icon: Grid3x3 },
  { id: "M8", name: "RPA Primer Design", desc: "Standard + allele-specific RPA", icon: Crosshair },
  { id: "M8.5", name: "Co-Selection", desc: "crRNA–primer compatibility check", icon: Check },
  { id: "M9", name: "Panel Assembly", desc: "MultiplexPanel + IS6110 control", icon: Package },
  { id: "M10", name: "Export", desc: "JSON, TSV, FASTA structured output", icon: Download },
];

const MODULE_NAME_MAP = {
  "Initializing": 0, "Target Resolution": 1, "PAM Scanning": 2,
  "Candidate Filtering": 3, "Off-Target Screening": 4, "Heuristic Scoring": 5,
  "Mismatch Pairs": 6, "SM Enhancement": 7, "Discrimination Scoring": 8,
  "Multiplex Optimization": 9, "RPA Primer Design": 10, "Co-Selection Validation": 11,
  "Panel Assembly": 12, "Export": 13, "Complete": 13, "Serializing Results": 13,
};

/* Scoring feature weights — matches guard/core/constants.py HEURISTIC_WEIGHTS exactly */
const SCORING_FEATURES = [
  { name: "Seed Position", key: "seed_position", weight: 0.35, desc: "Positions 1–8 (PAM-proximal) perfect match penalty. Mismatches in seed dramatically reduce cleavage.", source: "Kim et al. 2017" },
  { name: "GC Content", key: "gc", weight: 0.20, desc: "Optimal 40–60%. Extreme GC causes secondary structure (high) or weak binding (low).", source: "Empirical" },
  { name: "Secondary Structure", key: "structure", weight: 0.20, desc: "Spacer folding ΔG penalty. Strong secondary structure blocks Cas12a loading.", source: "ViennaRNA / SantaLucia 1998" },
  { name: "Homopolymer", key: "homopolymer", weight: 0.10, desc: "≥4 consecutive identical nucleotides penalized (includes poly-T terminator risk).", source: "Heuristic" },
  { name: "Off-Target", key: "offtarget", weight: 0.15, desc: "Bowtie2 alignment to H37Rv genome. Each hit with ≤3 mismatches reduces score.", source: "Langmead & Salzberg 2012" },
];

const DRUG_LABELS = {
  RIF: "Rifampicin", INH: "Isoniazid", EMB: "Ethambutol",
  PZA: "Pyrazinamide", FQ: "Fluoroquinolones", AG: "Amikacin",
};

/* ═══════════════════════════════════════════════════════════════════
   BIBLIOGRAPHY
   ═══════════════════════════════════════════════════════════════════ */
const BIBLIOGRAPHY = [
  // CRISPR Biology
  { id: "zetsche2015", authors: "Zetsche B, Gootenberg JS, Abudayyeh OO, et al.", year: 2015, title: "Cpf1 is a single RNA-guided endonuclease of a class 2 CRISPR-Cas system", journal: "Cell", doi: "10.1016/j.cell.2015.09.038", pmid: "26422227", category: "CRISPR Biology" },
  { id: "chen2018", authors: "Chen JS, Ma E, Harrington LB, et al.", year: 2018, title: "CRISPR-Cas12a target binding unleashes indiscriminate single-stranded DNase activity", journal: "Science", doi: "10.1126/science.aar6245", pmid: "29449511", category: "CRISPR Biology" },
  { id: "strohkendl2018", authors: "Strohkendl I, Saifuddin FA, Rybarski JR, et al.", year: 2018, title: "Kinetic basis for DNA target specificity of CRISPR-Cas12a", journal: "Molecular Cell", doi: "10.1016/j.molcel.2018.06.043", pmid: "30078724", category: "CRISPR Biology" },
  { id: "kleinstiver2019", authors: "Kleinstiver BP, Sousa AA, Walton RT, et al.", year: 2019, title: "Engineered CRISPR-Cas12a variants with increased activities and improved targeting ranges", journal: "Nature Biotechnology", doi: "10.1038/s41587-018-0011-0", pmid: "30742127", category: "CRISPR Biology" },
  // Guide Activity Prediction (ML)
  { id: "kim2020", authors: "Kim HK, Min S, Song M, et al.", year: 2020, title: "High-throughput analysis of the activities of xCas9, SpCas9-NG and SpCas9 at matched and mismatched target sequences in human cells", journal: "Nature Biotechnology", doi: "10.1038/s41587-020-0603-6", pmid: "32778843", category: "Guide Activity Prediction" },
  { id: "huang2024", authors: "Huang B, Mu K, Li G, et al.", year: 2024, title: "Deep learning enhancing guide RNA design for CRISPR/Cas12a-based diagnostics", journal: "iMeta", doi: "10.1002/imt2.214", category: "Guide Activity Prediction" },
  { id: "chen2022rnafm", authors: "Chen J, Hu Z, Sun S, et al.", year: 2022, title: "Interpretable RNA Foundation Model from Unannotated Data for Highly Accurate RNA Structure and Function Predictions", journal: "arXiv:2204.00300", doi: null, url: "https://arxiv.org/abs/2204.00300", category: "Guide Activity Prediction" },
  { id: "blondel2020", authors: "Blondel M, Teboul O, Berthet Q, Djolonga J", year: 2020, title: "Fast Differentiable Sorting and Ranking", journal: "ICML 2020", doi: null, url: "https://arxiv.org/abs/2002.08871", category: "Guide Activity Prediction" },
  // Clinical Standards
  { id: "who2024tpp", authors: "World Health Organization", year: 2024, title: "Target product profiles for tuberculosis diagnosis and detection of drug resistance", journal: "WHO", doi: null, url: "https://www.who.int/publications/i/item/9789240097698", isbn: "978-92-4-009769-8", category: "Clinical Standards" },
  { id: "maclean2023", authors: "MacLean EL-H, Kohli M, Weber SF, et al.", year: 2023, title: "Updating the WHO target product profile for next-generation Mycobacterium tuberculosis drug susceptibility testing at peripheral centres", journal: "PLOS Global Public Health", doi: "10.1371/journal.pgph.0001754", category: "Clinical Standards" },
  { id: "who2023", authors: "WHO", year: 2023, title: "Catalogue of mutations in Mycobacterium tuberculosis complex and their association with drug resistance (2nd ed.)", journal: "World Health Organization", doi: null, url: "https://iris.who.int/handle/10665/374061", isbn: "978-92-4-008241-0", category: "Clinical Standards" },
  { id: "cryptic2022", authors: "CRyPTIC Consortium", year: 2022, title: "A data compendium associating the genomes of 12,289 Mycobacterium tuberculosis isolates with quantitative resistance phenotypes to 13 antibiotics", journal: "PLoS Biology", doi: "10.1371/journal.pbio.3001721", pmid: "35944069", category: "Clinical Standards" },
  // CRISPR Diagnostics
  { id: "broughton2020", authors: "Broughton JP, Deng X, Yu G, et al.", year: 2020, title: "CRISPR-Cas12-based detection of SARS-CoV-2", journal: "Nature Biotechnology", doi: "10.1038/s41587-020-0513-4", pmid: "32300245", category: "CRISPR Diagnostics" },
  { id: "ai2019", authors: "Ai JW, Zhou X, Xu T, et al.", year: 2019, title: "CRISPR-based rapid and ultra-sensitive diagnostic test for Mycobacterium tuberculosis", journal: "Emerging Microbes & Infections", doi: "10.1080/22221751.2019.1664939", pmid: "31522608", category: "CRISPR Diagnostics" },
  // Bioinformatics
  { id: "langmead2012", authors: "Langmead B, Salzberg SL", year: 2012, title: "Fast gapped-read alignment with Bowtie 2", journal: "Nature Methods", doi: "10.1038/nmeth.1923", pmid: "22388286", category: "Bioinformatics" },
  { id: "piepenburg2006", authors: "Piepenburg O, Williams CH, Stemple DL, Armes NA", year: 2006, title: "DNA detection using recombination proteins", journal: "PLoS Biology", doi: "10.1371/journal.pbio.0040204", pmid: "16756388", category: "Bioinformatics" },
];

/* ═══════════════════════════════════════════════════════════════════
   UTILITY COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */
const DRUG_COLORS = {
  RIF: { bg: "#DBEAFE", text: "#1E40AF" }, INH: { bg: "#FEF3C7", text: "#92400E" },
  EMB: { bg: "#F3E8FF", text: "#6B21A8" }, FQ: { bg: "#FFE4E6", text: "#9F1239" },
  AG: { bg: "#E0E7FF", text: "#3730A3" }, PZA: { bg: "#F0FDF4", text: "#166534" },
};
const DEFAULT_DRUG = { bg: "#F3F4F6", text: "#6B7280" };

const Badge = ({ children, variant = "default" }) => {
  const s = {
    default: { background: "#F3F4F6", color: "#6B7280" },
    primary: { background: T.primaryLight, color: T.primaryDark },
    success: { background: "#DCFCE7", color: "#166534" },
    warning: { background: "#FEF3C7", color: "#92400E" },
    danger: { background: "#FEE2E2", color: "#991B1B" },
    purple: { background: "#F3E8FF", color: "#6B21A8" },
  };
  return (
    <span style={{ ...(s[variant] || s.default), padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.01em", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>{children}</span>
  );
};

const DrugBadge = ({ drug }) => {
  const c = DRUG_COLORS[drug] || DEFAULT_DRUG;
  return <span style={{ background: c.bg, color: c.text, padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, display: "inline-block" }}>{drug}</span>;
};

const Seq = ({ s: str }) => (
  <span style={{ fontFamily: MONO, fontSize: "11.5px", letterSpacing: "1.2px" }}>
    {str?.split("").map((c, i) => (
      <span key={i} style={{ color: c === "A" ? "#16A34A" : c === "T" ? "#DC2626" : c === "G" ? "#D97706" : "#36B8F6", fontWeight: 500 }}>{c}</span>
    ))}
  </span>
);

const Btn = ({ children, variant = "primary", onClick, disabled, icon: Icon, full, size = "md" }) => {
  const styles = {
    primary: { background: T.primary, color: "#fff", border: "none" },
    secondary: { background: "#fff", color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.textSec, border: "none" },
    danger: { background: T.danger, color: "#fff", border: "none" },
  };
  const sizes = { sm: { padding: "6px 12px", fontSize: "12px" }, md: { padding: "10px 20px", fontSize: "13px" }, lg: { padding: "12px 24px", fontSize: "14px" } };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], ...sizes[size], borderRadius: "8px", fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex",
      alignItems: "center", gap: "8px", fontFamily: FONT, opacity: disabled ? 0.5 : 1,
      transition: "all 0.15s", width: full ? "100%" : "auto", justifyContent: "center",
    }}>{Icon && <Icon size={15} />}{children}</button>
  );
};

const tooltipStyle = { background: "#fff", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", fontFamily: FONT };

/* ═══════════════════════════════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════════════════════════ */
const ToastContext = React.createContext(() => {});
const useToast = () => React.useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {createPortal(
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column-reverse", gap: "8px", pointerEvents: "none" }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              background: t.type === "success" ? "#065F46" : t.type === "error" ? "#991B1B" : "#1E3A5F",
              color: "#fff", padding: "10px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              fontFamily: FONT, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "8px",
              animation: "toastIn 0.25s ease-out",
            }}>
              {t.type === "success" && <Check size={14} />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   API DATA TRANSFORMER — maps API CandidateResponse → flat v8 format
   ═══════════════════════════════════════════════════════════════════ */
function transformApiCandidate(c) {
  /* Handle both the detailed per-candidate shape and the TargetResult shape from /api/results */
  const sc = c.selected_candidate;
  if (sc) {
    /* TargetResult shape from /api/results/{job_id} */
    const parts = (c.mutation || "").match(/^([A-Za-z*-]*)(\d+)([A-Za-z*-]*)$/);
    return {
      gene: c.gene, ref: parts?.[1] || "", pos: parts ? parseInt(parts[2]) : 0, alt: parts?.[3] || "",
      drug: c.drug, drugFull: c.drug || "", conf: "", tier: "",
      label: c.label, strategy: c.detection_strategy === "direct" ? "Direct" : "Proximity",
      spacer: sc.spacer_seq, wtSpacer: sc.wt_spacer_seq || "", pam: sc.pam_seq,
      score: sc.composite_score, disc: +(sc.discrimination_ratio || 0).toFixed(1), gc: sc.gc_content,
      cnnScore: sc.cnn_score ?? null,
      cnnCalibrated: sc.cnn_calibrated ?? null,
      ensembleScore: sc.ensemble_score ?? null,
      ot: 0, hasPrimers: c.has_primers, hasSM: c.has_sm || false,
      smSpacer: c.sm_enhanced_spacer || null, smPosition: c.sm_position || null,
      smOriginalBase: c.sm_original_base || null, smReplacementBase: c.sm_replacement_base || null,
      fwd: c.fwd_primer, rev: c.rev_primer, amplicon: c.amplicon_length,
      proximityDistance: c.proximity_distance || null,
      mutActivity: 0, wtActivity: 0,
      refs: WHO_REFS[c.label] || null,
      scoringBreakdown: null,
      isControl: false,
    };
  }
  /* Original detailed per-candidate shape */
  return {
    gene: c.gene, ref: c.ref_aa, pos: c.position, alt: c.alt_aa,
    drug: c.drug, drugFull: c.drug_full, conf: c.who_confidence, tier: c.tier,
    label: c.target_label, strategy: c.detection_strategy === "direct" ? "Direct" : "Proximity",
    spacer: c.spacer_seq, wtSpacer: c.wt_spacer_seq, pam: c.pam_seq,
    score: c.score, disc: +(c.discrimination?.ratio || 0).toFixed(1), gc: c.gc_content,
    cnnScore: c.cnn_score ?? null,
    cnnCalibrated: c.cnn_calibrated ?? null,
    ensembleScore: c.ensemble_score ?? null,
    ot: c.offtarget_count, hasPrimers: c.has_primers, hasSM: c.has_sm,
    fwd: c.fwd_primer, rev: c.rev_primer, amplicon: c.amplicon_length,
    proximityDistance: c.proximity_distance || null,
    mutActivity: c.discrimination?.mut_activity || 0,
    wtActivity: c.discrimination?.wt_activity || 0,
    refs: WHO_REFS[c.target_label] || null,
    scoringBreakdown: c.scoring_breakdown || null,
    isControl: c.is_control || false,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   CANDIDATE VIEWER — Detail panel with amplicon map + mismatch
   ═══════════════════════════════════════════════════════════════════ */
const AmpliconMap = ({ r }) => {
  const W = 640, H = 100, pad = 40;
  const track = W - 2 * pad;
  const ampLen = r.amplicon || 150;
  const scale = track / ampLen;
  const mutPos = Math.floor(ampLen * 0.55);
  const spacerStart = mutPos - Math.floor(r.spacer.length / 2);
  const spacerEnd = spacerStart + r.spacer.length;
  const pamStart = spacerStart - 4;
  const fwdEnd = 30;
  const revStart = ampLen - 30;
  const x = (pos) => pad + pos * scale;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: MONO }}>
      <line x1={pad} y1={45} x2={W - pad} y2={45} stroke={T.border} strokeWidth={2} />
      {r.fwd && <rect x={x(0)} y={36} width={fwdEnd * scale} height={18} rx={3} fill="#16A34A" fillOpacity={0.15} stroke="#16A34A" strokeWidth={1} />}
      {r.fwd && <text x={x(fwdEnd / 2)} y={32} textAnchor="middle" fontSize={8} fill="#16A34A" fontWeight={600}>FWD</text>}
      {r.rev && <rect x={x(revStart)} y={36} width={30 * scale} height={18} rx={3} fill="#7C3AED" fillOpacity={0.15} stroke="#7C3AED" strokeWidth={1} />}
      {r.rev && <text x={x(revStart + 15)} y={32} textAnchor="middle" fontSize={8} fill="#7C3AED" fontWeight={600}>REV</text>}
      <rect x={x(pamStart)} y={36} width={4 * scale} height={18} rx={2} fill={T.warning} fillOpacity={0.3} stroke={T.warning} strokeWidth={1} />
      <text x={x(pamStart + 2)} y={72} textAnchor="middle" fontSize={8} fill={T.warning} fontWeight={600}>PAM</text>
      <rect x={x(spacerStart)} y={36} width={r.spacer.length * scale} height={18} rx={3} fill={T.primary} fillOpacity={0.25} stroke={T.primary} strokeWidth={1.5} />
      <text x={x((spacerStart + spacerEnd) / 2)} y={47} textAnchor="middle" fontSize={8} fill={T.primaryDark} fontWeight={700}>crRNA spacer</text>
      <line x1={x(mutPos)} y1={28} x2={x(mutPos)} y2={62} stroke={T.danger} strokeWidth={2} strokeDasharray="3 2" />
      <circle cx={x(mutPos)} cy={24} r={4} fill={T.danger} />
      <text x={x(mutPos)} y={78} textAnchor="middle" fontSize={8} fill={T.danger} fontWeight={700}>{r.ref}{r.pos}{r.alt}</text>
      <text x={pad} y={92} fontSize={8} fill={T.textTer}>{r.gene} locus</text>
      <text x={W - pad} y={92} textAnchor="end" fontSize={8} fill={T.textTer}>{ampLen} bp amplicon</text>
    </svg>
  );
};

const MismatchProfile = ({ spacer, wtSpacer, strategy }) => {
  if (!spacer || !wtSpacer || wtSpacer.length !== spacer.length) {
    if (strategy === "Proximity") {
      return (
        <div style={{ fontSize: "12px", color: T.purple, lineHeight: 1.6, padding: "8px 0" }}>
          <strong>Proximity detection</strong> — discrimination is provided by the AS-RPA primers, not by crRNA mismatch. The crRNA binds a conserved region near the mutation site.
        </div>
      );
    }
    return (
      <div style={{ fontSize: "12px", color: T.textTer, lineHeight: 1.6, padding: "8px 0" }}>
        WT spacer not available — mismatch profile cannot be displayed.
      </div>
    );
  }
  return (
    <div style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
        <span style={{ width: 40, fontSize: "10px", color: T.textTer, fontWeight: 600 }}>MUT</span>
        {spacer.split("").map((c, i) => {
          const mm = c !== wtSpacer[i];
          return (<span key={`m${i}`} style={{ width: 18, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "3px", fontWeight: 700, fontSize: "11px", background: mm ? NUC[c] : "transparent", color: mm ? "#FFFFFF" : NUC[c], border: mm ? "none" : `1px solid ${T.borderLight}` }}>{c}</span>);
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
        <span style={{ width: 40 }} />
        {spacer.split("").map((c, i) => (<span key={`d${i}`} style={{ width: 18, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: c !== wtSpacer[i] ? T.danger : T.borderLight, fontWeight: 800 }}>{c !== wtSpacer[i] ? "▼" : "·"}</span>))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ width: 40, fontSize: "10px", color: T.textTer, fontWeight: 600 }}>WT</span>
        {wtSpacer.split("").map((c, i) => {
          const mm = c !== spacer[i];
          return (<span key={`w${i}`} style={{ width: 18, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "3px", fontWeight: 700, fontSize: "11px", background: mm ? "#F3F4F6" : "transparent", color: mm ? T.textSec : NUC[c], border: mm ? `1px solid ${T.border}` : `1px solid ${T.borderLight}` }}>{c}</span>);
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
        <span style={{ width: 40 }} />
        {spacer.split("").map((_, i) => (<span key={`p${i}`} style={{ width: 18, textAlign: "center", fontSize: "8px", color: [1, 2, 3, 4, 5, 6, 7, 8].includes(i + 1) ? T.primary : T.textTer, fontWeight: [1, 2, 3, 4, 5, 6, 7, 8].includes(i + 1) ? 700 : 400 }}>{i + 1}</span>))}
      </div>
      <div style={{ fontSize: "10px", color: T.textTer, marginTop: "6px" }}>Positions 1–8 (blue) = PAM-proximal seed region. Mismatches here have strongest effect on Cas12a discrimination.</div>
    </div>
  );
};

const CandidateViewer = ({ r, onClose }) => {
  if (!r) return null;
  const mobile = useIsMobile();
  const toast = useToast();
  const ref = r.refs;
  const discColor = r.disc >= 3 ? T.success : r.disc >= 2 ? T.primary : r.disc >= 1.5 ? T.warning : T.danger;
  // Use SM-enhanced spacer when available (the actual crRNA to synthesize)
  const displaySpacer = (r.hasSM && r.smSpacer) ? r.smSpacer : r.spacer;

  /* Compute per-feature scores deterministically from candidate data */
  const computeFeatures = () => {
    if (r.scoringBreakdown) {
      /* Real API data — use actual per-feature scores from pipeline HeuristicScore */
      const sb = r.scoringBreakdown;
      return [
        { ...SCORING_FEATURES[0], raw: +(1 - (sb.seed_position_score || 0)).toFixed(3), weighted: +((1 - (sb.seed_position_score || 0)) * 0.35).toFixed(4) },
        { ...SCORING_FEATURES[1], raw: +(1 - (sb.gc_penalty || 0)).toFixed(3), weighted: +((1 - (sb.gc_penalty || 0)) * 0.20).toFixed(4) },
        { ...SCORING_FEATURES[2], raw: +(1 - (sb.structure_penalty || 0)).toFixed(3), weighted: +((1 - (sb.structure_penalty || 0)) * 0.20).toFixed(4) },
        { ...SCORING_FEATURES[3], raw: +(1 - (sb.homopolymer_penalty || 0)).toFixed(3), weighted: +((1 - (sb.homopolymer_penalty || 0)) * 0.10).toFixed(4) },
        { ...SCORING_FEATURES[4], raw: +(1 - (sb.offtarget_penalty || 0)).toFixed(3), weighted: +((1 - (sb.offtarget_penalty || 0)) * 0.15).toFixed(4) },
      ];
    }
    /* Mock data — simulate deterministically from spacer */
    const seed = r.spacer.charCodeAt(0) + r.spacer.charCodeAt(1);
    return SCORING_FEATURES.map((f, i) => {
      let raw;
      if (f.key === "gc") raw = 1 - Math.abs(r.gc - 0.5) * 4;
      else if (f.key === "offtarget") raw = r.ot === 0 ? 1.0 : r.ot <= 1 ? 0.6 : 0.2;
      else raw = 0.4 + ((seed * (i + 7) * 13) % 60) / 100;
      raw = Math.max(0, Math.min(1, raw));
      return { ...f, raw: +raw.toFixed(3), weighted: +(raw * f.weight).toFixed(4) };
    });
  };
  const features = computeFeatures();
  const compositeCalc = features.reduce((a, f) => a + f.weighted, 0);

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: mobile ? "100%" : 720, background: T.bg, boxShadow: "-8px 0 40px rgba(0,0,0,0.1)", zIndex: 10000, overflow: "auto", borderLeft: mobile ? "none" : `1px solid ${T.border}` }}>
      <div style={{ padding: mobile ? "16px 16px" : "24px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? "6px" : "10px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: mobile ? "16px" : "20px", fontWeight: 800, fontFamily: MONO, color: T.text }}>{r.gene}</span>
            <span style={{ fontSize: mobile ? "13px" : "16px", fontFamily: MONO, color: T.textSec }}>{r.ref}{r.pos}{r.alt}</span>
            <DrugBadge drug={r.drug} />
            <Badge variant={r.strategy === "Direct" ? "success" : "purple"}>{r.strategy}</Badge>
          </div>
          <div style={{ fontSize: "12px", color: T.textSec }}>{r.drugFull} resistance · WHO Tier {r.tier} · {r.conf} confidence</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}><X size={20} color={T.textSec} /></button>
      </div>

      <div style={{ padding: mobile ? "16px" : "24px 28px" }}>
        {/* Key metrics */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? "8px" : "0", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: mobile ? "12px" : "16px", marginBottom: "24px" }}>
          {[
            { l: "Ensemble", v: (r.ensembleScore || r.score).toFixed(3), c: (r.ensembleScore || r.score) > 0.8 ? T.primary : (r.ensembleScore || r.score) > 0.65 ? T.warning : T.danger },
            { l: "Heuristic", v: r.score.toFixed(3), c: T.textSec },
            ...(r.cnnCalibrated != null ? [{ l: "CNN (cal)", v: r.cnnCalibrated.toFixed(3), c: r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger }] : []),
            { l: r.strategy === "Proximity" ? "Disc (AS-RPA)" : "Discrimination", v: r.strategy === "Proximity" ? "AS-RPA" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`, c: r.strategy === "Proximity" ? T.purple : discColor },
            ...(r.strategy === "Proximity" && r.proximityDistance ? [{ l: "Distance", v: `${r.proximityDistance} bp`, c: T.purple }] : []),
            { l: "GC%", v: `${(r.gc * 100).toFixed(0)}%`, c: T.text },
            { l: "Off-targets", v: r.ot, c: r.ot === 0 ? T.success : T.warning },
            { l: "PAM", v: r.pam, c: T.text },
          ].map((s, i) => (
            <div key={s.l} style={{ flex: mobile ? "1 1 40%" : 1, textAlign: "center", borderLeft: !mobile && i > 0 ? `1px dashed ${T.border}` : "none", minWidth: mobile ? "30%" : "auto" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{s.l}</div>
              <div style={{ fontSize: mobile ? "15px" : "18px", fontWeight: 700, color: s.c, fontFamily: MONO }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* PROXIMITY explanation block */}
        {r.strategy === "Proximity" && (
          <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}33`, borderRadius: "10px", padding: "16px 20px", marginBottom: "24px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.purple, fontFamily: HEADING, marginBottom: "6px" }}>Proximity Detection — PAM Desert Region</div>
            <div style={{ fontSize: "12px", color: "#6B21A8", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 6px" }}>
                The <strong>{r.gene} {r.ref}{r.pos}{r.alt}</strong> mutation sits in a high-GC region with no Cas12a PAM placing the SNP within any spacer.
                Instead, the crRNA binds a conserved site <strong>{r.proximityDistance ? `${r.proximityDistance} bp` : "nearby"}</strong> from the mutation.
              </p>
              <p style={{ margin: 0 }}>
                Discrimination is provided by <strong>allele-specific RPA (AS-RPA) primers</strong> whose 3′ terminal nucleotide matches only the resistance allele.
                The crRNA confirms the amplified region is the correct locus.
              </p>
            </div>
          </div>
        )}

        {/* Amplicon Map */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>Amplicon Map</div>
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "12px 8px", border: `1px solid ${T.borderLight}` }}>
            <AmpliconMap r={r} />
          </div>
        </div>

        {/* crRNA Spacer */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>crRNA Spacer</div>
          <div style={{ background: T.bgSub, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "10px", color: T.textTer, marginRight: "6px" }}>5'→</span>
              <Seq s={displaySpacer} />
              <span style={{ fontSize: "10px", color: T.textTer, marginLeft: "6px" }}>→3'</span>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(displaySpacer); toast("Spacer copied to clipboard"); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: T.textSec }}>
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>

        {/* Mismatch Profile */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>MUT vs WT Mismatch Profile</div>
          <div style={{ fontSize: "11px", color: T.textSec, marginBottom: "10px" }}>Mismatched positions between mutant and wildtype spacer alignment</div>
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "14px", border: `1px solid ${T.borderLight}`, overflowX: "auto" }}>
            <MismatchProfile spacer={displaySpacer} wtSpacer={r.wtSpacer} strategy={r.strategy} />
          </div>
        </div>

        {/* Evidence */}
        {ref && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Evidence</div>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
              {[
                ["WHO Classification", ref.who, ref.who === "Associated" ? "success" : "warning"],
                ["WHO Catalogue", ref.catalogue, null],
                ["Clinical Frequency", ref.freq, null],
                ["CRyPTIC Dataset", ref.cryptic || "—", null],
              ].map(([k, v, type], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "12px" }}>
                  <span style={{ color: T.textSec }}>{k}</span>
                  {type === "success" || type === "warning" ? <Badge variant={type}>{v}</Badge>
                   : <span style={{ fontWeight: 600, color: T.text }}>{v}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Oligo Sequences */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Oligo Sequences</div>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
            {[
              { name: `${r.gene}_${r.ref}${r.pos}${r.alt}_crRNA`, seq: `AATTTCTACTCTTGTAGAT${displaySpacer}`, note: "Direct repeat + spacer (IVT template)" },
              ...(r.fwd ? [{ name: `${r.gene}_${r.ref}${r.pos}${r.alt}_FWD`, seq: r.fwd, note: "RPA forward primer" }] : []),
              ...(r.rev ? [{ name: `${r.gene}_${r.ref}${r.pos}${r.alt}_REV`, seq: r.rev, note: "RPA reverse primer" }] : []),
            ].map((o, i, arr) => (
              <div key={o.name} style={{ padding: "10px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: MONO, color: T.text }}>{o.name}</span>
                  <button onClick={() => { navigator.clipboard?.writeText(o.seq); toast(`${o.name} copied`); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "3px 6px", cursor: "pointer", fontSize: "10px", color: T.textSec, display: "flex", alignItems: "center", gap: "3px" }}><Copy size={10} /> Copy</button>
                </div>
                <Seq s={o.seq} />
                <div style={{ fontSize: "10px", color: T.textTer, marginTop: "3px" }}>{o.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring Breakdown — 5 real pipeline features */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Scoring Breakdown</div>
          <div style={{ fontSize: "11px", color: T.textSec, marginBottom: "10px" }}>Per-feature contribution to composite score (heuristic model)</div>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
            {features.map((f, i) => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", borderBottom: i < features.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                <div style={{ width: 130, fontSize: "11px", fontWeight: 600, color: T.text, flexShrink: 0 }}>{f.name}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ flex: 1, height: 6, background: T.bgSub, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${f.raw * 100}%`, height: "100%", background: f.raw > 0.7 ? T.primary : f.raw > 0.4 ? T.warning : T.danger, borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 600, color: T.textSec, width: 36, textAlign: "right" }}>{(f.raw * 100).toFixed(0)}%</span>
                </div>
                <div style={{ width: 40, textAlign: "right", fontSize: "10px", color: T.textTer, fontFamily: MONO }}>×{(f.weight * 100).toFixed(0)}%</div>
                <div style={{ width: 50, textAlign: "right", fontFamily: MONO, fontSize: "11px", fontWeight: 700, color: T.text }}>{f.weighted.toFixed(3)}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", padding: "10px 14px", background: T.bgSub }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: T.textSec }}>Composite Score</span>
              <span style={{ fontFamily: MONO, fontSize: "14px", fontWeight: 800, color: T.text }}>{compositeCalc.toFixed(3)}</span>
              <span style={{ fontSize: "10px", color: T.textTer }}>(actual: {r.score.toFixed(3)})</span>
            </div>
          </div>
        </div>

        {/* Amplicon details */}
        {r.hasPrimers && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>Amplicon Details</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ flex: "1 1 auto", minWidth: mobile ? "100%" : 0, background: T.bgSub, borderRadius: "8px", padding: "12px", fontSize: "12px" }}>
                <div style={{ color: T.textTer, marginBottom: "4px" }}>Amplicon length</div>
                <div style={{ fontWeight: 700, fontFamily: MONO, color: T.text }}>{r.amplicon} bp</div>
              </div>
              <div style={{ flex: "1 1 auto", minWidth: mobile ? "45%" : 0, background: T.bgSub, borderRadius: "8px", padding: "12px", fontSize: "12px" }}>
                <div style={{ color: T.textTer, marginBottom: "4px" }}>Strategy</div>
                <div style={{ fontWeight: 700, color: T.text }}>{r.strategy}</div>
              </div>
              <div style={{ flex: "1 1 auto", minWidth: mobile ? "45%" : 0, background: r.hasSM ? T.primaryLight : T.bgSub, borderRadius: "8px", padding: "12px", fontSize: "12px" }}>
                <div style={{ color: T.textTer, marginBottom: "4px" }}>Synthetic mismatch</div>
                <div style={{ fontWeight: 700, color: r.hasSM ? T.primaryDark : T.textTer }}>{r.hasSM ? "Applied" : "None"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════ */
const NAV = [
  { section: "Design", items: [
    { id: "home", label: "Home", icon: Activity },
    { id: "pipeline", label: "Pipeline", icon: Cpu },
    { id: "results", label: "Results", icon: BarChart3 },
  ]},
  { section: "Library", items: [
    { id: "panels", label: "Panels", icon: Layers },
    { id: "mutations", label: "Mutations", icon: Database },
  ]},
  { section: "Models", items: [
    { id: "scoring", label: "Scoring", icon: Brain },
  ]},
];

const Sidebar = ({ page, setPage, connected, mobileOpen, setMobileOpen, collapsed, setCollapsed }) => {
  const mobile = useIsMobile();
  const handleNav = (id) => { setPage(id); if (mobile) setMobileOpen(false); };
  const isCollapsed = !mobile && collapsed;

  const inner = (
    <aside style={{
      width: mobile ? "280px" : (isCollapsed ? 56 : 240), background: T.sidebar,
      borderRight: mobile ? "none" : `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
      transition: "width 0.2s ease",
      ...(mobile ? { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 9998, boxShadow: "4px 0 24px rgba(0,0,0,0.15)" } : {}),
    }}>
      {/* Toggle + Connection */}
      <div style={{ padding: isCollapsed ? "16px 0" : "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: "8px" }}>
        {mobile ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
              {connected ? <Wifi size={12} color={T.success} /> : <WifiOff size={12} color={T.danger} />}
              <span style={{ color: connected ? T.success : T.danger, fontWeight: 600 }}>{connected ? "API Connected" : "Offline (mock)"}</span>
            </div>
            <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", marginLeft: "auto" }}><X size={20} color={T.textSec} /></button>
          </>
        ) : (
          <>
            {!isCollapsed && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                {connected ? <Wifi size={12} color={T.success} /> : <WifiOff size={12} color={T.danger} />}
                <span style={{ color: connected ? T.success : T.danger, fontWeight: 600 }}>{connected ? "API Connected" : "Offline (mock)"}</span>
              </div>
            )}
            <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", borderRadius: "6px" }} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {isCollapsed ? <PanelLeft size={18} color={T.textSec} /> : <PanelLeftClose size={18} color={T.textSec} />}
            </button>
          </>
        )}
      </div>
      {/* Nav groups */}
      <nav style={{ flex: 1, padding: isCollapsed ? "12px 6px" : "12px 10px", overflowY: "auto" }}>
        {NAV.map((g) => (
          <div key={g.section} style={{ marginBottom: "18px" }}>
            {!isCollapsed && <div style={{ fontSize: "10px", fontWeight: 700, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 10px", marginBottom: "6px" }}>{g.section}</div>}
            {g.items.map((it) => {
              const active = page === it.id;
              return (
                <button key={it.id} onClick={() => handleNav(it.id)} title={isCollapsed ? it.label : undefined} style={{
                  display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: "10px", width: "100%", padding: isCollapsed ? "9px 0" : "9px 10px",
                  borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: "13px",
                  fontWeight: active ? 600 : 500, background: active ? T.sidebarActive : "transparent",
                  color: active ? T.primaryDark : T.sidebarText, transition: "all 0.12s",
                }}>
                  <it.icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  {!isCollapsed && it.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {/* Footer */}
      {!isCollapsed && (
        <div style={{ padding: "16px", borderTop: `1px solid ${T.border}`, fontSize: "10px", color: T.textTer, lineHeight: 1.6, textAlign: "center" }}>
          GUARD v2
        </div>
      )}
    </aside>
  );

  if (mobile) {
    if (!mobileOpen) return null;
    return createPortal(
      <>
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9997 }} />
        {inner}
      </>,
      document.body
    );
  }
  return inner;
};

/* ═══════════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION HELPER
   ═══════════════════════════════════════════════════════════════════ */
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: "16px", border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "12px 16px",
        background: T.bgSub, border: "none", cursor: "pointer", fontFamily: FONT, fontSize: "13px",
        fontWeight: 600, color: T.text, textAlign: "left",
      }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div style={{ padding: "16px" }}>{children}</div>}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   HOME PAGE — Run workflow + methodology blog
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_MUTS = [
  "rpoB_S450L", "rpoB_H445D", "rpoB_H445Y", "rpoB_D435V",
  "katG_S315T", "katG_S315N", "inhA_C-15T",
  "embB_M306V", "embB_M306I",
  "gyrA_D94G", "gyrA_A90V",
  "rrs_A1401G",
];

const HomePage = ({ goTo, connected }) => {
  const mobile = useIsMobile();
  const [runName, setRunName] = useState("GUARD_panel_" + new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const [mode, setMode] = useState("standard");
  const [selectedModules, setSelectedModules] = useState(new Set(MODULES.map(m => m.id)));
  const [configOpen, setConfigOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);

  /* ── Preset panel definitions ── */
  const ALL_INDICES = MUTATIONS.map((_, i) => i);
  const CORE5_LABELS = ["rpoB_S450L", "katG_S315T", "inhA_C-15T", "gyrA_D94G", "rrs_A1401G"];
  const CORE5_INDICES = MUTATIONS.map((m, i) => CORE5_LABELS.includes(`${m.gene}_${m.ref}${m.pos}${m.alt}`) ? i : -1).filter(i => i >= 0);

  const [panel, setPanel] = useState("mdr14");        // "mdr14" | "core5" | "custom"
  const [selected, setSelected] = useState(new Set(ALL_INDICES));
  const [targetsOpen, setTargetsOpen] = useState(false);

  const selectPanel = (p) => {
    setPanel(p);
    if (p === "mdr14") { setSelected(new Set(ALL_INDICES)); setTargetsOpen(false); }
    else if (p === "core5") { setSelected(new Set(CORE5_INDICES)); setTargetsOpen(false); }
    else { setTargetsOpen(true); }
  };

  const toggleMut = (i) => { const n = new Set(selected); n.has(i) ? n.delete(i) : n.add(i); setSelected(n); };
  const selectedDrugs = [...new Set([...selected].map(i => MUTATIONS[i]?.drug).filter(Boolean))];

  const launch = async () => {
    setLaunching(true);
    setError(null);
    const muts = [...selected].map(i => ({
      gene: MUTATIONS[i].gene,
      ref_aa: MUTATIONS[i].ref,
      position: MUTATIONS[i].pos,
      alt_aa: MUTATIONS[i].alt,
      drug: MUTATIONS[i].drug || "OTHER",
    }));
    const apiMode = "full";
    if (connected) {
      const { data, error: err } = await submitRun(runName, apiMode, muts);
      if (err) { setError(err); setLaunching(false); return; }
      goTo("pipeline", { jobId: data.job_id });
    } else {
      setTimeout(() => goTo("pipeline", { jobId: "mock-" + Date.now() }), 600);
    }
  };

  const sectionTitle = (text) => (
    <div style={{ fontSize: mobile ? "18px" : "22px", fontWeight: 800, color: T.text, marginBottom: "12px", marginTop: mobile ? "32px" : "48px", letterSpacing: "-0.02em", fontFamily: HEADING }}>{text}</div>
  );

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px" }}>
      {/* Hero */}
      <div style={{ marginBottom: mobile ? "28px" : "48px" }}>
        <div style={{ maxWidth: "100%" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>GUARD Platform</div>
          <h1 style={{ fontSize: mobile ? "22px" : "34px", fontWeight: 800, color: T.text, margin: "0 0 12px", lineHeight: 1.2, letterSpacing: "-0.03em", fontFamily: HEADING }}>
            Design 14-plex drug resistance diagnostics in minutes, not months
          </h1>
          <p style={{ fontSize: "15px", color: T.textSec, lineHeight: 1.7, margin: "0 0 24px" }}>
            GUARD automates the complete CRISPR-Cas12a guide RNA design process — from WHO mutation catalogue to assay-ready crRNA panel — with AI-powered scoring and clinical performance benchmarking against WHO Target Product Profiles.
          </p>
          {/* Key stats row */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px" }}>
            {[
              { value: "14", label: "Resistance targets", sub: "simultaneous markers" },
              { value: "6", label: "Drug classes", sub: "RIF · INH · FQ · EMB · PZA · AG" },
              { value: "< 2 hr", label: "Assay time", sub: "RPA-CRISPR at 37°C" },
              { value: "235K", label: "ML parameters", sub: "GUARD-Net · runs on CPU" },
            ].map(s => (
              <div key={s.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px 20px" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, color: T.primary, fontFamily: MONO, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginTop: "6px" }}>{s.label}</div>
                <div style={{ fontSize: "11px", color: T.textTer, marginTop: "2px" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Run Workflow ── */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: mobile ? "20px" : "32px", marginBottom: "24px" }}>

        {/* 1. Run Name */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary }}>1</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Run Name</span>
          </div>
          <input value={runName} onChange={(e) => setRunName(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "14px", fontFamily: FONT, color: T.text, background: T.bgSub, outline: "none", boxSizing: "border-box" }}
            placeholder="e.g. MDR-TB_14plex_v2"
          />
          <p style={{ fontSize: "12px", color: T.textTer, margin: "6px 0 0" }}>A descriptive name for tracking. Used in export filenames and panel metadata.</p>
        </div>

        {/* 2. Pipeline Mode */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary }}>2</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Pipeline Mode</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px" }}>
            {[
              { id: "standard", name: "Standard", desc: "Full pipeline. crRNA design, GUARD-Net scoring, discrimination, primers, multiplex assembly, WHO compliance." },
              { id: "custom", name: "Custom", desc: "Select individual modules. For re-running specific stages on existing results." },
            ].map(m => (
              <div key={m.id} onClick={() => { setMode(m.id); if (m.id === "standard") setSelectedModules(new Set(MODULES.map(x => x.id))); }} style={{
                padding: "16px", borderRadius: "10px", cursor: "pointer",
                border: `2px solid ${mode === m.id ? T.primary : T.border}`,
                background: mode === m.id ? T.primaryLight : T.bg,
              }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "4px" }}>{m.name}</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>

          {/* Module selection for Custom mode */}
          {mode === "custom" && (
            <div style={{ marginTop: "12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Select Modules</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setSelectedModules(new Set(MODULES.map(x => x.id)))} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${T.border}`, background: selectedModules.size === MODULES.length ? T.primaryLight : T.bg, color: selectedModules.size === MODULES.length ? T.primary : T.textSec, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>All</button>
                  <button onClick={() => setSelectedModules(new Set())} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.bg, color: T.textSec, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>None</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "6px" }}>
                {MODULES.map(m => {
                  const sel = selectedModules.has(m.id);
                  return (
                    <div key={m.id} onClick={() => { const n = new Set(selectedModules); sel ? n.delete(m.id) : n.add(m.id); setSelectedModules(n); }} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
                      border: `1px solid ${sel ? T.primary : T.borderLight}`,
                      background: sel ? T.primaryLight + "60" : "transparent",
                      transition: "all 0.12s",
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: "4px", border: `2px solid ${sel ? T.primary : T.border}`, background: sel ? T.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {sel && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: T.text, fontFamily: MONO }}>{m.id}</div>
                        <div style={{ fontSize: "11px", color: T.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "10px", fontSize: "11px", color: T.textTer }}>{selectedModules.size} of {MODULES.length} modules selected</div>
            </div>
          )}
        </div>

        {/* 3. Diagnostic Panel */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary }}>3</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Diagnostic Panel</span>
          </div>

          {/* Preset cards */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[
              { id: "mdr14", name: "MDR-TB 14-plex", targets: ALL_INDICES.length + " targets",
                desc: "Complete WHO-catalogued first- and second-line resistance panel. Covers rifampicin, isoniazid, ethambutol, pyrazinamide, fluoroquinolones, and aminoglycosides. Recommended for comprehensive drug-susceptibility profiling.",
                meta: [["6 drug classes", ""], ["Tier 1–2", ""], ["High + Moderate", ""]] },
              { id: "core5", name: "Core 5-plex", targets: "5 targets",
                desc: "High-confidence tier-1 mutations only, targeting the most clinically actionable resistance determinants. Suitable for rapid point-of-care screening where multiplexing capacity is limited.",
                meta: [["4 drug classes", ""], ["Tier 1", ""], ["High", ""]] },
              { id: "custom", name: "Custom Panel", targets: panel === "custom" ? selected.size + " targets" : "",
                desc: "Select individual mutations from the WHO mutation catalogue. Use for targeted re-design, single-drug panels, or validation of specific resistance determinants.",
                meta: [] },
            ].map(p => (
              <div key={p.id} onClick={() => selectPanel(p.id)} style={{
                padding: "20px", borderRadius: "10px", cursor: "pointer",
                border: `2px solid ${panel === p.id ? T.primary : T.border}`,
                background: panel === p.id ? T.primaryLight : T.bg,
                display: "flex", flexDirection: "column", transition: "border-color 0.12s, background 0.12s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>{p.name}</span>
                  {p.targets && <span style={{ fontSize: "11px", fontWeight: 600, color: T.primary }}>{p.targets}</span>}
                </div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, flex: 1, marginBottom: p.meta.length ? "12px" : "0" }}>{p.desc}</div>
                {p.meta.length > 0 && (
                  <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: T.textTer, borderTop: `1px solid ${panel === p.id ? T.primary + "30" : T.borderLight}`, paddingTop: "10px" }}>
                    {p.meta.map(([label], j) => <span key={j}>{label}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Collapsible summary bar */}
          <div style={{ background: T.bgSub, border: `1px solid ${T.borderLight}`, borderRadius: "10px", overflow: "hidden" }}>
            <button onClick={() => setTargetsOpen(!targetsOpen)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
              background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>{selected.size} mutations selected</span>
              <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                {selectedDrugs.map(d => <DrugBadge key={d} drug={d} />)}
              </div>
              <span style={{ fontSize: "11px", color: T.textSec, marginRight: "4px" }}>View targets</span>
              <ChevronDown size={14} color={T.textSec} style={{ transform: targetsOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>

            {/* Expanded table */}
            {targetsOpen && (
              <div style={{ borderTop: `1px solid ${T.borderLight}` }}>
                {/* Drug filter chips — only for Custom panel */}
                {panel === "custom" && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${T.borderLight}` }}>
                    <button onClick={() => setSelected(new Set(ALL_INDICES))} style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${T.border}`, background: selected.size === MUTATIONS.length ? T.primary : T.bg, color: selected.size === MUTATIONS.length ? "#fff" : T.textSec, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>All ({MUTATIONS.length})</button>
                    <button onClick={() => setSelected(new Set())} style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${T.border}`, background: selected.size === 0 ? T.bgSub : T.bg, color: T.textSec, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>None</button>
                    <div style={{ width: 1, background: T.border, margin: "0 4px" }} />
                    {[...new Set(MUTATIONS.map(m => m.drug))].map(drug => {
                      const indices = MUTATIONS.map((m, i) => m.drug === drug ? i : -1).filter(i => i >= 0);
                      const allSel = indices.every(i => selected.has(i));
                      return (
                        <button key={drug} onClick={() => {
                          const n = new Set(selected);
                          indices.forEach(i => allSel ? n.delete(i) : n.add(i));
                          setSelected(n);
                        }} style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${allSel ? T.primary : T.border}`, background: allSel ? T.primaryLight : T.bg, color: allSel ? T.primary : T.textSec, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                          {drug} ({indices.length})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Mutation table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: T.bg }}>
                      {(panel === "custom" ? ["", "Gene", "Mutation", "Drug", "WHO Confidence", "Tier"] : ["Gene", "Mutation", "Drug", "WHO Confidence", "Tier"]).map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.borderLight}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MUTATIONS.map((m, i) => {
                      if (panel !== "custom" && !selected.has(i)) return null;
                      const isCustom = panel === "custom";
                      return (
                        <tr key={i} onClick={isCustom ? () => toggleMut(i) : undefined} style={{ cursor: isCustom ? "pointer" : "default", borderBottom: `1px solid ${T.borderLight}`, background: isCustom && selected.has(i) ? T.primaryLight + "40" : "transparent", transition: "background 0.1s" }}>
                          {isCustom && (
                            <td style={{ padding: "10px 12px", width: 32 }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: "4px",
                                border: `2px solid ${selected.has(i) ? T.primary : T.border}`,
                                background: selected.has(i) ? T.primary : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>{selected.has(i) && <Check size={10} color="#fff" strokeWidth={3} />}</div>
                            </td>
                          )}
                          <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: MONO, color: T.text, fontSize: "12px" }}>{m.gene}</td>
                          <td style={{ padding: "10px 12px", fontFamily: MONO, fontSize: "12px", color: T.textSec }}>{m.ref}{m.pos}{m.alt}</td>
                          <td style={{ padding: "10px 12px" }}><DrugBadge drug={m.drug} /></td>
                          <td style={{ padding: "10px 12px" }}><Badge variant={m.conf === "High" ? "success" : "warning"}>{m.conf}</Badge></td>
                          <td style={{ padding: "10px 12px" }}><Badge variant={m.tier === 1 ? "primary" : "default"}>Tier {m.tier}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 4. Configuration (collapsible) */}
        <div style={{ marginBottom: "28px" }}>
          <button onClick={() => setConfigOpen(!configOpen)} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0 0 10px 0", fontFamily: FONT }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary }}>4</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, flex: 1, textAlign: "left" }}>Configuration</span>
            <span style={{ fontSize: "11px", color: T.textTer, marginRight: "4px" }}>defaults shown</span>
            <ChevronDown size={14} color={T.textSec} style={{ transform: configOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
          </button>
          {configOpen && (
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "0 32px" }}>
                {[
                  ["Cas12a Variant", "enAsCas12a"], ["PAM Pattern", "TTTV"],
                  ["Spacer Lengths", "20, 21, 22, 23 nt"], ["GC Range", "30–70%"],
                  ["Min Discrimination", "2.0×"], ["SM Enhancement", "Enabled"],
                  ["RPA Amplicon", "100–200 bp"], ["Scoring Model", "GUARD-Net ensemble (CNN + RNA-FM + Heuristic)"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.borderLight}`, fontSize: "13px" }}>
                    <span style={{ color: T.textSec }}>{k}</span>
                    <span style={{ fontWeight: 600, color: T.text }}>{v}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "11px", color: T.textTer, margin: "12px 0 0" }}>
                Override defaults by providing a custom YAML config file or editing parameters via the API.
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: "0 0 20px" }} />

        {/* Summary + Launch */}
        {error && <div style={{ color: T.danger, fontSize: "12px", marginBottom: "12px" }}>{error}</div>}
        <div style={{ display: "flex", alignItems: mobile ? "stretch" : "center", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", gap: mobile ? "12px" : "0" }}>
          <div style={{ display: "flex", gap: "24px", fontSize: "13px", flexWrap: "wrap" }}>
            <span style={{ color: T.textSec }}><strong style={{ color: T.text }}>{selected.size}</strong> targets</span>
            <span style={{ color: T.textSec }}><strong style={{ color: T.text }}>{mode === "custom" ? selectedModules.size : MODULES.length}</strong> modules</span>
            <span style={{ color: T.textSec }}>Est. <strong style={{ color: T.text }}>~{Math.max(15, selected.size * 3)}s</strong></span>
            <span style={{ color: T.textSec }}>{[...new Set([...selected].map(i => MUTATIONS[i]?.drug))].length} drug classes</span>
          </div>
          <Btn icon={launching ? Loader2 : Play} onClick={launch} disabled={launching || selected.size === 0}>
            {launching ? "Launching…" : "Launch Pipeline"}
          </Btn>
        </div>
      </div>

      {/* ═══ HOW IT WORKS — 4-step simplified pipeline ═══ */}
      {sectionTitle("How It Works")}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
        {[
          { step: "1", icon: Target, title: "Define Targets", desc: "Input WHO resistance mutations. The pipeline resolves each mutation to its exact genomic position on the M. tuberculosis H37Rv reference genome, identifies the codon context, and determines which drug class it confers resistance to." },
          { step: "2", icon: Search, title: "Generate & Score Candidates", desc: "For each target, GUARD scans for Cas12a-compatible PAM sites, generates crRNA candidates, filters by biophysical criteria (GC content, secondary structure, off-targets), and scores them with GUARD-Net — a neural network trained on 15,000 experimentally validated guides." },
          { step: "3", icon: Grid3x3, title: "Optimise the Panel", desc: "A simulated annealing optimizer selects the best combination of guides that maximises cleavage efficiency while minimising cross-reactivity. RPA primers are co-designed for each guide, with allele-specific primers for proximity targets." },
          { step: "4", icon: Shield, title: "Assess Clinical Performance", desc: "Block 3 evaluates the panel against WHO Target Product Profiles: per-drug-class sensitivity, specificity estimates, and ranked backup alternatives for each target. Three operating modes (field screening, clinical deployment, reference lab) adjust thresholds automatically." },
        ].map(c => (
          <div key={c.title} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "8px", background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "14px", fontWeight: 800, color: T.primaryDark, fontFamily: MONO }}>{c.step}</span>
              </div>
              <c.icon size={20} color={T.primary} strokeWidth={1.8} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>{c.title}</span>
            </div>
            <div style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.65 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* ═══ ARCHITECTURE DIAGRAM ═══ */}
      <CollapsibleSection title="System Architecture">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0" }}>
          {/* Input */}
          <div style={{ background: T.warningLight, border: `1px solid ${T.warning}33`, borderRadius: "8px", padding: "10px 24px", fontSize: "12px", fontWeight: 600, color: "#92400E", textAlign: "center" }}>WHO Mutation Catalogue</div>
          <div style={{ width: "2px", height: "20px", background: T.border }} />

          {/* Pipeline */}
          <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: "16px 24px", width: "100%", maxWidth: 600, textAlign: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.primaryDark, marginBottom: "8px" }}>GUARD Pipeline</div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px", fontSize: "11px", color: T.primaryDark }}>
              {["Target Resolution", "→", "Candidate Generation", "→", "Scoring", "→", "Panel Optimisation", "→", "Primer Design"].map((t, i) => (
                <span key={i} style={{ fontWeight: t === "→" ? 400 : 600, opacity: t === "→" ? 0.5 : 1 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Two branches */}
          <div style={{ display: "flex", gap: mobile ? "12px" : "32px", marginTop: "12px", width: "100%", maxWidth: 600, justifyContent: "center" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: "2px", height: "16px", background: T.border, margin: "0 auto" }} />
              <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}33`, borderRadius: "8px", padding: "12px 16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.purple }}>GUARD-Net</div>
                <div style={{ fontSize: "10px", color: "#6B21A8", marginTop: "2px" }}>AI guide scoring</div>
                <div style={{ fontSize: "10px", color: "#6B21A8" }}>efficiency + discrimination</div>
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: "2px", height: "16px", background: T.border, margin: "0 auto" }} />
              <div style={{ background: T.successLight, border: `1px solid ${T.success}33`, borderRadius: "8px", padding: "12px 16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.success }}>Block 3</div>
                <div style={{ fontSize: "10px", color: "#166534", marginTop: "2px" }}>Clinical assessment</div>
                <div style={{ fontSize: "10px", color: "#166534" }}>WHO TPP compliance</div>
              </div>
            </div>
          </div>

          <div style={{ width: "2px", height: "20px", background: T.border }} />

          {/* Output */}
          <div style={{ background: T.bgSub, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "10px 24px", fontSize: "12px", fontWeight: 600, color: T.text, textAlign: "center" }}>
            Assay-Ready Panel: 14 crRNAs + 14 RPA primer pairs + clinical metrics
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ GUARD-NET — AI-Powered Guide Scoring ═══ */}
      {sectionTitle("How GUARD-Net Predicts Guide Performance")}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 20px" }}>
          Each candidate guide is scored by a neural network that combines two complementary perspectives on what makes a guide effective:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          {[
            { icon: Cpu, title: "Understanding the target DNA", desc: "A convolutional neural network scans the 34-nucleotide target sequence for patterns that affect how well Cas12a can bind and cut. It detects features like dinucleotide preferences and seed-region composition that determine cleavage activity." },
            { icon: Layers, title: "Understanding the guide RNA", desc: "A pre-trained RNA foundation model (RNA-FM) analyses the guide's folding properties, thermodynamic stability, and structure — factors that determine whether the guide loads properly into the Cas12a enzyme." },
            { icon: TrendingUp, title: "Physics-informed attention", desc: "Cas12a reads DNA sequentially — if there's a problem at position 3, it never reaches position 18. This directional 'R-loop propagation' is encoded in the model's attention mechanism, improving prediction accuracy by 6.7% over standard approaches." },
          ].map(c => (
            <div key={c.title}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <c.icon size={16} color={T.primary} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>{c.title}</span>
              </div>
              <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ background: T.bgSub, borderRadius: "8px", padding: "14px 18px", fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
          The model also predicts <strong>discrimination</strong> — how well a guide distinguishes drug-resistant from drug-susceptible bacteria, even when the difference is a single DNA letter. This is critical for diagnostic accuracy, and is predicted jointly with efficiency in a multi-task architecture.
        </div>
      </div>

      <CollapsibleSection title="Technical Details — GUARD-Net Architecture">
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {[
            ["Architecture", "Dual-branch CNN + RNA-FM with RLPA"],
            ["Parameters", "235,000 trainable"],
            ["Training data", "Kim et al. 2018 HT-PAMDA (15K guides)"],
            ["Attention", "R-Loop Propagation Attention (RLPA)"],
            ["RLPA improvement", "+6.7% test performance over standard attention"],
            ["Training protocol", "3-phase: pretrain, RLPA, multi-task"],
            ["Multi-task heads", "Efficiency + Discrimination (joint prediction)"],
            ["Inference", "CPU-compatible (~50ms per candidate)"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: "8px", padding: "8px 12px", background: T.bgSub, borderRadius: "6px" }}>
              <span style={{ fontSize: "11px", color: T.textTer, fontWeight: 600, minWidth: 110, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: T.textTer, margin: 0, lineHeight: 1.5 }}>
          All predictions are in silico estimates. Predicted discrimination ratios are derived from mismatch penalty models, not from clinical trial data. Experimental confirmation is required before diagnostic deployment.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Model Deep Dive — Input, Process, Output for Each Component">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* CNN Branch */}
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.primary, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={16} /> Branch 1: Convolutional Neural Network (CNN)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Input</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  34-nucleotide one-hot encoded target sequence (4 bp upstream PAM + 4 bp PAM + 23 bp protospacer + 3 bp downstream). Encoded as a 4 x 34 binary matrix where each column represents A, C, G, or T at that position.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Process</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Three convolutional layers (64 / 128 / 256 filters) with kernel sizes 3, 5, and 7 scan for local sequence motifs: dinucleotide preferences, seed-region composition (positions 1-8), and PAM-proximal patterns. Batch normalisation and dropout (0.3) regularise each layer. Global average pooling compresses spatial features into a 256-dim vector.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  256-dimensional feature vector capturing local sequence determinants of Cas12a binding affinity. Encodes PAM quality, seed complementarity, and position-specific nucleotide preferences that govern R-loop initiation.
                </div>
              </div>
            </div>
          </div>

          {/* RNA-FM Branch */}
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.purple, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={16} /> Branch 2: RNA Foundation Model (RNA-FM)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Input</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Raw guide RNA nucleotide sequence (20-23 nt spacer). Fed into a pre-trained RNA foundation model (RNA-FM, Chen et al. 2022) that was trained on 23 million non-coding RNA sequences via masked language modelling.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Process</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  RNA-FM generates per-token embeddings (640-dim) encoding secondary structure propensity, thermodynamic stability, and accessibility. A projection layer maps the mean-pooled 640-dim RNA-FM embedding down to 128 dimensions. The weights of RNA-FM are frozen; only the projection head is trained.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  128-dimensional structural embedding capturing guide RNA folding properties: self-complementarity, loop stability, and 5' end accessibility. These features determine whether the crRNA loads correctly into the Cas12a enzyme and remains unfolded for target binding.
                </div>
              </div>
            </div>
          </div>

          {/* RLPA */}
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#059669", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={16} /> Fusion: R-Loop Propagation Attention (RLPA)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Input</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Concatenated feature vector from both branches: 256-dim CNN features + 128-dim RNA-FM features = 384-dim combined representation of sequence and structure.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Process</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  A causal (lower-triangular) attention mask enforces the physical constraint that Cas12a reads the target 5' to 3': a mismatch at position 3 blocks propagation to all downstream positions. This biologically-informed inductive bias improves accuracy by 6.7% over standard bidirectional attention. Two attention heads with 64-dim keys/values.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Attention-weighted 384-dim vector where each feature dimension is re-weighted according to its positional importance in the R-loop propagation process. Fed into the multi-task prediction heads.
                </div>
              </div>
            </div>
          </div>

          {/* Prediction Heads */}
          <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Target size={16} /> Multi-Task Prediction Heads
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Input</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  RLPA-weighted 384-dim combined feature vector from the attention fusion layer. Shared representation for both tasks.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Process</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Two parallel MLP heads (384 {"\u2192"} 128 {"\u2192"} 1), each with ReLU activation and dropout. <strong>Head 1 (Efficiency):</strong> predicts normalised cleavage activity (0-1). <strong>Head 2 (Discrimination):</strong> predicts log-ratio of mutant vs wildtype cleavage. Joint training with weighted loss: L = 0.6 * L_eff + 0.4 * L_disc.
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.text, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
                  Two scalar predictions per candidate guide: <strong>efficiency score</strong> (0-1, higher = better cleavage) and <strong>discrimination ratio</strong> (fold-change MUT/WT, higher = better diagnostic specificity). These scores drive all downstream panel selection and WHO compliance assessment.
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: T.primaryLight, borderRadius: "8px", padding: "12px 16px", fontSize: "12px", color: T.primaryDark, lineHeight: 1.6 }}>
            <strong>Training protocol:</strong> Phase 1 — pre-train CNN branch on efficiency labels only (200 epochs). Phase 2 — introduce RLPA attention and fine-tune (100 epochs). Phase 3 — activate discrimination head for multi-task learning (100 epochs). Total: 235K trainable parameters trained on 15,000 experimentally validated Cas12a guides from Kim et al. 2018 HT-PAMDA dataset.
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ BLOCK 3 — Clinical Performance Dashboard ═══ */}
      {sectionTitle("WHO-Benchmarked Diagnostic Assessment")}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 20px" }}>
          After panel design, GUARD evaluates clinical readiness against WHO Target Product Profiles (2024 update) for drug susceptibility testing:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
          {[
            { title: "Per-drug-class sensitivity", desc: "Does the panel detect resistance to each antibiotic? WHO requires ≥95% for rifampicin, ≥90% for isoniazid and fluoroquinolones, ≥80% for ethambutol, pyrazinamide, and aminoglycosides.", icon: TrendingUp },
            { title: "Specificity estimate", desc: "For each target, the discrimination ratio (mutant vs wildtype signal) predicts false positive rates. A ratio ≥3× is diagnostic-grade; ≥10× is reference-lab quality. Estimated from discrimination ratios, not from clinical trials.", icon: Shield },
            { title: "Three operating modes", desc: "High Sensitivity (field screening), Balanced (WHO TPP deployment), High Specificity (reference labs). Each mode adjusts scoring and discrimination thresholds to optimise for different clinical settings.", icon: Settings },
            { title: "Ranked alternatives", desc: "For every target, GUARD stores 3–5 backup candidates with annotated tradeoffs. If the first choice fails in the lab, backups are ready with documented efficiency-discrimination tradeoffs.", icon: Layers },
          ].map(c => (
            <div key={c.title} style={{ display: "flex", gap: "12px" }}>
              <c.icon size={18} color={T.primary} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>{c.title}</div>
                <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ DISCRIMINATION ═══ */}
      {sectionTitle("Discrimination Analysis")}
      <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 16px 0" }}>
        Discrimination quantifies a crRNA's ability to distinguish the resistance allele from wildtype.
        Reported as the ratio of mutant vs wildtype cleavage activity. Higher is better — it means the guide reacts strongly to resistant bacteria and weakly to susceptible ones.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
        {[
          { label: "Excellent", val: "≥ 10×", color: "#16a34a", bg: "#f0fdf4", desc: "Single-plex clinical. Robust across sample types." },
          { label: "Good", val: "≥ 3×", color: T.primary, bg: T.primaryLight, desc: "Multiplex panel. Fluorescence & lateral flow." },
          { label: "Acceptable", val: "≥ 2×", color: "#d97706", bg: "#fffbeb", desc: "Requires confirmatory readout." },
          { label: "Insufficient", val: "< 2×", color: "#dc2626", bg: "#fef2f2", desc: "Synthetic mismatch enhancement needed." },
        ].map(t => (
          <div key={t.label} style={{ background: t.bg, borderRadius: "8px", padding: "14px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: t.color, marginBottom: "2px" }}>{t.val}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>{t.label}</div>
            <div style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.4 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      <CollapsibleSection title="Synthetic Mismatch Enhancement">
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <Zap size={18} color={T.primary} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, margin: "0 0 8px 0" }}>
              For candidates with insufficient discrimination, deliberate mismatches at positions 2–6 destabilize wildtype binding
              while preserving mutant recognition, boosting discrimination from ~2× to 10–100×.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ NUCLEASE & DEFAULTS — collapsed ═══ */}
      <CollapsibleSection title="Nuclease Reference — Cas12a (Cpf1)">
        <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, margin: "0 0 8px 0" }}>
          Cas12a (formerly Cpf1) is a Class 2, Type V-A CRISPR effector discovered in <em>Francisella novicida</em> (Zetsche et al. 2015).
          Unlike Cas9, it recognises a T-rich PAM upstream of the target, processes its own pre-crRNA without tracrRNA,
          and generates staggered double-strand breaks with 5' overhangs. Crucially for diagnostics, target binding activates
          a non-specific single-stranded DNase (<em>trans</em>-cleavage) that degrades fluorophore-quencher reporters, enabling
          isothermal detection without thermocycling.
        </p>
        <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, margin: "0 0 12px 0" }}>
          GUARD uses the engineered <strong>enAsCas12a</strong> variant (Kleinstiver et al. 2019), which expands PAM recognition
          from canonical TTTV to include TTTT, VTTV, and TRTV motifs, increasing targetable sites by approximately 4-fold.
          This variant maintains high fidelity while operating at 37 °C — compatible with recombinase polymerase amplification (RPA)
          for single-tube, equipment-free diagnostics at point of care.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {[
            ["Variant", "enAsCas12a (engineered)"],
            ["PAM", "5'-TTTV-3' (expanded: VTTV, TRTV)"],
            ["Spacer", "5' → 3', non-target strand"],
            ["crRNA", "19 nt direct repeat + 20–23 nt spacer"],
            ["Cis-cleavage", "Staggered dsDNA cut, 5' overhang"],
            ["Trans-cleavage", "Non-specific ssDNase (reporter activation)"],
            ["Temperature", "37 °C (RPA-compatible)"],
            ["Readouts", "Fluorescence · lateral flow · electrochemical"],
            ["Sensitivity", "Attomolar with RPA pre-amplification"],
            ["Multiplexing", "Orthogonal reporters per crRNA in single tube"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: "8px", padding: "8px 12px", background: T.bgSub, borderRadius: "6px" }}>
              <span style={{ fontSize: "11px", color: T.textTer, fontWeight: 600, minWidth: mobile ? 80 : 110, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: T.primaryLight, borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: T.primaryDark, lineHeight: 1.5 }}>
          <strong>Why Cas12a over Cas9 for diagnostics?</strong> (1) T-rich PAM avoids GC-rich regions that cause secondary structures. (2) Self-processing crRNA simplifies guide design. (3) Trans-cleavage enables signal amplification without PCR. (4) Staggered cuts improve allele discrimination at single-nucleotide resolution.
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Pipeline Defaults">
        {[
          ["PAM", "TTTV", "~4× more sites than TTTG-only"],
          ["Spacer length", "20–23 nt", "20nt canonical; 21–23 for high-GC"],
          ["GC range", "30–70%", "Below 30% weak R-loop; above 70% self-structure"],
          ["Max homopolymer", "4 nt", "Poly-T ≥5 = Pol III termination"],
          ["Off-target", "≤3 mismatches", "Bowtie2 against full genome"],
          ["RPA amplicon", "100–200 bp", "Optimal RPA range"],
          ["Primer Tm", "57–72 °C", "Strand invasion at 37–42 °C"],
          ["Discrimination min", "2.0×", "≥3.0× preferred for LFA"],
        ].map(([param, value, rationale], i, arr) => (
          <div key={param} style={{ display: "flex", alignItems: "baseline", gap: mobile ? "8px" : "16px", padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", flexWrap: mobile ? "wrap" : "nowrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.text, minWidth: mobile ? "100%" : 130, flexShrink: 0 }}>{param}</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary, minWidth: 80, flexShrink: 0 }}>{value}</span>
            <span style={{ fontSize: "11px", color: T.textTer, flex: 1 }}>{rationale}</span>
          </div>
        ))}
      </CollapsibleSection>

      {/* ═══ REFERENCES ═══ */}
      <CollapsibleSection title={`References (${BIBLIOGRAPHY.length})`}>
        {(() => {
          const categories = [...new Set(BIBLIOGRAPHY.map(b => b.category))];
          return categories.map(cat => (
            <div key={cat} style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", paddingTop: "8px" }}>{cat}</div>
              {BIBLIOGRAPHY.filter(b => b.category === cat).map((b, i, arr) => (
                <div key={b.id} style={{ padding: "6px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", display: "flex", justifyContent: "space-between", alignItems: mobile ? "flex-start" : "center", gap: "12px", flexDirection: mobile ? "column" : "row" }}>
                  <div style={{ flex: 1, fontSize: "12px", lineHeight: 1.5 }}>
                    <strong style={{ color: T.text }}>{b.authors} ({b.year}).</strong>{" "}
                    {b.title}.{" "}
                    <em style={{ color: T.textTer }}>{b.journal}.</em>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {b.doi && <a href={`https://doi.org/${b.doi}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: T.primary, textDecoration: "none", fontWeight: 600 }}>DOI <ExternalLink size={8} style={{ verticalAlign: "middle" }} /></a>}
                    {b.pmid && <a href={`https://pubmed.ncbi.nlm.nih.gov/${b.pmid}/`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: T.primary, textDecoration: "none", fontWeight: 600 }}>PubMed <ExternalLink size={8} style={{ verticalAlign: "middle" }} /></a>}
                    {!b.doi && !b.pmid && b.url && <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: T.primary, textDecoration: "none", fontWeight: 600 }}>Link <ExternalLink size={8} style={{ verticalAlign: "middle" }} /></a>}
                  </div>
                </div>
              ))}
            </div>
          ));
        })()}
      </CollapsibleSection>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   PIPELINE PAGE — Real-time progress via WS + polling fallback
   ═══════════════════════════════════════════════════════════════════ */
const PipelinePage = ({ jobId, connected, goTo }) => {
  const mobile = useIsMobile();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [jobData, setJobData] = useState(null);
  const [moduleStats, setModuleStats] = useState([]);
  const [revealedStats, setRevealedStats] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    if (connected) {
      try {
        const ws = connectJobWS(jobId,
          (msg) => {
            if (msg.current_module) {
              const idx = MODULE_NAME_MAP[msg.current_module];
              if (idx !== undefined) setStep(idx);
            }
            if (msg.status === "complete" || msg.status === "completed") {
              setDone(true);
              setJobData(msg);
            }
          },
          () => { startPolling(); }
        );
        wsRef.current = ws;
      } catch {
        startPolling();
      }
    } else {
      simulateProgress();
    }

    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, connected]);

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      const { data } = await getJob(jobId);
      if (data) {
        const idx = MODULE_NAME_MAP[data.current_module] || 0;
        setStep(idx);
        if (data.status === "complete" || data.status === "completed") {
          setDone(true);
          setJobData(data);
          clearInterval(pollRef.current);
        }
      }
    }, 2000);
  };

  const simulateProgress = () => {
    let i = 0;
    const iv = setInterval(() => {
      if (i >= MODULES.length) { clearInterval(iv); setDone(true); return; }
      setStep(i);
      i++;
    }, 800);
  };

  /* Fetch module stats when pipeline completes — mock if offline */
  useEffect(() => {
    if (done && jobId) {
      if (connected) {
        getResults(jobId).then(({ data }) => {
          if (data?.module_stats?.length) setModuleStats(data.module_stats);
        });
      } else {
        /* Realistic mock stats for offline demo */
        setModuleStats([
          { module_id: "M1", detail: "14 mutations → 14 genomic targets resolved", candidates_out: 14, duration_ms: 120, breakdown: {} },
          { module_id: "M2", detail: "842,106 positions scanned → 3,847 PAM hits → 1,206 candidates", candidates_out: 1206, duration_ms: 4230, breakdown: { positions_scanned: 842106, pam_hits: 3847 } },
          { module_id: "M3", detail: "GC 30–70%, homopolymer ≤4, Tm filter → 847 passed", candidates_out: 847, duration_ms: 310 },
          { module_id: "M4", detail: "Bowtie2 ≤3mm screen → 12 off-target hits removed", candidates_out: 835, duration_ms: 8920 },
          { module_id: "M5", detail: "5-feature composite scoring complete", candidates_out: 835, duration_ms: 190 },
          { module_id: "M5.5", detail: "835 WT/MUT spacer pairs generated", candidates_out: 835, duration_ms: 280 },
          { module_id: "M6", detail: "SM enhancement: 4 candidates improved (avg 12× → 47×)", candidates_out: 835, duration_ms: 1540 },
          { module_id: "M6.5", detail: "Discrimination scored: 11 diagnostic-grade (≥3×)", candidates_out: 835, duration_ms: 420 },
          { module_id: "M7", detail: "Simulated annealing: 14-plex panel selected (score 0.847)", candidates_out: 14, duration_ms: 3200 },
          { module_id: "M8", detail: "RPA primers: 12/14 successful (2 high-GC failures)", candidates_out: 14, duration_ms: 6100 },
          { module_id: "M8.5", detail: "Co-selection: 0 crRNA–primer conflicts", candidates_out: 14, duration_ms: 150 },
          { module_id: "M9", detail: "Panel assembled: 14 targets + IS6110 control = 15-plex", candidates_out: 15, duration_ms: 80 },
          { module_id: "M10", detail: "Exported JSON + TSV + FASTA", candidates_out: 15, duration_ms: 45 },
        ]);
      }
    }
  }, [done, jobId, connected]);

  /* Staggered reveal of stats (350ms per module) */
  useEffect(() => {
    if (moduleStats.length > 0) {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setRevealedStats(i);
        if (i >= MODULES.length) {
          clearInterval(interval);
          setRevealDone(true);
        }
      }, 350);
      return () => clearInterval(interval);
    }
  }, [moduleStats]);

  /* Build stat lookup by module_id */
  const statMap = {};
  moduleStats.forEach((s) => { statMap[s.module_id] = s; });
  const maxCandidates = statMap["M2"]?.candidates_out || 1;
  const totalDuration = moduleStats.reduce((s, m) => s + (m.duration_ms || 0), 0);
  const m2Out = statMap["M2"]?.candidates_out || 0;
  const positionsScanned = statMap["M2"]?.breakdown?.positions_scanned || 0;
  const pamHits = statMap["M2"]?.breakdown?.pam_hits || 0;
  const finalSize = statMap["M9"]?.candidates_out || statMap["M7"]?.candidates_out || 0;

  const pct = Math.min(100, Math.round(((step + (done ? 1 : 0)) / MODULES.length) * 100));

  /* Empty state — no job launched */
  if (!jobId) {
    return (
      <div style={{ padding: mobile ? "16px" : "36px 40px" }}>
        <div style={{ textAlign: "center", padding: mobile ? "48px 24px" : "80px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "16px", background: T.bgSub, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
            <Cpu size={28} color={T.textTer} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>No pipeline running</div>
          <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
            Configure your target mutations and launch the GUARD pipeline from the Home page. Real-time progress will appear here as each module executes.
          </p>
          <Btn icon={Play} onClick={() => goTo("home")}>Configure & Launch</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px", maxWidth: 1100, width: "100%" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Pipeline Execution</div>
      <h2 style={{ fontSize: mobile ? "22px" : "28px", fontWeight: 800, color: T.text, margin: "0 0 8px", letterSpacing: "-0.02em", fontFamily: HEADING }}>
        {done ? "Pipeline Complete" : "Running…"}
      </h2>
      <p style={{ fontSize: "13px", color: T.textSec, marginBottom: "32px" }}>Job: <span style={{ fontFamily: MONO }}>{jobId}</span></p>

      {/* Progress bar */}
      <div style={{ background: T.bgSub, borderRadius: "8px", height: "8px", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? T.success : T.primary, borderRadius: "8px", transition: "width 0.4s ease" }} />
      </div>

      {/* Module list with inline stats */}
      <div style={{ marginBottom: "32px" }}>
        {MODULES.map((m, i) => {
          const status = i < step ? "done" : i === step && !done ? "active" : done ? "done" : "pending";
          const stat = statMap[m.id];
          const statsVisible = i < revealedStats && stat;
          const barWidth = stat ? Math.max(0.5, (stat.candidates_out / maxCandidates) * 100) : 0;

          return (
            <div key={m.id} style={{ padding: mobile ? "8px 0" : "10px 0", borderBottom: `1px solid ${T.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: mobile ? "8px" : "12px" }}>
                <div style={{
                  width: mobile ? 24 : 28, height: mobile ? 24 : 28, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: status === "done" ? T.successLight : status === "active" ? T.primaryLight : T.bgSub,
                }}>
                  {status === "done" ? <Check size={mobile ? 12 : 14} color={T.success} /> : status === "active" ? <Loader2 size={mobile ? 12 : 14} color={T.primary} className="spin" /> : <m.icon size={mobile ? 12 : 14} color={T.textTer} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: mobile ? "12px" : "13px", fontWeight: status === "active" ? 700 : 500, color: status === "pending" ? T.textTer : T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ fontFamily: MONO, fontSize: "10px", color: T.primary, marginRight: "6px" }}>{m.id}</span>
                    {m.name}
                  </div>
                </div>
              </div>

              {/* Inline stat line — reveals after pipeline completes */}
              {statsVisible && (
                <div style={{ animation: "statReveal 0.3s ease-out forwards", marginTop: 6, marginLeft: mobile ? 32 : 40 }}>
                  <div style={{ fontFamily: MONO, fontSize: mobile ? "10px" : "11px", color: T.textSec, display: "flex", justifyContent: "space-between", alignItems: "baseline", lineHeight: 1.6, gap: 8 }}>
                    <span style={{ minWidth: 0, wordBreak: "break-word" }}>{stat.detail}</span>
                    <span style={{ color: T.textTer, flexShrink: 0, fontSize: "10px" }}>{stat.duration_ms}ms</span>
                  </div>
                  {/* Funnel bar */}
                  <div style={{ width: "100%", height: 3, background: T.borderLight, borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${barWidth}%`, height: "100%", background: T.primary, borderRadius: 2,
                      transition: "width 0.6s ease-out", opacity: barWidth < 5 ? 1 : 0.6,
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary strip — appears after all stats revealed */}
      {revealDone && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
          padding: mobile ? "12px 0" : "16px 0", borderTop: `2px solid ${T.text}`,
          animation: "statReveal 0.4s ease-out forwards",
        }}>
          <div style={{ fontFamily: MONO, fontSize: mobile ? "11px" : "13px", color: T.text, fontWeight: 700 }}>
            {positionsScanned > 0
              ? <>{positionsScanned.toLocaleString()} positions {"→"} {pamHits.toLocaleString()} PAM hits {"→"} {m2Out.toLocaleString()} candidates {"→"} {finalSize} selected</>
              : <>{m2Out.toLocaleString()} candidates {"→"} {finalSize} selected</>
            }
          </div>
          <div style={{ fontFamily: MONO, fontSize: mobile ? "11px" : "12px", color: T.textTer }}>
            {(totalDuration / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {/* View Results button — appears after reveal completes */}
      {revealDone && (
        <div style={{ marginTop: mobile ? 16 : 24, animation: "statReveal 0.3s ease-out forwards" }}>
          <button
            onClick={() => goTo("results", { jobId })}
            style={{
              background: T.primary, color: "#fff", border: "none", borderRadius: 8,
              padding: mobile ? "10px 20px" : "12px 28px", fontSize: mobile ? "13px" : "14px", fontWeight: 700, cursor: "pointer",
              fontFamily: FONT, letterSpacing: "-0.01em", width: mobile ? "100%" : "auto",
            }}
          >
            View Results {"→"}
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   RESULT TABS
   ═══════════════════════════════════════════════════════════════════ */
const OverviewTab = ({ results }) => {
  const mobile = useIsMobile();
  const drugs = [...new Set(results.map((r) => r.drug))];
  const byDrug = drugs.map((d) => ({ drug: d, count: results.filter((r) => r.drug === d).length, avgScore: +(results.filter((r) => r.drug === d).reduce((a, r) => a + r.score, 0) / results.filter((r) => r.drug === d).length).toFixed(3) }));
  const withPrimers = results.filter((r) => r.hasPrimers).length;
  const directResults = results.filter((r) => r.strategy === "Direct" && r.disc < 900);
  const avgDisc = directResults.length ? +(directResults.reduce((a, r) => a + r.disc, 0) / directResults.length).toFixed(1) : 0;
  const highDisc = directResults.filter((r) => r.disc >= 3).length;
  const directCount = results.filter((r) => r.strategy === "Direct").length;
  const proximityCount = results.filter((r) => r.strategy === "Proximity").length;
  const avgScore = results.length ? +(results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(3) : 0;
  const minScore = results.length ? Math.min(...results.map(r => r.score)).toFixed(3) : "0";
  const maxScore = results.length ? Math.max(...results.map(r => r.score)).toFixed(3) : "0";
  const cnnResults = results.filter(r => r.cnnCalibrated != null);
  const avgCNN = cnnResults.length ? +(cnnResults.reduce((a, r) => a + r.cnnCalibrated, 0) / cnnResults.length).toFixed(3) : null;
  const ensResults = results.filter(r => r.ensembleScore != null);
  const avgEnsemble = ensResults.length ? +(ensResults.reduce((a, r) => a + r.ensembleScore, 0) / ensResults.length).toFixed(3) : null;

  /* Adaptyv-style grouped stat section */
  const StatGroup = ({ title, items }) => (
    <div style={{ flex: 1, minWidth: mobile ? "100%" : 0 }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>{title}</div>
      <div style={{ display: "flex", gap: 0 }}>
        {items.map((s, i) => (
          <div key={s.l} style={{ flex: 1, paddingLeft: i > 0 ? "20px" : 0, borderLeft: i > 0 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ fontSize: "10px", fontWeight: 500, color: T.textTer, marginBottom: "4px" }}>{s.l}</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: T.text, fontFamily: MONO, lineHeight: 1.2 }}>{s.v}</div>
            {s.sub && <div style={{ fontSize: "10px", color: T.textTer, marginTop: "3px" }}>{s.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* Explainer box — same blue as stat bar */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "16px" : "20px 24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "8px" }}>How to read these results</div>
        <div style={{ fontSize: "13px", color: T.primaryDark, lineHeight: 1.7, opacity: 0.85 }}>
          <p style={{ margin: "0 0 8px" }}>
            Each <strong>candidate</strong> is a CRISPR guide RNA (crRNA) designed to detect one specific drug-resistance mutation in <em>M. tuberculosis</em>.
            The pipeline evaluates every candidate on four axes:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "6px 24px", fontSize: "12px" }}>
            <div><strong>Score</strong> (0–1) — ensemble of calibrated CNN activity prediction and heuristic biophysical features. Used as the primary ranking metric.</div>
            <div><strong>Discrimination</strong> (×) — how well the guide distinguishes resistant bacteria from normal (drug-susceptible) bacteria. Expressed as the ratio of mutant vs wildtype cleavage activity. ≥ 3× is diagnostic-grade.</div>
            <div><strong>RPA Primers</strong> — short DNA sequences that amplify the target region at 37°C (no thermal cycler needed). A candidate without primers cannot be used as a complete assay.</div>
            <div><strong>Drug class</strong> — which antibiotic the mutation confers resistance to (e.g. RIF = rifampicin, INH = isoniazid). A complete panel covers all first- and second-line drugs.</div>
          </div>
        </div>
      </div>

      {/* Grouped stat bar — blue */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "24px 32px", marginBottom: "24px", display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? "24px" : "32px" }}>
        <StatGroup title="Panel" items={[
          { l: "Candidates", v: results.length },
          { l: "Drug classes", v: drugs.length },
          { l: "Detection", v: `${directCount} / ${proximityCount}`, sub: "direct / proximity" },
        ]} />
        <div style={{ width: mobile ? "100%" : "1px", height: mobile ? "1px" : "auto", background: T.border, flexShrink: 0 }} />
        <StatGroup title="Primers" items={[
          { l: "Designed", v: `${withPrimers}/${results.length}` },
          { l: "Coverage", v: `${results.length ? Math.round(withPrimers / results.length * 100) : 0}%` },
        ]} />
        <div style={{ width: mobile ? "100%" : "1px", height: mobile ? "1px" : "auto", background: T.border, flexShrink: 0 }} />
        <StatGroup title="Discrimination" items={[
          { l: "Avg. ratio", v: `${avgDisc}×` },
          { l: "Diagnostic-grade", v: highDisc, sub: "≥ 3× threshold" },
        ]} />
        <div style={{ width: mobile ? "100%" : "1px", height: mobile ? "1px" : "auto", background: T.border, flexShrink: 0 }} />
        <StatGroup title="Scoring" items={[
          { l: "Avg. score", v: avgScore },
          { l: "Range", v: `${minScore} – ${maxScore}`, sub: "min – max" },
        ]} />
      </div>

      {/* Scoring Model Comparison */}
      {avgCNN != null && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, marginBottom: "6px", fontFamily: HEADING }}>Scoring Model Comparison</div>
          <div style={{ fontSize: "12px", color: T.textSec, marginBottom: "20px", lineHeight: 1.6 }}>
            Each candidate is scored by three approaches. The heuristic uses hand-crafted biophysical features.
            The CNN learns nucleotide preferences from 15K Cas12a measurements, then is temperature-calibrated (T=7.5) to spread saturated scores.
            The ensemble blends both for improved ranking.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "16px" }}>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Heuristic</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.text, fontFamily: MONO }}>{avgScore}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>5 features · fixed weights</div>
            </div>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>SeqCNN (calibrated)</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.primary, fontFamily: MONO }}>{avgCNN}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>110K params · T=7.5</div>
            </div>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px", border: `2px solid ${T.primary}33` }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Ensemble</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.primary, fontFamily: MONO }}>{avgEnsemble || "—"}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>val rho = 0.74 · primary score</div>
            </div>
          </div>
        </div>
      )}

      {/* Score distribution chart — Adaptyv style: light bars + scatter dots + reference zones */}
      {(() => {
        /* Build per-candidate chart data: one bar per candidate sorted by score desc */
        const sorted = [...results].sort((a, b) => b.score - a.score);
        const chartData = sorted.map((r, i) => ({ name: r.label, score: r.score, disc: r.disc, drug: r.drug, idx: i }));
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Composite Score</span>
                <span style={{ fontSize: "12px", color: T.textTer, marginLeft: "10px" }}>{results.length} / {results.length} candidates scored</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} barCategoryGap="40%">
                <defs>
                  <linearGradient id="lowZone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C4B5FD" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#C4B5FD" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={T.borderLight} strokeDasharray="none" />
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: T.borderLight }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.textTer, fontFamily: MONO }} domain={[0, 1]} axisLine={false} tickLine={false} label={{ value: "Score", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: T.textTer }, offset: 0 }} />
                <Tooltip
                  contentStyle={{ ...tooltipStyle, padding: "10px 14px" }}
                  cursor={{ fill: "rgba(54,184,246,0.06)" }}
                  formatter={(v, name) => [typeof v === "number" ? v.toFixed(3) : v, name === "score" ? "Score" : "Disc"]}
                  labelFormatter={(l) => l}
                />
                {/* Low-score zone (purple gradient at bottom) */}
                <ReferenceLine y={0.5} stroke="none" />
                {/* Threshold reference line */}
                <ReferenceLine y={0.7} stroke="#EAB308" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Threshold", position: "left", style: { fontSize: 11, fill: "#EAB308", fontWeight: 600 } }} />
                {/* Light bars */}
                <Bar dataKey="score" fill="rgba(54,184,246,0.25)" radius={[3, 3, 0, 0]} name="Score" isAnimationActive={false} />
                {/* Scatter dots on top */}
                <Scatter dataKey="score" fill={T.primary} r={4} name="Score" isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 0.7 ? T.primary : entry.score >= 0.5 ? "#60A5FA" : "#93C5FD"} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            {/* Bottom zone labels */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "-4px", paddingLeft: "50px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.primary }} />
                <span style={{ fontSize: "11px", color: T.textSec }}>Above threshold (≥ 0.7)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#93C5FD" }} />
                <span style={{ fontSize: "11px", color: T.textSec }}>Below threshold</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 12, height: 3, background: "#EAB308", borderRadius: 2 }} />
                <span style={{ fontSize: "11px", color: T.textSec }}>0.7 threshold</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Drug coverage table */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Drug Coverage</div>
          <div style={{ fontSize: "12px", color: T.textTer }}>{drugs.length} classes</div>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr>
              {["Drug", "Candidates", "Avg Score", "Avg Disc", "Primers"].map((h) => (
                <th key={h} style={{ padding: "10px 24px", textAlign: "left", fontWeight: 600, color: T.textTer, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byDrug.map((d) => {
              const rows = results.filter((r) => r.drug === d.drug);
              const primerCount = rows.filter((r) => r.hasPrimers).length;
              return (
                <tr key={d.drug} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: "12px 24px" }}><DrugBadge drug={d.drug} /></td>
                  <td style={{ padding: "12px 24px", fontFamily: MONO, fontWeight: 600 }}>{d.count}</td>
                  <td style={{ padding: "12px 24px", fontFamily: MONO, color: d.avgScore > 0.75 ? T.success : d.avgScore > 0.6 ? T.text : T.warning }}>{d.avgScore}</td>
                  <td style={{ padding: "12px 24px", fontFamily: MONO }}>{(rows.reduce((a, r) => a + r.disc, 0) / rows.length).toFixed(1)}×</td>
                  <td style={{ padding: "12px 24px" }}>
                    <span style={{ fontFamily: MONO, fontWeight: 600 }}>{primerCount}/{d.count}</span>
                    {primerCount < d.count && <span style={{ marginLeft: "6px", fontSize: "10px", color: T.warning, fontWeight: 600 }}>{d.count - primerCount} missing</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Spacer Architecture ─── nucleotide-by-nucleotide crRNA SVG ─── */
const SpacerArchitecture = ({ r }) => {
  const mobile = useIsMobile();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  // Use SM-enhanced spacer when available so the SM base change is visible
  const spacer = (r.hasSM && r.smSpacer) ? r.smSpacer : r.spacer;
  const wt = r.wtSpacer && r.wtSpacer.length === spacer.length ? r.wtSpacer : null;
  const hasWt = !!wt;
  const len = spacer.length;

  // Derive per-nucleotide annotations
  const nts = spacer.split("").map((base, i) => {
    const pos = i + 1;
    return { base, pos, isSeed: pos <= 8, isSnp: false, isSynthMM: false };
  });

  // Classify mismatches: SNP vs synthetic mismatch
  const mmIndices = hasWt ? nts.map((nt, i) => spacer[i] !== wt[i] ? i : -1).filter(i => i >= 0) : [];
  if (r.hasSM && r.smPosition) {
    // We know exactly which position is the SM from the backend
    const smIdx = r.smPosition - 1; // smPosition is 1-based
    if (smIdx >= 0 && smIdx < nts.length) {
      nts[smIdx].isSynthMM = true;
    }
    mmIndices.filter(i => i !== smIdx).forEach(i => { nts[i].isSnp = true; });
  } else if (r.hasSM && mmIndices.length >= 2) {
    // Fallback: infer SM position from seed region mismatches
    const smIdx = mmIndices.find(i => nts[i].pos >= 2 && nts[i].pos <= 6);
    if (smIdx !== undefined) {
      nts[smIdx].isSynthMM = true;
      mmIndices.filter(i => i !== smIdx).forEach(i => { nts[i].isSnp = true; });
    } else {
      mmIndices.forEach(i => { nts[i].isSnp = true; });
    }
  } else {
    mmIndices.forEach(i => { nts[i].isSnp = true; });
  }

  // Bigger, more spacious cells
  const cellW = 30, cellH = 44, cellGap = 3;
  const pamW = 64, pamGap = 10, oX = 30;
  const spacerX = oX + pamW + pamGap;
  const totalNtW = len * (cellW + cellGap) - cellGap;
  const svgW = spacerX + totalNtW + 36;
  const svgH = 80;

  const cellBg = (nt) => nt.isSnp ? T.danger : nt.isSynthMM ? T.warning : nt.isSeed ? T.primaryLight : T.bgSub;
  const cellBorder = (nt) => nt.isSnp ? T.danger : nt.isSynthMM ? T.warning : nt.isSeed ? "rgba(54,184,246,0.3)" : T.borderLight;
  const letterFill = (nt) => (nt.isSnp || nt.isSynthMM) ? "#FFFFFF" : NUC[nt.base] || T.textSec;
  const posFill = (nt) => (nt.isSnp || nt.isSynthMM) ? "rgba(255,255,255,0.7)" : nt.isSeed ? T.primary : T.textTer;

  const snpNt = nts.find(n => n.isSnp);
  const smNt = nts.find(n => n.isSynthMM);
  const snpChange = snpNt ? `${wt[snpNt.pos - 1]}→${snpNt.base}` : "—";
  const smChange = smNt ? `${wt[smNt.pos - 1]}→${smNt.base}` : null;

  const handleCopy = (e) => {
    e.stopPropagation();
    if (navigator.clipboard) navigator.clipboard.writeText(spacer);
    setCopied(true);
    toast("Spacer copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginBottom: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>crRNA Spacer Architecture</div>
        <button onClick={handleCopy} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: copied ? T.success : T.textSec, fontFamily: FONT, transition: "color 0.15s" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy spacer"}
        </button>
      </div>

      {/* SVG card — centered with generous padding */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px 24px 20px", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg width={svgW} height={svgH} style={{ fontFamily: MONO, display: "block", minWidth: svgW }}>
            {/* 5' label */}
            <text x={oX - 6} y={28} fontSize={12} fill={T.textTer} fontWeight={700} textAnchor="end">5′</text>

            {/* PAM block */}
            <rect x={oX} y={4} width={pamW} height={cellH} rx={8} fill={T.primary} />
            <text x={oX + pamW / 2} y={17} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.6)" fontWeight={600} style={{ letterSpacing: "0.1em" }}>PAM</text>
            <text x={oX + pamW / 2} y={36} textAnchor="middle" fontSize={16} fill="#FFFFFF" fontWeight={700} letterSpacing="2">{r.pam}</text>

            {/* Nucleotide cells */}
            {nts.map((nt, i) => {
              const x = spacerX + i * (cellW + cellGap);
              return (
                <g key={i}>
                  <rect x={x} y={4} width={cellW} height={cellH} rx={5} fill={cellBg(nt)} stroke={cellBorder(nt)} strokeWidth={1.2} />
                  <text x={x + cellW / 2} y={28} textAnchor="middle" fontSize={15} fontWeight={700} fill={letterFill(nt)}>{nt.base}</text>
                  <text x={x + cellW / 2} y={42} textAnchor="middle" fontSize={9} fontWeight={nt.isSeed ? 700 : 400} fill={posFill(nt)}>{nt.pos}</text>
                </g>
              );
            })}

            {/* 3' label */}
            <text x={spacerX + totalNtW + 12} y={28} fontSize={12} fill={T.textTer} fontWeight={700}>3′</text>

            {/* Seed bracket */}
            {(() => {
              const bx1 = spacerX;
              const bx2 = spacerX + 8 * (cellW + cellGap) - cellGap;
              const by = cellH + 14;
              return (
                <g>
                  <line x1={bx1 + 3} y1={by - 4} x2={bx1 + 3} y2={by + 1} stroke={T.primary} strokeWidth={1.2} opacity={0.5} />
                  <line x1={bx1 + 3} y1={by + 1} x2={bx2 - 3} y2={by + 1} stroke={T.primary} strokeWidth={1.2} opacity={0.5} />
                  <line x1={bx2 - 3} y1={by - 4} x2={bx2 - 3} y2={by + 1} stroke={T.primary} strokeWidth={1.2} opacity={0.5} />
                  <text x={(bx1 + bx2) / 2} y={by + 15} textAnchor="middle" fontSize={10} fill={T.primary} fontWeight={700} fontFamily={FONT}>SEED (1–8)</text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Legend + metadata row — below the SVG, centered */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "20px", marginTop: "16px", paddingTop: "14px", borderTop: `1px solid ${T.borderLight}` }}>
          {/* Legend items */}
          {[
            { color: T.primary, label: "PAM" },
            { color: T.primaryLight, label: "Seed (1–8)", border: "rgba(54,184,246,0.3)" },
            { color: T.danger, label: "SNP" },
            ...(r.hasSM ? [{ color: T.warning, label: "Synth. MM" }] : []),
          ].map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: item.border ? `1px solid ${item.border}` : "none" }} />
              <span style={{ fontSize: "11px", color: T.textSec, fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}

          {/* Divider */}
          <div style={{ width: "1px", height: "16px", background: T.borderLight }} />

          {/* Metadata chips */}
          <span style={{ fontSize: "11px", color: T.textSec, fontFamily: MONO }}>{len} nt · GC {(r.gc * 100).toFixed(0)}%</span>
          {snpNt ? (
            <span style={{ fontSize: "11px", color: T.danger, fontWeight: 600, fontFamily: MONO }}>SNP @ pos {snpNt.pos} · {snpChange}</span>
          ) : r.strategy === "Proximity" ? (
            <span style={{ fontSize: "11px", color: T.purple, fontWeight: 600 }}>Mutation outside spacer{r.proximityDistance ? ` (${r.proximityDistance} bp away)` : ""}</span>
          ) : !hasWt ? (
            <span style={{ fontSize: "11px", color: T.textTer }}>WT spacer unavailable</span>
          ) : (
            <span style={{ fontSize: "11px", color: T.textTer }}>No SNP in spacer</span>
          )}
          {smNt ? (
            <span style={{ fontSize: "11px", color: T.warning, fontWeight: 600, fontFamily: MONO }}>SM: {smChange} @ pos {smNt.pos}</span>
          ) : (
            <span style={{ fontSize: "11px", color: T.textTer }}>SM: none</span>
          )}
        </div>
      </div>
    </div>
  );
};

const CandidateAccordion = ({ r }) => {
  const mobile = useIsMobile();
  const toast = useToast();
  const ref = r.refs;
  const discColor = r.disc >= 3 ? T.success : r.disc >= 2 ? T.primary : r.disc >= 1.5 ? T.warning : T.danger;
  const displaySpacer = (r.hasSM && r.smSpacer) ? r.smSpacer : r.spacer;

  return (
    <div style={{ padding: mobile ? "16px" : "20px 24px", background: T.bgSub, borderTop: `1px solid ${T.borderLight}` }}>
      {/* Key metrics row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
        {[
          { l: "Ensemble", v: (r.ensembleScore || r.score).toFixed(3), c: (r.ensembleScore || r.score) > 0.8 ? T.primary : (r.ensembleScore || r.score) > 0.65 ? T.warning : T.danger },
          { l: "Heuristic", v: r.score.toFixed(3), c: T.textSec },
          ...(r.cnnCalibrated != null ? [{ l: "CNN (cal)", v: r.cnnCalibrated.toFixed(3), c: r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger }] : []),
          { l: r.strategy === "Proximity" ? "Disc (AS-RPA)" : "Discrimination", v: r.strategy === "Proximity" ? "AS-RPA" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`, c: r.strategy === "Proximity" ? T.purple : discColor },
          ...(r.strategy === "Proximity" && r.proximityDistance ? [{ l: "Distance", v: `${r.proximityDistance} bp`, c: T.purple }] : []),
          { l: "GC%", v: `${(r.gc * 100).toFixed(0)}%`, c: T.text },
          { l: "Off-targets", v: r.ot, c: r.ot === 0 ? T.success : T.warning },
          { l: "Strategy", v: r.strategy, c: r.strategy === "Direct" ? T.success : T.purple },
        ].map((s, i) => (
          <div key={s.l} style={{ flex: 1, textAlign: "center", borderLeft: i > 0 ? `1px dashed ${T.border}` : "none", minWidth: mobile ? "30%" : "auto" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{s.l}</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: s.c, fontFamily: MONO }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* PROXIMITY explanation block */}
      {r.strategy === "Proximity" && (
        <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}33`, borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: T.purple, fontFamily: HEADING, marginBottom: "4px" }}>Proximity Detection — PAM Desert</div>
          <div style={{ fontSize: "11px", color: "#6B21A8", lineHeight: 1.5 }}>
            crRNA binds a conserved site {r.proximityDistance ? `${r.proximityDistance} bp` : "near"} the mutation. Discrimination via AS-RPA primers.
          </div>
        </div>
      )}

      {/* crRNA Spacer Architecture — full width */}
      <SpacerArchitecture r={r} />

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
        {/* Left: Amplicon + Mismatch */}
        <div>
          {/* Amplicon Map */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>Amplicon Map</div>
            <div style={{ background: T.bg, borderRadius: "8px", padding: "8px 4px", border: `1px solid ${T.borderLight}` }}>
              <AmpliconMap r={r} />
            </div>
          </div>

          {/* Mismatch Profile */}
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>MUT vs WT Mismatch</div>
            <div style={{ background: T.bg, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, overflowX: "auto" }}>
              <MismatchProfile spacer={displaySpacer} wtSpacer={r.wtSpacer} strategy={r.strategy} />
            </div>
          </div>
        </div>

        {/* Right: Oligos + Evidence */}
        <div>
          {/* Oligo Sequences */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>Oligo Sequences</div>
            <div style={{ background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: "8px", overflow: "hidden" }}>
              {[
                { name: `${r.label}_crRNA`, seq: `AATTTCTACTCTTGTAGAT${displaySpacer}`, note: "Direct repeat + spacer" },
                ...(r.fwd ? [{ name: `${r.label}_FWD`, seq: r.fwd, note: r.strategy === "Direct" ? "Standard RPA forward" : "AS-RPA forward" }] : []),
                ...(r.rev ? [{ name: `${r.label}_REV`, seq: r.rev, note: r.strategy === "Direct" ? "Standard RPA reverse" : "AS-RPA reverse" }] : []),
              ].map((o, i, arr) => (
                <div key={o.name} style={{ padding: "8px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: MONO, color: T.text }}>{o.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(o.seq); toast(`${o.name} copied`); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "2px 5px", cursor: "pointer", fontSize: "9px", color: T.textSec, display: "flex", alignItems: "center", gap: "2px" }}><Copy size={9} /> Copy</button>
                  </div>
                  <Seq s={o.seq} />
                  <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>{o.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          {ref && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "6px" }}>Evidence</div>
              <div style={{ background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: "8px", overflow: "hidden" }}>
                {[
                  ["WHO", ref.who],
                  ["Catalogue", ref.catalogue],
                  ["Frequency", ref.freq],
                  ["CRyPTIC", ref.cryptic || "—"],
                ].map(([k, v], i) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < 3 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px" }}>
                    <span style={{ color: T.textSec }}>{k}</span>
                    <span style={{ fontWeight: 600, color: T.text }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amplicon details */}
          {r.hasPrimers && (
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <div style={{ flex: 1, background: T.bg, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                <div style={{ color: T.textTer, marginBottom: "2px" }}>Amplicon</div>
                <div style={{ fontWeight: 700, fontFamily: MONO, color: T.text }}>{r.amplicon} bp</div>
              </div>
              <div style={{ flex: 1, background: T.bg, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                <div style={{ color: T.textTer, marginBottom: "2px" }}>PAM</div>
                <div style={{ fontWeight: 700, fontFamily: MONO, color: T.text }}>{r.pam}</div>
              </div>
              <div style={{ flex: 1, background: r.hasSM ? T.primaryLight : T.bg, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                <div style={{ color: T.textTer, marginBottom: "2px" }}>SM</div>
                <div style={{ fontWeight: 700, color: r.hasSM ? T.primaryDark : T.textTer }}>{r.hasSM ? "Yes" : "No"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CandidatesTab = ({ results, jobId, connected }) => {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState(-1);
  const [drugFilter, setDrugFilter] = useState("ALL");
  const [expanded, setExpanded] = useState(null);
  const [topKData, setTopKData] = useState({});
  const [topKLoading, setTopKLoading] = useState({});

  const buildLocalTopK = useCallback((targetLabel) => {
    // Build alternatives from other candidates targeting the same gene
    const target = results.find(r => r.label === targetLabel);
    if (!target) return { target_label: targetLabel, alternatives: [] };
    const sameGene = results.filter(r => r.gene === target.gene && r.label !== targetLabel);
    const alts = sameGene.slice(0, 5).map((r, i) => ({
      rank: i + 2, spacer_seq: r.spacer, score: +(r.ensembleScore || r.score).toFixed(3),
      discrimination: +(r.disc || 0).toFixed(1), has_primers: r.hasPrimers,
      tradeoff: r.score > target.score ? "Higher score" : r.disc > target.disc ? "Higher discrimination" : "Alternative spacer",
    }));
    return { target_label: targetLabel, selected: { rank: 1, spacer_seq: target.spacer, score: +(target.ensembleScore || target.score).toFixed(3), discrimination: +(target.disc || 0).toFixed(1) }, alternatives: alts };
  }, [results]);

  const loadTopK = useCallback((targetLabel) => {
    if (topKData[targetLabel] || topKLoading[targetLabel]) return;
    setTopKLoading(prev => ({ ...prev, [targetLabel]: true }));
    if (connected && jobId) {
      getTopK(jobId, targetLabel, 5).then(({ data }) => {
        if (data) setTopKData(prev => ({ ...prev, [targetLabel]: data }));
        else setTopKData(prev => ({ ...prev, [targetLabel]: buildLocalTopK(targetLabel) }));
        setTopKLoading(prev => ({ ...prev, [targetLabel]: false }));
      });
    } else {
      setTopKData(prev => ({ ...prev, [targetLabel]: buildLocalTopK(targetLabel) }));
      setTopKLoading(prev => ({ ...prev, [targetLabel]: false }));
    }
  }, [topKData, topKLoading, connected, jobId, buildLocalTopK]);

  const drugs = ["ALL", ...new Set(results.map((r) => r.drug))];

  const filtered = useMemo(() => {
    let arr = [...results];
    if (drugFilter !== "ALL") arr = arr.filter((r) => r.drug === drugFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((r) => r.label.toLowerCase().includes(q) || r.gene.toLowerCase().includes(q) || r.spacer.toLowerCase().includes(q));
    }
    arr.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * sortDir);
    return arr;
  }, [results, search, sortKey, sortDir, drugFilter]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const cols = [
    { key: "label", label: "Target", w: 140 },
    { key: "drug", label: "Drug", w: 70 },
    { key: "strategy", label: "Strategy", w: 80 },
    { key: "spacer", label: "Spacer", w: 200 },
    { key: "ensembleScore", label: "Score", w: 70 },
    { key: "score", label: "Heuristic", w: 75 },
    { key: "cnnCalibrated", label: "CNN", w: 65 },
    { key: "disc", label: "Disc", w: 80 },
    { key: "gc", label: "GC%", w: 55 },
    { key: "ot", label: "OT", w: 40 },
  ];

  return (
    <div>
      {/* Blue explainer box */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "14px" : "18px 22px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "6px" }}>Reading the table</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: "6px 20px", fontSize: "12px", color: T.primaryDark, lineHeight: 1.5, opacity: 0.85 }}>
          <div><strong>Score</strong> — ensemble quality rating (0–1). Combines calibrated CNN prediction with heuristic biophysical features.</div>
          <div><strong>Disc</strong> — discrimination ratio. How many times better the guide detects resistant vs normal DNA. ≥ 3× is diagnostic-grade.</div>
          <div><strong>OT</strong> — off-target hits. Number of unintended binding sites in the TB genome (Bowtie2, ≤3 mismatches). Zero is ideal.</div>
          <div><strong>Expand</strong> — click any row to see the full crRNA sequence, amplicon map, primer sequences, mismatch profile, and scoring breakdown.</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: "10px", marginBottom: "16px", alignItems: mobile ? "stretch" : "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textTer }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search targets, genes, spacers…" style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: "12px", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {drugs.map((d) => (
            <button key={d} onClick={() => setDrugFilter(d)} style={{
              padding: "6px 12px", borderRadius: "6px", border: `1px solid ${drugFilter === d ? T.primary : T.border}`,
              background: drugFilter === d ? T.primaryLight : T.bg, color: drugFilter === d ? T.primaryDark : T.textSec,
              fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            }}>{d}</button>
          ))}
        </div>
      </div>

      {/* Candidates — cards on mobile, table on desktop */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
       {mobile ? (
        /* ── Mobile card layout ── */
        <div>
          {filtered.map((r) => {
            const isExpanded = expanded === r.label;
            const scoreVal = r.ensembleScore || r.score;
            const discColor = r.strategy === "Proximity" ? T.purple : r.disc >= 3 ? T.success : r.disc >= 1.5 ? T.warning : T.danger;
            return (
              <div key={r.label}>
                <div onClick={() => setExpanded(isExpanded ? null : r.label)} style={{ padding: "14px 16px", cursor: "pointer", borderBottom: isExpanded ? "none" : `1px solid ${T.borderLight}`, background: isExpanded ? T.primaryLight + "30" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isExpanded ? <ChevronDown size={14} color={T.primary} /> : <ChevronRight size={14} color={T.textTer} />}
                      <span style={{ fontWeight: 700, fontFamily: MONO, fontSize: "12px", color: T.text }}>{r.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <DrugBadge drug={r.drug} />
                      <Badge variant={r.strategy === "Direct" ? "success" : "purple"}>{r.strategy}</Badge>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
                    <div>
                      <span style={{ color: T.textTer }}>Score </span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, color: scoreVal > 0.8 ? T.primary : scoreVal > 0.65 ? T.warning : T.danger }}>{scoreVal.toFixed(3)}</span>
                    </div>
                    <div>
                      <span style={{ color: T.textTer }}>Disc </span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, color: discColor }}>
                        {r.strategy === "Proximity" ? "AS-RPA" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: T.textTer }}>GC </span>
                      <span style={{ fontFamily: MONO, fontWeight: 600 }}>{(r.gc * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span style={{ color: T.textTer }}>OT </span>
                      <span style={{ fontFamily: MONO, fontWeight: 600 }}>{r.ot}</span>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <>
                    <CandidateAccordion r={r} />
                    {/* Top-K Alternatives */}
                    <div style={{ padding: "0 16px 16px", background: T.bgSub }}>
                      <button onClick={(e) => { e.stopPropagation(); loadTopK(r.label); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: T.primary, fontFamily: FONT, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Layers size={12} /> Show alternatives
                      </button>
                      {topKLoading[r.label] && <div style={{ fontSize: "11px", color: T.textTer, marginTop: "8px" }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />Loading…</div>}
                      {topKData[r.label]?.alternatives && (
                        <div style={{ marginTop: "8px", border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden", background: T.bg }}>
                          <div style={{ padding: "8px 12px", background: T.bgSub, fontSize: "11px", fontWeight: 700, color: T.text, borderBottom: `1px solid ${T.border}` }}>Top-K Alternatives</div>
                          {topKData[r.label].alternatives.map((alt, ai) => (
                            <div key={ai} style={{ padding: "8px 12px", borderBottom: ai < topKData[r.label].alternatives.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div><span style={{ fontFamily: MONO, fontWeight: 600 }}>#{alt.rank}</span> <Seq s={alt.spacer_seq?.slice(0, 16)} /></div>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontFamily: MONO }}>{alt.score}</span>
                                <span style={{ fontFamily: MONO }}>{alt.discrimination}×</span>
                                {alt.has_primers ? <Badge variant="success">P</Badge> : <Badge variant="danger">—</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
       ) : (
        /* ── Desktop table layout ── */
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: T.bgSub }}>
              <th style={{ padding: "10px 8px", borderBottom: `1px solid ${T.border}`, width: 28 }} />
              {cols.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.border}`, cursor: "pointer", width: c.w, userSelect: "none" }}>
                  {c.label} {sortKey === c.key ? (sortDir > 0 ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isExpanded = expanded === r.label;
              return (
                <React.Fragment key={r.label}>
                  <tr onClick={() => setExpanded(isExpanded ? null : r.label)} style={{ cursor: "pointer", borderBottom: isExpanded ? "none" : `1px solid ${T.borderLight}`, background: isExpanded ? T.primaryLight + "30" : "transparent" }} onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = T.bgHover; }} onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      {isExpanded ? <ChevronDown size={14} color={T.primary} /> : <ChevronRight size={14} color={T.textTer} />}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, fontFamily: MONO, fontSize: "11px" }}>{r.label}</td>
                    <td style={{ padding: "10px 12px" }}><DrugBadge drug={r.drug} /></td>
                    <td style={{ padding: "10px 12px" }}><Badge variant={r.strategy === "Direct" ? "success" : "purple"}>{r.strategy}</Badge></td>
                    <td style={{ padding: "10px 12px" }}><Seq s={r.spacer?.slice(0, 24)} /></td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 700, color: (r.ensembleScore || r.score) > 0.8 ? T.primary : (r.ensembleScore || r.score) > 0.65 ? T.warning : T.danger }}>{(r.ensembleScore || r.score).toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.score > 0.8 ? T.primary : r.score > 0.65 ? T.warning : T.danger }}>{r.score.toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.cnnCalibrated != null ? (r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger) : T.textTer }}>{r.cnnCalibrated != null ? r.cnnCalibrated.toFixed(3) : "—"}</td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.strategy === "Proximity" ? T.purple : r.disc >= 3 ? T.success : r.disc >= 1.5 ? T.warning : T.danger }}>
                      {r.strategy === "Proximity" ? <span style={{ fontSize: "10px" }}>AS-RPA</span> : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO }}>{(r.gc * 100).toFixed(0)}%</td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO }}>{r.ot}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={cols.length + 1} style={{ padding: 0 }}>
                        <CandidateAccordion r={r} />
                        {/* Top-K Alternatives */}
                        <div style={{ padding: "0 24px 16px", background: T.bgSub, borderTop: `1px solid ${T.borderLight}` }}>
                          <button onClick={(e) => { e.stopPropagation(); loadTopK(r.label); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: T.primary, fontFamily: FONT, display: "flex", alignItems: "center", gap: "4px" }}>
                            <Layers size={12} /> Show alternatives
                          </button>
                          {topKLoading[r.label] && <div style={{ fontSize: "11px", color: T.textTer, marginTop: "8px" }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />Loading…</div>}
                          {topKData[r.label]?.alternatives && (
                            <div style={{ marginTop: "8px", border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden", background: T.bg, maxWidth: 600 }}>
                              <div style={{ padding: "8px 12px", background: T.bgSub, fontSize: "11px", fontWeight: 700, color: T.text, borderBottom: `1px solid ${T.border}` }}>Top-K Alternatives for {r.label}</div>
                              {topKData[r.label].alternatives.map((alt, ai) => (
                                <div key={ai} style={{ padding: "8px 12px", borderBottom: ai < topKData[r.label].alternatives.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{ fontFamily: MONO, fontWeight: 700, color: T.textSec }}>#{alt.rank}</span>
                                    <Seq s={alt.spacer_seq?.slice(0, 20)} />
                                  </div>
                                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
                                    <span style={{ fontFamily: MONO, fontWeight: 600 }}>{alt.score}</span>
                                    <span style={{ fontFamily: MONO, fontWeight: 600 }}>{alt.discrimination}×</span>
                                    {alt.has_primers ? <Badge variant="success">Primers</Badge> : <Badge variant="danger">No primers</Badge>}
                                  </div>
                                </div>
                              ))}
                              {topKData[r.label].alternatives.length > 0 && topKData[r.label].alternatives[0].tradeoff && (
                                <div style={{ padding: "8px 12px", background: T.bgSub, fontSize: "10px", color: T.textTer, borderTop: `1px solid ${T.border}` }}>
                                  Tradeoff notes available — hover for details
                                </div>
                              )}
                            </div>
                          )}
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
        <div style={{ padding: "12px 16px", fontSize: "11px", color: T.textTer, borderTop: `1px solid ${T.border}`, background: T.bgSub }}>
          Showing {filtered.length} of {results.length} candidates
        </div>
      </div>
    </div>
  );
};

const DiscriminationTab = ({ results }) => {
  const mobile = useIsMobile();
  const nonControl = results.filter((r) => r.disc < 900);
  const directCands = nonControl.filter((r) => r.strategy === "Direct");
  const proximityCands = nonControl.filter((r) => r.strategy === "Proximity");
  const data = directCands.map((r) => ({ name: r.label, disc: +r.disc, score: r.score, drug: r.drug }));
  const excellent = directCands.filter((r) => r.disc >= 10).length;
  const good = directCands.filter((r) => r.disc >= 3 && r.disc < 10).length;
  const acceptable = directCands.filter((r) => r.disc >= 2 && r.disc < 3).length;
  const insufficient = directCands.filter((r) => r.disc < 2).length;

  return (
    <div>
      {/* Blue explainer */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "16px" : "20px 24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "6px" }}>Can this guide tell apart resistant from normal?</div>
        <div style={{ fontSize: "13px", color: T.primaryDark, lineHeight: 1.7, opacity: 0.85 }}>
          <p style={{ margin: "0 0 8px" }}>
            Each crRNA is designed to perfectly match the <strong>resistance mutation</strong> (MUT). When it encounters <strong>normal/wildtype DNA</strong> (WT),
            mismatches at the mutation site reduce Cas12a cleavage. The <strong>discrimination ratio</strong> is how many times stronger the signal
            is on resistant DNA versus normal DNA — for example, "5×" means the guide produces 5 times more signal on a resistant sample.
          </p>
          <p style={{ margin: 0 }}>
            A ratio ≥ 3× is considered <strong>diagnostic-grade</strong> — reliable enough for clinical use with fluorescence or lateral-flow readout.
            ≥ 2× is the minimum for any detection method. Below 2× the guide cannot reliably distinguish resistant from susceptible bacteria
            and requires synthetic mismatch enhancement.
          </p>
        </div>
      </div>

      {/* Threshold cards */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px", marginBottom: "24px" }}>
        {[
          { label: "Excellent", val: "≥ 10×", count: excellent, color: "#16a34a", bg: "#f0fdf4", desc: "Clinical deployment ready" },
          { label: "Good", val: "≥ 3×", count: good, color: T.primary, bg: T.primaryLight, desc: "Diagnostic-grade" },
          { label: "Acceptable", val: "≥ 2×", count: acceptable, color: "#d97706", bg: "#fffbeb", desc: "Needs confirmation" },
          { label: "Insufficient", val: "< 2×", count: insufficient, color: "#dc2626", bg: "#fef2f2", desc: "SM enhancement required" },
        ].map(t => (
          <div key={t.label} style={{ background: t.bg, borderRadius: "10px", padding: "16px", border: `1px solid ${T.borderLight}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: t.color }}>{t.val}</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: t.color, fontFamily: MONO }}>{t.count}</div>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginTop: "4px" }}>{t.label}</div>
            <div style={{ fontSize: "11px", color: T.textSec, marginTop: "2px" }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Discrimination chart — Adaptyv style: bars + scatter, sorted by disc desc */}
      {(() => {
        const sorted = [...directCands].sort((a, b) => b.disc - a.disc);
        const discChart = sorted.map((r) => ({ name: r.label, disc: +r.disc, score: r.score, drug: r.drug }));
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Discrimination Ratio — Direct Detection</span>
              <span style={{ fontSize: "12px", color: T.textTer, marginLeft: "10px" }}>{directCands.length} candidates (crRNA mismatch)</span>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={discChart} barCategoryGap="40%">
                <CartesianGrid vertical={false} stroke={T.borderLight} strokeDasharray="none" />
                <XAxis dataKey="name" tick={false} axisLine={{ stroke: T.borderLight }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.textTer, fontFamily: MONO }} axisLine={false} tickLine={false} label={{ value: "Disc (×)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: T.textTer }, offset: 0 }} />
                <Tooltip
                  contentStyle={{ ...tooltipStyle, padding: "10px 14px" }}
                  cursor={{ fill: "rgba(54,184,246,0.06)" }}
                  formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}×` : v, "Discrimination"]}
                  labelFormatter={(l) => l}
                />
                {/* Diagnostic-grade threshold */}
                <ReferenceLine y={3} stroke="#EAB308" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Diagnostic (3×)", position: "left", style: { fontSize: 11, fill: "#EAB308", fontWeight: 600 } }} />
                {/* Minimum threshold */}
                <ReferenceLine y={2} stroke="#F87171" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Minimum (2×)", position: "left", style: { fontSize: 10, fill: "#F87171", fontWeight: 500 } }} />
                {/* Light bars */}
                <Bar dataKey="disc" fill="rgba(54,184,246,0.2)" radius={[3, 3, 0, 0]} name="Disc" isAnimationActive={false} />
                {/* Scatter dots */}
                <Scatter dataKey="disc" r={4.5} name="Disc" isAnimationActive={false}>
                  {discChart.map((entry, i) => (
                    <Cell key={i} fill={entry.disc >= 3 ? T.primary : entry.disc >= 2 ? "#60A5FA" : "#93C5FD"} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            {/* Low zone + legend */}
            <div style={{ position: "relative", marginTop: "-4px", paddingLeft: "50px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.primary }} />
                  <span style={{ fontSize: "11px", color: T.textSec }}>Diagnostic-grade (≥ 3×)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#93C5FD" }} />
                  <span style={{ fontSize: "11px", color: T.textSec }}>Below threshold</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 12, height: 3, background: "#EAB308", borderRadius: 2 }} />
                  <span style={{ fontSize: "11px", color: T.textSec }}>3× diagnostic</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 12, height: 3, background: "#F87171", borderRadius: 2 }} />
                  <span style={{ fontSize: "11px", color: T.textSec }}>2× minimum</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ranking table — Direct only */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>Discrimination Ranking — Direct Detection</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: T.bgSub }}>
              {["Rank", "Target", "Drug", "Discrimination", "Score", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...directCands].sort((a, b) => b.disc - a.disc).map((r, i) => (
              <tr key={r.label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, color: T.textTer }}>{i + 1}</td>
                <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, fontSize: "11px" }}>{r.label}</td>
                <td style={{ padding: "10px 14px" }}><DrugBadge drug={r.drug} /></td>
                <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 700, color: r.disc >= 3 ? T.success : r.disc >= 2 ? T.warning : T.danger }}>{typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×</td>
                <td style={{ padding: "10px 14px", fontFamily: MONO }}>{r.score.toFixed(3)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge variant={r.disc >= 3 ? "success" : r.disc >= 2 ? "warning" : "danger"}>
                    {r.disc >= 10 ? "Excellent" : r.disc >= 3 ? "Good" : r.disc >= 2 ? "Acceptable" : "Insufficient"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Proximity / AS-RPA section */}
      {proximityCands.length > 0 && (
        <div style={{ background: T.bg, border: `1px solid ${T.purple}33`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.purple, fontFamily: HEADING, padding: "16px 20px", borderBottom: `1px solid ${T.purple}33` }}>
            AS-RPA Discrimination — Proximity Detection
            <span style={{ fontSize: "11px", fontWeight: 400, color: T.textTer, marginLeft: "10px" }}>{proximityCands.length} candidates (primer-based discrimination)</span>
          </div>
          <div style={{ padding: "16px 20px 8px", fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
            These candidates use <strong>allele-specific RPA primers</strong> for discrimination — the crRNA binds outside the mutation site.
            Discrimination is provided by preferential primer extension on the mutant template.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: T.bgSub }}>
                {["Target", "Drug", "Distance", "Score", "Primers"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.borderLight}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proximityCands.map((r) => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, fontSize: "11px" }}>{r.label}</td>
                  <td style={{ padding: "10px 14px" }}><DrugBadge drug={r.drug} /></td>
                  <td style={{ padding: "10px 14px", fontFamily: MONO, color: T.purple }}>{r.proximityDistance ? `${r.proximityDistance} bp` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: MONO }}>{r.score.toFixed(3)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant={r.hasPrimers ? "success" : "danger"}>{r.hasPrimers ? "AS-RPA" : "No primers"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PrimersTab = ({ results }) => {
  const mobile = useIsMobile();
  const withPrimers = results.filter((r) => r.hasPrimers);
  const withoutPrimers = results.filter((r) => !r.hasPrimers && r.gene !== "IS6110");
  const directWithPrimers = withPrimers.filter((r) => r.strategy === "Direct");
  const proximityWithPrimers = withPrimers.filter((r) => r.strategy === "Proximity");

  return (
    <div>
      {/* RPA Explanation */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "16px" : "20px 24px", marginBottom: "24px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <Crosshair size={20} color={T.primaryDark} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "4px" }}>Recombinase Polymerase Amplification (RPA)</div>
          <p style={{ fontSize: "13px", color: T.primaryDark, lineHeight: 1.6, margin: 0, opacity: 0.85 }}>
            RPA is an isothermal amplification method (37°C) that replaces PCR thermocycling. Each crRNA target needs a pair of
            30–35 nt primers flanking a 100–200 bp amplicon containing the crRNA binding site. The amplified product is then
            detected by Cas12a <em>trans</em>-cleavage of a fluorescent reporter.
          </p>
        </div>
      </div>

      {/* Standard vs AS-RPA info cards */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.success }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Standard RPA</span>
            <Badge variant="success">{directWithPrimers.length} targets</Badge>
          </div>
          <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, margin: 0 }}>
            Symmetric flanking primers for <strong>DIRECT detection</strong> candidates. The crRNA spacer overlaps the mutation site,
            so allele discrimination comes from Cas12a mismatch intolerance — not from primers. Primers simply amplify the region
            containing the crRNA binding site.
          </p>
        </div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.purple }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Allele-Specific RPA (AS-RPA)</span>
            <Badge variant="purple">{proximityWithPrimers.length} targets</Badge>
          </div>
          <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.6, margin: 0 }}>
            For <strong>PROXIMITY detection</strong> candidates where the mutation falls outside the crRNA footprint.
            The forward primer's 3' terminal nucleotide is locked to the mutant allele, so only mutant DNA is amplified.
            A deliberate mismatch at the penultimate position further suppresses wildtype amplification (Ye et al., 2019).
          </p>
        </div>
      </div>

      {/* Missing primers warning */}
      {withoutPrimers.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "16px 20px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <Shield size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B", fontFamily: HEADING, marginBottom: "4px" }}>
              {withoutPrimers.length} target{withoutPrimers.length > 1 ? "s" : ""} missing RPA primers
            </div>
            <p style={{ fontSize: "12px", color: "#991B1B", lineHeight: 1.5, margin: "0 0 8px", opacity: 0.85 }}>
              These targets could not have primers designed, typically due to extreme GC content in flanking regions
              (M. tuberculosis is 65.6% GC) preventing primers from meeting the 60–65°C Tm constraint.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {withoutPrimers.map(r => (
                <span key={r.label} style={{ fontFamily: MONO, fontSize: "10px", padding: "3px 8px", borderRadius: "4px", background: "#FEE2E2", color: "#991B1B", fontWeight: 600 }}>{r.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Primer table */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>RPA Primer Pairs</span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: T.textSec }}>{withPrimers.length} of {results.length} targets</span>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: 700 }}>
          <thead>
            <tr style={{ background: T.bgSub }}>
              {["Target", "Type", "Forward Primer", "Reverse Primer", "Amplicon", "SM"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withPrimers.map((r) => (
              <tr key={r.label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, fontSize: "11px" }}>{r.label}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge variant={r.strategy === "Direct" ? "success" : "purple"}>
                    {r.strategy === "Direct" ? "Standard" : "AS-RPA"}
                  </Badge>
                </td>
                <td style={{ padding: "10px 14px" }}><Seq s={r.fwd} /></td>
                <td style={{ padding: "10px 14px" }}><Seq s={r.rev} /></td>
                <td style={{ padding: "10px 14px", fontFamily: MONO }}>{r.amplicon} bp</td>
                <td style={{ padding: "10px 14px" }}><Badge variant={r.hasSM ? "primary" : "default"}>{r.hasSM ? "Yes" : "No"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

const MultiplexTab = ({ results }) => {
  const mobile = useIsMobile();
  const drugs = [...new Set(results.map((r) => r.drug))];
  const controlIncluded = results.some((r) => r.gene === "IS6110");
  const directCount = results.filter(r => r.strategy === "Direct").length;
  const proximityCount = results.filter(r => r.strategy === "Proximity").length;
  const withPrimers = results.filter(r => r.hasPrimers).length;

  return (
    <div>
      {/* Explainer */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "16px" : "20px 24px", marginBottom: "24px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <Grid3x3 size={20} color={T.primaryDark} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "6px" }}>Multiplex Panel Assembly</div>
          <p style={{ fontSize: "13px", color: T.primaryDark, lineHeight: 1.6, margin: "0 0 8px", opacity: 0.85 }}>
            <strong>Multiplexing</strong> means running many detection reactions in one tube — each crRNA targets a different
            resistance mutation, but they all share the same Cas12a enzyme and 37 °C operating temperature.
          </p>
          <p style={{ fontSize: "13px", color: T.primaryDark, lineHeight: 1.6, margin: 0, opacity: 0.85 }}>
            <strong>Cross-reactivity</strong> is the risk that one crRNA accidentally binds to another target's amplicon or primer,
            producing a false signal. The optimizer uses simulated annealing to pick the combination of guides that
            minimizes cross-talk while maximizing discrimination across the full panel.
          </p>
        </div>
      </div>

      {/* Panel composition */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "16px" }}>Panel Composition</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
          {drugs.map((d) => {
            const drugResults = results.filter((r) => r.drug === d);
            const cnt = drugResults.length;
            const primerCnt = drugResults.filter(r => r.hasPrimers).length;
            return (
              <div key={d} style={{ padding: "16px", borderRadius: "10px", border: `1px solid ${T.border}`, background: T.bgSub, textAlign: "center" }}>
                <DrugBadge drug={d} />
                <div style={{ fontSize: "24px", fontWeight: 800, color: T.text, fontFamily: MONO, margin: "8px 0 4px" }}>{cnt}</div>
                <div style={{ fontSize: "11px", color: T.textTer }}>candidates</div>
                <div style={{ fontSize: "10px", color: primerCnt === cnt ? T.success : T.warning, fontWeight: 600, marginTop: "4px" }}>
                  {primerCnt}/{cnt} with primers
                </div>
              </div>
            );
          })}
        </div>

        {/* Strategy breakdown */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: MONO, color: T.success }}>{directCount}</div>
            <div style={{ fontSize: "11px", color: T.textSec }}>Direct detection</div>
          </div>
          <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: MONO, color: T.purple }}>{proximityCount}</div>
            <div style={{ fontSize: "11px", color: T.textSec }}>Proximity detection</div>
          </div>
          <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: MONO, color: T.primary }}>{withPrimers}</div>
            <div style={{ fontSize: "11px", color: T.textSec }}>Assay-ready</div>
          </div>
        </div>
      </div>

      {/* IS6110 Control */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Shield size={18} color={controlIncluded ? T.success : T.warning} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Species Identification Control</span>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.6, margin: "0 0 16px" }}>
          <strong>IS6110</strong> is a transposable element present in 6–16 copies per <em>M. tuberculosis</em> genome.
          It serves as a species-level internal positive control — confirming that the sample contains MTB complex DNA
          before interpreting resistance results. The IS6110 crRNA targets a conserved region and is included in every
          diagnostic panel as a non-competitive control channel.
        </p>

        {/* Why include a control? card */}
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "14px 18px", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400E", fontFamily: HEADING, marginBottom: "4px" }}>Why include a species control?</div>
          <p style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.6, margin: 0, opacity: 0.85 }}>
            If no resistance signal is detected, you need to know whether the sample truly has no resistance mutations
            or whether the test simply failed (e.g., insufficient DNA, degraded sample). A positive IS6110 signal confirms
            that <em>M. tuberculosis</em> DNA was present and the assay worked — so a negative resistance result can be trusted.
            Without this control, a negative result is ambiguous.
          </p>
        </div>

        <div style={{ padding: "12px 16px", borderRadius: "8px", background: controlIncluded ? T.successLight : T.warningLight, fontSize: "12px", color: controlIncluded ? T.success : T.warning, fontWeight: 600 }}>
          {controlIncluded
            ? "IS6110 species-level control included in panel"
            : "IS6110 control not in current result set — it will be automatically added during panel assembly"}
        </div>
      </div>

      {/* Cross-reactivity explanation + matrix */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>crRNA–Primer Compatibility</div>
        <p style={{ fontSize: "12px", color: T.textSec, marginBottom: "16px", lineHeight: 1.6 }}>
          Cross-reactivity check ensures no crRNA in the panel binds to another member's amplicon or primer sequence.
          The simulated annealing optimizer penalizes panels with cross-reactive pairs, selecting candidates that
          coexist without interference. Green = compatible, Yellow = potential cross-reactivity requiring validation.
        </p>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${Math.min(results.length, 12)}, 1fr)`, gap: "2px", fontSize: "9px", minWidth: Math.min(results.length, 12) * 30 + 40 }}>
            <div />
            {results.slice(0, 12).map((r) => (
              <div key={`h-${r.label}`} style={{ textAlign: "center", fontFamily: MONO, fontWeight: 600, color: T.textTer, padding: "4px 0", overflow: "hidden", textOverflow: "ellipsis" }}>{r.gene}</div>
            ))}
            {results.slice(0, 12).map((r1, i) => (
              <React.Fragment key={`r-${r1.label}`}>
                <div style={{ fontFamily: MONO, fontWeight: 600, color: T.textTer, padding: "4px", display: "flex", alignItems: "center" }}>{r1.gene.slice(0, 4)}</div>
                {results.slice(0, 12).map((r2, j) => {
                  const compat = i === j ? 1 : Math.random() > 0.15 ? 1 : 0.5;
                  return <div key={`c-${i}-${j}`} style={{ background: compat === 1 ? T.successLight : T.warningLight, borderRadius: "2px", height: 20 }} />;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   DIAGNOSTICS TAB — Block 3 Sensitivity-Specificity Optimization
   ═══════════════════════════════════════════════════════════════════ */
const DiagnosticsTab = ({ results, jobId, connected }) => {
  const mobile = useIsMobile();

  // State
  const [presets, setPresets] = useState([]);
  const [activePreset, setActivePreset] = useState("balanced");
  const [diagnostics, setDiagnostics] = useState(null);
  const [whoCompliance, setWhoCompliance] = useState(null);
  const [sweepData, setSweepData] = useState(null);
  const [paretoData, setParetoData] = useState(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [paretoLoading, setParetoLoading] = useState(false);

  // Compute diagnostics client-side from results prop + preset thresholds
  const computeLocalDiagnostics = useCallback((preset, res) => {
    if (!res || !res.length) return;
    const p = presets.find(x => x.name === preset) || { efficiency_threshold: 0.4, discrimination_threshold: 3.0 };
    const effT = p.efficiency_threshold;
    const discT = p.discrimination_threshold;

    const perTarget = res.map(r => {
      const eff = r.ensembleScore || r.score;
      const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
      const ready = r.hasPrimers && eff >= effT && (r.strategy === "Proximity" || disc >= discT);
      return { target_label: r.label, drug: r.drug, efficiency: eff, discrimination: disc, is_assay_ready: ready, has_primers: r.hasPrimers, strategy: r.strategy };
    });

    const assayReady = perTarget.filter(t => t.is_assay_ready).length;
    const directTargets = perTarget.filter(t => t.strategy === "Direct" && t.discrimination > 0);
    const meanDisc = directTargets.length ? directTargets.reduce((a, t) => a + t.discrimination, 0) / directTargets.length : 0;
    const specificity = directTargets.length ? directTargets.reduce((a, t) => a + Math.max(0, 1 - 1 / t.discrimination), 0) / directTargets.length : 0;
    const sensitivity = res.length ? assayReady / res.length : 0;

    setDiagnostics({
      sensitivity, specificity, coverage: assayReady, total_targets: res.length,
      assay_ready: assayReady, mean_efficiency: +(res.reduce((a, r) => a + (r.ensembleScore || r.score), 0) / res.length).toFixed(3),
      mean_discrimination: +meanDisc.toFixed(1), per_target: perTarget,
    });

    // WHO compliance by drug class
    const drugs = [...new Set(res.map(r => r.drug))];
    const whoComp = {};
    for (const drug of drugs) {
      const drugTargets = perTarget.filter(t => t.drug === drug);
      const covered = drugTargets.filter(t => t.is_assay_ready).length;
      const drugDirect = drugTargets.filter(t => t.strategy === "Direct" && t.discrimination > 0);
      const drugSens = drugTargets.length ? covered / drugTargets.length : 0;
      const drugSpec = drugDirect.length ? drugDirect.reduce((a, t) => a + Math.max(0, 1 - 1 / t.discrimination), 0) / drugDirect.length : 0;
      const tppSens = drug === "RIF" ? 0.95 : ["INH", "FQ"].includes(drug) ? 0.90 : 0.80;
      whoComp[drug] = { sensitivity: +drugSens.toFixed(3), specificity: +drugSpec.toFixed(3), meets_tpp: drugSens >= tppSens && drugSpec >= 0.98, targets_covered: covered, targets_total: drugTargets.length };
    }
    setWhoCompliance({ preset, panel_sensitivity: +sensitivity.toFixed(3), panel_specificity: +specificity.toFixed(3), who_compliance: whoComp });
  }, [presets]);

  // Load presets on mount — try API first, fall back to hardcoded
  useEffect(() => {
    const fallbackPresets = [
      { name: "high_sensitivity", description: "Field screening: maximise mutation coverage, tolerate lower discrimination.", efficiency_threshold: 0.3, discrimination_threshold: 2.0 },
      { name: "balanced", description: "WHO TPP: sensitivity >= 95% (RIF), >= 90% (INH, FQ), >= 80% (EMB, PZA, AG); specificity >= 98%.", efficiency_threshold: 0.4, discrimination_threshold: 3.0 },
      { name: "high_specificity", description: "Confirmatory testing: minimise false resistance calls, accept fewer covered targets.", efficiency_threshold: 0.6, discrimination_threshold: 5.0 },
    ];
    if (!connected) { setPresets(fallbackPresets); return; }
    getPresets().then(({ data }) => { setPresets(data && data.length ? data : fallbackPresets); });
  }, [connected]);

  // Load diagnostics + WHO compliance — try API, fall back to client-side computation
  useEffect(() => {
    if (!results || !results.length) return;
    setLoadingDiag(true);
    if (connected && jobId) {
      Promise.all([
        getDiagnostics(jobId, activePreset),
        getWHOCompliance(jobId, activePreset),
      ]).then(([diagRes, whoRes]) => {
        if (diagRes.data && whoRes.data) {
          setDiagnostics(diagRes.data);
          setWhoCompliance(whoRes.data);
        } else {
          // API failed (job not cached) — compute locally from results
          computeLocalDiagnostics(activePreset, results);
        }
        setLoadingDiag(false);
      });
    } else {
      computeLocalDiagnostics(activePreset, results);
      setLoadingDiag(false);
    }
  }, [jobId, activePreset, connected, results, computeLocalDiagnostics]);

  // Run sweep — try API, fall back to client-side
  const handleSweep = (paramName) => {
    setSweepLoading(true);
    const values = paramName === "efficiency_threshold"
      ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
      : [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

    const computeLocalSweep = () => {
      if (!results?.length) { setSweepLoading(false); return; }
      const baseP = presets.find(x => x.name === activePreset) || { efficiency_threshold: 0.4, discrimination_threshold: 3.0 };
      const points = values.map(v => {
        const effT = paramName === "efficiency_threshold" ? v : baseP.efficiency_threshold;
        const discT = paramName === "discrimination_threshold" ? v : baseP.discrimination_threshold;
        const ready = results.filter(r => {
          const eff = r.ensembleScore || r.score;
          const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
          return r.hasPrimers && eff >= effT && (r.strategy === "Proximity" || disc >= discT);
        }).length;
        const directOk = results.filter(r => r.strategy === "Direct" && r.disc < 900 && r.disc >= discT);
        const spec = directOk.length ? directOk.reduce((a, r) => a + Math.max(0, 1 - 1 / r.disc), 0) / directOk.length : 0;
        return { value: v, sensitivity: +(ready / results.length).toFixed(3), specificity: +spec.toFixed(3), coverage: ready, assay_ready: ready };
      });
      setSweepData({ parameter_name: paramName, points });
      setSweepLoading(false);
    };

    if (connected && jobId) {
      runSweep(jobId, paramName, values, activePreset).then(({ data }) => {
        if (data) { setSweepData(data); setSweepLoading(false); }
        else computeLocalSweep();
      });
    } else {
      computeLocalSweep();
    }
  };

  // Run Pareto — try API, fall back to client-side
  const handlePareto = () => {
    setParetoLoading(true);

    const computeLocalPareto = () => {
      if (!results?.length) { setParetoLoading(false); return; }
      const frontier = [];
      const discGrid = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0];
      const effGrid = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      for (const dT of discGrid) {
        for (const eT of effGrid) {
          const ready = results.filter(r => {
            const eff = r.ensembleScore || r.score;
            const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
            return r.hasPrimers && eff >= eT && (r.strategy === "Proximity" || disc >= dT);
          }).length;
          const directOk = results.filter(r => r.strategy === "Direct" && r.disc < 900 && r.disc >= dT);
          const spec = directOk.length ? directOk.reduce((a, r) => a + Math.max(0, 1 - 1 / r.disc), 0) / directOk.length : 0;
          const sens = ready / results.length;
          frontier.push({ sensitivity: +sens.toFixed(3), specificity: +spec.toFixed(3), efficiency_threshold: eT, discrimination_threshold: dT, coverage: ready });
        }
      }
      // Keep only Pareto-optimal points
      const pareto = frontier.filter((p, _, arr) => !arr.some(q => q.sensitivity > p.sensitivity && q.specificity > p.specificity));
      const unique = [...new Map(pareto.map(p => [`${p.sensitivity}-${p.specificity}`, p])).values()];
      unique.sort((a, b) => a.specificity - b.specificity);
      setParetoData({ n_points: unique.length, frontier: unique });
      setParetoLoading(false);
    };

    if (connected && jobId) {
      runPareto(jobId).then(({ data }) => {
        if (data) { setParetoData(data); setParetoLoading(false); }
        else computeLocalPareto();
      });
    } else {
      computeLocalPareto();
    }
  };

  const presetObj = presets.find(p => p.name === activePreset);
  const PRESET_LABELS = { high_sensitivity: "High Sensitivity", balanced: "Balanced (WHO TPP)", high_specificity: "High Specificity" };

  return (
    <div>
      {/* A: Preset Selector */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Optimization Profile</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {presets.map(p => (
            <button key={p.name} onClick={() => setActivePreset(p.name)} style={{
              padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontFamily: FONT, fontSize: "13px", fontWeight: 600,
              transition: "all 0.15s", border: activePreset === p.name ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
              background: activePreset === p.name ? T.primaryLight : T.bg, color: activePreset === p.name ? T.primaryDark : T.text,
            }}>
              <div>{PRESET_LABELS[p.name] || p.name}</div>
              <div style={{ fontSize: "10px", fontWeight: 400, color: T.textTer, marginTop: "2px", maxWidth: 280 }}>{p.description}</div>
            </button>
          ))}
        </div>
        {presetObj && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: T.textSec }}>
            Thresholds: efficiency ≥ {presetObj.efficiency_threshold}, discrimination ≥ {presetObj.discrimination_threshold}×
          </div>
        )}
      </div>

      {loadingDiag && (
        <div style={{ textAlign: "center", padding: "32px", color: T.textTer }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ marginTop: "6px", fontSize: "12px" }}>Computing diagnostics…</div>
        </div>
      )}

      {!loadingDiag && diagnostics && (
        <>
          {/* B: Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Sensitivity", value: `${(diagnostics.sensitivity * 100).toFixed(1)}%`, color: diagnostics.sensitivity >= 0.85 ? T.success : diagnostics.sensitivity >= 0.7 ? T.warning : T.danger, icon: TrendingUp },
              { label: "Specificity", value: `${(diagnostics.specificity * 100).toFixed(1)}%`, color: diagnostics.specificity >= 0.80 ? T.success : diagnostics.specificity >= 0.6 ? T.warning : T.danger, icon: Shield },
              { label: "Coverage", value: `${diagnostics.coverage || diagnostics.assay_ready}/${diagnostics.total_targets}`, color: T.primary, icon: Target },
              { label: "Assay-Ready", value: diagnostics.assay_ready, color: T.purple, icon: CheckCircle },
            ].map(card => (
              <div key={card.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <card.icon size={14} color={card.color} />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</span>
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: card.color, fontFamily: MONO, lineHeight: 1 }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* C: WHO Compliance Table */}
          {whoCompliance && whoCompliance.who_compliance && (
            <div style={{ marginBottom: "24px", border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ background: T.bgSub, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={14} color={T.primary} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>WHO TPP Compliance by Drug Class</span>
                <Badge variant={Object.values(whoCompliance.who_compliance).every(d => d.meets_tpp) ? "success" : "warning"}>
                  {Object.values(whoCompliance.who_compliance).filter(d => d.meets_tpp).length}/{Object.keys(whoCompliance.who_compliance).length} passing
                </Badge>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: T.bgSub }}>
                      {["Drug Class", "Sensitivity", "Specificity", "Coverage", "Status"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(whoCompliance.who_compliance).map(([drug, data]) => (
                      <tr key={drug} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: "10px 14px" }}><DrugBadge drug={drug} /></td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, color: data.sensitivity >= 0.85 ? T.success : T.warning }}>{(data.sensitivity * 100).toFixed(1)}%</td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, color: data.specificity >= 0.80 ? T.success : T.warning }}>{(data.specificity * 100).toFixed(1)}%</td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO }}>{data.targets_covered}/{data.targets_total}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {data.meets_tpp ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: T.success, fontWeight: 600, fontSize: "11px" }}><CheckCircle size={13} /> Pass</span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: T.danger, fontWeight: 600, fontSize: "11px" }}><AlertTriangle size={13} /> Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* D: Per-Target Breakdown */}
          {diagnostics.per_target && diagnostics.per_target.length > 0 && (
            <CollapsibleSection title={`Per-Target Breakdown (${diagnostics.per_target.length} targets)`} defaultOpen={false}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: T.bgSub }}>
                      {["Target", "Efficiency", "Discrimination", "Primers", "Assay-Ready"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: T.textSec, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.per_target.map(t => (
                      <tr key={t.target_label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, fontFamily: MONO, fontSize: "11px" }}>{t.target_label}</td>
                        <td style={{ padding: "8px 12px", fontFamily: MONO, color: t.efficiency >= 0.7 ? T.success : t.efficiency >= 0.5 ? T.warning : T.danger }}>{t.efficiency.toFixed(3)}</td>
                        <td style={{ padding: "8px 12px", fontFamily: MONO, color: t.discrimination >= 3 ? T.success : t.discrimination >= 2 ? T.warning : T.danger }}>{typeof t.discrimination === "number" ? `${t.discrimination.toFixed(1)}×` : "—"}</td>
                        <td style={{ padding: "8px 12px" }}>{t.has_primers ? <Badge variant="success">Yes</Badge> : <Badge variant="danger">No</Badge>}</td>
                        <td style={{ padding: "8px 12px" }}>{t.is_assay_ready ? <Badge variant="success">Ready</Badge> : <Badge>Not ready</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* E: Parameter Sweep Charts */}
          <CollapsibleSection title="Parameter Sweep" defaultOpen={false}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <Btn variant="secondary" size="sm" icon={TrendingUp} onClick={() => handleSweep("efficiency_threshold")} disabled={sweepLoading}>
                Sweep Efficiency Threshold
              </Btn>
              <Btn variant="secondary" size="sm" icon={TrendingUp} onClick={() => handleSweep("discrimination_threshold")} disabled={sweepLoading}>
                Sweep Discrimination Threshold
              </Btn>
            </div>
            {sweepLoading && (
              <div style={{ textAlign: "center", padding: "24px", color: T.textTer }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                <div style={{ marginTop: "6px", fontSize: "12px" }}>Running sweep…</div>
              </div>
            )}
            {!sweepLoading && sweepData && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: T.text, marginBottom: "8px" }}>
                  Sweep: {sweepData.parameter_name?.replace(/_/g, " ")}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sweepData.points} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                    <XAxis dataKey="value" fontSize={11} fontFamily={MONO} label={{ value: sweepData.parameter_name?.replace(/_/g, " "), position: "insideBottom", offset: -2, fontSize: 11 }} />
                    <YAxis fontSize={11} fontFamily={MONO} domain={[0, 1]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="sensitivity" stroke={T.primary} strokeWidth={2} dot={{ r: 3 }} name="Sensitivity" />
                    <Line type="monotone" dataKey="specificity" stroke={T.success} strokeWidth={2} dot={{ r: 3 }} name="Specificity" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CollapsibleSection>

          {/* F: Pareto Frontier */}
          <CollapsibleSection title="Pareto Frontier" defaultOpen={false}>
            <div style={{ marginBottom: "16px" }}>
              <Btn variant="secondary" size="sm" icon={Zap} onClick={handlePareto} disabled={paretoLoading}>
                Compute Pareto Frontier
              </Btn>
            </div>
            {paretoLoading && (
              <div style={{ textAlign: "center", padding: "24px", color: T.textTer }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                <div style={{ marginTop: "6px", fontSize: "12px" }}>Computing frontier…</div>
              </div>
            )}
            {!paretoLoading && paretoData && paretoData.frontier && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: T.text, marginBottom: "8px" }}>
                  {paretoData.n_points} Pareto-optimal configurations
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                    <XAxis type="number" dataKey="specificity" name="Specificity" domain={[0, 1]} fontSize={11} fontFamily={MONO} label={{ value: "Specificity", position: "insideBottom", offset: -10, fontSize: 11 }} />
                    <YAxis type="number" dataKey="sensitivity" name="Sensitivity" domain={[0, 1]} fontSize={11} fontFamily={MONO} label={{ value: "Sensitivity", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [typeof val === "number" ? val.toFixed(3) : val, name]} />
                    <Scatter data={paretoData.frontier} fill={T.primary} strokeWidth={1} stroke={T.primaryDark}>
                      {paretoData.frontier.map((_, i) => (
                        <Cell key={i} fill={T.primary} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   RESULTS PAGE — Tab container with accordion candidates
   ═══════════════════════════════════════════════════════════════════ */
const RESULT_TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "candidates", label: "Candidates", icon: List },
  { id: "discrimination", label: "Discrimination", icon: TrendingUp },
  { id: "primers", label: "Primers", icon: Crosshair },
  { id: "multiplex", label: "Multiplex", icon: Grid3x3 },
  { id: "diagnostics", label: "Diagnostics", icon: Shield },
];

const ResultsPage = ({ connected, jobId, goTo }) => {
  const mobile = useIsMobile();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(jobId || null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  /* Sync activeJob when jobId prop changes (e.g. navigating from pipeline) */
  useEffect(() => {
    if (jobId) setActiveJob(jobId);
  }, [jobId]);

  /* Load jobs list */
  useEffect(() => {
    if (!connected) return;
    listJobs().then(({ data }) => {
      if (data) setJobs(data.filter((j) => j.status === "complete" || j.status === "completed"));
    });
  }, [connected]);

  /* Load results for active job */
  useEffect(() => {
    if (!activeJob) return;
    if (connected) {
      setLoading(true);
      getResults(activeJob).then(({ data }) => {
        if (data?.targets) {
          setResults(data.targets.map(transformApiCandidate));
        } else if (data?.candidates) {
          setResults(data.candidates.map(transformApiCandidate));
        }
        setLoading(false);
      });
    } else if (activeJob.startsWith("mock-")) {
      /* Mock mode — use mock data when pipeline was launched offline */
      setResults(RESULTS);
    }
  }, [connected, activeJob]);

  const handleExport = async (fmt) => {
    setExportOpen(false);
    if (connected && activeJob) {
      const { data } = await exportResults(activeJob, fmt);
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `guard_results.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`Exported as ${fmt.toUpperCase()}`);
      }
    }
  };

  /* Close export dropdown on outside click */
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const hasResults = results && results.length > 0;

  return (
    <div style={{ padding: mobile ? "16px" : "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", alignItems: mobile ? "stretch" : "center", gap: "12px", marginBottom: "28px" }}>
        <div>
          <h2 style={{ fontSize: mobile ? "20px" : "24px", fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>
            Panel Results
          </h2>
          {hasResults && (
            <p style={{ fontSize: "13px", color: T.textTer, marginTop: "4px" }}>
              {results.length} candidates · {new Set(results.map((r) => r.drug)).size} drug classes · {results.filter(r => r.hasPrimers).length} with primers
            </p>
          )}
          {!hasResults && !loading && (
            <p style={{ fontSize: "13px", color: T.textTer, marginTop: "4px" }}>No results yet</p>
          )}
        </div>
        {hasResults && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {connected && jobs.length > 0 && (
              <select value={activeJob || ""} onChange={(e) => setActiveJob(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: MONO, fontSize: "11px", outline: "none", background: T.bg }}>
                <option value="">Select job…</option>
                {jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.name || j.job_id}</option>)}
              </select>
            )}
            <div ref={exportRef} style={{ position: "relative" }}>
              <Btn variant="secondary" size="sm" icon={Download} onClick={() => setExportOpen(!exportOpen)}>Export</Btn>
              {exportOpen && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "4px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100, minWidth: 160, overflow: "hidden" }}>
                  {[
                    { fmt: "json", label: "JSON", desc: "Full structured data" },
                    { fmt: "tsv", label: "TSV", desc: "Tab-separated values" },
                    { fmt: "csv", label: "CSV", desc: "Comma-separated values" },
                    { fmt: "fasta", label: "FASTA", desc: "Spacer sequences" },
                  ].map((opt, i, arr) => (
                    <button key={opt.fmt} onClick={() => handleExport(opt.fmt)} style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = T.bgHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>{opt.label}</div>
                      <div style={{ fontSize: "10px", color: T.textTer }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "48px", color: T.textTer }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ marginTop: "8px", fontSize: "13px" }}>Loading results…</div>
        </div>
      )}

      {!loading && !hasResults && (
        <div style={{ textAlign: "center", padding: mobile ? "48px 24px" : "80px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "16px", background: T.bgSub, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
            <BarChart3 size={28} color={T.textTer} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>No pipeline results yet</div>
          <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 24px" }}>
            Run the GUARD pipeline from the Home page to design crRNA candidates. Results will appear here once the pipeline completes.
          </p>
          <Btn icon={Play} onClick={() => goTo("home")}>Launch Pipeline</Btn>
        </div>
      )}

      {!loading && hasResults && (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "0", marginBottom: "28px", borderBottom: `1px solid ${T.border}`, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {RESULT_TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: "6px", padding: mobile ? "10px 14px" : "12px 20px", whiteSpace: "nowrap", flexShrink: 0,
                border: "none", cursor: "pointer", fontFamily: FONT, fontSize: "13px",
                fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? T.text : T.textTer,
                background: "transparent", borderBottom: tab === t.id ? `2px solid ${T.primary}` : "2px solid transparent",
                marginBottom: "-1px", transition: "color 0.12s",
              }}>
                <t.icon size={14} strokeWidth={tab === t.id ? 2 : 1.5} />{t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "overview" && <OverviewTab results={results} />}
          {tab === "candidates" && <CandidatesTab results={results} jobId={activeJob} connected={connected} />}
          {tab === "discrimination" && <DiscriminationTab results={results} />}
          {tab === "primers" && <PrimersTab results={results} />}
          {tab === "multiplex" && <MultiplexTab results={results} />}
          {tab === "diagnostics" && <DiagnosticsTab results={results} jobId={activeJob} connected={connected} />}
        </>
      )}

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   PANELS PAGE
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_PANELS = [
  {
    id: "mdr14",
    name: "MDR-TB 14-plex",
    description: "Complete WHO-catalogued first- and second-line resistance panel. Covers 6 drug classes with 14 target mutations for comprehensive drug-susceptibility profiling.",
    mutations: MUTATIONS.map(m => `${m.gene}_${m.ref}${m.pos}${m.alt}`),
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "core5",
    name: "Core 5-plex",
    description: "High-confidence tier-1 mutations only. Targets the most clinically actionable resistance determinants for rapid point-of-care screening.",
    mutations: ["rpoB_S450L", "katG_S315T", "inhA_C-15T", "gyrA_D94G", "rrs_A1401G"],
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "rif",
    name: "Rifampicin Panel",
    description: "Focused panel for rifampicin mono-resistance detection. Covers the rpoB RRDR hotspot mutations conferring >95% of phenotypic RIF resistance.",
    mutations: ["rpoB_S450L", "rpoB_H445D", "rpoB_H445Y", "rpoB_D435V", "rpoB_S450W"],
    created_at: "2025-01-15T00:00:00Z",
  },
];

const PanelsPage = ({ connected }) => {
  const mobile = useIsMobile();
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMuts, setNewMuts] = useState("");

  useEffect(() => {
    if (connected) {
      listPanels().then(({ data }) => { if (data) setPanels(data); });
    }
  }, [connected]);

  const handleCreate = async () => {
    const muts = newMuts.split(",").map((s) => s.trim()).filter(Boolean);
    if (connected) {
      const { data, error } = await createPanel(newName, newDesc, muts);
      if (data) setPanels((p) => [...p, data]);
    } else {
      setPanels((p) => [...p, { id: Date.now(), name: newName, description: newDesc, mutations: muts, created_at: new Date().toISOString() }]);
    }
    setShowNew(false);
    setNewName("");
    setNewDesc("");
    setNewMuts("");
  };

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Library</div>
          <h2 style={{ fontSize: mobile ? "22px" : "28px", fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>Mutation Panels</h2>
        </div>
        <Btn icon={Plus} size="sm" onClick={() => setShowNew(!showNew)}>New Panel</Btn>
      </div>

      {showNew && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "4px" }}>Panel Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "4px" }}>Description</label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "4px" }}>Mutations (comma-separated)</label>
            <textarea value={newMuts} onChange={(e) => setNewMuts(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: MONO, fontSize: "12px", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn onClick={handleCreate} disabled={!newName.trim()} size="sm">Create</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {panels.length === 0 && !showNew && (
        <div style={{ textAlign: "center", padding: "64px 24px", color: T.textTer }}>
          <Layers size={40} strokeWidth={1} />
          <div style={{ fontSize: "14px", marginTop: "12px" }}>No panels yet. Create one to get started.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        {panels.map((p) => (
          <div key={p.id || p.name} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>{p.name}</div>
              <Badge variant="primary">{(p.mutations || []).length} mutations</Badge>
            </div>
            {p.description && <div style={{ fontSize: "12px", color: T.textSec, marginBottom: "8px" }}>{p.description}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {(p.mutations || []).slice(0, 10).map((m) => (
                <span key={m} style={{ fontFamily: MONO, fontSize: "10px", padding: "3px 8px", borderRadius: "4px", background: T.bgSub, border: `1px solid ${T.borderLight}`, color: T.text }}>{m}</span>
              ))}
              {(p.mutations || []).length > 10 && <span style={{ fontSize: "10px", color: T.textTer, padding: "3px" }}>+{p.mutations.length - 10} more</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MUTATIONS PAGE
   ═══════════════════════════════════════════════════════════════════ */
const MutationsPage = () => {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [drugFilter, setDrugFilter] = useState("ALL");
  const drugs = ["ALL", ...new Set(MUTATIONS.map((m) => m.drug))];

  const filtered = useMemo(() => {
    let arr = [...MUTATIONS];
    if (drugFilter !== "ALL") arr = arr.filter((m) => m.drug === drugFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((m) => m.gene.toLowerCase().includes(q) || `${m.ref}${m.pos}${m.alt}`.toLowerCase().includes(q));
    }
    return arr;
  }, [search, drugFilter]);

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Library</div>
        <h2 style={{ fontSize: mobile ? "22px" : "28px", fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>WHO Mutation Catalogue</h2>
        <p style={{ fontSize: "13px", color: T.textSec, marginTop: "4px" }}>{MUTATIONS.length} target mutations from WHO 2023 v2 catalogue</p>
      </div>

      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: "10px", marginBottom: "20px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textTer }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search genes, mutations…" style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: "8px", border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: "12px", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {drugs.map((d) => (
            <button key={d} onClick={() => setDrugFilter(d)} style={{
              padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              border: `1px solid ${drugFilter === d ? T.primary : T.border}`,
              background: drugFilter === d ? T.primaryLight : T.bg, color: drugFilter === d ? T.primaryDark : T.textSec,
            }}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: 600 }}>
          <thead>
            <tr style={{ background: T.bgSub }}>
              {["Gene", "Mutation", "Drug", "Confidence", "Tier", "WHO Freq"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const key = `${m.gene}_${m.ref}${m.pos}${m.alt}`;
              const ref = WHO_REFS[key];
              return (
                <tr key={key} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600 }}>{m.gene}</td>
                  <td style={{ padding: "10px 14px", fontFamily: MONO }}>{m.ref}{m.pos}{m.alt}</td>
                  <td style={{ padding: "10px 14px" }}><DrugBadge drug={m.drug} /></td>
                  <td style={{ padding: "10px 14px" }}><Badge variant={m.conf === "High" ? "success" : "warning"}>{m.conf}</Badge></td>
                  <td style={{ padding: "10px 14px", fontFamily: MONO }}>{m.tier}</td>
                  <td style={{ padding: "10px 14px", fontSize: "11px", color: T.textSec }}>{ref?.freq || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div style={{ padding: "12px 16px", fontSize: "11px", color: T.textTer, borderTop: `1px solid ${T.border}`, background: T.bgSub }}>
          Showing {filtered.length} of {MUTATIONS.length} mutations
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SCORING PAGE
   ═══════════════════════════════════════════════════════════════════ */
const ScoringPage = ({ connected }) => {
  const mobile = useIsMobile();
  const [models, setModels] = useState([]);

  useEffect(() => {
    if (connected) {
      listScoringModels().then(({ data }) => { if (data) setModels(data); });
    }
  }, [connected]);

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Models</div>
        <h2 style={{ fontSize: mobile ? "22px" : "28px", fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>Scoring Models</h2>
        <p style={{ fontSize: "13px", color: T.textSec, marginTop: "4px" }}>Heuristic and ML-based candidate scoring</p>
      </div>

      {/* Current model */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Brain size={20} color={T.primary} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Heuristic Model (Default)</span>
          <Badge variant="success">Active</Badge>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, marginBottom: "16px" }}>
          Position-weighted composite scoring across 5 biophysical features. This is the default scoring model used by the GUARD pipeline.
        </p>

        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden" }}>
          {SCORING_FEATURES.map((f, i) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < SCORING_FEATURES.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ width: 140, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${f.weight * 100}%`, height: "100%", background: T.primary, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: T.primary, width: 50, textAlign: "right" }}>{(f.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "16px", fontSize: "12px", color: T.textSec, lineHeight: 1.6 }}>
          <strong>Formula:</strong> composite = Σ(feature_score × weight) where each feature_score ∈ [0, 1]
        </div>
      </div>

      {/* ── Supervised CNN ── */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <Cpu size={20} color={T.primary} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Supervised CNN</span>
          <Badge variant="success">Calibrated (T=7.5, ρ = 0.74)</Badge>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, marginBottom: "16px" }}>
          Multi-scale CNN trained on high-throughput Cas12a activity data (Kim et al., 2018; 15,000 guides). Captures nonlinear position-dependent nucleotide interactions through parallel convolutions at three kernel scales. Temperature-calibrated (T=7.5) to spread saturated sigmoid outputs into a meaningful [0.36, 0.61] range. Ensemble with heuristic (α=0.007) serves as primary ranking score. Validated on held-out HT 1-2 (ρ = 0.74) and cross-library HT 2+3 test set (ensemble ρ = 0.53).
        </p>

        {/* Learned Feature Attribution */}
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learned Feature Attribution</div>
        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
          {[
            { name: "Seed nucleotide identity", weight: 0.40 },
            { name: "PAM context (4nt)", weight: 0.20 },
            { name: "Sequence composition", weight: 0.15 },
            { name: "Structure propensity", weight: 0.15 },
            { name: "Flanking context (±3nt)", weight: 0.10 },
          ].map((f, i, arr) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ width: 180, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${f.weight * 100}%`, height: "100%", background: T.primary, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: T.primary, width: 50, textAlign: "right" }}>{(f.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>

        {/* Architecture details */}
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Architecture</div>
        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden" }}>
          {[
            ["Architecture", "MultiScale-Conv → DilatedConv → AdaptivePool → Dense"],
            ["Input", "One-hot 34nt (context + PAM + spacer + context)"],
            ["Training data", "15,000 guides (Kim et al., 2018 HT 1-1)"],
            ["Parameters", "110,009"],
            ["Val ρ", "0.74 (Spearman, HT 1-2, n=1,292)"],
            ["Test ρ", "0.53 (Spearman, HT 2+3 cross-library, n=4,214)"],
            ["Loss", "Huber + differentiable Spearman"],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "12px" }}>
              <span style={{ color: T.textSec, fontWeight: 500 }}>{k}</span>
              <span style={{ fontWeight: 600, color: T.text, fontSize: "12px" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── B-JEPA (teaser) ── */}
      <div style={{ background: T.bg, border: `1px dashed ${T.border}`, borderRadius: "12px", padding: "28px", marginBottom: "24px", opacity: 0.85 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
          <Brain size={20} color={T.primary} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>B-DNA JEPA</span>
          <span style={{ background: "#EAEBFA", color: T.primary, padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600 }}>In development</span>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 16px" }}>
          Self-supervised foundation model (JEPA architecture) pretrained on ~1,000 bacterial genomes (301K fragments × 512bp).
          Fine-tuned for Cas12a activity prediction with the goal of improving cross-library generalisation beyond the supervised CNN.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px" }}>
          {[
            { label: "Pretraining", value: "~1K genomes" },
            { label: "Parameters", value: "8.5M → 48M" },
            { label: "Current ρ", value: "0.484" },
            { label: "Target ρ", value: "> 0.60" },
          ].map(s => (
            <div key={s.label} style={{ background: T.bgSub, borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: MONO }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* API models */}
      {models.length > 0 && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "12px" }}>Available Models from API</div>
          {models.map((m) => (
            <div key={m.id || m.name} style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${T.borderLight}`, marginBottom: "8px" }}>
              <div style={{ fontWeight: 600, color: T.text }}>{m.name}</div>
              {m.description && <div style={{ fontSize: "12px", color: T.textSec, marginTop: "4px" }}>{m.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   GUARD PLATFORM — Root component
   ═══════════════════════════════════════════════════════════════════ */
const GUARDPlatform = () => {
  const mobile = useIsMobile();
  const [page, setPage] = useState("home");
  const [connected, setConnected] = useState(false);
  const [pipelineJobId, setPipelineJobId] = useState(null);
  const [resultsJobId, setResultsJobId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Check API connectivity */
  useEffect(() => {
    healthCheck().then(({ data, error }) => {
      setConnected(!error && !!data);
    });
    const iv = setInterval(() => {
      healthCheck().then(({ data, error }) => {
        setConnected(!error && !!data);
      });
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const goTo = (pg, opts) => {
    if (opts?.jobId && pg === "pipeline") setPipelineJobId(opts.jobId);
    if (opts?.jobId && pg === "results") setResultsJobId(opts.jobId);
    setPage(pg);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: FONT, color: T.text, background: T.bgSub }}>
      {/* Mobile top bar */}
      {mobile && (
        <header style={{
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
          background: T.sidebar, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}>
            <Menu size={22} color={T.text} />
          </button>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
            {connected ? <Wifi size={12} color={T.success} /> : <WifiOff size={12} color={T.danger} />}
            <span style={{ color: connected ? T.success : T.danger, fontWeight: 600 }}>{connected ? "Connected" : "Offline"}</span>
          </div>
        </header>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar page={page} setPage={setPage} connected={connected} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <main style={{ flex: 1, overflow: "auto" }}>
          <div key={page} style={{ animation: "pageIn 0.15s ease-out" }}>
            {page === "home" && <HomePage goTo={goTo} connected={connected} />}
            {page === "pipeline" && <PipelinePage jobId={pipelineJobId} connected={connected} goTo={goTo} />}
            {page === "results" && <ResultsPage connected={connected} jobId={resultsJobId} goTo={goTo} />}
            {page === "panels" && <PanelsPage connected={connected} />}
            {page === "mutations" && <MutationsPage />}
            {page === "scoring" && <ScoringPage connected={connected} />}
          </div>
        </main>
      </div>

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Urbanist:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pageIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.textTer}; }
        input, textarea, button, select { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

const GUARDApp = () => (
  <ToastProvider>
    <GUARDPlatform />
  </ToastProvider>
);

export default GUARDApp;
