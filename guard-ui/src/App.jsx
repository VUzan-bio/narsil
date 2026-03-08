import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Activity, BarChart3, BookOpen, Check, ChevronDown, ChevronRight, Clock, Copy,
  Database, Download, ExternalLink, Eye, FileText, Filter, FlaskConical,
  Folder, GitBranch, Grid3x3, Layers, List, Loader2,
  Lock, Menu, Package, PanelLeft, PanelLeftClose, Play, Plus, RefreshCw, Search, Settings, Target,
  TrendingUp, X, Zap, Shield, Crosshair, Brain, Cpu, Wifi, WifiOff,
  AlertTriangle, CheckCircle, Info, Map,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ComposedChart, ReferenceLine,
  LineChart, Line, Area, AreaChart,
} from "recharts";
import {
  healthCheck, submitRun, getJob, getResults, exportResults,
  getFigureUrl, listPanels, createPanel, listJobs, connectJobWS,
  listScoringModels, getPresets, getDiagnostics, getWHOCompliance,
  getTopK, runSweep, runPareto,
  compareScorers, getThermoProfile, getThermoStandalone, getAblation,
} from "./api";

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Adaptyv Foundry–inspired
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  bg: "#FFFFFF", bgSub: "#F7F9FC", bgHover: "#EEF2F7",
  border: "#E3E8EF", borderLight: "#F0F3F7",
  text: "#111827", textSec: "#6B7280", textTer: "#9CA3AF",
  primary: "#4F46E5", primaryLight: "#EEF2FF", primaryDark: "#312E81", primarySub: "#E0E7FF",
  success: "#16A34A", successLight: "#DCFCE7",
  warning: "#D97706", warningLight: "#FEF3C7",
  danger: "#DC2626", dangerLight: "#FEE2E2",
  purple: "#7C3AED", purpleLight: "#F3E8FF",
  sidebar: "#FAFBFD", sidebarActive: "#EEF2FF", sidebarHover: "#F3F4F6", sidebarText: "#374151",
};
const FONT = "'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const HEADING = "'Urbanist', sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const NUC = { A: "#16A34A", T: "#DC2626", G: "#D97706", C: "#6366F1" };
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
  const heuristic = +(0.6 + Math.random() * 0.35).toFixed(3);
  const cnnRaw = +(0.5 + Math.random() * 0.4).toFixed(4);
  const cnnCal = +(cnnRaw * 0.8 + 0.18).toFixed(4);
  const ensemble = +(heuristic * 0.35 + cnnCal * 0.65).toFixed(4);
  const discRatio = +(1.5 + Math.random() * 8).toFixed(1);
  const mutAct = +(0.5 + Math.random() * 0.45).toFixed(2);
  const wtAct = +(1.0 / Math.max(discRatio, 0.01)).toFixed(4);
  return {
    ...m, label: refKey,
    strategy: i % 3 === 0 ? "Direct" : i % 3 === 1 ? "Proximity" : "Direct",
    spacer, wtSpacer, pam: ["TTTV", "TTTG", "TTTA", "TTTC"][i % 4],
    score: heuristic, cnnScore: cnnRaw, cnnCalibrated: cnnCal, ensembleScore: ensemble,
    mlScores: [{ model_name: "guard_net", predicted_efficiency: cnnRaw }],
    disc: discRatio,
    discrimination: { model_name: "learned_lightgbm", ratio: discRatio, mut_activity: mutAct, wt_activity: wtAct },
    gc: +(0.35 + Math.random() * 0.3).toFixed(2),
    ot: Math.floor(Math.random() * 3), hasPrimers: i < 12, hasSM: i % 4 === 1, proximityDistance: i % 3 === 1 ? 15 + Math.floor(Math.random() * 30) : null,
    fwd: i < 12 ? seq(30) : null, rev: i < 12 ? seq(30) : null,
    amplicon: i < 12 ? 120 + Math.floor(Math.random() * 60) : null,
    mutActivity: mutAct,
    wtActivity: wtAct,
    refs: WHO_REFS[refKey] || null,
  };
});
RESULTS.push({
  gene: "IS6110", ref: "N", pos: 0, alt: "N", drug: "OTHER", drugFull: "Other", conf: "N/A", tier: 0,
  label: "IS6110_NON", strategy: "Direct", spacer: "AATGTCGCCGCGATCGAGCG", wtSpacer: "AATGTCGCCGCGATCGAGCG",
  pam: "TTTG", score: 0.95, cnnScore: 0.88, cnnCalibrated: 0.91, ensembleScore: 0.924,
  mlScores: [{ model_name: "guard_net", predicted_efficiency: 0.88 }],
  disc: 999, discrimination: { model_name: "learned_lightgbm", ratio: 999, mut_activity: 0.95, wt_activity: 0.001 },
  gc: 0.65, ot: 0, hasPrimers: true, hasSM: false,
  fwd: seq(30), rev: seq(30), amplicon: 142, mutActivity: 0.95, wtActivity: 0.001,
  refs: { who: "N/A", catalogue: "Species control", pmid: "30593580", cryptic: null, freq: "6–16 copies/genome" },
});

const MODULES = [
  { id: "M1", name: "Target Resolution", desc: "WHO mutations → genomic coordinates", icon: Target, execDesc: "Resolving WHO-catalogued resistance mutations to genomic coordinates on H37Rv" },
  { id: "M2", name: "PAM Scanning", desc: "Multi-PAM, multi-length spacer search", icon: Search, execDesc: "Scanning both strands for Cas12a-compatible PAM sites (TTTV canonical + relaxed)" },
  { id: "M3", name: "Candidate Filtering", desc: "Biophysical constraints (GC, homopolymer, Tm)", icon: Filter, execDesc: "Applying biophysical filters: GC content, homopolymer runs, self-complementarity" },
  { id: "M4", name: "Off-Target Screening", desc: "Bowtie2 alignment + heuristic fallback", icon: Shield, execDesc: "Bowtie2 alignment against H37Rv genome, flagging off-target binding sites" },
  { id: "M5", name: "Heuristic Scoring", desc: "Position-weighted composite scoring", icon: BarChart3, execDesc: "Position-weighted composite scoring across 5 biophysical features" },
  { id: "M5.5", name: "Mismatch Pairs", desc: "WT/MUT spacer pair generation", icon: GitBranch, execDesc: "Generating wildtype spacers for each mutant candidate (MUT/WT discrimination pairs)" },
  { id: "M6", name: "SM Enhancement", desc: "Synthetic mismatch for 10–100× discrimination", icon: Zap, execDesc: "Engineering synthetic mismatches at seed positions 2–6 for enhanced discrimination" },
  { id: "M6.5", name: "Discrimination", desc: "MUT/WT activity ratio quantification", icon: TrendingUp, execDesc: "Quantifying MUT/WT activity ratios for diagnostic-grade discrimination assessment" },
  { id: "M7", name: "Multiplex Optimization", desc: "Simulated annealing panel selection", icon: Grid3x3, execDesc: "Simulated annealing over candidate combinations for optimal panel selection" },
  { id: "M8", name: "RPA Primer Design", desc: "Standard + allele-specific RPA", icon: Crosshair, execDesc: "Designing RPA primers (25–38 nt, Tm 57–72 °C) with dimer checking" },
  { id: "M8.5", name: "Co-Selection", desc: "crRNA–primer compatibility check", icon: Check, execDesc: "Validating crRNA–primer compatibility and amplicon overlap constraints" },
  { id: "M9", name: "Panel Assembly", desc: "MultiplexPanel + IS6110 control", icon: Package, execDesc: "Assembling final panel: crRNA sequences, primer pairs, amplicon maps, discrimination predictions" },
  { id: "M10", name: "Export", desc: "JSON, TSV, FASTA structured output", icon: Download, execDesc: "Exporting structured output: JSON, TSV, FASTA" },
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
  { id: "strohkendl2024", authors: "Strohkendl I, Saha A, Moy C, et al.", year: 2024, title: "Cas12a domain flexibility guides R-loop formation and forces RuvC resetting", journal: "Molecular Cell", doi: "10.1016/j.molcel.2024.05.032", category: "CRISPR Biology" },
  // R-Loop Thermodynamics
  { id: "zhang2024", authors: "Zhang J, Guan X, Moon J, et al.", year: 2024, title: "Interpreting CRISPR-Cas12a enzyme kinetics through free energy change of nucleic acids", journal: "Nucleic Acids Research", doi: "10.1093/nar/gkae1124", category: "R-Loop Thermodynamics" },
  { id: "aris2025", authors: "Aris KDP, Cofsky JC, Shi H, et al.", year: 2025, title: "Dynamic basis of supercoiling-dependent DNA interrogation by Cas12a via R-loop intermediates", journal: "Nature Communications", doi: "10.1038/s41467-025-57703-y", category: "R-Loop Thermodynamics" },
  // Guide Activity Prediction (ML)
  { id: "kim2018", authors: "Kim HK, Min S, Song M, et al.", year: 2018, title: "Deep learning improves prediction of CRISPR-Cpf1 guide RNA activity", journal: "Nature Biotechnology", doi: "10.1038/nbt.4061", pmid: "29431741", category: "Guide Activity Prediction" },
  { id: "huang2024", authors: "Huang B, Mu K, Li G, et al.", year: 2024, title: "Deep learning enhancing guide RNA design for CRISPR/Cas12a-based diagnostics", journal: "iMeta", doi: "10.1002/imt2.214", category: "Guide Activity Prediction" },
  { id: "chen2022rnafm", authors: "Chen J, Hu Z, Sun S, et al.", year: 2022, title: "Interpretable RNA Foundation Model from Unannotated Data for Highly Accurate RNA Structure and Function Predictions", journal: "arXiv:2204.00300", doi: null, url: "https://arxiv.org/abs/2204.00300", category: "Guide Activity Prediction" },
  { id: "blondel2020", authors: "Blondel M, Teboul O, Berthet Q, Djolonga J", year: 2020, title: "Fast Differentiable Sorting and Ranking", journal: "ICML 2020", doi: null, url: "https://arxiv.org/abs/2002.08871", category: "Guide Activity Prediction" },
  { id: "yao2025", authors: "Yao Z, Li W, He K, et al.", year: 2025, title: "Facilitating crRNA design by integrating DNA interaction features of CRISPR-Cas12a system", journal: "Advanced Science", doi: "10.1002/advs.202501269", category: "Guide Activity Prediction" },
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
      <span key={i} style={{ color: c === "A" ? "#16A34A" : c === "T" ? "#DC2626" : c === "G" ? "#D97706" : "#6366F1", fontWeight: 500 }}>{c}</span>
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

/* Gaussian KDE for smooth density estimation */
function gaussianKDE(data, bandwidth = 0.05, nPoints = 100) {
  const min = 0, max = 1;
  const step = (max - min) / nPoints;
  const points = [];
  for (let x = min; x <= max; x += step) {
    let density = 0;
    for (const d of data) {
      const z = (x - d) / bandwidth;
      density += Math.exp(-0.5 * z * z) / (bandwidth * Math.sqrt(2 * Math.PI));
    }
    density /= data.length;
    points.push({ x: parseFloat(x.toFixed(3)), density: parseFloat(density.toFixed(4)) });
  }
  return points;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - 1));
}

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
      discrimination: sc.discrimination || null,
      cnnScore: sc.cnn_score ?? null,
      cnnCalibrated: sc.cnn_calibrated ?? null,
      ensembleScore: sc.ensemble_score ?? null,
      mlScores: sc.ml_scores || [],
      ot: 0, hasPrimers: c.has_primers, hasSM: c.has_sm || false,
      smSpacer: c.sm_enhanced_spacer || null, smPosition: c.sm_position || null,
      smOriginalBase: c.sm_original_base || null, smReplacementBase: c.sm_replacement_base || null,
      fwd: c.fwd_primer, rev: c.rev_primer, amplicon: c.amplicon_length,
      proximityDistance: c.proximity_distance || null,
      mutActivity: sc.discrimination?.mut_activity || 0, wtActivity: sc.discrimination?.wt_activity || 0,
      asrpaDiscrimination: c.asrpa_discrimination || null,
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
    discrimination: c.discrimination || null,
    cnnScore: c.cnn_score ?? null,
    cnnCalibrated: c.cnn_calibrated ?? null,
    ensembleScore: c.ensemble_score ?? null,
    mlScores: c.ml_scores || [],
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
            { l: r.ensembleScore != null ? "Ensemble" : "Score", v: (r.ensembleScore || r.score).toFixed(3), c: (r.ensembleScore || r.score) > 0.8 ? T.primary : (r.ensembleScore || r.score) > 0.65 ? T.warning : T.danger },
            ...(r.ensembleScore != null ? [{ l: "Heuristic", v: r.score.toFixed(3), c: T.textSec }] : []),
            ...(r.cnnCalibrated != null ? [{ l: r.mlScores?.some(m => (m.model_name || m.modelName) === "guard_net") ? "GUARD-Net" : "CNN (cal)", v: r.cnnCalibrated.toFixed(3), c: r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger }] : []),
            { l: r.strategy === "Proximity" ? "Disc (AS-RPA)" : "Discrimination", v: r.strategy === "Proximity" ? (r.asrpaDiscrimination ? (r.asrpaDiscrimination.block_class === "none" ? "1× (no mismatch)" : `${r.asrpaDiscrimination.disc_ratio >= 100 ? "≥100" : r.asrpaDiscrimination.disc_ratio.toFixed(0)}× ${r.asrpaDiscrimination.terminal_mismatch}`) : "AS-RPA") : r.gene === "IS6110" ? "N/A (control)" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`, c: r.strategy === "Proximity" ? (r.asrpaDiscrimination?.block_class === "none" ? T.danger : T.purple) : r.gene === "IS6110" ? T.textTer : discColor },
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
            {/* Shared amplicon warning for same-codon targets */}
            {(() => {
              const codonGroups = { "rpoB_H445": ["rpoB_H445D", "rpoB_H445Y"], "rpoB_S450": ["rpoB_S450L", "rpoB_S450W"] };
              for (const [, group] of Object.entries(codonGroups)) {
                if (group.includes(r.label)) {
                  const siblings = group.filter(l => l !== r.label);
                  return (
                    <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", fontSize: "11px", color: T.textSec, lineHeight: 1.6 }}>
                      <strong style={{ color: T.warning }}>Shared amplicon:</strong> This target shares the same amplicon region with {siblings.join(", ")}. In a single-pot assay both mutations produce a positive drug-class signal, but the specific amino acid change cannot be resolved without additional crRNA reporters.
                    </div>
                  );
                }
              }
              return null;
            })()}
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
    { id: "results", label: "Results", icon: BarChart3 },
  ]},
  { section: "Library", items: [
    { id: "panels", label: "Panels", icon: Layers },
    { id: "mutations", label: "Mutations", icon: Database },
  ]},
  { section: "Models", items: [
    { id: "scoring", label: "Scoring", icon: Brain },
    { id: "research", label: "Research", icon: FlaskConical },
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
      {/* Logo + Toggle */}
      <div style={{ padding: isCollapsed ? "16px 0" : "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: "8px" }}>
        {!isCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src="/guard-wordmark.png" alt="GUARD" style={{ height: "48px", objectFit: "contain" }} />
            {!connected && (
              <span style={{ fontSize: "10px", color: T.danger, fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                <WifiOff size={10} /> API disconnected
              </span>
            )}
          </div>
        )}
        {isCollapsed && (
          <button onClick={() => setCollapsed(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", borderRadius: "6px" }} title="Expand sidebar">
            <PanelLeft size={18} color={T.textSec} />
          </button>
        )}
        {mobile ? (
          <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", marginLeft: "auto" }}><X size={20} color={T.textSec} /></button>
        ) : !isCollapsed && (
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", borderRadius: "6px" }} title="Collapse sidebar">
            <PanelLeftClose size={18} color={T.textSec} />
          </button>
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
          v2.0
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
  const [scorer, setScorer] = useState("guard_net"); // "heuristic" | "guard_net"
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState(null);

  /* ── Inline pipeline execution state ── */
  const [pipeJobId, setPipeJobId] = useState(null);
  const [pipeStep, setPipeStep] = useState(0);
  const [pipeDone, setPipeDone] = useState(false);
  const [pipeStats, setPipeStats] = useState([]);
  const [pipeElapsed, setPipeElapsed] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [archOpen, setArchOpen] = useState(false);
  const pipeStartRef = useRef(Date.now());
  const pipeTimerRef = useRef(null);
  const pipeWsRef = useRef(null);
  const pipePollRef = useRef(null);
  const prevPipeStep = useRef(-1);

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
    const overrides = scorer !== "heuristic" ? { scorer } : {};
    if (connected) {
      const { data, error: err } = await submitRun(runName, apiMode, muts, overrides);
      if (err) { setError(err); setLaunching(false); return; }
      startInlinePipeline(data.job_id);
    } else {
      startInlinePipeline("mock-" + scorer + "-" + Date.now());
    }
  };

  /* ── Inline pipeline management ── */
  const startInlinePipeline = (jobId) => {
    setPipeJobId(jobId);
    setPipeStep(0);
    setPipeDone(false);
    setPipeStats([]);
    setPipeElapsed(0);
    prevPipeStep.current = -1;
    pipeStartRef.current = Date.now();
    setLaunching(false);

    // Elapsed timer
    pipeTimerRef.current = setInterval(() => {
      setPipeElapsed((Date.now() - pipeStartRef.current) / 1000);
    }, 100);

    if (connected) {
      try {
        const ws = connectJobWS(jobId,
          (msg) => {
            if (msg.current_module) {
              const idx = MODULE_NAME_MAP[msg.current_module];
              if (idx !== undefined) setPipeStep(idx);
            }
            if (msg.status === "complete" || msg.status === "completed") {
              finishInlinePipeline(jobId);
            }
          },
          () => { startInlinePolling(jobId); }
        );
        pipeWsRef.current = ws;
      } catch {
        startInlinePolling(jobId);
      }
    } else {
      // Mock simulation
      let i = 0;
      const iv = setInterval(() => {
        if (i >= MODULES.length) { clearInterval(iv); finishInlinePipeline(jobId); return; }
        setPipeStep(i);
        i++;
      }, 800);
    }
  };

  const startInlinePolling = (jobId) => {
    pipePollRef.current = setInterval(async () => {
      const { data } = await getJob(jobId);
      if (data) {
        const idx = MODULE_NAME_MAP[data.current_module] || 0;
        setPipeStep(idx);
        if (data.status === "complete" || data.status === "completed") {
          finishInlinePipeline(jobId);
          clearInterval(pipePollRef.current);
        }
      }
    }, 2000);
  };

  const finishInlinePipeline = (jobId) => {
    setPipeDone(true);
    if (pipeTimerRef.current) clearInterval(pipeTimerRef.current);

    if (connected) {
      getResults(jobId).then(({ data }) => {
        if (data?.module_stats?.length) setPipeStats(data.module_stats);
      });
    } else {
      setPipeStats([
        { module_id: "M1", detail: "14 mutations resolved on H37Rv", candidates_out: 14, duration_ms: 1 },
        { module_id: "M2", detail: "34,364 positions scanned, 1,837 PAM sites, 238 candidates", candidates_out: 238, duration_ms: 74 },
        { module_id: "M3", detail: "238 → 213 (25 removed: GC, homopolymer, Tm)", candidates_out: 213, duration_ms: 87 },
        { module_id: "M4", detail: "213 → 183 (30 off-target hits, Bowtie2)", candidates_out: 183, duration_ms: 846 },
        { module_id: "M5", detail: "213 scored (range 0.325–0.831)", candidates_out: 213, duration_ms: 4 },
        { module_id: "M5.5", detail: "213 MUT/WT spacer pairs generated", candidates_out: 213, duration_ms: 3 },
        { module_id: "M6", detail: "54 evaluated, 42 enhanced (seed pos 2–6)", candidates_out: 42, duration_ms: 34 },
        { module_id: "M6.5", detail: "54 above 2× threshold (48 diagnostic-grade)", candidates_out: 54, duration_ms: 2 },
        { module_id: "M7", detail: "14 selected (simulated annealing, 10K iterations)", candidates_out: 14, duration_ms: 3500 },
        { module_id: "M8", detail: "28 primers designed, 378 dimer checks", candidates_out: 14, duration_ms: 3300 },
        { module_id: "M8.5", detail: "0 crRNA-primer conflicts", candidates_out: 14, duration_ms: 15 },
        { module_id: "M9", detail: "14 targets + IS6110 control = 15-plex", candidates_out: 15, duration_ms: 15 },
        { module_id: "M10", detail: "JSON + TSV + FASTA exported", candidates_out: 15, duration_ms: 1 },
      ]);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipeTimerRef.current) clearInterval(pipeTimerRef.current);
      pipeWsRef.current?.close();
      if (pipePollRef.current) clearInterval(pipePollRef.current);
    };
  }, []);

  const sectionTitle = (text) => (
    <div style={{ fontSize: mobile ? "18px" : "22px", fontWeight: 800, color: T.text, marginBottom: "12px", marginTop: mobile ? "32px" : "48px", letterSpacing: "-0.02em", fontFamily: HEADING }}>{text}</div>
  );

  return (
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px" }}>
      {/* Spacer — hero removed, logo in sidebar */}
      <div style={{ marginBottom: mobile ? "12px" : "24px" }} />

      {/* ── Run Workflow ── */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: mobile ? "20px" : "32px", marginBottom: "24px" }}>

        {/* 1. Run Name — compact inline */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ fontSize: "13px", fontWeight: 700, color: T.text, fontFamily: HEADING, flexShrink: 0 }}>Run Name</label>
            <input value={runName} onChange={(e) => setRunName(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "13px", fontFamily: MONO, color: T.text, background: T.bgSub, outline: "none", boxSizing: "border-box" }}
              placeholder="e.g. MDR-TB_14plex_v2"
            />
          </div>
        </div>

        <div style={{ height: 1, background: T.borderLight, margin: "0 0 24px" }} />

        {/* Diagnostic Panel */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "10px" }}>Diagnostic Panel</div>

          {/* Preset cards */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[
              { id: "mdr14", name: "MDR-TB 14-plex", targets: ALL_INDICES.length + " targets",
                desc: "Full WHO-catalogued first- and second-line resistance panel covering RIF, INH, EMB, PZA, FQ, and aminoglycosides.",
                meta: [["6 drug classes", ""], ["Tier 1–2", ""], ["High + Moderate", ""]] },
              { id: "core5", name: "Core 5-plex", targets: "5 targets",
                desc: "High-confidence tier-1 mutations only. Suitable for point-of-care screening with limited multiplexing capacity.",
                meta: [["4 drug classes", ""], ["Tier 1", ""], ["High", ""]] },
              { id: "custom", name: "Custom Panel", targets: panel === "custom" ? selected.size + " targets" : "",
                desc: "Select individual mutations. For targeted re-design, single-drug panels, or validation studies.",
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

        {/* Scoring Model */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "10px" }}>Scoring Model</div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "10px" }}>
            {[
              { id: "heuristic", label: "Heuristic", desc: "Position-weighted composite across 5 biophysical features. Fast, interpretable, no GPU required.", tag: "Baseline" },
              { id: "guard_net", label: "GUARD-Net", desc: "Dual-branch CNN + RNA-FM with R-loop propagation attention. Trained on 25K+ cis- and trans-cleavage measurements. \u03C1 = 0.55 on diagnostic trans-cleavage prediction.", tag: "Recommended" },
            ].map(s => (
              <button key={s.id} onClick={() => setScorer(s.id)} style={{
                padding: "16px", borderRadius: "10px", cursor: "pointer", fontFamily: FONT, textAlign: "left",
                border: `2px solid ${scorer === s.id ? T.primary : T.border}`,
                background: scorer === s.id ? T.primaryLight : T.bg, transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: scorer === s.id ? T.primaryDark : T.text, fontFamily: HEADING }}>{s.label}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: scorer === s.id ? T.primary : T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: "4px", background: scorer === s.id ? T.primary + "15" : T.bgSub }}>{s.tag}</span>
                </div>
                <div style={{ fontSize: "12px", color: scorer === s.id ? T.primaryDark : T.textSec, lineHeight: 1.5, opacity: 0.85 }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Configuration (collapsible) */}
        <div style={{ marginBottom: "28px" }}>
          <button onClick={() => setConfigOpen(!configOpen)} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0 0 10px 0", fontFamily: FONT }}>
            <Settings size={14} color={T.textSec} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.text, flex: 1, textAlign: "left" }}>Advanced Configuration</span>
            <span style={{ fontSize: "11px", color: T.textTer, marginRight: "4px" }}>defaults</span>
            <ChevronDown size={14} color={T.textSec} style={{ transform: configOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
          </button>
          {configOpen && (
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "16px 20px", border: `1px solid ${T.borderLight}` }}>
              {/* Pipeline mode toggle */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: T.textSec, marginBottom: "8px" }}>Pipeline Mode</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    { id: "standard", label: "Standard", tip: "All 8 modules" },
                    { id: "custom", label: "Custom", tip: "Select modules" },
                  ].map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); if (m.id === "standard") setSelectedModules(new Set(MODULES.map(x => x.id))); }}
                      style={{
                        padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, fontFamily: FONT, cursor: "pointer",
                        border: `1px solid ${mode === m.id ? T.primary : T.border}`,
                        background: mode === m.id ? T.primaryLight : T.bg,
                        color: mode === m.id ? T.primaryDark : T.textSec,
                      }}
                    >{m.label}</button>
                  ))}
                </div>
              </div>
              {/* Module selection for custom mode */}
              {mode === "custom" && (
                <div style={{ marginBottom: "16px", background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: T.text }}>Modules</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setSelectedModules(new Set(MODULES.map(x => x.id)))} style={{ padding: "3px 8px", borderRadius: "4px", border: `1px solid ${T.border}`, background: T.bg, color: T.textSec, fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>All</button>
                      <button onClick={() => setSelectedModules(new Set())} style={{ padding: "3px 8px", borderRadius: "4px", border: `1px solid ${T.border}`, background: T.bg, color: T.textSec, fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>None</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: "4px" }}>
                    {MODULES.map(m => {
                      const sel = selectedModules.has(m.id);
                      return (
                        <div key={m.id} onClick={() => { const n = new Set(selectedModules); sel ? n.delete(m.id) : n.add(m.id); setSelectedModules(n); }} style={{
                          display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", borderRadius: "6px", cursor: "pointer",
                          border: `1px solid ${sel ? T.primary + "50" : T.borderLight}`,
                          background: sel ? T.primaryLight + "60" : "transparent", fontSize: "11px",
                        }}>
                          <div style={{ width: 14, height: 14, borderRadius: "3px", border: `2px solid ${sel ? T.primary : T.border}`, background: sel ? T.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {sel && <Check size={8} color="#fff" strokeWidth={3} />}
                          </div>
                          <span style={{ fontFamily: MONO, fontWeight: 600, color: T.text, fontSize: "10px" }}>{m.id}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "10px", color: T.textTer }}>{selectedModules.size}/{MODULES.length} modules</div>
                </div>
              )}
              {/* Parameter defaults */}
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "0 32px" }}>
                {[
                  ["Cas12a Variant", "enAsCas12a"], ["PAM Pattern", "TTTV"],
                  ["Spacer Lengths", "20–23 nt"], ["GC Range", "30–70%"],
                  ["Min Discrimination", "2.0×"], ["SM Enhancement", "Enabled"],
                  ["RPA Amplicon", "100–200 bp"],
                  ["Scoring Model", scorer === "guard_net" ? "GUARD-Net" : "Heuristic"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.borderLight}`, fontSize: "12px" }}>
                    <span style={{ color: T.textSec }}>{k}</span>
                    <span style={{ fontWeight: 600, color: T.text, fontFamily: MONO, fontSize: "11px" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: "0 0 20px" }} />

        {/* Summary + Launch */}
        {error && <div style={{ color: T.danger, fontSize: "12px", marginBottom: "12px" }}>{error}</div>}
        <div style={{ display: "flex", alignItems: mobile ? "stretch" : "center", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", gap: mobile ? "12px" : "16px" }}>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: T.textSec }}><strong style={{ color: T.text }}>{selected.size}</strong> targets</span>
            <span style={{ color: T.textSec }}><strong style={{ color: T.text }}>{[...new Set([...selected].map(i => MUTATIONS[i]?.drug))].length}</strong> drug classes</span>
            <span style={{ color: T.textSec }}><strong style={{ color: T.text }}>{mode === "custom" ? selectedModules.size : MODULES.length}</strong> modules</span>
            <span style={{ padding: "2px 8px", borderRadius: "4px", background: scorer === "guard_net" ? T.primaryLight : T.bgSub, color: scorer === "guard_net" ? T.primaryDark : T.textSec, fontSize: "11px", fontWeight: 600 }}>
              {scorer === "guard_net" ? "GUARD-Net" : "Heuristic"}
            </span>
          </div>
          <Btn icon={launching ? Loader2 : Play} onClick={launch} disabled={launching || selected.size === 0 || !!pipeJobId}>
            {launching ? "Launching…" : pipeJobId ? (pipeDone ? "Complete" : "Running…") : "Launch Pipeline"}
          </Btn>
        </div>
      </div>

      {/* ═══ INLINE PIPELINE EXECUTION ═══ */}
      {pipeJobId && (() => {
        const activeModule = MODULES[pipeStep] || MODULES[0];
        const ActiveIcon = activeModule.icon;
        const statMap = {};
        pipeStats.forEach(s => { statMap[s.module_id] = s; });
        const totalDuration = pipeStats.reduce((s, m) => s + (m.duration_ms || 0), 0);
        const fmtDur = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
        const m2Out = statMap["M2"]?.candidates_out || 0;
        const finalSize = statMap["M9"]?.candidates_out || statMap["M7"]?.candidates_out || 0;

        return (
          <div style={{
            background: pipeDone ? "#ffffff" : `linear-gradient(135deg, ${T.primaryLight} 0%, ${T.primarySub} 100%)`,
            border: `1px solid ${pipeDone ? T.border : T.primary + "88"}`,
            borderRadius: "10px",
            marginBottom: "24px", overflow: "hidden",
            ...(pipeDone ? {} : { boxShadow: `0 2px 12px ${T.primary}1F` }),
          }}>
            {/* Running state — single line, icon+name swipe up */}
            {!pipeDone && (
              <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", animation: "subtlePulse 2s ease-in-out infinite" }}>
                  <ActiveIcon size={16} color={T.primary} strokeWidth={1.8} />
                </div>
                <div key={pipeStep} style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "8px", animation: "stepSwipeUp 0.25s ease-out" }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: T.primary }}>{activeModule.id}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: T.primaryDark }}>{activeModule.name}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: T.primary, fontVariantNumeric: "tabular-nums" }}>{pipeElapsed.toFixed(1)}s</span>
              </div>
            )}

            {/* Complete state — summary + logs toggle + CTA */}
            {pipeDone && (
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#111", fontFamily: HEADING }}>Pipeline Complete</div>
                    <div style={{ fontSize: "12px", color: "#999", fontFamily: MONO, marginTop: "2px" }}>
                      {totalDuration > 0 ? fmtDur(totalDuration) : `${pipeElapsed.toFixed(1)}s`}
                      {m2Out > 0 && ` · ${m2Out} candidates`}
                      {finalSize > 0 && ` · ${finalSize} selected`}
                    </div>
                  </div>
                  <button
                    onClick={() => goTo("results", { jobId: pipeJobId, scorer })}
                    style={{
                      padding: "8px 20px", borderRadius: "6px",
                      background: T.primary, color: "#fff", border: "none",
                      fontSize: "12px", fontWeight: 600, fontFamily: FONT,
                      cursor: "pointer", transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    View Results →
                  </button>
                </div>

                {/* Logs toggle */}
                <button onClick={() => setShowLog(!showLog)} style={{
                  background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
                  fontSize: "11px", color: "#999", display: "flex", alignItems: "center", gap: "4px", padding: 0,
                }}>
                  <ChevronDown size={12} style={{ transform: showLog ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                  {showLog ? "Hide" : "Show"} execution log
                </button>

                {showLog && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${T.borderLight}` }}>
                    {MODULES.map((m, idx) => {
                      const st = statMap[m.id];
                      const Icon = m.icon;
                      const isLast = idx === MODULES.length - 1;
                      return (
                        <div key={m.id} style={{ display: "flex", gap: "0" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "20px", flexShrink: 0 }}>
                            <Icon size={12} color="#111" strokeWidth={1.5} style={{ opacity: 0.6 }} />
                            {!isLast && <div style={{ width: "1px", flex: 1, minHeight: "6px", background: "#e0e0e0" }} />}
                          </div>
                          <div style={{ flex: 1, paddingLeft: "8px", paddingBottom: isLast ? 0 : "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "20px" }}>
                              <span style={{ fontFamily: MONO, fontSize: "10px", color: "#999" }}>{m.id}</span>
                              <span style={{ fontSize: "11px", fontWeight: 500, color: "#333" }}>{m.name}</span>
                              {st && <span style={{ fontFamily: MONO, fontSize: "10px", color: "#bbb", marginLeft: "auto" }}>{fmtDur(st.duration_ms)}</span>}
                            </div>
                            {st && <div style={{ fontSize: "10px", color: "#999", lineHeight: 1.4, padding: "1px 0 3px" }}>{st.detail}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ PERFORMANCE BANNER ═══ */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: mobile ? "16px" : "20px 28px", marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "12px" }}>GUARD 14-plex MDR-TB Panel Results</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: mobile ? "12px" : "24px" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: T.text, fontFamily: MONO }}>93.3%</div>
            <div style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.4 }}>sensitivity across all drug classes</div>
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: T.text, fontFamily: MONO }}>14/14</div>
            <div style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.4 }}>targets with designed primers</div>
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: T.text, fontFamily: MONO }}>6</div>
            <div style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.4 }}>drug classes: RIF, INH, EMB, PZA, FQ, AG</div>
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: T.text, fontFamily: MONO }}>{"\u03C1"} = 0.55</div>
            <div style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.4 }}>trans-cleavage prediction accuracy</div>
          </div>
        </div>
      </div>

      {/* ═══ HOW IT WORKS — 4-step simplified pipeline ═══ */}
      {sectionTitle("How It Works")}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
        {[
          { step: "1", icon: Target, title: "Define Targets", desc: "Input WHO resistance mutations. The pipeline resolves each mutation to its exact genomic position on the M. tuberculosis H37Rv reference genome, identifies the codon context, and determines which drug class it confers resistance to." },
          { step: "2", icon: Search, title: "Generate & Score Candidates", desc: "For each target, GUARD scans for Cas12a-compatible PAM sites, generates crRNA candidates, filters by biophysical criteria (GC content, secondary structure, off-targets), and scores them with GUARD-Net — trained on 25,000+ cis- and trans-cleavage measurements from Kim et al. (2018) and Huang et al. (2024)." },
          { step: "3", icon: Grid3x3, title: "Optimise the Panel", desc: "Panel composition is optimised via simulated annealing (10,000 iterations) over the combinatorial space of candidate assignments, maximising a weighted objective of efficiency, discrimination, and cross-reactivity avoidance. RPA primers are co-designed for each guide, with allele-specific primers for proximity targets." },
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
          <div style={{ background: "#f5f5f5", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, color: T.text, textAlign: "center", fontFamily: MONO }}>WHO Mutation Catalogue</div>
          <div style={{ width: "1px", height: "16px", background: T.text }} />

          {/* Pipeline */}
          <div style={{ border: `1.5px solid ${T.text}`, borderRadius: "8px", padding: "16px 24px", width: "100%", maxWidth: 600 }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "8px", textAlign: "center" }}>GUARD Pipeline</div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "6px", fontSize: "11px" }}>
              {["Target Resolution", "Candidate Generation", "Off-Target Screening", "Scoring (GUARD-Net)"].map(t => (
                <div key={t} style={{ background: "#f5f5f5", border: `1px solid ${T.border}`, borderRadius: "4px", padding: "6px 8px", textAlign: "center", fontWeight: 600, color: T.text }}>{t}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: "6px", marginTop: "6px", fontSize: "11px" }}>
              {["Multiplex Optimiser", "RPA Primer Co-Design", "Panel Assembly"].map(t => (
                <div key={t} style={{ background: "#f5f5f5", border: `1px solid ${T.border}`, borderRadius: "4px", padding: "6px 8px", textAlign: "center", fontWeight: 600, color: T.text }}>{t}</div>
              ))}
            </div>
          </div>

          {/* Two branches */}
          <div style={{ display: "flex", gap: mobile ? "12px" : "32px", marginTop: "12px", width: "100%", maxWidth: 600, justifyContent: "center" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: "1px", height: "16px", background: T.text, margin: "0 auto" }} />
              <div style={{ border: `1.5px solid ${T.primary}`, borderRadius: "6px", padding: "10px 14px", background: "#fff" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary }}>GUARD-Net</div>
                <div style={{ fontSize: "10px", color: T.textSec, marginTop: "2px" }}>Efficiency + Discrimination</div>
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: "1px", height: "16px", background: T.text, margin: "0 auto" }} />
              <div style={{ border: `1.5px solid ${T.primary}`, borderRadius: "6px", padding: "10px 14px", background: "#fff" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary }}>Block 3</div>
                <div style={{ fontSize: "10px", color: T.textSec, marginTop: "2px" }}>Sensitivity + Specificity + WHO TPP</div>
              </div>
            </div>
          </div>

          <div style={{ width: "1px", height: "16px", background: T.text }} />

          {/* Output */}
          <div style={{ background: "#f5f5f5", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, color: T.text, textAlign: "center", fontFamily: MONO }}>
            Assay-Ready Panel: 14 crRNAs + 28 primers + clinical metrics
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══ GUARD-NET — AI-Powered Guide Scoring ═══ */}
      {sectionTitle("How GUARD-Net Predicts Guide Performance")}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "16px" }}>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 20px" }}>
          Each candidate is scored by GUARD-Net, which analyses the target DNA sequence and guide RNA structure in parallel, then combines both through physics-informed attention:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          {[
            { icon: Cpu, title: "Target DNA analysis", desc: "A multi-scale CNN scans the 34-nucleotide target context (PAM + protospacer + flanks) for sequence patterns governing Cas12a binding: dinucleotide preferences, seed-region composition, and PAM quality." },
            { icon: Layers, title: "Guide RNA structure", desc: "A pre-trained RNA foundation model (RNA-FM, 23M sequences) analyses the guide's folding and thermodynamic stability — properties governing Cas12a loading efficiency and spacer accessibility." },
            { icon: TrendingUp, title: "R-loop propagation", desc: "Cas12a reads DNA sequentially from PAM-proximal to PAM-distal. A causal attention mechanism encodes this directional constraint, improving cross-dataset generalisation by 6.7% over standard bidirectional attention." },
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
          Efficiency and discrimination are predicted jointly via multi-task learning, sharing learned representations of Cas12a-target interactions. Discrimination — the ratio of mutant to wildtype cleavage — is the metric that determines whether a guide can distinguish resistant from susceptible bacteria at single-nucleotide resolution.
        </div>
      </div>

      <CollapsibleSection title="Technical Details — GUARD-Net Architecture">
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {[
            ["Architecture", "Dual-branch CNN + RNA-FM with RLPA"],
            ["Parameters", "235,000 trainable"],
            ["Training data", "Kim et al. 2018 (15K cis) + Huang et al. 2024 EasyDesign (10K trans)"],
            ["Trans-cleavage \u03C1", "0.55 (EasyDesign benchmark)"],
            ["Cis-cleavage \u03C1", "0.49 (Kim 2018 benchmark)"],
            ["Attention", "R-Loop Propagation Attention (RLPA)"],
            ["RLPA improvement", "+6.7% cross-dataset generalisation"],
            ["Training protocol", "3-phase: pretrain, RLPA, multi-task"],
            ["Multi-task heads", "Efficiency (sigmoid) + Discrimination (Softplus)"],
            ["Inference", "CPU-compatible (~50ms per candidate)"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: "8px", padding: "8px 12px", background: T.bgSub, borderRadius: "6px" }}>
              <span style={{ fontSize: "11px", color: T.textTer, fontWeight: 600, minWidth: 130, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.text, fontFamily: v.match(/^[0-9.\-+]/) ? MONO : FONT }}>{v}</span>
            </div>
          ))}
        </div>
        {/* Benchmark finding */}
        <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", padding: "12px 16px", marginBottom: "12px", fontSize: "12px", color: T.primaryDark, lineHeight: 1.65 }}>
          <strong>Benchmark validation:</strong> Models trained only on gene-editing data (Kim et al. 2018, cis-cleavage) show near-zero predictive value for diagnostic trans-cleavage ({"\u03C1"} = 0.04). The production model incorporates trans-cleavage training data (Huang et al. 2024) and achieves {"\u03C1"} = 0.55 on diagnostic predictions — a 12x improvement in predictive accuracy for the relevant readout.
        </div>
        <p style={{ fontSize: "11px", color: T.textTer, margin: 0, lineHeight: 1.5 }}>
          All predictions are in silico estimates. Predicted discrimination ratios are derived from mismatch penalty models, not from clinical trial data. Experimental confirmation is required before diagnostic deployment.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="GUARD-Net Architecture Summary">
        {/* Summary visible by default */}
        <div style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.75, marginBottom: "16px" }}>
          <p style={{ margin: "0 0 10px" }}>Two branches analyse different molecules:</p>
          <ul style={{ margin: "0 0 10px", paddingLeft: "20px" }}>
            <li style={{ marginBottom: "4px" }}><strong style={{ color: T.text }}>CNN branch:</strong> multi-scale parallel convolutions (kernel sizes 3, 5, 7; 32 channels each) scan the 34-nt target DNA context for sequence patterns affecting Cas12a binding — GC content, seed composition, PAM quality. Output: 64-dim features per position.</li>
            <li style={{ marginBottom: "4px" }}><strong style={{ color: T.text }}>RNA-FM branch:</strong> pre-trained RNA foundation model (23M sequences) generates 640-dim per-nucleotide embeddings of the guide RNA, projected to 64 dimensions. Captures folding stability and accessibility properties governing enzyme loading.</li>
          </ul>
          <p style={{ margin: "0 0 10px" }}>These are concatenated (64 + 64 = 128-dim per position) and processed by R-Loop Propagation Attention — a single-head causal attention mechanism with 32-dim Q/K/V projections and a learnable 34x34 positional bias matrix. The causal mask encodes the directional way Cas12a reads DNA (PAM-proximal to PAM-distal), improving cross-dataset generalisation by 6.7%.</p>
          <p style={{ margin: "0 0 10px" }}>Two output heads per candidate:</p>
          <ul style={{ margin: "0 0 10px", paddingLeft: "20px" }}>
            <li style={{ marginBottom: "4px" }}><strong style={{ color: T.text }}>Efficiency</strong> (0-1): predicted trans-cleavage signal strength. Head: 128 {"\u2192"} 64 {"\u2192"} 32 {"\u2192"} 1, sigmoid.</li>
            <li style={{ marginBottom: "4px" }}><strong style={{ color: T.text }}>Discrimination</strong> (x): predicted ability to distinguish resistant from susceptible bacteria. Head: 1024 {"\u2192"} 64 {"\u2192"} 32 {"\u2192"} 1, Softplus.</li>
          </ul>
          <p style={{ margin: 0, fontFamily: MONO, fontSize: "12px", color: T.text }}>
            235,000 params {"\u00B7"} {"\u03C1"} = 0.55 on trans-cleavage {"\u00B7"} Loss: L<sub>Huber</sub> + 0.5(1-{"\u03C1"}<sub>soft</sub>) + {"\u03BB"}<sub>disc</sub>L<sub>Huber</sub>(log D) {"\u00B7"} CPU ~50ms
          </p>
        </div>

        {/* Expandable full details */}
        <button onClick={() => setArchOpen(!archOpen)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", color: T.primary, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", fontFamily: FONT, marginBottom: archOpen ? "16px" : 0 }}>
          {archOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {archOpen ? "Hide" : "Show"} full architecture details
        </button>
        {archOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                  {[
                    {
                      label: "Branch 1", title: "Multi-Scale CNN", accent: T.primary,
                      input: "34-nucleotide one-hot encoded target context (4 nt PAM + 20 nt protospacer + 10 nt flanking downstream). Encoded as a 4 × 34 binary matrix.",
                      process: "Three parallel convolutional paths (kernel sizes 3, 5, 7) with 32 channels each, batch normalisation, and dropout (0.3). Outputs are concatenated and projected to 64-dim per position via a 1x1 convolution.",
                      output: "64-dimensional feature vector per position capturing local sequence determinants: dinucleotide preferences, seed complementarity, PAM-proximal patterns.",
                    },
                    {
                      label: "Branch 2", title: "RNA-FM Projection", accent: "#7c3aed",
                      input: "Guide RNA sequence (20-23 nt spacer). Processed by frozen RNA-FM (Chen et al. 2022, trained on 23M non-coding RNAs via masked language modelling).",
                      process: "RNA-FM generates 640-dim per-nucleotide embeddings encoding secondary structure propensity and thermodynamic stability. A trainable linear projection maps 640-dim to 64-dim. Sequence is zero-padded from 20 to 34 positions for alignment with the CNN branch.",
                      output: "64-dimensional structural embedding per position. Captures folding, stability, and 5' accessibility properties governing Cas12a loading.",
                    },
                    {
                      label: "Fusion", title: "R-Loop Propagation Attention (RLPA)", accent: "#0d9488",
                      input: "Concatenated per-position features: 64-dim CNN + 64-dim RNA-FM = 128-dim at each of 34 positions.",
                      process: "Single-head attention with 32-dim Q/K/V projections. A lower-triangular causal mask enforces PAM-proximal to PAM-distal directionality. A learnable 34x34 positional bias matrix encodes position-dependent interaction strengths. This improves cross-dataset generalisation by 6.7% over standard bidirectional attention.",
                      output: "Attention-weighted 128-dim representation where features are re-weighted by positional importance in R-loop propagation.",
                    },
                    {
                      label: "Output", title: "Multi-Task Prediction Heads", accent: "#e11d48",
                      input: "RLPA-weighted representation, globally pooled to a single vector.",
                      process: "Efficiency head: 128 -> 64 -> 32 -> 1 (sigmoid). Discrimination head: 1024 -> 64 -> 32 -> 1 (Softplus, predicts log MUT/WT ratio). Joint loss: L_Huber(efficiency) + 0.5 * (1 - rho_soft_Spearman) + lambda_disc * L_Huber(log D).",
                      output: "Two scalars: efficiency score (0-1) and discrimination ratio (fold-change MUT/WT). These drive panel selection and WHO compliance assessment.",
                    },
                  ].map((block, idx, arr) => (
                    <div key={block.title} style={{ padding: mobile ? "16px 0" : "20px 0", borderBottom: idx < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: block.accent, background: block.accent + "14", padding: "2px 8px", borderRadius: "4px", fontFamily: MONO, textTransform: "uppercase" }}>{block.label}</span>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{block.title}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: mobile ? "12px" : "24px" }}>
                        {[
                          { label: "Input", text: block.input },
                          { label: "Process", text: block.process },
                          { label: "Output", text: block.output },
                        ].map(col => (
                          <div key={col.label}>
                            <div style={{ fontSize: "10px", fontWeight: 700, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{col.label}</div>
                            <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.65 }}>{col.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Training protocol */}
                  <div style={{ marginTop: "8px", padding: "14px 16px", background: T.primaryLight, borderRadius: "8px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: T.primaryDark, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Training Protocol</div>
                    <div style={{ fontSize: "12px", color: T.primaryDark, lineHeight: 1.65, opacity: 0.85 }}>
                      Phase 1 — pre-train CNN branch on efficiency labels only (200 epochs). Phase 2 — introduce RLPA attention and fine-tune (100 epochs). Phase 3 — activate discrimination head for multi-task learning (100 epochs). Total: 235K trainable parameters trained on 25,000+ Cas12a activity measurements from Kim et al. 2018 (cis-cleavage HT-PAMDA) and Huang et al. 2024 (trans-cleavage EasyDesign).
                    </div>
                  </div>
                </div>
              )}
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
        Reported as the ratio of mutant vs wildtype cleavage activity. Higher is better.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
        {[
          { label: "Excellent", val: "≥ 10×", color: "#64748b", border: "#cbd5e1", desc: "Single-plex clinical. Robust across sample types." },
          { label: "Good", val: "≥ 3×", color: "#64748b", border: "#cbd5e1", desc: "Multiplex panel. Fluorescence & lateral flow." },
          { label: "Acceptable", val: "≥ 2×", color: "#94a3b8", border: "#e2e8f0", desc: "Requires confirmatory readout." },
          { label: "Insufficient", val: "< 2×", color: "#94a3b8", border: "#e2e8f0", desc: "Synthetic mismatch enhancement needed." },
        ].map(t => (
          <div key={t.label} style={{ background: T.bg, borderRadius: "8px", padding: "14px 16px", border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: "18px", fontWeight: 500, color: T.text, fontFamily: MONO, marginBottom: "4px" }}>{t.val}</div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: t.color, marginBottom: "4px" }}>{t.label}</div>
            <div style={{ fontSize: "11px", color: T.textTer, lineHeight: 1.5 }}>{t.desc}</div>
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
          ["Primer Tm", "57–72 \u00B0C", "Primer melting temperature (not reaction temperature). RPA runs at 37\u00B0C; high Tm ensures stable primer hybridisation."],
          ["Discrimination min", "2.0\u00D7", "Minimum acceptable. \u22653.0\u00D7 for fluorescence/LFA. \u22655.0\u00D7 for electrochemical readout."],
        ].map(([param, value, rationale], i, arr) => (
          <div key={param} style={{ display: "flex", alignItems: "baseline", gap: mobile ? "8px" : "16px", padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", flexWrap: mobile ? "wrap" : "nowrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.text, minWidth: mobile ? "100%" : 130, flexShrink: 0 }}>{param}</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: T.primary, minWidth: 80, flexShrink: 0 }}>{value}</span>
            <span style={{ fontSize: "11px", color: T.textTer, flex: 1 }}>{rationale}</span>
          </div>
        ))}
      </CollapsibleSection>

      {/* ═══ LIMITATIONS ═══ */}
      <CollapsibleSection title="Limitations & Scope">
        <div style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.75, marginBottom: "8px" }}>
          All predictions are in silico estimates. Experimental validation on the target electrochemical platform is required before diagnostic deployment. Key limitations of the current version:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            {
              title: "Discrimination prediction",
              text: "Discrimination ratios are predicted by a gradient-boosted model trained on 6,136 paired MUT/WT trans-cleavage measurements from the EasyDesign dataset (Huang et al. 2024, LbCas12a). The model uses 15 thermodynamic features including R-loop cumulative \u0394G, mismatch \u0394\u0394G penalties (Sugimoto 2000), and position sensitivity. Cross-validated correlation r\u22480.46 (vs r\u22480.30 for heuristic baseline). Falls back to position-dependent heuristics when the trained model is unavailable.",
            },
            {
              title: "Training data & domain shift",
              text: "GUARD-Net is trained on two datasets: Kim et al. 2018 (indel frequencies \u2014 cis-cleavage, AsCas12a/LbCas12a) and EasyDesign (Huang et al. 2024, FAM-quencher reporter fluorescence \u2014 trans-cleavage, LbCas12a). The production checkpoint is validated against EasyDesign\u2019s trans-cleavage test set (\u03c1 = 0.55), so predictions are performance-validated against the diagnostic-relevant readout. The primary domain shift is enzyme variant (trained on LbCas12a, deployed on enAsCas12a), target organism (human \u2192 M. tuberculosis), and amplification context (purified DNA \u2192 RPA amplicons). Active learning from initial experimental validation will calibrate predictions to the deployment domain.",
            },
            {
              title: "AS-RPA specificity",
              text: "Discrimination for Proximity candidates is estimated from 3′ terminal mismatch identity using Boltzmann thermodynamics (not experimentally validated). Ratios > 100× are capped — kinetic effects dominate at high ΔΔG.",
            },
            {
              title: "Multiplex compatibility",
              text: "Cross-reactivity is assessed by sequence homology (Bowtie2). Primer dimer stability is predicted using SantaLucia nearest-neighbour thermodynamics (post-optimization analysis \u2014 not yet integrated into the simulated annealing cost function). Enzyme competition and amplification bias are not modelled.",
            },
            {
              title: "Shared amplicons & cross-priming",
              text: "Targets at the same codon (e.g., rpoB_H445D/H445Y, rpoB_S450L/S450W) may share the same amplicon and primers. In a single-pot multiplex, both mutations produce a positive drug-class signal but the specific amino acid change cannot be resolved without distinct crRNA reporters. Near-identical AS-RPA primers (differing only at the 3\u2032 base) competing for the same template region pose cross-priming risk not captured by the inter-oligo dimer analysis.",
            },
            {
              title: "Amplicon secondary structure",
              text: "No amplicon \u0394G_fold calculation is performed. RPA at 37 \u00b0C on GC-rich M. tuberculosis DNA (some amplicons >70% GC) risks stable hairpin formation that blocks recombinase strand invasion. Amplicons with \u0394G_fold < \u221210 kcal/mol should be flagged \u2014 requires ViennaRNA or NUPACK integration (planned).",
            },
            {
              title: "Specificity estimates",
              text: "The proxy formula (1\u22121/disc) assumes perfectly separated signal distributions with a midpoint threshold. In practice, specificity depends on signal variance and threshold selection \u2014 a target with disc = 7\u00d7 and high activity variance could have worse specificity than disc = 5\u00d7 with low variance. WHO TPP compliance requires experimental validation on clinical isolate panels. All specificity statuses are marked \u201cPending\u201d accordingly.",
            },
          ].map((item, i) => (
            <div key={i} style={{ background: T.bgSub, borderRadius: "8px", padding: "12px 16px", border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>{item.title}</div>
              <div style={{ fontSize: "11.5px", color: T.textSec, lineHeight: 1.65 }}>{item.text}</div>
            </div>
          ))}
        </div>
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
   EXECUTION THEME TOKENS (light, integrated with sidebar)
   ═══════════════════════════════════════════════════════════════════ */
/* Monotone execution palette — black, grey, white only */
const EX = {
  bg: T.bgSub,
  text: "#111111",
  textSec: "#888888",
  textTer: "#999999",
  line: "#e0e0e0",
  lineDone: "#111111",
  nodeUp: "#cccccc",
  nodeDone: "#111111",
  desc: "#666666",
};

/* ═══════════════════════════════════════════════════════════════════
   PIPELINE PAGE — Redirects to Home (execution is now inline)
   ═══════════════════════════════════════════════════════════════════ */
const PipelinePage = ({ jobId, connected, goTo }) => {
  const mobile = useIsMobile();
  useEffect(() => { goTo("home"); }, []);
  return (
    <div style={{ padding: mobile ? "16px" : "36px 40px", textAlign: "center" }}>
      <div style={{ padding: "80px 24px" }}>
        <Cpu size={28} color="#999" strokeWidth={1.5} />
        <div style={{ fontSize: "14px", color: "#999", marginTop: "12px" }}>Redirecting to Home…</div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   RESULT TABS
   ═══════════════════════════════════════════════════════════════════ */
const OverviewTab = ({ results, scorer }) => {
  const mobile = useIsMobile();

  // Detect scorer from prop (primary) or ml_scores (fallback)
  const usesGuardNet = scorer === "guard_net" || results.some(r => r.mlScores?.some(m => (m.model_name || m.modelName) === "guard_net"));
  const mlModelLabel = usesGuardNet ? "GUARD-Net" : "Heuristic";
  const mlModelDetail = usesGuardNet ? "235K params · CNN + RNA-FM + RLPA" : "Biophysical features";

  const getResultScore = (r) => usesGuardNet ? (r.ensembleScore || r.score) : r.score;
  const drugs = [...new Set(results.map((r) => r.drug))];
  const byDrug = drugs.map((d) => ({ drug: d, count: results.filter((r) => r.drug === d).length, avgScore: +(results.filter((r) => r.drug === d).reduce((a, r) => a + getResultScore(r), 0) / results.filter((r) => r.drug === d).length).toFixed(3) }));
  const withPrimers = results.filter((r) => r.hasPrimers).length;
  const directResults = results.filter((r) => r.strategy === "Direct" && r.disc < 900);
  const avgDisc = directResults.length ? +(directResults.reduce((a, r) => a + r.disc, 0) / directResults.length).toFixed(1) : 0;
  const highDisc = directResults.filter((r) => r.disc >= 3).length;
  const directCount = results.filter((r) => r.strategy === "Direct").length;
  const proximityCount = results.filter((r) => r.strategy === "Proximity").length;
  const avgScore = results.length ? +(results.reduce((a, r) => a + getResultScore(r), 0) / results.length).toFixed(3) : 0;
  const minScore = results.length ? Math.min(...results.map(r => getResultScore(r))).toFixed(3) : "0";
  const maxScore = results.length ? Math.max(...results.map(r => getResultScore(r))).toFixed(3) : "0";
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
            <div><strong>Score</strong> (0–1) — predicted Cas12a trans-cleavage activity. A score of 0.8 means the crRNA is expected to trigger strong collateral cleavage of the fluorescent reporter, producing a bright signal in ~10 min. Below 0.4, the guide may not generate a detectable signal within a clinically useful timeframe. {usesGuardNet ? "Computed as an ensemble of GUARD-Net (trained on 25K+ activity measurements) and heuristic biophysical features." : "Computed from position-weighted biophysical features."}</div>
            <div><strong>Discrimination</strong> (×) — fold-difference in cleavage activity between the mutant (resistant) and wildtype (susceptible) template. A 5× ratio means the guide cleaves 5× faster on the mutant — so the assay signal from a resistant sample is 5× stronger than from a susceptible sample. ≥ 3× is diagnostic-grade. {results.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "Predicted by a gradient-boosted model trained on 6,136 EasyDesign pairs using 15 thermodynamic features." : "Predicted by heuristic position × destabilisation model."}</div>
            <div><strong>RPA Primers</strong> — isothermal amplification primers (37°C, no thermal cycler). RPA amplifies the target region in 15–20 min, then Cas12a detects the amplified product. A candidate without primers cannot be used as a complete assay.</div>
            <div><strong>Drug class</strong> — which antibiotic the mutation confers resistance to (e.g. RIF = rifampicin, INH = isoniazid). A 14-plex panel covers all 6 WHO priority drug classes for MDR/XDR-TB.</div>
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
          { l: "Model", v: directResults.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "Learned" : "Heuristic", sub: directResults.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "XGBoost · 15 features" : "position × destab" },
        ]} />
        <div style={{ width: mobile ? "100%" : "1px", height: mobile ? "1px" : "auto", background: T.border, flexShrink: 0 }} />
        <StatGroup title="Predicted Activity" items={[
          { l: "Avg. activity", v: usesGuardNet && avgEnsemble ? avgEnsemble : avgScore },
          { l: "Range", v: `${minScore} – ${maxScore}`, sub: "min – max" },
        ]} />
      </div>

      {/* Scoring Model Comparison */}
      {avgCNN != null && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, marginBottom: "6px", fontFamily: HEADING }}>Scoring Model Comparison</div>
          <div style={{ fontSize: "12px", color: T.textSec, marginBottom: "20px", lineHeight: 1.6 }}>
            Two models independently predict each crRNA's cleavage activity: a heuristic (biophysical features: seed position, GC, secondary structure) and GUARD-Net (CNN + RNA-FM + RLPA, trained on 25K+ cis- and trans-cleavage measurements, validated on diagnostic trans-cleavage at \u03c1 = 0.55). The ensemble blends both to produce the final predicted activity score used for panel selection.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "16px" }}>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Heuristic</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.text, fontFamily: MONO }}>{avgScore}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>5 features · fixed weights</div>
            </div>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{mlModelLabel} (calibrated)</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.primary, fontFamily: MONO }}>{avgCNN}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>{mlModelDetail}</div>
            </div>
            <div style={{ background: T.bgSub, borderRadius: "10px", padding: "20px", border: `2px solid ${T.primary}33` }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Ensemble</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: T.primary, fontFamily: MONO }}>{avgEnsemble || "—"}</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "4px" }}>{usesGuardNet ? "val ρ = 0.537 · primary score" : "val ρ = 0.74 · primary score"}</div>
            </div>
          </div>
        </div>
      )}

      {/* KDE Score Distribution */}
      {!mobile && (() => {
        const scoresByDrug = results.map(r => ({ score: usesGuardNet ? (r.ensembleScore || r.score) : r.score, drug: r.drug, label: r.label }));
        const scores = scoresByDrug.map(s => s.score);
        const kde = gaussianKDE(scores, 0.05, 100);
        const sigma = stdDev(scores);
        const mean = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
        const scoreMin = Math.min(...scores).toFixed(2);
        const scoreMax = Math.max(...scores).toFixed(2);
        const effThreshold = 0.4;
        const DRUG_DOT = { RIF: "#2563EB", INH: "#D97706", EMB: "#7C3AED", FQ: "#E11D48", AG: "#4F46E5", PZA: "#16A34A", OTHER: "#6B7280" };
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px 32px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Predicted Activity Distribution</div>
                <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px", lineHeight: 1.5 }}>
                  Distribution of predicted Cas12a trans-cleavage activity across all candidates. Higher scores = stronger fluorescent signal = faster time-to-result.
                  Scores below 0.4 may not produce detectable signal; above 0.7 indicates high-confidence diagnostic performance.
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "20px" }}>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div><div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>RANGE</div><div style={{ fontSize: "13px", fontWeight: 800, color: T.text, fontFamily: MONO }}>{scoreMin}–{scoreMax}</div></div>
                  <div><div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>MEAN</div><div style={{ fontSize: "13px", fontWeight: 800, color: T.primary, fontFamily: MONO }}>{mean}</div></div>
                  <div><div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>STD DEV</div><div style={{ fontSize: "13px", fontWeight: 800, color: T.text, fontFamily: MONO }}>{sigma.toFixed(3)}</div></div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={kde} margin={{ top: 5, right: 15, bottom: 20, left: 15 }}>
                <defs>
                  <linearGradient id="kdeAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={T.primary} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: T.textTer, fontFamily: MONO }} tickCount={11} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip contentStyle={{ ...tooltipStyle, padding: "8px 12px" }} formatter={(v) => [v.toFixed(4), "Density"]} labelFormatter={(l) => `Score: ${l}`} />
                <ReferenceLine x={effThreshold} stroke={T.danger} strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "0.4 min", position: "insideTopRight", fontSize: 9, fill: T.danger, fontWeight: 600 }} />
                <ReferenceLine x={mean} stroke={T.primary} strokeDasharray="3 3" strokeWidth={1} label={{ value: "μ", position: "insideTopRight", fontSize: 10, fill: T.primary, fontWeight: 700 }} />
                <Area type="monotone" dataKey="density" stroke={T.primary} strokeWidth={2.5} fill="url(#kdeAreaFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            {/* Rug plot — colored by drug */}
            <div style={{ position: "relative", height: "18px", marginTop: "-14px", marginLeft: "15px", marginRight: "15px" }}>
              {scoresByDrug.map((s, i) => (
                <div key={i} style={{ position: "absolute", left: `${s.score * 100}%`, bottom: 0, width: "2.5px", height: "12px", background: DRUG_DOT[s.drug] || DRUG_DOT.OTHER, opacity: 0.85, borderRadius: "1px" }} title={`${s.label} (${s.drug}): ${s.score.toFixed(3)}`} />
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px", marginLeft: "15px", flexWrap: "wrap", alignItems: "center" }}>
              {Object.entries(DRUG_DOT).filter(([d]) => d !== "OTHER" && results.some(r => r.drug === d)).map(([drug, color]) => (
                <div key={drug} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: color }} />
                  <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>{drug}</span>
                </div>
              ))}
            </div>
            {/* Interpretation */}
            {(() => {
              const sorted = [...scoresByDrug].sort((a, b) => a.score - b.score);
              const worst = sorted[0];
              const best = sorted[sorted.length - 1];
              const belowMin = sorted.filter(s => s.score < 0.4);
              const aboveTarget = sorted.filter(s => s.score >= 0.7);
              const medianScore = sorted[Math.floor(sorted.length / 2)].score;
              return (
                <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                  <strong style={{ color: T.primary }}>Interpretation:</strong> Panel scores range from <strong style={{ color: T.text }}>{worst.score.toFixed(3)}</strong> ({worst.label}) to <strong style={{ color: T.text }}>{best.score.toFixed(3)}</strong> ({best.label}) with a median of {medianScore.toFixed(3)} (μ = {mean}, σ = {sigma.toFixed(3)}).
                  {aboveTarget.length > 0 ? ` ${aboveTarget.length}/${scores.length} candidates exceed the 0.7 high-confidence threshold.` : " No candidates reach the 0.7 high-confidence threshold — consider alternative spacer designs or SM enhancement."}
                  {belowMin.length > 0 ? ` ${belowMin.length} candidate${belowMin.length > 1 ? "s" : ""} (${belowMin.map(s => s.label).slice(0, 3).join(", ")}${belowMin.length > 3 ? "…" : ""}) fall below the 0.4 viability threshold.` : " All candidates clear the 0.4 minimum viability threshold."}
                  {sigma < 0.05 ? " The narrow spread (σ < 0.05) suggests the model assigns similar scores — consider a checkpoint with wider dynamic range or re-evaluate feature diversity." : sigma > 0.1 ? " The wide spread (σ > 0.1) confirms the model differentiates strongly between targets, which is desirable for panel optimisation." : ""}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Drug Class Score Distribution — Box Plot */}
      {!mobile && (() => {
        const getScore = (r) => usesGuardNet ? (r.ensembleScore || r.score) : r.score;
        const DRUG_FILL = { RIF: { bg: "#DBEAFE", dot: "#2563EB", bar: "#3B82F6" }, INH: { bg: "#FEF3C7", dot: "#D97706", bar: "#F59E0B" }, EMB: { bg: "#F3E8FF", dot: "#7C3AED", bar: "#8B5CF6" }, FQ: { bg: "#FFE4E6", dot: "#E11D48", bar: "#F43F5E" }, AG: { bg: "#E0E7FF", dot: "#4F46E5", bar: "#6366F1" }, PZA: { bg: "#F0FDF4", dot: "#16A34A", bar: "#22C55E" }, OTHER: { bg: "#F3F4F6", dot: "#6B7280", bar: "#9CA3AF" } };
        const drugOrder = [...new Set(results.map(r => r.drug))];
        const drugData = drugOrder.map(d => {
          const dScores = results.filter(r => r.drug === d).map(r => getScore(r)).sort((a, b) => a - b);
          const avg = +(dScores.reduce((a, b) => a + b, 0) / dScores.length).toFixed(3);
          return { drug: d, min: dScores[0], max: dScores[dScores.length - 1], avg, count: dScores.length, scores: dScores };
        }).sort((a, b) => b.avg - a.avg);
        const weakest = drugData[drugData.length - 1];
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px 32px", marginBottom: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Score by Drug Class</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>
                Score range and distribution per drug. Sorted by average score, highest first. Each dot is one candidate.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {drugData.map(d => {
                const c = DRUG_FILL[d.drug] || DRUG_FILL.OTHER;
                const isWeakest = d === weakest && d.avg < 0.5;
                return (
                  <div key={d.drug} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" }}>
                    <div style={{ width: "50px", textAlign: "right" }}><span style={{ background: c.bg, color: c.dot, padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, border: isWeakest ? `1.5px solid ${T.danger}` : "none" }}>{d.drug}</span></div>
                    <div style={{ flex: 1, position: "relative", height: "32px", background: T.bgSub, borderRadius: "6px" }}>
                      {/* Range bar with gradient */}
                      <div style={{ position: "absolute", top: "12px", left: `${d.min * 100}%`, width: `${Math.max((d.max - d.min) * 100, 0.3)}%`, height: "8px", background: `linear-gradient(90deg, ${c.bar}44, ${c.bar}88)`, borderRadius: "4px" }} />
                      {/* Mean tick */}
                      <div style={{ position: "absolute", top: "8px", left: `${d.avg * 100}%`, width: "2px", height: "16px", background: c.dot, borderRadius: "1px", transform: "translateX(-1px)" }} />
                      {/* Individual dots */}
                      {d.scores.map((s, i) => (
                        <div key={i} style={{ position: "absolute", top: "10px", left: `${s * 100}%`, width: "12px", height: "12px", borderRadius: "50%", background: c.dot, border: "2px solid #fff", transform: "translateX(-6px)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)", zIndex: 2 }} />
                      ))}
                    </div>
                    <div style={{ width: "90px", textAlign: "right" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: d.avg >= 0.7 ? T.success : d.avg >= 0.5 ? T.text : T.danger, fontFamily: MONO }}>{d.avg}</span>
                      <span style={{ fontSize: "9px", color: T.textTer, marginLeft: "4px" }}>({d.count})</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Scale line */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
              <div style={{ width: "50px" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: T.textTer, fontFamily: MONO, padding: "0 1px" }}>
                  {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => <span key={v} style={v === 0.4 ? { color: T.danger, fontWeight: 700 } : {}}>{v}</span>)}
                </div>
              </div>
              <div style={{ width: "90px" }} />
            </div>
            {/* Interpretation */}
            {(() => {
              const strongest = drugData[0];
              const spread = drugData.map(d => ({ drug: d.drug, range: +(d.max - d.min).toFixed(3) })).sort((a, b) => b.range - a.range);
              const mostVariable = spread[0];
              return (
                <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                  <strong style={{ color: T.primary }}>Interpretation:</strong> <strong style={{ color: T.text }}>{strongest.drug}</strong> leads with avg {strongest.avg} across {strongest.count} target{strongest.count > 1 ? "s" : ""}.
                  {weakest && weakest.avg < 0.5 ? ` ${weakest.drug} (avg ${weakest.avg}, ${weakest.count} targets) is critically weak — consider alternative spacer designs, SM enhancement, or dropping low-value targets.` : weakest && weakest.avg < 0.6 ? ` ${weakest.drug} (avg ${weakest.avg}) trails other classes and may benefit from optimisation.` : " All drug classes maintain competitive average scores."}
                  {mostVariable.range > 0.2 ? ` ${mostVariable.drug} shows the widest intra-class variation (range ${mostVariable.range}) — its targets vary significantly in spacer quality.` : ""}
                  {drugData.length >= 3 ? ` Coverage spans ${drugData.length} drug classes, supporting multi-drug resistance profiling.` : ""}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Score by Target — bars colored by drug class */}
      {(() => {
        const DRUG_BAR = { RIF: "#2563EB", INH: "#D97706", EMB: "#7C3AED", FQ: "#E11D48", AG: "#4F46E5", PZA: "#16A34A", OTHER: "#9CA3AF" };
        const DRUG_BAR_LIGHT = { RIF: "rgba(37,99,235,0.15)", INH: "rgba(217,119,6,0.15)", EMB: "rgba(124,58,237,0.15)", FQ: "rgba(225,29,72,0.15)", AG: "rgba(79,70,229,0.15)", PZA: "rgba(22,163,74,0.15)", OTHER: "rgba(156,163,175,0.15)" };
        const getScore = (r) => usesGuardNet ? (r.ensembleScore || r.score) : r.score;
        const sorted = [...results].sort((a, b) => getScore(b) - getScore(a));
        const chartData = sorted.map((r) => ({ name: r.label, score: getScore(r), disc: r.disc, drug: r.drug, strategy: r.strategy }));
        const belowThreshold = chartData.filter(d => d.score < 0.4).length;
        const aboveTarget = chartData.filter(d => d.score >= 0.7).length;
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>{usesGuardNet ? "Ensemble Score" : "Heuristic Score"} by Target</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>
                Individual candidate scores sorted by rank. Bar color = drug class. Dot marks the exact score.
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={T.borderLight} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: T.textTer, fontFamily: MONO }} angle={-50} textAnchor="end" height={65} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: T.textTer, fontFamily: MONO }} domain={[0, 1]} axisLine={false} tickLine={false} label={{ value: "Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: T.textTer }, offset: 0 }} />
                <Tooltip content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload;
                  return d ? (
                    <div style={{ ...tooltipStyle, padding: "10px 14px" }}>
                      <div style={{ fontWeight: 700, fontSize: "12px", color: DRUG_BAR[d.drug] || T.text }}>{d.name}</div>
                      <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>Score: <strong>{d.score.toFixed(3)}</strong></div>
                      <div style={{ fontSize: "11px", color: T.textSec }}>Disc: {d.disc?.toFixed(1)}× · {d.drug} · {d.strategy}</div>
                    </div>
                  ) : null;
                }} />
                <ReferenceLine y={0.4} stroke={T.danger} strokeDasharray="4 3" strokeWidth={1} />
                <ReferenceLine y={0.7} stroke={T.success} strokeDasharray="4 3" strokeWidth={1} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={DRUG_BAR_LIGHT[entry.drug] || DRUG_BAR_LIGHT.OTHER} stroke={DRUG_BAR[entry.drug] || DRUG_BAR.OTHER} strokeWidth={1} />
                  ))}
                </Bar>
                <Scatter dataKey="score" r={5} isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={DRUG_BAR[entry.drug] || DRUG_BAR.OTHER} stroke="#fff" strokeWidth={1.5} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            {/* Legend + thresholds */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
              {[...new Set(results.map(r => r.drug))].map(d => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "3px", background: DRUG_BAR[d] || DRUG_BAR.OTHER }} />
                  <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>{d}</span>
                </div>
              ))}
              <span style={{ fontSize: "10px", color: T.textTer, marginLeft: "6px" }}>—</span>
              <span style={{ fontSize: "10px", color: T.danger, fontWeight: 600 }}>0.4 minimum</span>
              <span style={{ fontSize: "10px", color: T.success, fontWeight: 600 }}>0.7 target</span>
            </div>
            {/* Interpretation */}
            {(() => {
              const top3 = chartData.slice(0, 3);
              const bottom3 = chartData.slice(-3);
              const lowTargets = chartData.filter(d => d.score < 0.4);
              const midTargets = chartData.filter(d => d.score >= 0.4 && d.score < 0.7);
              return (
                <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                  <strong style={{ color: T.primary }}>Interpretation:</strong> Top performers: {top3.map(d => `${d.name} (${d.score.toFixed(3)})`).join(", ")}.
                  {aboveTarget > 0 ? ` ${aboveTarget}/${chartData.length} candidates exceed the 0.7 target — these are deployment-ready.` : " No candidates reach the 0.7 target — the panel may need alternative spacer designs."}
                  {lowTargets.length > 0 ? ` ${lowTargets.length} candidate${lowTargets.length > 1 ? "s" : ""} (${lowTargets.map(d => d.name).slice(0, 3).join(", ")}${lowTargets.length > 3 ? "…" : ""}) fall below 0.4 and should be flagged for redesign or removal.` : ""}
                  {midTargets.length > 0 ? ` ${midTargets.length} candidate${midTargets.length > 1 ? "s sit" : " sits"} in the 0.4–0.7 optimisation zone — SM enhancement or alternative spacers may improve these.` : ""}
                  {` Weakest: ${bottom3[bottom3.length - 1].name} at ${bottom3[bottom3.length - 1].score.toFixed(3)}.`}
                </div>
              );
            })()}
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
              {["Drug", "Candidates", "Avg Score", "Avg Disc (Direct)", "Primers"].map((h) => (
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
                  {(() => {
                    const directRows = rows.filter(r => r.strategy === "Direct" && r.disc > 0 && r.disc < 900);
                    const proxCount = rows.filter(r => r.strategy === "Proximity").length;
                    if (directRows.length > 0) {
                      const avg = (directRows.reduce((a, r) => a + r.disc, 0) / directRows.length).toFixed(1);
                      return <td style={{ padding: "12px 24px", fontFamily: MONO }}>{avg}×<span style={{ fontSize: "9px", color: T.textTer, marginLeft: "3px" }}>({directRows.length})</span>{proxCount > 0 && <span style={{ fontSize: "9px", color: T.textTer, marginLeft: "4px" }}>+{proxCount} AS-RPA</span>}</td>;
                    }
                    return <td style={{ padding: "12px 24px", fontSize: "10px", color: T.purple, fontWeight: 600 }}>AS-RPA only</td>;
                  })()}
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

      {/* Score vs Discrimination Scatter */}
      {!mobile && (() => {
        const DRUG_SC = { RIF: "#2563EB", INH: "#D97706", EMB: "#7C3AED", FQ: "#E11D48", AG: "#4F46E5", PZA: "#16A34A", OTHER: "#9CA3AF" };
        const getScore = (r) => usesGuardNet ? (r.ensembleScore || r.score) : r.score;
        const scatterData = results.filter(r => r.disc > 0 && r.disc < 900).map(r => ({
          score: getScore(r), disc: Math.min(r.disc, 25), label: r.label, drug: r.drug, strategy: r.strategy, hasPrimers: r.hasPrimers,
        }));
        const inTopRight = scatterData.filter(d => d.score >= 0.4 && d.disc >= 3).length;
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px 32px", marginTop: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Score vs Discrimination</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>
                Each candidate plotted by efficiency score (x) and discrimination ratio (y).
                Top-right quadrant = diagnostic-ready. Dot size reflects primer availability.
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 25, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
                  <XAxis type="number" dataKey="score" name="Score" domain={[0, 1]} tick={{ fontSize: 10, fontFamily: MONO, fill: T.textTer }} label={{ value: "Efficiency Score", position: "insideBottom", offset: -12, fontSize: 11, fill: T.textSec }} />
                  <YAxis type="number" dataKey="disc" name="Discrimination" domain={[0, "auto"]} tick={{ fontSize: 10, fontFamily: MONO, fill: T.textTer }} label={{ value: "Discrimination (×)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: T.textSec }} />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    const ready = d.score >= 0.4 && d.disc >= 3;
                    return (
                      <div style={{ ...tooltipStyle, padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: "12px", color: DRUG_SC[d.drug] || T.text, marginBottom: "4px" }}>{d.label}</div>
                        <div style={{ fontSize: "11px", color: T.textSec }}>Score: <strong style={{ color: T.text }}>{d.score.toFixed(3)}</strong></div>
                        <div style={{ fontSize: "11px", color: T.textSec }}>Discrimination: <strong style={{ color: T.text }}>{d.disc.toFixed(1)}×</strong></div>
                        <div style={{ fontSize: "11px", color: T.textSec }}>{d.drug} · {d.strategy} · {d.hasPrimers ? "Primers OK" : "No primers"}</div>
                        <div style={{ marginTop: "4px" }}><Badge variant={ready ? "success" : "warning"}>{ready ? "Diagnostic-ready" : "Needs improvement"}</Badge></div>
                      </div>
                    );
                  }} />
                  <ReferenceLine x={0.4} stroke={T.danger} strokeDasharray="5 3" strokeWidth={1.5} />
                  <ReferenceLine y={3} stroke={T.warning} strokeDasharray="5 3" strokeWidth={1.5} />
                  <Scatter data={scatterData} isAnimationActive={false}>
                    {scatterData.map((entry, i) => (
                      <Cell key={i} fill={DRUG_SC[entry.drug] || DRUG_SC.OTHER} r={entry.hasPrimers ? 8 : 5} stroke="#fff" strokeWidth={2} opacity={entry.hasPrimers ? 0.9 : 0.5} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              {/* Quadrant labels */}
              <div style={{ position: "absolute", top: "24px", right: "28px", fontSize: "9px", fontWeight: 700, color: T.success, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Diagnostic-ready</div>
              <div style={{ position: "absolute", top: "24px", left: "60px", fontSize: "9px", fontWeight: 700, color: T.danger, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Low score</div>
              <div style={{ position: "absolute", bottom: "42px", right: "28px", fontSize: "9px", fontWeight: 700, color: T.warning, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Low discrimination</div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
              {[...new Set(results.map(r => r.drug))].map(d => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: DRUG_SC[d] || DRUG_SC.OTHER }} />
                  <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>{d}</span>
                </div>
              ))}
              <span style={{ fontSize: "10px", color: T.textTer }}>|</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.textTer, opacity: 0.8 }} />
                <span style={{ fontSize: "10px", color: T.textTer }}>With primers</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.textTer, opacity: 0.4 }} />
                <span style={{ fontSize: "10px", color: T.textTer }}>No primers</span>
              </div>
            </div>
            {/* Interpretation */}
            {(() => {
              const topRight = scatterData.filter(d => d.score >= 0.4 && d.disc >= 3);
              const bottomRight = scatterData.filter(d => d.score >= 0.4 && d.disc < 3);
              const topLeft = scatterData.filter(d => d.score < 0.4 && d.disc >= 3);
              const bestCandidate = [...scatterData].sort((a, b) => (b.score * b.disc) - (a.score * a.disc))[0];
              const worstCandidate = [...scatterData].sort((a, b) => (a.score * a.disc) - (b.score * b.disc))[0];
              const proximityCands = results.filter(r => r.strategy === "Proximity" && r.gene !== "IS6110");
              const viableProx = proximityCands.filter(r => !r.asrpaDiscrimination || r.asrpaDiscrimination.block_class !== "none");
              const nonViableProx = proximityCands.length - viableProx.length;
              return (
                <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                  <strong style={{ color: T.primary }}>Interpretation:</strong> {topRight.length}/{scatterData.length} Direct candidates are diagnostic-ready (score ≥ 0.4, disc ≥ 3×).
                  {bestCandidate ? ` Best overall: ${bestCandidate.label} (${bestCandidate.score.toFixed(3)}, ${bestCandidate.disc.toFixed(1)}×).` : ""}
                  {bottomRight.length > 0 ? ` ${bottomRight.length} Direct candidate${bottomRight.length > 1 ? "s have" : " has"} good scores but low Cas12a discrimination (${bottomRight.slice(0, 2).map(d => d.label).join(", ")}${bottomRight.length > 2 ? "…" : ""}) — synthetic mismatch enhancement may improve these.` : ""}
                  {topLeft.length > 0 ? ` ${topLeft.length} candidate${topLeft.length > 1 ? "s" : ""} ${topLeft.length > 1 ? "have" : "has"} strong discrimination but weak scores — alternative spacers may help.` : ""}
                  {proximityCands.length > 0 ? ` ${proximityCands.length} Proximity candidate${proximityCands.length > 1 ? "s are" : " is"} not plotted — their discrimination comes from AS-RPA primers, not crRNA mismatch. Of these, ${viableProx.length} show viable AS-RPA discrimination${nonViableProx > 0 ? ` and ${nonViableProx} ha${nonViableProx > 1 ? "ve" : "s"} no viable discrimination pathway (WC pair)` : ""}.` : ""}
                  {worstCandidate && worstCandidate !== bestCandidate ? ` Weakest Direct: ${worstCandidate.label} (${worstCandidate.score.toFixed(3)}, ${worstCandidate.disc.toFixed(1)}×).` : ""}
                </div>
              );
            })()}
          </div>
        );
      })()}
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
  const cellBorder = (nt) => nt.isSnp ? T.danger : nt.isSynthMM ? T.warning : nt.isSeed ? "rgba(79,70,229,0.25)" : T.borderLight;
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
            { color: T.primaryLight, label: "Seed (1–8)", border: "rgba(79,70,229,0.25)" },
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

const generateInterpretation = (r) => {
  const lines = [];
  const eff = r.ensembleScore || r.score;
  const gc = r.gc * 100;
  const disc = typeof r.disc === "number" ? r.disc : 0;
  const spacer = (r.hasSM && r.smSpacer) ? r.smSpacer : r.spacer;
  const wt = r.wtSpacer && r.wtSpacer.length === spacer.length ? r.wtSpacer : null;

  // Find SNP position
  let snpPos = null;
  let snpChange = null;
  if (wt) {
    for (let i = 0; i < spacer.length; i++) {
      if (spacer[i] !== wt[i]) {
        const isSM = r.hasSM && r.smPosition && (r.smPosition - 1) === i;
        if (!isSM) { snpPos = i + 1; snpChange = `${wt[i]}\u2192${spacer[i]}`; break; }
      }
    }
  }

  // Overall assessment
  if (eff >= 0.7) lines.push(`Strong candidate (activity score ${eff.toFixed(3)}). High predicted Cas12a trans-cleavage rate — expected to generate a clear fluorescent signal within 10–15 min in the DETECTR assay, well above the limit of detection.`);
  else if (eff >= 0.5) lines.push(`Moderate candidate (activity score ${eff.toFixed(3)}). Predicted trans-cleavage is sufficient for detection but not optimal — the fluorescent signal may require 20–30 min to reach a confident positive call, or may produce a weaker band on lateral flow.`);
  else lines.push(`Weak candidate (activity score ${eff.toFixed(3)}). Low predicted trans-cleavage rate — the collateral cleavage signal may be near the detection limit, risking false negatives. Consider alternatives from the top-K list or synthetic mismatch optimisation.`);

  // PAM quality
  const pam = (r.pam || "").toUpperCase();
  if (pam.match(/^TTT[ACGV]/)) lines.push(`Canonical PAM (${r.pam}) \u2014 optimal Cas12a recognition. LbCas12a binds this PAM with highest affinity.`);
  else lines.push(`Non-canonical PAM (${r.pam}) \u2014 reduced binding affinity compared to TTTV. This is the best available PAM site in the GC-rich M. tuberculosis genomic context around this mutation.`);

  // Discrimination
  const discModelName = r.discrimination?.model_name || "";
  const isLearnedDisc = discModelName.includes("learned");
  const discSource = isLearnedDisc ? "learned model (XGBoost, 15 thermodynamic features)" : "heuristic model (position \u00D7 destabilisation)";
  if (r.strategy === "Proximity") {
    lines.push(`Proximity detection \u2014 the resistance SNP falls outside the crRNA spacer${r.proximityDistance ? ` (${r.proximityDistance} bp away)` : ""}. Allele discrimination relies on AS-RPA primers (10\u2013100\u00D7 selectivity), not Cas12a mismatch intolerance. The Cas12a disc ratio (~${disc.toFixed(1)}\u00D7) is not relevant for this strategy.`);
  } else if (snpPos) {
    // Mismatch chemistry context
    let mmChem = "";
    if (snpChange) {
      const bases = snpChange.split("\u2192");
      if (bases.length === 2) {
        const purines = new Set(["A", "G"]);
        const b1 = bases[0].toUpperCase(), b2 = bases[1].toUpperCase();
        if (purines.has(b1) && purines.has(b2)) mmChem = " (purine\u2192purine, severely destabilising)";
        else if (!purines.has(b1) && !purines.has(b2)) mmChem = " (pyrimidine\u2192pyrimidine, moderately destabilising)";
        else if ((b1 === "G" && b2 === "T") || (b1 === "T" && b2 === "G")) mmChem = " (G:T wobble, tolerated by Cas12a)";
        else mmChem = " (transversion)";
      }
    }
    if (snpPos <= 8) {
      if (disc >= 5) lines.push(`SNP at seed position ${snpPos} (${snpChange}${mmChem}) provides strong discrimination (${disc.toFixed(1)}\u00D7, ${discSource}). The mismatch in the PAM-proximal seed region (pos 1\u20138) causes near-complete R-loop collapse on the wildtype template, ensuring high specificity.`);
      else if (disc >= 3) lines.push(`SNP at seed position ${snpPos} (${snpChange}${mmChem}) provides diagnostic-grade discrimination (${disc.toFixed(1)}\u00D7, ${discSource}). Seed region mismatches are highly destabilising for Cas12a binding.`);
      else lines.push(`SNP at seed position ${snpPos} (${snpChange}${mmChem}) gives limited discrimination (${disc.toFixed(1)}\u00D7, ${discSource}) despite being in the seed region. The surrounding sequence context or mismatch chemistry may stabilise partial R-loop formation. Synthetic mismatch enhancement may improve this.`);
    } else {
      if (disc >= 3) lines.push(`SNP at PAM-distal position ${snpPos} (${snpChange}${mmChem}) provides ${disc.toFixed(1)}\u00D7 discrimination (${discSource}). Although outside the seed, the mismatch is sufficient for diagnostic-grade allele differentiation.`);
      else lines.push(`SNP at PAM-distal position ${snpPos} (${snpChange}${mmChem}) gives limited discrimination (${disc.toFixed(1)}\u00D7, ${discSource}). PAM-distal mismatches are better tolerated by Cas12a \u2014 synthetic mismatch in the seed region could boost specificity.`);
    }
  } else if (r.strategy === "Direct" && !wt) {
    lines.push(`Direct detection strategy. Discrimination ratio: ${disc.toFixed(1)}\u00D7 (${discSource}). WT spacer data unavailable for positional analysis.`);
  }

  // Synthetic mismatch
  if (r.hasSM) {
    let smPos = r.smPosition || null;
    let smChange = null;
    if (smPos && wt && spacer[smPos - 1] !== wt[smPos - 1]) smChange = `${wt[smPos - 1]}\u2192${spacer[smPos - 1]}`;
    if (smPos && smChange) lines.push(`Synthetic mismatch at position ${smPos} (${smChange}) creates a double-mismatch penalty on the wildtype template. This engineered substitution boosts discrimination at the cost of ~15\u201320% reduced cleavage activity on the mutant target.`);
    else lines.push("Synthetic mismatch applied \u2014 an engineered base substitution in the seed region creates a double-mismatch penalty on the wildtype template, boosting specificity.");
  }

  // GC content
  if (gc > 65) lines.push(`High GC content (${gc.toFixed(0)}%) increases R-loop thermodynamic stability but also raises the energetic cost of target strand unwinding. This is typical for M. tuberculosis (genome-wide GC ~65.6%).`);
  else if (gc < 40) lines.push(`Low GC content (${gc.toFixed(0)}%) \u2014 unusual for M. tuberculosis. R-loop stability may be reduced, potentially lowering cleavage efficiency.`);

  // Off-targets
  if (r.ot > 0) lines.push(`${r.ot} potential off-target site${r.ot > 1 ? "s" : ""} detected in the H37Rv genome. Review cross-reactivity before synthesis \u2014 off-targets within the same amplicon region could generate false positives.`);

  return lines;
};

const CandidateAccordion = ({ r, onShowAlternatives }) => {
  const mobile = useIsMobile();
  const toast = useToast();
  const ref = r.refs;
  const discColor = r.disc >= 3 ? T.success : r.disc >= 2 ? T.primary : r.disc >= 1.5 ? T.warning : T.danger;
  const displaySpacer = (r.hasSM && r.smSpacer) ? r.smSpacer : r.spacer;
  const [openTab, setOpenTab] = useState(null);
  const interpretation = useMemo(() => generateInterpretation(r), [r]);

  const toggleTab = (tab) => { setOpenTab(prev => prev === tab ? null : tab); };

  const tabStyle = (tab) => ({
    flex: 1, padding: "10px 14px", background: openTab === tab ? T.bg : "transparent",
    border: `1px solid ${openTab === tab ? T.border : T.borderLight}`,
    borderBottom: openTab === tab ? "none" : `1px solid ${T.borderLight}`,
    borderRadius: openTab === tab ? "8px 8px 0 0" : "8px",
    cursor: "pointer", fontSize: "11px", fontWeight: 600,
    color: openTab === tab ? T.primary : T.textSec, fontFamily: FONT,
    display: "flex", alignItems: "center", gap: "6px", justifyContent: "center",
    transition: "all 0.15s",
  });

  return (
    <div style={{ padding: mobile ? "16px" : "20px 24px", background: T.bgSub, borderTop: `1px solid ${T.borderLight}` }}>
      {/* Key metrics row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0", background: T.bg, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
        {[
          { l: "Ensemble", v: (r.ensembleScore || r.score).toFixed(3), c: (r.ensembleScore || r.score) > 0.8 ? T.primary : (r.ensembleScore || r.score) > 0.65 ? T.warning : T.danger },
          { l: "Heuristic", v: r.score.toFixed(3), c: T.textSec },
          ...(r.cnnCalibrated != null ? [{ l: r.mlScores?.some(m => (m.model_name || m.modelName) === "guard_net") ? "GUARD-Net" : "CNN (cal)", v: r.cnnCalibrated.toFixed(3), c: r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger }] : []),
          { l: r.strategy === "Proximity" ? "Disc (AS-RPA)" : "Discrimination", v: r.strategy === "Proximity" ? (r.asrpaDiscrimination ? (r.asrpaDiscrimination.block_class === "none" ? "1× (no mismatch)" : `${r.asrpaDiscrimination.disc_ratio >= 100 ? "≥100" : r.asrpaDiscrimination.disc_ratio.toFixed(0)}× ${r.asrpaDiscrimination.terminal_mismatch}`) : "AS-RPA") : r.gene === "IS6110" ? "N/A (control)" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`, c: r.strategy === "Proximity" ? (r.asrpaDiscrimination?.block_class === "none" ? T.danger : T.purple) : r.gene === "IS6110" ? T.textTer : discColor },
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

      {/* crRNA Spacer Architecture — full width, with Show Alternatives top-right */}
      <div style={{ position: "relative" }}>
        {onShowAlternatives && (
          <button onClick={(e) => { e.stopPropagation(); onShowAlternatives(); }} style={{
            position: "absolute", top: 0, right: 0, zIndex: 2,
            background: T.primaryLight, border: `1px solid ${T.primary}44`,
            borderRadius: "6px", padding: "6px 14px", cursor: "pointer",
            fontSize: "11px", fontWeight: 600, color: T.primaryDark, fontFamily: FONT,
            display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.primaryLight; e.currentTarget.style.color = T.primaryDark; }}
          >
            <Layers size={12} /> Show alternatives
          </button>
        )}
        <SpacerArchitecture r={r} />
      </div>

      {/* Dynamic Interpretation Box */}
      <div style={{ background: `linear-gradient(135deg, ${T.primaryLight} 0%, ${T.primarySub} 100%)`, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <Info size={14} color={T.primary} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING }}>Interpretation</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {interpretation.map((line, i) => (
            <div key={i} style={{ fontSize: "11.5px", color: T.primaryDark, lineHeight: 1.65, paddingLeft: "22px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, top: "1px", width: "14px", height: "14px", borderRadius: "50%", background: T.primarySub, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 700, color: T.primary }}>{i + 1}</span>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible detail tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: openTab ? "0" : "0" }}>
        <div style={tabStyle("amplicon")} onClick={(e) => { e.stopPropagation(); toggleTab("amplicon"); }}>
          <Map size={12} /> Amplicon & Mismatch
        </div>
        <div style={tabStyle("oligos")} onClick={(e) => { e.stopPropagation(); toggleTab("oligos"); }}>
          <Copy size={12} /> Oligo Sequences
        </div>
        <div style={tabStyle("evidence")} onClick={(e) => { e.stopPropagation(); toggleTab("evidence"); }}>
          <FileText size={12} /> Evidence & Metadata
        </div>
      </div>

      {/* Tab content */}
      {openTab && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "16px", animation: "fadeIn 0.15s ease-out" }}>

          {/* Amplicon & Mismatch tab */}
          {openTab === "amplicon" && (
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Amplicon Map</div>
                <div style={{ background: T.bgSub, borderRadius: "8px", padding: "8px 4px", border: `1px solid ${T.borderLight}` }}>
                  <AmpliconMap r={r} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>MUT vs WT Mismatch</div>
                <div style={{ background: T.bgSub, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, overflowX: "auto" }}>
                  <MismatchProfile spacer={displaySpacer} wtSpacer={r.wtSpacer} strategy={r.strategy} />
                </div>
              </div>
              {r.hasPrimers && (
                <div style={{ gridColumn: mobile ? "1" : "1 / -1", display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                    <div style={{ color: T.textTer, marginBottom: "2px" }}>Amplicon</div>
                    <div style={{ fontWeight: 700, fontFamily: MONO, color: T.text }}>{r.amplicon} bp</div>
                  </div>
                  <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                    <div style={{ color: T.textTer, marginBottom: "2px" }}>PAM</div>
                    <div style={{ fontWeight: 700, fontFamily: MONO, color: T.text }}>{r.pam}</div>
                  </div>
                  <div style={{ flex: 1, background: r.hasSM ? T.primaryLight : T.bgSub, borderRadius: "8px", padding: "10px", border: `1px solid ${T.borderLight}`, fontSize: "11px" }}>
                    <div style={{ color: T.textTer, marginBottom: "2px" }}>SM</div>
                    <div style={{ fontWeight: 700, color: r.hasSM ? T.primaryDark : T.textTer }}>{r.hasSM ? "Yes" : "No"}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Oligo Sequences tab */}
          {openTab === "oligos" && (
            <div style={{ background: T.bgSub, border: `1px solid ${T.borderLight}`, borderRadius: "8px", overflow: "hidden" }}>
              {[
                { name: `${r.label}_crRNA`, seq: `AATTTCTACTCTTGTAGAT${displaySpacer}`, note: "Direct repeat + spacer" },
                ...(r.fwd ? [{ name: `${r.label}_FWD`, seq: r.fwd, note: r.strategy === "Direct" ? "Standard RPA forward" : "AS-RPA forward (allele-specific)" }] : []),
                ...(r.rev ? [{ name: `${r.label}_REV`, seq: r.rev, note: r.strategy === "Direct" ? "Standard RPA reverse" : "AS-RPA reverse (allele-specific)" }] : []),
              ].map((o, i, arr) => (
                <div key={o.name} style={{ padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: MONO, color: T.text }}>{o.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(o.seq); toast(`${o.name} copied`); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "3px 8px", cursor: "pointer", fontSize: "9px", color: T.textSec, display: "flex", alignItems: "center", gap: "3px" }}><Copy size={9} /> Copy</button>
                  </div>
                  <div style={{ background: T.bg, borderRadius: "6px", padding: "8px 10px", border: `1px solid ${T.borderLight}`, marginBottom: "4px" }}>
                    <Seq s={o.seq} />
                  </div>
                  <div style={{ fontSize: "9px", color: T.textTer }}>{o.note} — {o.seq.length} nt</div>
                </div>
              ))}
            </div>
          )}

          {/* Evidence & Metadata tab */}
          {openTab === "evidence" && (
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
              {ref && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Clinical Evidence</div>
                  <div style={{ background: T.bgSub, border: `1px solid ${T.borderLight}`, borderRadius: "8px", overflow: "hidden" }}>
                    {[
                      ["WHO Classification", ref.who],
                      ["Catalogue", ref.catalogue],
                      ["Clinical Frequency", ref.freq],
                      ["CRyPTIC", ref.cryptic || "—"],
                    ].map(([k, v], i) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: i < 3 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px" }}>
                        <span style={{ color: T.textSec }}>{k}</span>
                        <span style={{ fontWeight: 600, color: T.text, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Assay Parameters</div>
                <div style={{ background: T.bgSub, border: `1px solid ${T.borderLight}`, borderRadius: "8px", overflow: "hidden" }}>
                  {[
                    ["Drug Class", r.drug],
                    ["Gene", r.gene],
                    ["Strategy", r.strategy],
                    ["PAM Sequence", r.pam],
                    ["Spacer Length", `${(r.spacer || "").length} nt`],
                    ["GC Content", `${(r.gc * 100).toFixed(1)}%`],
                    ...(r.amplicon ? [["Amplicon Size", `${r.amplicon} bp`]] : []),
                    ["Synthetic Mismatch", r.hasSM ? `Yes (pos ${r.smPosition || "?"})` : "No"],
                    ["Off-targets", `${r.ot}`],
                  ].map(([k, v], i, arr) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px" }}>
                      <span style={{ color: T.textSec }}>{k}</span>
                      <span style={{ fontWeight: 600, color: T.text, fontFamily: MONO }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CandidatesTab = ({ results, jobId, connected, scorer }) => {
  const mobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(scorer === "guard_net" ? "ensembleScore" : "score");
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

  const hasGuardNet = scorer === "guard_net" || results.some(r => r.mlScores?.some(m => (m.model_name || m.modelName) === "guard_net"));
  const hasML = hasGuardNet || results.some(r => r.cnnCalibrated != null);
  const mlColLabel = hasGuardNet ? "GN" : "CNN";

  const cols = [
    { key: "label", label: "Target", w: 140 },
    { key: "drug", label: "Drug", w: 70 },
    { key: "strategy", label: "Strategy", w: 80 },
    { key: "spacer", label: "Spacer", w: 200 },
    { key: "ensembleScore", label: hasML ? "Ensemble" : "Score", w: 70 },
    ...(hasML ? [{ key: "score", label: "Heuristic", w: 75 }] : []),
    ...(hasML ? [{ key: "cnnCalibrated", label: mlColLabel, w: 65 }] : []),
    { key: "disc", label: "Disc", w: 80 },
    { key: "gc", label: "GC%", w: 55 },
    { key: "ot", label: "OT", w: 40 },
  ];

  return (
    <div>
      {/* Blue explainer box */}
      <div style={{ background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "10px", padding: mobile ? "14px" : "18px 22px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: T.primaryDark, fontFamily: HEADING, marginBottom: "6px" }}>Reading the table</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : hasML ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: "6px 20px", fontSize: "12px", color: T.primaryDark, lineHeight: 1.5, opacity: 0.85 }}>
          <div><strong>Score</strong> — predicted trans-cleavage activity (0–1). Higher = stronger fluorescent signal. {hasML ? `Ensemble of heuristic + ${hasGuardNet ? "GUARD-Net" : "CNN"}.` : "Heuristic composite."}</div>
          <div><strong>Disc</strong> — fold-difference in cleavage between MUT and WT templates. ≥ 3× = diagnostic-grade specificity.</div>
          {hasML && <div><strong>{mlColLabel}</strong> — {hasGuardNet ? "GUARD-Net neural network" : "ML calibrated"} activity prediction (before ensemble).</div>}
          <div><strong>Expand</strong> — click any row for full interpretation, crRNA architecture, primers, and alternatives.</div>
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
                      <span style={{ color: T.textTer }}>{hasML ? "Ensemble" : "Score"} </span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, color: scoreVal > 0.8 ? T.primary : scoreVal > 0.65 ? T.warning : T.danger }}>{scoreVal.toFixed(3)}</span>
                    </div>
                    <div>
                      <span style={{ color: T.textTer }}>Disc </span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, color: discColor }}>
                        {r.strategy === "Proximity" ? "AS-RPA" : r.gene === "IS6110" ? "N/A" : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`}
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
                    <CandidateAccordion r={r} onShowAlternatives={() => loadTopK(r.label)} />
                    {/* Top-K Alternatives inline */}
                    {topKLoading[r.label] && <div style={{ padding: "8px 16px", fontSize: "11px", color: T.textTer, background: T.bgSub }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />Loading alternatives…</div>}
                    {topKData[r.label]?.alternatives && (
                      <div style={{ margin: "0 16px 16px", border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden", background: T.bg }}>
                        <div style={{ padding: "8px 12px", background: T.primaryLight, fontSize: "11px", fontWeight: 700, color: T.primaryDark, borderBottom: `1px solid ${T.border}` }}>Top-K Alternatives for {r.label}</div>
                        {topKData[r.label].alternatives.map((alt, ai) => (
                          <div key={ai} style={{ padding: "8px 12px", borderBottom: ai < topKData[r.label].alternatives.length - 1 ? `1px solid ${T.borderLight}` : "none", fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div><span style={{ fontFamily: MONO, fontWeight: 600 }}>#{alt.rank}</span> <Seq s={alt.spacer_seq?.slice(0, 16)} /></div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ fontFamily: MONO }}>{alt.score}</span>
                              <span style={{ fontFamily: MONO }}>{r.strategy === "Proximity" ? <span style={{ fontSize: "10px", color: T.purple }}>AS-RPA</span> : `${alt.discrimination}×`}</span>
                              {alt.has_primers ? <Badge variant="success">P</Badge> : <Badge variant="danger">—</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                    {hasML && <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.score > 0.8 ? T.primary : r.score > 0.65 ? T.warning : T.danger }}>{r.score.toFixed(3)}</td>}
                    {hasML && <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.cnnCalibrated != null ? (r.cnnCalibrated > 0.7 ? T.primary : r.cnnCalibrated > 0.5 ? T.warning : T.danger) : T.textTer }}>{r.cnnCalibrated != null ? r.cnnCalibrated.toFixed(3) : "—"}</td>}
                    <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: r.gene === "IS6110" ? T.textTer : r.strategy === "Proximity" ? T.purple : r.disc >= 3 ? T.success : r.disc >= 1.5 ? T.warning : T.danger }}>
                      {r.gene === "IS6110" ? <span style={{ fontSize: "10px", color: T.textTer }}>N/A</span> : r.strategy === "Proximity" ? <span style={{ fontSize: "10px" }}>AS-RPA</span> : `${typeof r.disc === "number" ? r.disc.toFixed(1) : r.disc}×`}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO }}>{(r.gc * 100).toFixed(0)}%</td>
                    <td style={{ padding: "10px 12px", fontFamily: MONO }}>{r.ot}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={cols.length + 1} style={{ padding: 0 }}>
                        <CandidateAccordion r={r} onShowAlternatives={() => loadTopK(r.label)} />
                        {/* Top-K Alternatives inline */}
                        {topKLoading[r.label] && <div style={{ padding: "8px 24px", fontSize: "11px", color: T.textTer, background: T.bgSub }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />Loading alternatives…</div>}
                        {topKData[r.label]?.alternatives && (
                          <div style={{ margin: "0 24px 16px", border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden", background: T.bg }}>
                            <div style={{ padding: "10px 14px", background: T.primaryLight, fontSize: "11px", fontWeight: 700, color: T.primaryDark, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "6px" }}>
                              <Layers size={12} /> Top-K Alternatives for {r.label}
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                              <thead>
                                <tr style={{ background: T.bgSub }}>
                                  {["Rank", "Spacer", "Score", "Disc", "Primers", "Tradeoff"].map(h => (
                                    <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: T.textTer, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.borderLight}` }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {topKData[r.label].alternatives.map((alt, ai) => (
                                  <tr key={ai} style={{ borderBottom: ai < topKData[r.label].alternatives.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                                    <td style={{ padding: "7px 12px", fontFamily: MONO, fontWeight: 700, color: T.textSec }}>#{alt.rank}</td>
                                    <td style={{ padding: "7px 12px" }}><Seq s={alt.spacer_seq?.slice(0, 20)} /></td>
                                    <td style={{ padding: "7px 12px", fontFamily: MONO, fontWeight: 600 }}>{alt.score}</td>
                                    <td style={{ padding: "7px 12px", fontFamily: MONO, fontWeight: 600 }}>{r.strategy === "Proximity" ? <span style={{ fontSize: "10px", color: T.purple }}>AS-RPA</span> : `${alt.discrimination}×`}</td>
                                    <td style={{ padding: "7px 12px" }}>{alt.has_primers ? <Badge variant="success">Yes</Badge> : <Badge variant="danger">No</Badge>}</td>
                                    <td style={{ padding: "7px 12px", fontSize: "10px", color: T.textSec }}>{alt.tradeoff || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
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

      {/* Discrimination chart — drug-colored bars, sorted desc */}
      {(() => {
        const DRUG_DC = { RIF: "#2563EB", INH: "#D97706", EMB: "#7C3AED", FQ: "#E11D48", AG: "#4F46E5", PZA: "#16A34A", OTHER: "#9CA3AF" };
        const DRUG_DC_LIGHT = { RIF: "rgba(37,99,235,0.15)", INH: "rgba(217,119,6,0.15)", EMB: "rgba(124,58,237,0.15)", FQ: "rgba(225,29,72,0.15)", AG: "rgba(79,70,229,0.15)", PZA: "rgba(22,163,74,0.15)", OTHER: "rgba(156,163,175,0.15)" };
        const sorted = [...directCands].sort((a, b) => b.disc - a.disc);
        const discChart = sorted.map((r) => ({ name: r.label, disc: +r.disc, score: r.score, drug: r.drug }));
        const diagGrade = discChart.filter(d => d.disc >= 3).length;
        return (
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: mobile ? "20px" : "28px 32px", marginBottom: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Discrimination Ratio — Direct Detection</div>
              <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>
                {directCands.length} candidates using crRNA mismatch discrimination. Sorted highest to lowest.
                The ratio indicates how many times stronger the signal is on resistant vs susceptible DNA.
              </div>
              <div style={{ fontSize: "10px", color: T.textTer, marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: directCands.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "#22c55e" : T.warning }} />
                {directCands.some(r => (r.discrimination?.model_name || "").includes("learned"))
                  ? "Predicted by learned model (XGBoost on 15 thermodynamic features, trained on 6,136 EasyDesign pairs)"
                  : "Predicted by heuristic model (position sensitivity \u00D7 mismatch destabilisation)"
                }
              </div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={discChart} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={T.borderLight} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: T.textTer, fontFamily: MONO }} angle={-50} textAnchor="end" height={65} axisLine={{ stroke: T.border }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: T.textTer, fontFamily: MONO }} axisLine={false} tickLine={false} label={{ value: "Discrimination (×)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: T.textTer }, offset: 0 }} />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  return (
                    <div style={{ ...tooltipStyle, padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "12px", color: DRUG_DC[d.drug] || T.text }}>{d.name}</div>
                      <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px" }}>Discrimination: <strong style={{ color: T.text }}>{d.disc.toFixed(1)}×</strong></div>
                      <div style={{ fontSize: "11px", color: T.textSec }}>Score: {d.score.toFixed(3)} · {d.drug}</div>
                      <div style={{ marginTop: "4px" }}><Badge variant={d.disc >= 10 ? "success" : d.disc >= 3 ? "primary" : d.disc >= 2 ? "warning" : "danger"}>{d.disc >= 10 ? "Excellent" : d.disc >= 3 ? "Good" : d.disc >= 2 ? "Acceptable" : "Insufficient"}</Badge></div>
                    </div>
                  );
                }} />
                <ReferenceLine y={3} stroke={T.warning} strokeDasharray="5 3" strokeWidth={1.5} label={{ value: "3× diagnostic", position: "left", style: { fontSize: 10, fill: T.warning, fontWeight: 600 } }} />
                <ReferenceLine y={2} stroke={T.danger} strokeDasharray="4 4" strokeWidth={1} label={{ value: "2× minimum", position: "left", style: { fontSize: 10, fill: T.danger, fontWeight: 500 } }} />
                <Bar dataKey="disc" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {discChart.map((entry, i) => (
                    <Cell key={i} fill={DRUG_DC_LIGHT[entry.drug] || DRUG_DC_LIGHT.OTHER} stroke={DRUG_DC[entry.drug] || DRUG_DC.OTHER} strokeWidth={1} />
                  ))}
                </Bar>
                <Scatter dataKey="disc" r={5} isAnimationActive={false}>
                  {discChart.map((entry, i) => (
                    <Cell key={i} fill={DRUG_DC[entry.drug] || DRUG_DC.OTHER} stroke="#fff" strokeWidth={1.5} />
                  ))}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
              {[...new Set(directCands.map(r => r.drug))].map(d => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "3px", background: DRUG_DC[d] || DRUG_DC.OTHER }} />
                  <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>{d}</span>
                </div>
              ))}
              <span style={{ fontSize: "10px", color: T.textTer }}>|</span>
              <span style={{ fontSize: "10px", color: T.warning, fontWeight: 600 }}>3× diagnostic</span>
              <span style={{ fontSize: "10px", color: T.danger, fontWeight: 600 }}>2× minimum</span>
            </div>
            {(() => {
              const bestDisc = discChart[0];
              const worstDisc = discChart[discChart.length - 1];
              const below2 = discChart.filter(d => d.disc < 2);
              const avgDisc = +(discChart.reduce((a, d) => a + d.disc, 0) / discChart.length).toFixed(1);
              return (
                <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                  <strong style={{ color: T.primary }}>Interpretation:</strong> {diagGrade}/{directCands.length} candidates reach diagnostic-grade (≥ 3×), panel avg {avgDisc}×{directCands.some(r => (r.discrimination?.model_name || "").includes("learned")) ? " (learned model)" : " (heuristic)"}.
                  {bestDisc ? ` Highest: ${bestDisc.name} at ${bestDisc.disc.toFixed(1)}× — likely a seed-region mismatch (positions 1–4).` : ""}
                  {worstDisc ? ` Lowest: ${worstDisc.name} at ${worstDisc.disc.toFixed(1)}×${worstDisc.disc < 2 ? " — insufficient for any detection method, SM enhancement required." : worstDisc.disc < 3 ? " — acceptable but not diagnostic-grade." : "."}` : ""}
                  {below2.length > 0 ? ` ${below2.length} candidate${below2.length > 1 ? "s" : ""} (${below2.map(d => d.name).slice(0, 3).join(", ")}${below2.length > 3 ? "…" : ""}) fall below the 2× minimum — these have PAM-distal mismatches and require synthetic mismatch engineering.` : " All candidates meet the 2× minimum detection threshold."}
                  {excellent > 0 ? ` ${excellent} candidate${excellent > 1 ? "s" : ""} ${excellent > 1 ? "achieve" : "achieves"} excellent (≥ 10×) discrimination, suitable for lateral-flow deployment.` : ""}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Ranking table — Direct only */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>Discrimination Ranking — Direct Detection</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: T.bgSub }}>
              {["Rank", "Target", "Drug", "Discrimination", "Model", "Score", "Status"].map(h => (
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
                <td style={{ padding: "10px 14px", fontSize: "10px", color: (r.discrimination?.model_name || "").includes("learned") ? T.success : T.textTer }}>
                  {(r.discrimination?.model_name || "").includes("learned") ? "Learned" : "Heuristic"}
                </td>
                <td style={{ padding: "10px 14px", fontFamily: MONO }}>{(r.ensembleScore || r.score).toFixed(3)}</td>
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
            {proximityCands.some(r => r.asrpaDiscrimination) && (
              <span> Thermodynamic estimates below are based on 3′ terminal mismatch identity and penultimate mismatch design.</span>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: T.bgSub }}>
                {["Target", "Drug", "Distance", "Score", "Mismatch", "Disc. Ratio", "Block", "Primers"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.borderLight}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proximityCands.map((r) => {
                const d = r.asrpaDiscrimination;
                const blockColor = d?.block_class === "strong" ? T.success : d?.block_class === "moderate" ? T.warning : T.danger;
                return (
                  <tr key={r.label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, fontSize: "11px" }}>{r.label}</td>
                    <td style={{ padding: "10px 14px" }}><DrugBadge drug={r.drug} /></td>
                    <td style={{ padding: "10px 14px", fontFamily: MONO, color: T.purple }}>{r.proximityDistance ? `${r.proximityDistance} bp` : "—"}</td>
                    <td style={{ padding: "10px 14px", fontFamily: MONO }}>{r.score.toFixed(3)}</td>
                    <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 700 }}>{d?.terminal_mismatch || "—"}</td>
                    <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 700, color: d ? (d.block_class === "none" ? T.danger : d.disc_ratio >= 50 ? T.success : d.disc_ratio >= 10 ? T.warning : T.danger) : T.textTer }}>
                      {d ? (d.block_class === "none" ? "1× (WC)" : d.disc_ratio >= 100 ? "≥100×" : `${d.disc_ratio.toFixed(0)}×`) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {d ? (d.block_class === "none"
                        ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "#FEE2E2", color: T.danger, textTransform: "uppercase" }}>NO DISC</span>
                        : <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: blockColor + "20", color: blockColor, textTransform: "uppercase" }}>{d.block_class}</span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {d?.block_class === "none"
                        ? <Badge variant="danger">Not viable</Badge>
                        : <Badge variant={r.hasPrimers ? "success" : "danger"}>{r.hasPrimers ? "AS-RPA" : "No primers"}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {proximityCands.some(r => r.asrpaDiscrimination?.block_class === "none") && (
            <div style={{ padding: "12px 20px", fontSize: "11px", color: T.danger, background: "#FEF2F2", borderTop: `1px solid #FECACA` }}>
              <strong>Panel gap:</strong> {proximityCands.filter(r => r.asrpaDiscrimination?.block_class === "none").map(r => r.label).join(", ")} — primer 3′ base forms a Watson-Crick pair with the WT template (no mismatch = no discrimination).
              These targets require primer strand reversal, alternative SNP base selection, or a different discrimination strategy.
            </div>
          )}
          {proximityCands.some(r => r.asrpaDiscrimination) && (
            <div style={{ padding: "12px 20px", fontSize: "10px", color: T.textTer, fontStyle: "italic", borderTop: `1px solid ${T.purple}15` }}>
              Thermodynamic estimates — not experimentally validated. Ratios from Boltzmann conversion exp(ΔΔG/RT) at 37 °C, capped at 100× (empirical AS-RPA discrimination typically 10–100×; Ye et al. 2019).
            </div>
          )}
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
            containing the crRNA binding site. Discrimination ratios are {results.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "predicted by a learned model (LightGBM, 15 thermodynamic features)" : "estimated by position × destabilisation heuristic"}.
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
              {["Target", "Type", "Disc", "Forward Primer", "Reverse Primer", "Amplicon", "SM"].map((h) => (
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
                <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600, fontSize: "11px", color: r.gene === "IS6110" ? T.textTer : r.strategy === "Proximity" ? T.purple : r.disc >= 3 ? T.success : r.disc >= 2 ? T.warning : T.danger }}>
                  {r.gene === "IS6110" ? "N/A" : r.strategy === "Proximity" ? "AS-RPA" : r.disc > 0 ? `${r.disc.toFixed(1)}×` : "—"}
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

const MultiplexTab = ({ results, panelData }) => {
  const mobile = useIsMobile();
  const drugs = [...new Set(results.map((r) => r.drug))];
  const controlIncluded = results.some((r) => r.gene === "IS6110");
  const directCount = results.filter(r => r.strategy === "Direct").length;
  const proximityCount = results.filter(r => r.strategy === "Proximity").length;
  const withPrimers = results.filter(r => r.hasPrimers && !(r.asrpaDiscrimination?.block_class === "none")).length;
  const dimerMatrix = panelData?.primer_dimer_matrix || null;
  const dimerLabels = panelData?.primer_dimer_labels || null;
  const dimerReport = panelData?.primer_dimer_report || null;

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
            minimizes cross-talk while maximizing discrimination across the full panel. {results.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "Discrimination ratios are predicted by the learned model (LightGBM, 15 thermodynamic features) and used during optimization — the panel is selected with these predictions, not relabeled post-hoc." : ""}
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
            const directDrug = drugResults.filter(r => r.strategy === "Direct" && r.disc > 0 && r.disc < 900);
            const avgDiscDrug = directDrug.length ? +(directDrug.reduce((a, r) => a + r.disc, 0) / directDrug.length).toFixed(1) : null;
            return (
              <div key={d} style={{ padding: "16px", borderRadius: "10px", border: `1px solid ${T.border}`, background: T.bgSub, textAlign: "center" }}>
                <DrugBadge drug={d} />
                <div style={{ fontSize: "24px", fontWeight: 800, color: T.text, fontFamily: MONO, margin: "8px 0 4px" }}>{cnt}</div>
                <div style={{ fontSize: "11px", color: T.textTer }}>candidates</div>
                <div style={{ fontSize: "10px", color: primerCnt === cnt ? T.success : T.warning, fontWeight: 600, marginTop: "4px" }}>
                  {primerCnt}/{cnt} with primers
                </div>
                {avgDiscDrug != null && (
                  <div style={{ fontSize: "10px", color: avgDiscDrug >= 3 ? T.success : avgDiscDrug >= 2 ? T.warning : T.danger, fontWeight: 600, marginTop: "2px" }}>
                    avg disc {avgDiscDrug}×
                  </div>
                )}
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
            <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>primers + viable discrimination</div>
          </div>
          {(() => {
            const directAll = results.filter(r => r.strategy === "Direct" && r.disc > 0 && r.disc < 900);
            const panelAvgDisc = directAll.length ? +(directAll.reduce((a, r) => a + r.disc, 0) / directAll.length).toFixed(1) : 0;
            const diagGrade = directAll.filter(r => r.disc >= 3).length;
            return (
              <div style={{ flex: 1, background: T.bgSub, borderRadius: "8px", padding: "12px", border: `1px solid ${T.borderLight}`, textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: MONO, color: panelAvgDisc >= 3 ? T.success : T.warning }}>{panelAvgDisc}×</div>
                <div style={{ fontSize: "11px", color: T.textSec }}>Avg. discrimination</div>
                <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>{diagGrade}/{directAll.length} diagnostic-grade</div>
              </div>
            );
          })()}
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

      {/* Primer Dimer ΔG Heatmap */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>Primer Dimer Analysis <span style={{ fontSize: "10px", fontWeight: 500, color: T.textTer, marginLeft: "8px" }}>POST-OPTIMIZATION</span></div>
        <p style={{ fontSize: "12px", color: T.textSec, marginBottom: "16px", lineHeight: 1.6 }}>
          Thermodynamic primer-dimer prediction using SantaLucia nearest-neighbour parameters (2004).
          The heatmap shows <strong>3′-anchored ΔG</strong> (kcal/mol) for each primer pair — extensible dimers that can produce
          amplification artifacts in multiplex RPA. Red cells indicate high-risk dimers (ΔG &lt; −6.0), yellow moderate risk (ΔG &lt; −4.0).
          This analysis runs <strong>after</strong> panel selection — dimer penalties are not yet integrated into the simulated annealing
          optimizer. Flagged pairs should be validated empirically or addressed by redesigning one primer in the pair.
        </p>
        {dimerMatrix && dimerLabels ? (
          <>
            <div style={{ overflowX: "auto", marginBottom: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${dimerLabels.length}, 1fr)`, gap: "1px", fontSize: "8px", minWidth: dimerLabels.length * 28 + 60 }}>
                <div />
                {dimerLabels.map((lbl) => (
                  <div key={`dh-${lbl}`} style={{ textAlign: "center", fontFamily: MONO, fontWeight: 600, color: T.textTer, padding: "3px 1px", overflow: "hidden", textOverflow: "ellipsis", writingMode: "vertical-lr", transform: "rotate(180deg)", height: "50px" }}>{lbl}</div>
                ))}
                {dimerLabels.map((rowLbl, i) => (
                  <React.Fragment key={`dr-${rowLbl}`}>
                    <div style={{ fontFamily: MONO, fontWeight: 600, color: T.textTer, padding: "3px 4px", display: "flex", alignItems: "center", fontSize: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowLbl}</div>
                    {dimerLabels.map((_, j) => {
                      const dg = dimerMatrix[i][j];
                      let bg = T.successLight;
                      let textColor = T.success;
                      if (dg < -6.0) { bg = "#FEE2E2"; textColor = "#DC2626"; }
                      else if (dg < -4.0) { bg = "#FEF3C7"; textColor = "#D97706"; }
                      else if (dg < -2.0) { bg = "#F0FDF4"; textColor = "#16A34A"; }
                      return (
                        <div key={`dc-${i}-${j}`} style={{ background: bg, borderRadius: "2px", height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontFamily: MONO, color: textColor, fontWeight: 600 }}
                          title={`${rowLbl} × ${dimerLabels[j]}: ΔG = ${dg.toFixed(1)} kcal/mol`}>
                          {i !== j && dg < -2.0 ? dg.toFixed(1) : ""}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", fontSize: "10px", color: T.textSec, marginBottom: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "#FEE2E2", border: "1px solid #FECACA" }} /> &lt; −6.0 HIGH risk</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "#FEF3C7", border: "1px solid #FDE68A" }} /> &lt; −4.0 MODERATE</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: T.successLight, border: `1px solid ${T.success}33` }} /> Clean</span>
            </div>
            {/* Dimer report summary */}
            {dimerReport && (
              <div style={{ background: T.bgSub, borderRadius: "8px", padding: "14px 18px", border: `1px solid ${T.borderLight}` }}>
                <div style={{ display: "flex", gap: "24px", marginBottom: "8px", fontSize: "12px" }}>
                  <span style={{ fontWeight: 600, color: T.text }}>Panel dimer score: <span style={{ fontFamily: MONO, color: dimerReport.panel_dimer_score < 0.1 ? T.success : dimerReport.panel_dimer_score < 0.3 ? T.warning : T.danger }}>{dimerReport.panel_dimer_score.toFixed(3)}</span></span>
                  <span style={{ color: T.textSec }}>HIGH-risk: <strong style={{ color: (dimerReport.high_risk_pairs?.length || 0) > 0 ? T.danger : T.success }}>{dimerReport.high_risk_pairs?.length || 0}</strong></span>
                  <span style={{ color: T.textSec }}>Moderate: <strong style={{ color: (dimerReport.flagged_pairs?.length || 0) > 0 ? T.warning : T.success }}>{dimerReport.flagged_pairs?.length || 0}</strong></span>
                  <span style={{ color: T.textSec }}>Internal: <strong>{dimerReport.internal_dimers?.length || 0}</strong></span>
                </div>
                {dimerReport.recommendations?.map((rec, i) => (
                  <p key={i} style={{ fontSize: "11px", color: T.textSec, lineHeight: 1.5, margin: i === 0 ? 0 : "4px 0 0" }}>{rec}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: T.textTer, fontSize: "12px", background: T.bgSub, borderRadius: "8px" }}>
            Primer dimer analysis not available — run a full pipeline to generate thermodynamic dimer predictions.
          </div>
        )}
      </div>

      {/* AS-RPA Discrimination Summary */}
      {results.some(r => r.asrpaDiscrimination) && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>AS-RPA Thermodynamic Discrimination</div>
          <p style={{ fontSize: "12px", color: T.textSec, marginBottom: "16px", lineHeight: 1.6 }}>
            Proximity candidates use allele-specific RPA primers for discrimination. The 3′ terminal mismatch
            identity determines extension blocking strength. Values are <strong>thermodynamic estimates</strong> based
            on terminal mismatch penalty data — not experimentally validated ratios.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Target</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Mismatch</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>ΔΔG</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Disc. Ratio</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Block</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Specificity</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontFamily: HEADING, color: T.textSec }}>Pen. MM</th>
                </tr>
              </thead>
              <tbody>
                {results.filter(r => r.asrpaDiscrimination).map(r => {
                  const d = r.asrpaDiscrimination;
                  const blockColor = d.block_class === "strong" ? T.success : d.block_class === "moderate" ? T.warning : T.danger;
                  return (
                    <tr key={r.label} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.label}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: MONO, fontWeight: 700 }}>{d.terminal_mismatch}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: MONO }}>{d.ddg_kcal.toFixed(1)} kcal/mol</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: MONO, fontWeight: 700, color: d.disc_ratio >= 50 ? T.success : d.disc_ratio >= 10 ? T.warning : T.danger }}>{d.disc_ratio >= 100 ? "≥100" : d.disc_ratio.toFixed(0)}×</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: blockColor + "20", color: blockColor, textTransform: "uppercase" }}>{d.block_class}</span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontFamily: MONO }}>{(d.estimated_specificity * 100).toFixed(1)}%</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>{d.has_penultimate_mm ? "✓" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "10px", color: T.textTer, marginTop: "8px", fontStyle: "italic" }}>
            Discrimination ratios computed via Boltzmann conversion: exp(ΔΔG / RT) at 37 °C. Ratios &gt; 100× capped — kinetic effects dominate at high ΔΔG.
          </div>
        </div>
      )}

      {/* Cross-reactivity explanation (sequence-based) */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING, marginBottom: "8px" }}>crRNA Sequence Cross-Reactivity</div>
        <p style={{ fontSize: "12px", color: T.textSec, marginBottom: "16px", lineHeight: 1.6 }}>
          Cross-reactivity is assessed by sequence homology (Bowtie2 alignment). The simulated annealing optimizer
          penalizes panels with cross-reactive pairs, selecting candidates that coexist without interference.
          This is complementary to the thermodynamic primer dimer check above.
        </p>
        <div style={{ padding: "16px", textAlign: "center", color: T.textTer, fontSize: "12px", background: T.bgSub, borderRadius: "8px" }}>
          Cross-reactivity matrix checked during optimization — {directCount + proximityCount} targets validated for sequence orthogonality.
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   DIAGNOSTICS TAB — Block 3 Sensitivity-Specificity Optimization
   ═══════════════════════════════════════════════════════════════════ */
class DiagnosticsErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("DiagnosticsTab crash:", error, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding: "24px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", margin: "16px 0" }}>
        <div style={{ fontWeight: 700, color: "#991B1B", marginBottom: "8px" }}>Diagnostics failed to render</div>
        <div style={{ fontSize: "12px", color: "#7F1D1D", fontFamily: "monospace" }}>{this.state.error.message}</div>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: "12px", padding: "6px 16px", border: "1px solid #FECACA", borderRadius: "6px", cursor: "pointer", background: "white", fontSize: "12px" }}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}
const DiagnosticsTab = ({ results, jobId, connected, scorer }) => {
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
  const [expandedTargets, setExpandedTargets] = useState({});
  const [topKData, setTopKData] = useState({});

  // Detect which scorer produced the results
  const scorerInfo = useMemo(() => {
    if (scorer === "guard_net") return { name: "GUARD-Net", level: 3 };
    if (!results?.length) return { name: "Heuristic", level: 1 };
    const first = results.find(r => r.mlScores?.length > 0);
    if (first) {
      const model = first.mlScores[0].model_name || first.mlScores[0].modelName;
      if (model === "guard_net") return { name: "GUARD-Net", level: 3 };
    }
    return { name: "Heuristic", level: 1 };
  }, [results, scorer]);

  // Compute diagnostics client-side from results prop + preset thresholds
  const computeLocalDiagnostics = useCallback((preset, res) => {
    try {
      if (!res || !res.length) return;
      const p = presets.find(x => x.name === preset) || { efficiency_threshold: 0.4, discrimination_threshold: 3.0 };
      const effT = p.efficiency_threshold || 0.4;
      const discT = p.discrimination_threshold || 3.0;

      const perTarget = res.map(r => {
        const eff = r.ensembleScore ?? r.score ?? 0;
        const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
        const asrpaViable = r.strategy !== "Proximity" || !r.asrpaDiscrimination || r.asrpaDiscrimination.block_class !== "none";
        const ready = r.hasPrimers && eff >= effT && asrpaViable && (r.strategy === "Proximity" || disc >= discT);
        return { target_label: r.label || "unknown", drug: r.drug || "", efficiency: eff, discrimination: disc, is_assay_ready: ready, has_primers: !!r.hasPrimers, strategy: r.strategy || "Direct", asrpaViable };
      });

      // Exclude species control (IS6110) from resistance metrics
      const resistanceTargets = perTarget.filter(t => t.drug !== "OTHER");
      const assayReady = resistanceTargets.filter(t => t.is_assay_ready).length;
      const directTargets = resistanceTargets.filter(t => t.strategy === "Direct" && t.discrimination > 0);
      const meanDisc = directTargets.length ? directTargets.reduce((a, t) => a + t.discrimination, 0) / directTargets.length : 0;
      // Panel specificity: Direct targets use Cas12a disc, Proximity use computed AS-RPA estimate (fallback 0.95)
      const readyResistance = resistanceTargets.filter(t => t.is_assay_ready);
      const specValues = readyResistance.map(t => {
        if (t.strategy === "Proximity") {
          const orig = res.find(r => r.label === t.target_label);
          if (orig?.asrpaDiscrimination?.estimated_specificity != null) return orig.asrpaDiscrimination.estimated_specificity;
          return 0.95;
        }
        return Math.max(0, 1 - 1 / Math.max(t.discrimination, 1.01));
      });
      const specificity = specValues.length ? specValues.reduce((a, v) => a + v, 0) / specValues.length : 0;
      const sensitivity = resistanceTargets.length ? assayReady / resistanceTargets.length : 0;

      const meanEff = res.length > 0 ? res.reduce((a, r) => a + (r.ensembleScore ?? r.score ?? 0), 0) / res.length : 0;

      setDiagnostics({
        sensitivity, specificity, coverage: assayReady, total_targets: resistanceTargets.length,
        assay_ready: assayReady, mean_efficiency: +meanEff.toFixed(3),
        mean_discrimination: +meanDisc.toFixed(1), per_target: perTarget,
      });

      // WHO compliance by drug class (exclude species control)
      const drugs = [...new Set(res.map(r => r.drug))].filter(d => d && d !== "OTHER");
      const whoComp = {};
      for (const drug of drugs) {
        const drugTargets = perTarget.filter(t => t.drug === drug);
        const covered = drugTargets.filter(t => t.is_assay_ready).length;
        // Per-drug specificity: only viable targets (exclude WC-pair AS-RPA with no discrimination)
        const drugSpecs = drugTargets.filter(t => t.is_assay_ready).map(t => {
          if (t.strategy === "Proximity") {
            const orig = res.find(r => r.label === t.target_label);
            if (orig?.asrpaDiscrimination?.estimated_specificity != null) return orig.asrpaDiscrimination.estimated_specificity;
            return 0.95;
          }
          return t.discrimination > 0 ? Math.max(0, 1 - 1 / Math.max(t.discrimination, 1.01)) : 0;
        }).filter(v => v > 0);
        const drugSens = drugTargets.length ? covered / drugTargets.length : 0;
        const drugSpec = drugSpecs.length ? drugSpecs.reduce((a, v) => a + v, 0) / drugSpecs.length : 0;
        const tppSens = drug === "RIF" ? 0.95 : ["INH", "FQ"].includes(drug) ? 0.90 : 0.80;
        whoComp[drug] = { sensitivity: +drugSens.toFixed(3), specificity: +drugSpec.toFixed(3), meets_tpp: drugSens >= tppSens && drugSpec >= 0.98, meets_sensitivity: drugSens >= tppSens, meets_specificity: drugSpec >= 0.98, targets_covered: covered, targets_total: drugTargets.length };
      }
      setWhoCompliance({ preset, panel_sensitivity: +sensitivity.toFixed(3), panel_specificity: +specificity.toFixed(3), who_compliance: whoComp });
    } catch (err) {
      console.error("computeLocalDiagnostics error:", err);
      // Set minimal diagnostics so the page isn't blank
      setDiagnostics({
        sensitivity: 0, specificity: 0, coverage: 0, total_targets: res?.length || 0,
        assay_ready: 0, mean_efficiency: 0, mean_discrimination: 0, per_target: [],
      });
    }
  }, [presets]);

  // Load presets on mount — try API first, fall back to hardcoded
  useEffect(() => {
    const fallbackPresets = [
      { name: "high_sensitivity", description: "Field screening — maximise coverage, tolerate lower discrimination.", efficiency_threshold: 0.3, discrimination_threshold: 2.0 },
      { name: "balanced", description: "WHO TPP-aligned — clinical diagnostic deployment.", efficiency_threshold: 0.4, discrimination_threshold: 3.0 },
      { name: "high_specificity", description: "Confirmatory — minimise false calls, reference lab use.", efficiency_threshold: 0.6, discrimination_threshold: 5.0 },
    ];
    if (!connected) { setPresets(fallbackPresets); return; }
    getPresets().then(({ data }) => { setPresets(data && data.length ? data : fallbackPresets); });
  }, [connected]);

  // Load diagnostics + WHO compliance — try API, fall back to client-side computation
  useEffect(() => {
    if (!results || !results.length) return;
    let cancelled = false;
    setLoadingDiag(true);
    if (connected && jobId) {
      Promise.all([
        getDiagnostics(jobId, activePreset),
        getWHOCompliance(jobId, activePreset),
      ]).then(([diagRes, whoRes]) => {
        if (cancelled) return;
        if (diagRes.data && whoRes.data) {
          // Normalize API response: API returns panel_sensitivity/panel_specificity
          // but the render expects sensitivity/specificity at the top level
          const d = diagRes.data;
          const perTarget = (d.per_target || []).map(t => ({
            target_label: t.label || t.target_label,
            drug: t.drug_class || t.drug || "",
            efficiency: t.score ?? t.efficiency ?? 0,
            discrimination: t.discrimination ?? 0,
            is_assay_ready: t.assay_ready ?? t.is_assay_ready ?? false,
            has_primers: t.has_primers ?? true,
            strategy: (t.strategy || t.detection_strategy || "direct") === "direct" ? "Direct" : "Proximity",
          }));
          const resistanceTargets = perTarget.filter(t => t.drug !== "species_control" && t.drug !== "OTHER");
          const assayReady = resistanceTargets.filter(t => t.is_assay_ready).length;
          setDiagnostics({
            sensitivity: d.sensitivity ?? d.panel_sensitivity ?? 0,
            specificity: d.specificity ?? d.panel_specificity ?? 0,
            coverage: assayReady,
            total_targets: resistanceTargets.length,
            assay_ready: assayReady,
            mean_efficiency: d.mean_efficiency ?? 0,
            mean_discrimination: d.mean_discrimination ?? 0,
            per_target: perTarget,
          });
          // Normalize WHO compliance: API returns meets_minimal/meets_optimal,
          // frontend expects meets_tpp, specificity, targets_covered, targets_total
          const w = whoRes.data;
          const DRUG_MAP = { rifampicin: "RIF", isoniazid: "INH", fluoroquinolone: "FQ", ethambutol: "EMB", pyrazinamide: "PZA", aminoglycoside: "AG" };
          const normalizedWho = {};
          if (w.who_compliance) {
            for (const [drug, entry] of Object.entries(w.who_compliance)) {
              // Skip species control and unknown
              if (drug === "species_control" || drug === "unknown") continue;
              const drugKey = DRUG_MAP[drug] || drug.toUpperCase();
              const tppSens = drugKey === "RIF" ? 0.95 : ["INH", "FQ"].includes(drugKey) ? 0.90 : 0.80;
              const sens = entry.sensitivity ?? 0;
              const spec = entry.specificity ?? 0;
              normalizedWho[drugKey] = {
                sensitivity: sens,
                specificity: spec,
                meets_tpp: entry.meets_tpp ?? entry.meets_minimal ?? false,
                meets_sensitivity: sens >= tppSens,
                meets_specificity: spec >= 0.98,
                targets_covered: entry.n_covered ?? 0,
                targets_total: entry.n_targets ?? 0,
              };
            }
          }
          setWhoCompliance({
            preset: w.preset,
            panel_sensitivity: w.panel_sensitivity ?? 0,
            panel_specificity: w.panel_specificity ?? 0,
            who_compliance: normalizedWho,
          });
        } else {
          computeLocalDiagnostics(activePreset, results);
        }
        setLoadingDiag(false);
      }).catch(() => {
        if (cancelled) return;
        computeLocalDiagnostics(activePreset, results);
        setLoadingDiag(false);
      });
    } else {
      computeLocalDiagnostics(activePreset, results);
      setLoadingDiag(false);
    }
    return () => { cancelled = true; };
  }, [jobId, activePreset, connected, results, computeLocalDiagnostics]);

  // Run sweep — try API, fall back to client-side
  const handleSweep = (paramName) => {
    setSweepLoading(true);
    const values = paramName === "efficiency_threshold"
      ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
      : [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

    const computeLocalSweep = () => {
      if (!results?.length) { setSweepLoading(false); return; }
      const resistanceResults = results.filter(r => r.drug !== "OTHER");
      const baseP = presets.find(x => x.name === activePreset) || { efficiency_threshold: 0.4, discrimination_threshold: 3.0 };
      const points = values.map(v => {
        const effT = paramName === "efficiency_threshold" ? v : baseP.efficiency_threshold;
        const discT = paramName === "discrimination_threshold" ? v : baseP.discrimination_threshold;
        const ready = resistanceResults.filter(r => {
          const eff = r.ensembleScore || r.score;
          const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
          return r.hasPrimers && eff >= effT && (r.strategy === "Proximity" || disc >= discT);
        }).length;
        const directOk = resistanceResults.filter(r => r.strategy === "Direct" && r.disc < 900 && r.disc >= discT);
        const spec = directOk.length ? directOk.reduce((a, r) => a + Math.max(0, 1 - 1 / r.disc), 0) / directOk.length : 0;
        return { value: v, sensitivity: +(ready / resistanceResults.length).toFixed(3), specificity: +spec.toFixed(3), coverage: ready, assay_ready: ready };
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
      const resistanceResults = results.filter(r => r.drug !== "OTHER");
      const discGrid = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0];
      const effGrid = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      for (const dT of discGrid) {
        for (const eT of effGrid) {
          const ready = resistanceResults.filter(r => {
            const eff = r.ensembleScore || r.score;
            const disc = r.disc != null && r.disc < 900 ? r.disc : 0;
            return r.hasPrimers && eff >= eT && (r.strategy === "Proximity" || disc >= dT);
          }).length;
          const directOk = resistanceResults.filter(r => r.strategy === "Direct" && r.disc < 900 && r.disc >= dT);
          const spec = directOk.length ? directOk.reduce((a, r) => a + Math.max(0, 1 - 1 / r.disc), 0) / directOk.length : 0;
          const sens = ready / resistanceResults.length;
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
          <div style={{ marginTop: "8px", fontSize: "11px", color: T.textSec, display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <span>Thresholds: efficiency ≥ {presetObj.efficiency_threshold}, discrimination ≥ {presetObj.discrimination_threshold}×</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "2px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 600,
              background: scorerInfo.level >= 3 ? "rgba(16,185,129,0.1)" : T.bgSub,
              color: scorerInfo.level >= 3 ? T.success : T.textSec,
              border: `1px solid ${scorerInfo.level >= 3 ? T.success + "33" : T.borderLight}`,
            }}>
              <Cpu size={10} />
              Scored by: {scorerInfo.name}
            </span>
          </div>
        )}
      </div>

      {loadingDiag && (
        <div style={{ textAlign: "center", padding: "32px", color: T.textTer }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ marginTop: "6px", fontSize: "12px" }}>Computing diagnostics…</div>
        </div>
      )}

      {!loadingDiag && !diagnostics && (
        <div style={{ textAlign: "center", padding: "32px", color: T.textTer }}>
          <AlertTriangle size={20} color={T.warning} style={{ marginBottom: "8px" }} />
          <div style={{ fontSize: "13px", marginBottom: "8px" }}>Diagnostics data could not be computed.</div>
          <button onClick={() => { setLoadingDiag(true); setTimeout(() => { computeLocalDiagnostics(activePreset, results); setLoadingDiag(false); }, 50); }} style={{ padding: "6px 16px", border: `1px solid ${T.border}`, borderRadius: "6px", cursor: "pointer", background: T.bg, fontSize: "12px", fontFamily: FONT }}>Retry</button>
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

          {/* MUT vs WT Activity Distribution */}
          {!mobile && (() => { try {
            const p = presets.find(x => x.name === activePreset) || { efficiency_threshold: 0.4, discrimination_threshold: 3.0 };
            const effT = p.efficiency_threshold || 0.4;
            const discT = p.discrimination_threshold || 3.0;
            // Filter to candidates that pass the active preset's thresholds
            const filtered = results.filter(r => {
              const eff = r.ensembleScore || r.score;
              if (eff < effT) return false;
              if (r.gene === "IS6110") return false; // species control
              if (r.strategy === "Proximity") return !(r.asrpaDiscrimination?.block_class === "none");
              return (r.disc > 0 && r.disc < 900) ? r.disc >= discT : false;
            });
            const plotResults = filtered.length >= 2 ? filtered : results.filter(r => r.gene !== "IS6110"); // fallback to all if <2 pass
            const mutScores = plotResults.map(r => r.ensembleScore || r.score);
            const wtScores = plotResults.map(r => {
              const eff = r.ensembleScore || r.score;
              const disc = r.disc > 0 && r.disc < 900 ? r.disc : 0.9;
              return eff / disc;
            });
            const kdeMut = gaussianKDE(mutScores, 0.05, 100);
            const kdeWt = gaussianKDE(wtScores, 0.05, 100);
            const combined = kdeMut.map((p, i) => {
              const mutD = p.density;
              const wtD = kdeWt[i]?.density || 0;
              return { x: p.x, mut: mutD, wt: wtD, overlap: Math.min(mutD, wtD) };
            });
            const meanMut = +(mutScores.reduce((a, b) => a + b, 0) / mutScores.length).toFixed(3);
            const meanWt = +(wtScores.reduce((a, b) => a + b, 0) / wtScores.length).toFixed(3);
            const separation = +(meanMut - meanWt).toFixed(3);
            // Compute overlap coefficient (proportion of area that overlaps)
            const totalMut = kdeMut.reduce((a, p) => a + p.density, 0);
            const overlapArea = combined.reduce((a, p) => a + p.overlap, 0);
            const overlapPct = totalMut > 0 ? Math.round((overlapArea / totalMut) * 100) : 0;
            return (
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "24px 28px", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>MUT vs WT Predicted Activity</div>
                    <div style={{ fontSize: "11px", color: T.textSec, marginTop: "3px", lineHeight: 1.5, maxWidth: "540px" }}>
                      Density computed from <strong>{plotResults.length}</strong> candidates passing the {activePreset} preset thresholds (eff ≥ {effT}, disc ≥ {discT}×). Greater separation between curves = better discrimination. WT activity derived from discrimination ratios (A<sub>WT</sub> = A<sub>MUT</sub> / disc).
                    </div>
                  </div>
                  <Badge variant={separation >= 0.15 ? "success" : separation >= 0.08 ? "warning" : "danger"}>
                    {separation >= 0.15 ? "Good separation" : separation >= 0.08 ? "Moderate" : "Poor separation"}
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={combined} margin={{ top: 10, right: 15, bottom: 25, left: 15 }}>
                    <defs>
                      <linearGradient id="mutAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="wtAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="overlapAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.danger} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={T.danger} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: T.textTer, fontFamily: MONO }} tickCount={11} axisLine={{ stroke: T.border }} tickLine={false} label={{ value: "Predicted cleavage activity", position: "insideBottom", offset: -12, fontSize: 10, fill: T.textSec }} />
                    <YAxis hide domain={[0, "auto"]} />
                    <Tooltip content={({ payload, label }) => {
                      if (!payload?.length) return null;
                      return (
                        <div style={{ ...tooltipStyle, padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, fontSize: "11px", color: T.text, marginBottom: "4px" }}>Activity: {label}</div>
                          {payload.map(p => p.dataKey !== "overlap" && (
                            <div key={p.dataKey} style={{ fontSize: "11px", color: p.dataKey === "mut" ? "#2563EB" : "#D97706" }}>
                              {p.dataKey === "mut" ? "Mutant" : "Wildtype"}: {p.value?.toFixed(4)}
                            </div>
                          ))}
                        </div>
                      );
                    }} />
                    <ReferenceLine x={meanMut} stroke="#2563EB" strokeDasharray="3 3" strokeWidth={1} label={{ value: "μ MUT", position: "insideTopRight", fontSize: 9, fill: "#2563EB", fontWeight: 700 }} />
                    <ReferenceLine x={meanWt} stroke="#D97706" strokeDasharray="3 3" strokeWidth={1} label={{ value: "μ WT", position: "insideTopRight", fontSize: 9, fill: "#D97706", fontWeight: 700 }} />
                    <Area type="monotone" dataKey="overlap" stroke="none" fill="url(#overlapAreaFill)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="mut" stroke="#2563EB" strokeWidth={2.5} fill="url(#mutAreaFill)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="wt" stroke="#D97706" strokeWidth={2} fill="url(#wtAreaFill)" isAnimationActive={false} strokeDasharray="6 3" />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Custom legend + stats */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "16px", height: "3px", background: "#2563EB", borderRadius: "2px" }} />
                      <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>Mutant (A<sub>MUT</sub>)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "16px", height: "3px", background: "#D97706", borderRadius: "2px", borderBottom: "1px dashed #D97706" }} />
                      <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>Wildtype (A<sub>WT</sub>)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "10px", height: "10px", background: "rgba(220,38,38,0.15)", borderRadius: "2px" }} />
                      <span style={{ fontSize: "10px", color: T.textSec, fontWeight: 500 }}>Overlap zone ({overlapPct}%)</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>μ MUT</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#2563EB", fontFamily: MONO }}>{meanMut}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>μ WT</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#D97706", fontFamily: MONO }}>{meanWt}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "9px", color: T.textTer, fontWeight: 600 }}>SEPARATION</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: separation >= 0.15 ? T.success : T.warning, fontFamily: MONO }}>{separation}</div>
                    </div>
                  </div>
                </div>
                {/* Interpretation */}
                {(() => {
                  const mutSorted = [...mutScores].sort((a, b) => b - a);
                  const wtSorted = [...wtScores].sort((a, b) => b - a);
                  const bestMutIdx = mutScores.indexOf(mutSorted[0]);
                  const bestMutLabel = results[bestMutIdx]?.label || "top target";
                  const worstMutIdx = mutScores.indexOf(mutSorted[mutSorted.length - 1]);
                  const worstMutLabel = results[worstMutIdx]?.label || "weakest target";
                  const clinicalRisk = overlapPct > 30 ? "high" : overlapPct > 15 ? "moderate" : "low";
                  return (
                    <div style={{ marginTop: "14px", padding: "12px 16px", background: T.primaryLight, border: `1px solid ${T.primary}33`, borderRadius: "8px", fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                      <strong style={{ color: T.primary }}>Interpretation:</strong> Mutant mean activity ({meanMut}) vs wildtype ({meanWt}) gives a separation of <strong style={{ color: separation >= 0.15 ? T.success : T.warning }}>{separation}</strong>.
                      {separation >= 0.15 ? " Good separation — the panel reliably distinguishes resistant from susceptible samples at the aggregate level." : separation >= 0.08 ? " Moderate separation — borderline samples may produce ambiguous calls; consider tightening the panel to high-discrimination targets only." : " Poor separation — the panel cannot reliably distinguish MUT from WT; review target selection and consider dropping low-discrimination candidates."}
                      {` Overlap zone: ${overlapPct}% — this is the aggregate overlap; individual targets with high discrimination (e.g., disc ≥10×) have near-zero overlap. In practice each target is read independently, so per-target separation matters more than panel-level aggregate.`}
                      {` Strongest MUT signal: ${bestMutLabel} (${mutSorted[0].toFixed(3)}). Weakest: ${worstMutLabel} (${mutSorted[mutSorted.length - 1].toFixed(3)}).`}
                    </div>
                  );
                })()}
              </div>
            );
          } catch (e) { console.error("MUT vs WT chart error:", e); return null; } })()}

          {/* B2: Understanding Discrimination Scores — collapsible explainer */}
          <CollapsibleSection title="Understanding Discrimination Scores" defaultOpen={false}>
            <div style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7 }}>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Mismatch position matters most</div>
                Cas12a reads DNA directionally from PAM toward the spacer end. Mismatches near the PAM (seed positions 1–4) block R-loop formation almost completely, giving discrimination ratios of 10–50×. Mismatches far from the PAM (positions 15–20) are tolerated, giving ratios of 1–2×. Each mutation's position in the spacer determines its baseline discrimination.
              </div>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Not all mismatches are equal</div>
                A purine-to-pyrimidine change (e.g., A→C) disrupts the R-loop more than a purine-to-purine change (e.g., A→G). The geometry of the mismatch affects how much Cas12a distinguishes mutant from wildtype.
              </div>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>High GC content reduces discrimination</div>
                <em>M. tuberculosis</em> has 65.8% GC content. GC-rich sequences around a mismatch stabilise the R-loop through additional hydrogen bonds, partially compensating for the mismatch. This is why some targets (EMB, PZA) show low predicted discrimination — their mutations sit in GC-rich regions at PAM-distal positions.
              </div>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "4px" }}>Prediction model</div>
                {results.some(r => (r.discrimination?.model_name || "").includes("learned"))
                  ? "Discrimination ratios are predicted by a gradient-boosted model (LightGBM) trained on 6,136 paired MUT/WT trans-cleavage measurements from the EasyDesign dataset (Huang et al. 2024, LbCas12a). The model uses 15 thermodynamic features including R-loop cumulative ΔG, mismatch ΔΔG penalties, and position sensitivity. 3-fold CV: RMSE = 0.540, r = 0.459 (vs heuristic RMSE = 0.641, r = 0.298)."
                  : "Discrimination ratios are predicted by a heuristic model using position sensitivity × mismatch destabilisation scores. A trained model (XGBoost on 15 thermodynamic features) is available but was not loaded for this run."
                }
              </div>
              <div style={{ fontSize: "11px", color: T.textTer, fontStyle: "italic", borderTop: `1px solid ${T.borderLight}`, paddingTop: "10px" }}>
                These are in silico predictions. Experimental validation on the electrochemical platform will provide measured discrimination ratios through the active learning loop.
              </div>
            </div>
          </CollapsibleSection>

          {/* C: WHO Compliance Table */}
          {whoCompliance && whoCompliance.who_compliance && (() => {
            // Filter out species_control/UNKNOWN from WHO table — it's not a resistance drug class
            const whoEntries = Object.entries(whoCompliance.who_compliance).filter(([drug]) => !["UNKNOWN", "OTHER", "SPECIES_CONTROL", "species_control"].includes(drug));
            const WHO_TPP_SENS = { RIF: 0.95, INH: 0.90, FQ: 0.90, EMB: 0.80, PZA: 0.80, AG: 0.80 };
            const sensPassing = whoEntries.filter(([, d]) => d.meets_sensitivity).length;
            const specPassing = whoEntries.filter(([, d]) => d.meets_specificity).length;
            return (
            <div style={{ marginBottom: "24px", border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ background: T.bgSub, padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <Shield size={14} color={T.primary} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>WHO TPP Compliance by Drug Class</span>
                <Badge variant={sensPassing === whoEntries.length ? "success" : "warning"}>
                  Sens: {sensPassing}/{whoEntries.length}
                </Badge>
                <Badge variant={specPassing === whoEntries.length ? "success" : specPassing > 0 ? "warning" : "neutral"}>
                  Spec: {specPassing}/{whoEntries.length}
                </Badge>
              </div>
              <div style={{ padding: "12px 18px", fontSize: "11px", color: T.textSec, lineHeight: 1.6, borderBottom: `1px solid ${T.borderLight}`, background: T.bg }}>
                WHO Target Product Profile (TPP) 2024 defines minimum sensitivity and specificity thresholds per drug class for diagnostic deployment. Sensitivity = fraction of resistance-conferring mutations detected (pass/fail per drug class). Specificity = approximate in silico estimate: Direct targets use 1−1/disc (assumes perfectly separated signal distributions — actual specificity depends on signal variance and threshold selection). Proximity targets use thermodynamic AS-RPA mismatch penalty. ≥98% required — marked "Pending" when below threshold as experimental validation is needed. {results.some(r => (r.discrimination?.model_name || "").includes("learned")) ? "Discrimination ratios used here are from the learned model (LightGBM, 15 thermodynamic features)." : "Discrimination ratios used here are from the heuristic model."}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: T.bgSub }}>
                      {["Drug Class", "Sensitivity", "WHO Target", "Coverage", "Avg Disc", "Specificity", "Sens. Status", "Spec. Status"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: T.textSec, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {whoEntries.map(([drug, data]) => {
                      const tppTarget = WHO_TPP_SENS[drug] || 0.80;
                      // Compute avg discrimination for this drug class from diagnostics per_target
                      const drugTargets = (diagnostics.per_target || []).filter(t => {
                        const tDrug = (t.drug || "").toUpperCase().replace("RIFAMPICIN", "RIF").replace("ISONIAZID", "INH").replace("FLUOROQUINOLONE", "FQ").replace("ETHAMBUTOL", "EMB").replace("PYRAZINAMIDE", "PZA").replace("AMINOGLYCOSIDE", "AG");
                        return tDrug === drug;
                      });
                      const discTargets = drugTargets.filter(t => t.discrimination > 0 && t.strategy === "Direct");
                      const avgDisc = discTargets.length ? discTargets.reduce((a, t) => a + t.discrimination, 0) / discTargets.length : 0;
                      const sensPercent = (data.sensitivity * 100);
                      const tppPercent = (tppTarget * 100);
                      const gap = sensPercent - tppPercent;
                      return (
                      <tr key={drug} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: "10px 14px" }}><DrugBadge drug={drug} /></td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "13px", color: data.sensitivity >= tppTarget ? T.success : data.sensitivity >= tppTarget * 0.8 ? T.warning : T.danger }}>{sensPercent.toFixed(1)}%</span>
                            {gap !== 0 && <span style={{ fontSize: "10px", fontFamily: MONO, fontWeight: 600, color: gap >= 0 ? T.success : T.danger }}>{gap >= 0 ? "+" : ""}{gap.toFixed(0)}pp</span>}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO, fontSize: "11px", color: T.textTer }}>≥ {tppPercent.toFixed(0)}%</td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO, fontWeight: 600 }}>{data.targets_covered}/{data.targets_total}</td>
                        <td style={{ padding: "10px 14px", fontFamily: MONO, fontSize: "11px", color: avgDisc >= 3 ? T.success : avgDisc >= 2 ? T.warning : T.textTer }}>{avgDisc > 0 ? `${avgDisc.toFixed(1)}×` : "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {data.specificity != null ? (
                            <div>
                              <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: "12px", color: data.specificity >= 0.98 ? T.success : data.specificity >= 0.90 ? T.warning : T.textTer }}>{(data.specificity * 100).toFixed(1)}%</span>
                              {data.n_excluded_specificity > 0 && <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>{data.n_excluded_specificity} excluded</div>}
                            </div>
                          ) : <span style={{ color: T.textTer }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {data.meets_sensitivity ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: T.success, fontWeight: 600, fontSize: "11px" }}><CheckCircle size={12} /> Pass</span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "20px", background: "rgba(239,68,68,0.08)", color: T.danger, fontWeight: 600, fontSize: "11px" }}><AlertTriangle size={12} /> Fail</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {data.meets_specificity ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: T.success, fontWeight: 600, fontSize: "11px" }}><CheckCircle size={12} /> Pass</span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "3px 10px", borderRadius: "20px", background: "rgba(245,158,11,0.08)", color: T.warning, fontWeight: 600, fontSize: "11px" }}><AlertTriangle size={12} /> Pending</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Interpretation */}
              {(() => {
                const sensFailing = whoEntries.filter(([, d]) => !d.meets_sensitivity);
                const specFailing = whoEntries.filter(([, d]) => !d.meets_specificity);
                const worstSens = sensFailing.length ? sensFailing.sort((a, b) => a[1].sensitivity - b[1].sensitivity)[0] : null;
                return (
                  <div style={{ padding: "12px 18px", background: T.primaryLight, borderTop: `1px solid ${T.borderLight}`, fontSize: "11px", color: T.textSec, lineHeight: 1.7 }}>
                    <strong style={{ color: T.primary }}>Interpretation:</strong>{" "}
                    <strong>Sensitivity:</strong> {sensPassing}/{whoEntries.length} drug classes meet WHO TPP minimal sensitivity thresholds.
                    {worstSens && ` ${worstSens[0]} is the weakest (${(worstSens[1].sensitivity * 100).toFixed(0)}% vs ${((WHO_TPP_SENS[worstSens[0]] || 0.80) * 100).toFixed(0)}% required).`}
                    {sensFailing.length > 1 && ` ${sensFailing.length} classes need additional mutation coverage.`}
                    {sensPassing === whoEntries.length && " All drug classes pass sensitivity."}
                    {" "}<strong>Specificity:</strong> {specPassing}/{whoEntries.length} classes meet the ≥98% threshold (approximate in silico proxy — actual specificity requires experimental determination with clinical samples).
                    {specFailing.length > 0 && ` ${specFailing.length} class${specFailing.length > 1 ? "es" : ""} pending — specificity estimates require experimental validation on the electrochemical platform.`}
                    {specPassing === whoEntries.length && " All classes pass specificity."}
                  </div>
                );
              })()}
            </div>
            );
          })()}

          {/* D: Per-Target Breakdown with Top-K */}
          {diagnostics.per_target && diagnostics.per_target.length > 0 && (
            <CollapsibleSection title={`Per-Target Breakdown (${diagnostics.per_target.length} targets)`} defaultOpen={false}>
              <div style={{ padding: "10px 14px", marginBottom: "12px", background: T.primaryLight, borderRadius: "8px", fontSize: "11px", color: T.primaryDark, lineHeight: 1.6 }}>
                <strong>Per-target assay readiness assessment.</strong> Each row shows the selected candidate's predicted efficiency and discrimination ratio against the active profile thresholds.
                Click any row to expand the <strong>Top-K alternative candidates</strong> — ranked alternatives with tradeoff annotations for experimental fallback planning.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: T.bgSub }}>
                      {["", "Target", "Drug", "Strategy", "Efficiency", "Discrimination", "Primers", "Status"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: T.textSec, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.per_target.map(t => {
                      const isExpanded = expandedTargets[t.target_label];
                      const topK = topKData[t.target_label];
                      const eff = typeof t.efficiency === "number" ? t.efficiency : 0;
                      const disc = typeof t.discrimination === "number" ? t.discrimination : 0;
                      const effColor = eff >= 0.7 ? T.success : eff >= 0.5 ? T.warning : T.danger;
                      const discColor = disc >= 3 ? T.success : disc >= 2 ? T.warning : T.danger;
                      const drugDisplay = (t.drug || "").toUpperCase().replace("RIFAMPICIN", "RIF").replace("ISONIAZID", "INH").replace("FLUOROQUINOLONE", "FQ").replace("ETHAMBUTOL", "EMB").replace("PYRAZINAMIDE", "PZA").replace("AMINOGLYCOSIDE", "AG").replace("SPECIES_CONTROL", "CTRL");
                      const stratDisplay = (t.strategy || "").charAt(0).toUpperCase() + (t.strategy || "").slice(1);
                      const toggleExpand = () => {
                        setExpandedTargets(prev => ({ ...prev, [t.target_label]: !prev[t.target_label] }));
                        if (!topKData[t.target_label]) {
                          if (!connected || !jobId) {
                            setTopKData(prev => ({ ...prev, [t.target_label]: [] }));
                          } else {
                            const timeout = setTimeout(() => {
                              setTopKData(prev => prev[t.target_label] === undefined ? { ...prev, [t.target_label]: [] } : prev);
                            }, 5000);
                            getTopK(jobId, t.target_label, 5).then(({ data }) => {
                              clearTimeout(timeout);
                              setTopKData(prev => ({ ...prev, [t.target_label]: (data?.alternatives || data) || [] }));
                            });
                          }
                        }
                      };
                      return (
                        <React.Fragment key={t.target_label}>
                          <tr style={{ borderBottom: `1px solid ${T.borderLight}`, cursor: "pointer", transition: "background 0.1s" }} onClick={toggleExpand} onMouseEnter={e => e.currentTarget.style.background = T.bgSub} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={{ padding: "10px 8px", width: "24px" }}>{isExpanded ? <ChevronDown size={13} color={T.primary} /> : <ChevronRight size={13} color={T.textTer} />}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600, fontFamily: MONO, fontSize: "11px", color: T.text }}>{t.target_label}</td>
                            <td style={{ padding: "10px 12px" }}><DrugBadge drug={drugDisplay} /></td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px", background: stratDisplay === "Direct" ? "rgba(37,99,235,0.08)" : "rgba(147,51,234,0.08)", color: stratDisplay === "Direct" ? T.primary : T.purple }}>{stratDisplay}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "12px", color: effColor }}>{eff.toFixed(3)}</span>
                                <div style={{ width: "40px", height: "4px", background: T.borderLight, borderRadius: "2px", overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min(eff * 100, 100)}%`, height: "100%", background: effColor, borderRadius: "2px" }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {t.strategy === "Proximity" ? (() => {
                                const orig = results.find(r => r.label === t.target_label);
                                const ad = orig?.asrpaDiscrimination;
                                if (ad) {
                                  const c = ad.block_class === "strong" ? T.success : ad.block_class === "moderate" ? T.warning : T.danger;
                                  return <span style={{ fontSize: "10px", fontWeight: 700, color: c }} title={`AS-RPA ${ad.terminal_mismatch} — ${ad.block_class}`}>{ad.disc_ratio >= 100 ? "≥100" : ad.disc_ratio.toFixed(0)}× <span style={{ fontWeight: 500, color: T.purple }}>AS-RPA</span></span>;
                                }
                                return <span style={{ fontSize: "10px", color: T.purple, fontWeight: 600 }}>AS-RPA</span>;
                              })() : (
                                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "12px", color: discColor }}>{disc > 0 ? `${disc.toFixed(1)}×` : "—"}</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px" }}>{t.has_primers ? <CheckCircle size={14} color={T.success} /> : <span style={{ color: T.textTer }}>—</span>}</td>
                            <td style={{ padding: "10px 12px" }}>
                              {t.is_assay_ready ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: T.success }}>Ready</span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", background: T.bgSub, color: T.textTer }}>Not ready</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0, background: T.bgSub }}>
                                <div style={{ padding: "16px 20px 16px 44px" }}>
                                  {!topK ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: T.textTer, padding: "8px 0" }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Loading alternative candidates…</div>
                                  ) : topK.length === 0 ? (
                                    <div style={{ fontSize: "11px", color: T.textTer, padding: "8px 0", fontStyle: "italic" }}>No alternative candidates available for this target.</div>
                                  ) : (
                                    <div>
                                      {/* Clean ranked table */}
                                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", fontFamily: FONT }}>
                                        <thead>
                                          <tr>
                                            {["Rank", "Score", "Disc", "OT", "Spacer (20-nt)", "Tradeoff vs selected"].map(h => (
                                              <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: T.textTer, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.borderLight}` }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {topK.slice(0, 5).map((alt, i) => {
                                            const s = alt.efficiency ?? alt.score ?? alt.composite_score ?? 0;
                                            const aDisc = alt.discrimination_ratio ?? alt.discrimination ?? 0;
                                            const spacer = alt.spacer_seq || alt.spacer || "";
                                            const notes = alt.tradeoff_summary || alt.tradeoff_note || "";
                                            const deltaEff = alt.delta_efficiency;
                                            const isSelected = i === 0;
                                            const sColor = s >= 0.7 ? T.success : s >= 0.5 ? T.warning : T.danger;
                                            const isProximity = t.strategy === "Proximity";
                                            return (
                                              <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}`, background: isSelected ? T.primaryLight : "transparent" }}>
                                                <td style={{ padding: "7px 10px", fontFamily: MONO, fontWeight: 700, color: isSelected ? T.primary : T.textSec }}>{isSelected ? "#1 ●" : `#${i + 1}`}</td>
                                                <td style={{ padding: "7px 10px" }}>
                                                  <span style={{ fontFamily: MONO, fontWeight: 700, color: sColor }}>{s.toFixed(3)}</span>
                                                  {deltaEff != null && !isSelected && <span style={{ fontSize: "9px", fontFamily: MONO, fontWeight: 600, color: deltaEff >= 0 ? T.success : T.danger, marginLeft: "4px" }}>{deltaEff >= 0 ? "+" : ""}{deltaEff.toFixed(3)}</span>}
                                                </td>
                                                <td style={{ padding: "7px 10px", fontFamily: MONO, color: T.textSec }}>{isProximity ? <span style={{ fontSize: "10px", color: T.purple }}>AS-RPA</span> : aDisc > 0 ? `${aDisc.toFixed(1)}×` : "—"}</td>
                                                <td style={{ padding: "7px 10px", fontFamily: MONO, color: alt.offtarget_count === 0 ? T.success : alt.offtarget_count != null ? T.warning : T.textTer }}>{alt.offtarget_count ?? "—"}</td>
                                                <td style={{ padding: "7px 10px", fontFamily: MONO, fontSize: "10px", color: T.textTer, letterSpacing: "0.3px" }}>{spacer ? `${spacer.slice(0, 10)} ${spacer.slice(10, 20)}` : "—"}</td>
                                                <td style={{ padding: "7px 10px", fontSize: "10px", color: T.textTer, fontStyle: isSelected ? "normal" : "italic" }}>
                                                  {isSelected ? <span style={{ fontWeight: 600, color: T.primary, fontStyle: "normal" }}>Selected candidate</span> : (notes || "comparable")}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
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

const ResultsPage = ({ connected, jobId, scorer: scorerProp, goTo }) => {
  const mobile = useIsMobile();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [results, setResults] = useState(null);
  const [panelData, setPanelData] = useState(null);
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
        setPanelData({
          primer_dimer_matrix: data?.primer_dimer_matrix || null,
          primer_dimer_labels: data?.primer_dimer_labels || null,
          primer_dimer_report: data?.primer_dimer_report || null,
        });
        setLoading(false);
      });
    } else if (activeJob.startsWith("mock-")) {
      /* Mock mode — adapt mock data to scorer encoded in job ID */
      const isHeuristic = activeJob.includes("-heuristic-");
      if (isHeuristic) {
        setResults(RESULTS.map(r => ({
          ...r,
          cnnScore: undefined, cnnCalibrated: undefined,
          ensembleScore: undefined, mlScores: [],
        })));
      } else {
        setResults(RESULTS);
      }
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
          {tab === "overview" && <OverviewTab results={results} scorer={scorerProp} />}
          {tab === "candidates" && <CandidatesTab results={results} jobId={activeJob} connected={connected} scorer={scorerProp} />}
          {tab === "discrimination" && <DiscriminationTab results={results} />}
          {tab === "primers" && <PrimersTab results={results} />}
          {tab === "multiplex" && <MultiplexTab results={results} panelData={panelData} />}
          {tab === "diagnostics" && <DiagnosticsErrorBoundary><DiagnosticsTab results={results} jobId={activeJob} connected={connected} scorer={scorerProp} /></DiagnosticsErrorBoundary>}
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

      {/* ── GUARD-Net ── */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <Cpu size={20} color={T.primary} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>GUARD-Net</span>
          <Badge variant="success">Recommended</Badge>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, marginBottom: "16px" }}>
          Dual-branch neural network combining a target-DNA CNN with RNA Foundation Model (RNA-FM) embeddings for crRNA secondary structure.
          R-Loop Propagation Attention (RLPA) encodes the biophysics of Cas12a's directional R-loop formation into the architecture.
          Trained on 25,000+ cis- and trans-cleavage measurements from Kim et al. (2018) and Huang et al. (2024). Ensemble with heuristic serves as primary ranking score.
        </p>

        {/* Architecture branches */}
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Branch Ablation (Kim 2018 cross-library)</div>
        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
          {[
            { name: "CNN only (baseline)", rho: "0.496", delta: null },
            { name: "+ RNA-FM embeddings", rho: "0.501", delta: "+0.005" },
            { name: "+ RLPA attention", rho: "0.534", delta: "+0.033" },
          ].map((f, i, arr) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO, color: T.text, width: 55, textAlign: "right" }}>{f.rho}</span>
              {f.delta ? (
                <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: MONO, color: T.success, width: 55, textAlign: "right" }}>{f.delta}</span>
              ) : (
                <span style={{ width: 55, textAlign: "right", fontSize: "11px", color: T.textTer }}>baseline</span>
              )}
            </div>
          ))}
        </div>

        {/* Architecture details */}
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Architecture</div>
        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden" }}>
          {[
            ["Architecture", "CNN + RNA-FM → RLPA Attention → Fusion → Dense"],
            ["CNN input", "One-hot 34nt (PAM + spacer + context)"],
            ["RNA-FM input", "Pre-cached 640-dim embeddings (20 positions)"],
            ["Training data", "25K+ guides (Kim 2018 + Huang 2024)"],
            ["Parameters", "235K"],
            ["Val ρ (cis)", "0.49 (Spearman, Kim 2018 cross-library)"],
            ["Val ρ (trans)", "0.55 (Spearman, Huang 2024 EasyDesign)"],
            ["Attention", "RLPA — causal mask encoding PAM→distal R-loop propagation"],
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

      {/* ── Discrimination model ── */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "28px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <TrendingUp size={20} color={T.primary} />
          <span style={{ fontSize: "16px", fontWeight: 700, color: T.text, fontFamily: HEADING }}>Discrimination Prediction</span>
          <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600 }}>Trained</span>
        </div>
        <p style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.7, margin: "0 0 16px" }}>
          Gradient-boosted model (LightGBM) trained on 6,136 paired MUT/WT trans-cleavage measurements from the EasyDesign dataset (Huang et al. 2024, LbCas12a).
          Predicts the discrimination ratio (\u0394log-k between perfect-match and single-mismatch targets) from 15 thermodynamic features encoding mismatch position, chemistry, R-loop energetics, and sequence context.
        </p>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Performance (3-fold stratified CV, guide-level split)</div>
        <div style={{ background: T.bgSub, borderRadius: "10px", overflow: "hidden", marginBottom: "16px" }}>
          {[
            { name: "Heuristic baseline", rmse: "0.641", corr: "0.298", delta: null },
            { name: "Learned model (XGBoost)", rmse: "0.540", corr: "0.459", delta: "\u221215% RMSE" },
          ].map((f, i, arr) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
              <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: T.text }}>{f.name}</div>
              <span style={{ fontSize: "12px", fontFamily: MONO, color: T.textSec, width: 80, textAlign: "right" }}>RMSE {f.rmse}</span>
              <span style={{ fontSize: "12px", fontFamily: MONO, color: T.text, fontWeight: 700, width: 55, textAlign: "right" }}>r={f.corr}</span>
              {f.delta ? (
                <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: MONO, color: T.success, width: 75, textAlign: "right" }}>{f.delta}</span>
              ) : (
                <span style={{ width: 75, textAlign: "right", fontSize: "11px", color: T.textTer }}>baseline</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textSec, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Features (by importance)</div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Seed \u0394G", desc: "R-loop stability at seed" },
            { label: "Total hybrid \u0394G", desc: "Full RNA:DNA energy" },
            { label: "Cumulative \u0394G", desc: "Energy at mismatch pos" },
            { label: "Energy ratio", desc: "|cum. \u0394G| / \u0394\u0394G" },
            { label: "GC content", desc: "Spacer GC fraction" },
          ].map(f => (
            <div key={f.label} style={{ background: T.bgSub, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: T.primary }}>{f.label}</div>
              <div style={{ fontSize: "9px", color: T.textTer, marginTop: "2px" }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "11px", color: T.textTer, lineHeight: 1.6 }}>
          Training data: EasyDesign (Huang et al. 2024). Features: R-loop \u0394G profiles (Sugimoto 1995 NN params), mismatch \u0394\u0394G penalties (Sugimoto 2000), position sensitivity (Strohkendl 2018). Guide-level CV split prevents data leakage.
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
   RESEARCH PAGE — Experimental sandbox for scoring R&D
   ═══════════════════════════════════════════════════════════════════ */
const ResearchPage = ({ connected }) => {
  const mobile = useIsMobile();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [comparison, setComparison] = useState(null);
  const [modelA, setModelA] = useState("heuristic");
  const [modelB, setModelB] = useState("guard_net");
  const [comparing, setComparing] = useState(false);
  const [thermoTarget, setThermoTarget] = useState("");
  const [thermoStandaloneSeq, setThermoStandaloneSeq] = useState("TCGGTCAACCCCGACAGC");
  const [thermoMode, setThermoMode] = useState("standalone"); // "standalone" | "panel"
  const [thermoData, setThermoData] = useState(null);
  const [thermoLoading, setThermoLoading] = useState(false);
  const [thermoShowWT, setThermoShowWT] = useState(true);
  const [ablation, setAblation] = useState([]);
  const [sciBgOpen, setSciBgOpen] = useState(false);

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
    bg: "#fafafa", cardBg: "#ffffff", border: "#e5e5e5", text: "#1a1a1a",
    muted: "#737373", accent: "#2563eb", positive: "#16a34a", negative: "#dc2626",
    mutLine: "#1a1a1a", wtLine: "#a3a3a3", seedBg: "rgba(37,99,235,0.06)",
    snpLine: "#dc2626", barrier: "#f97316",
  };
  const rTooltip = { background: "#1a1a1a", border: "none", borderRadius: "6px", fontSize: "11px", fontFamily: MONO, color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" };
  const selectStyle = { padding: "6px 10px", borderRadius: "6px", border: `1px solid ${RS.border}`, fontSize: "12px", fontFamily: MONO, background: RS.cardBg, color: RS.text };
  const btnStyle = { padding: "6px 14px", borderRadius: "6px", border: "none", background: RS.accent, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" };
  const thStyle = { padding: "8px 12px", fontWeight: 600, color: RS.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${RS.border}` };
  const tdStyle = { padding: "8px 12px", fontSize: "12px", fontFamily: MONO, color: RS.text };

  // Heuristic feature weights for waterfall chart
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
    <div style={{ padding: mobile ? "24px 16px" : "48px 40px", background: RS.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: RS.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Research</div>
        <h2 style={{ fontSize: mobile ? "22px" : "28px", fontWeight: 800, color: RS.text, margin: 0, letterSpacing: "-0.02em", fontFamily: HEADING }}>Scoring R&D Sandbox</h2>
        <p style={{ fontSize: "13px", color: RS.muted, marginTop: "8px", lineHeight: 1.7, maxWidth: "720px" }}>
          Experimental workspace for scoring model development. Results here are exploratory — they inform model selection and feature engineering but do not affect production panel design. All thermodynamic calculations use nearest-neighbor parameters (Sugimoto et al. 1995 for RNA:DNA; SantaLucia 1998 for DNA:DNA) and are approximations of the true molecular energetics.
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
            <option value="guard_net">GUARD-Net</option>
            <option value="guard_net_diagnostic">GUARD-Net Diagnostic</option>
          </select>
          <span style={{ fontSize: "12px", color: RS.muted, fontWeight: 600 }}>vs</span>
          <select value={modelB} onChange={(e) => setModelB(e.target.value)} style={selectStyle}>
            <option value="guard_net">GUARD-Net</option>
            <option value="heuristic">Heuristic</option>
            <option value="guard_net_diagnostic">GUARD-Net Diagnostic</option>
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
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: RS.muted, fontWeight: 600, marginBottom: "4px" }}>KENDALL TAU</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: RS.text, fontFamily: MONO }}>{summary.kendall_tau?.toFixed(3) ?? "—"}</div>
                  <div style={{ fontSize: "10px", color: RS.muted, marginTop: "2px" }}>1.0 = identical ranking, 0 = unrelated</div>
                </div>
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: RS.muted, fontWeight: 600, marginBottom: "4px" }}>MEAN SCORE DELTA</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: summary.mean_score_delta > 0 ? RS.positive : summary.mean_score_delta < 0 ? RS.negative : RS.text, fontFamily: MONO }}>
                    {summary.mean_score_delta > 0 ? "+" : ""}{summary.mean_score_delta?.toFixed(4) || "0"}
                  </div>
                  <div style={{ fontSize: "10px", color: RS.muted, marginTop: "2px" }}>Average score change (B - A)</div>
                </div>
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "14px 18px" }}>
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
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
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
                            <td style={{ ...tdStyle, color: RS.muted }}>{t.drug || "—"}</td>
                            <td style={{ ...tdStyle, color: RS.muted, fontSize: "11px" }}>{t.strategy || "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{t.model_a.score?.toFixed(3) ?? "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{t.model_b.score?.toFixed(3) ?? "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: t.score_delta > 0 ? RS.positive : t.score_delta < 0 ? RS.negative : RS.muted }}>
                              {t.score_delta != null ? `${t.score_delta > 0 ? "+" : ""}${t.score_delta.toFixed(3)}` : "—"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center", color: RS.muted }}>{t.model_a.disc != null ? `${t.model_a.disc}x` : "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>#{t.model_a.rank ?? "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>#{t.model_b.rank ?? "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "center", color: t.rank_delta > 0 ? RS.positive : t.rank_delta < 0 ? RS.negative : RS.muted }}>
                              {t.rank_delta != null ? (t.rank_delta > 0 ? `▲${t.rank_delta}` : t.rank_delta < 0 ? `▼${Math.abs(t.rank_delta)}` : "—") : "—"}
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
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Score Distribution Comparison</div>
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
          <button onClick={() => setSciBgOpen(!sciBgOpen)} style={{ background: "none", border: `1px solid ${RS.border}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", color: RS.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            {sciBgOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Scientific Background
          </button>
          {sciBgOpen && (
            <div style={{ marginTop: "10px", padding: "16px 20px", background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", fontSize: "12px", color: RS.muted, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 10px 0" }}>R-loop formation is the rate-limiting step of CRISPR-Cas12a target recognition (Strohkendl et al., Molecular Cell 2018; 2024). The crRNA spacer hybridises to the target strand of dsDNA, displacing the non-target strand, in a sequential PAM-proximal to PAM-distal process. Each dinucleotide step contributes a free energy increment that depends on the base-pair identity (nearest-neighbor model).</p>
              <p style={{ margin: "0 0 10px 0" }}>Zhang et al. (Nucleic Acids Research 2024, DOI: 10.1093/nar/gkae1124) demonstrated a linear correlation between Cas12a trans-cleavage kinetics and the free energy change required to unwind the crRNA spacer and DNA target from their self-folded states to a hybridisation-competent conformation. This "unwinding cost" is the dominant predictor of trans-cleavage rate.</p>
              <p style={{ margin: "0 0 10px 0" }}>CRISPRzip (Offerhaus et al., bioRxiv 2025) formalises R-loop formation as movement through a sequence-dependent free-energy landscape, combining nearest-neighbor RNA:DNA hybrid energetics with protein-mediated contributions inferred from high-throughput kinetics.</p>
              <p style={{ margin: "0 0 10px 0" }}>Aris et al. (Nature Communications 2025, DOI: 10.1038/s41467-025-57703-y) established a four-state kinetic model for Cas12a R-loop dynamics using single-molecule measurements, showing that R-loop formation is dynamic and reversible, with supercoiling-dependent interrogation.</p>
              <p style={{ margin: 0, fontStyle: "italic", fontSize: "11px", color: "#a3a3a3" }}>The profiles shown here use the Sugimoto et al. (1995) nearest-neighbor parameters for RNA:DNA hybrid thermodynamics and the SantaLucia (1998) unified parameters for DNA:DNA duplex stability. These are approximations — the true free-energy landscape includes protein-mediated contributions, supercoiling effects, and PAM-proximal protein contacts that stabilise early R-loop intermediates beyond what nucleic acid thermodynamics alone predict.</p>
            </div>
          )}
        </div>

        {/* Target input — dual mode */}
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
                  <input value={thermoStandaloneSeq} onChange={(e) => setThermoStandaloneSeq(e.target.value.toUpperCase().replace(/[^ATCG]/g, ""))} placeholder="e.g. TCGGTCAACCCCGACAGC" style={{ ...selectStyle, flex: 1, maxWidth: "320px", fontFamily: MONO, letterSpacing: "0.05em" }} />
                  <button onClick={handleThermoStandalone} disabled={thermoStandaloneSeq.trim().length < 15} style={{ ...btnStyle, opacity: thermoStandaloneSeq.trim().length < 15 ? 0.5 : 1 }}>Compute</button>
                </div>
                <div style={{ fontSize: "10px", color: "#a3a3a3", marginTop: "4px" }}>Pre-filled: rpoB_H445D spacer (18 nt). No panel run needed.</div>
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
                  <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text }}>{thermoTarget}</div>
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
                  <div key={m.label} style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "6px", padding: "10px 12px" }} title={m.tip}>
                    <div style={{ fontSize: "9px", color: RS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: RS.text, fontFamily: MONO, marginTop: "2px" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart A: Cumulative R-Loop Free Energy Profile */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Cumulative R-Loop Free Energy Profile</div>
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
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: RS.seedBg, borderRadius: "6px", fontSize: "11px", color: RS.text, lineHeight: 1.6 }}>
                    <strong>Thermodynamic discrimination:</strong> The mismatch at position {snpPos} creates a +{Number(sc.snp_barrier).toFixed(2)} kcal/mol barrier in the wildtype R-loop.
                    {snpPos <= 4 ? " At this seed position, the barrier occurs early in R-loop propagation, likely causing complete R-loop collapse (Strohkendl et al., 2018)." : snpPos <= 8 ? " Within the seed region, this barrier significantly impedes R-loop extension." : " At this PAM-distal position, the barrier occurs after substantial R-loop formation and may be partially tolerated."}
                  </div>
                )}
              </div>

              {/* Chart B: Per-Position Energy Contribution */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px", marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Per-Position Energy Contribution</div>
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
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Unwinding Cost Decomposition</div>
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
                            <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: MONO, color: item.color }}>{item.value > 0 ? "+" : ""}{item.value.toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{ width: "60px", fontSize: "10px", color: RS.muted, flexShrink: 0 }}>{item.type === "cost" ? "cost" : "gain"}</div>
                      </div>
                    );
                  })}
                  {/* Net line */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: `1px solid ${RS.border}`, paddingTop: "8px", marginTop: "4px" }}>
                    <div style={{ width: "180px", fontSize: "12px", fontWeight: 700, color: RS.text, textAlign: "right" }}>Net dG (nucleic acid)</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, fontFamily: MONO, color: netDg < 0 ? RS.positive : RS.negative }}>{netDg.toFixed(2)} kcal/mol</span>
                      <span style={{ fontSize: "11px", color: RS.muted, marginLeft: "8px" }}>{netDg < -15 ? "strongly favourable" : netDg < -5 ? "moderately favourable" : netDg < 0 ? "weakly favourable" : "unfavourable without protein"}</span>
                    </div>
                    <div style={{ width: "60px" }} />
                  </div>
                </div>
                {/* Protein stabilisation note */}
                {netDg >= 0 && (
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: RS.seedBg, borderRadius: "6px", fontSize: "11px", color: RS.text, lineHeight: 1.6 }}>
                    <strong>Note:</strong> The positive net dG indicates that nucleic acid thermodynamics alone do not favour R-loop formation at this target. Cas12a protein provides 10{"\u2013"}30 kcal/mol of additional stabilisation through PAM recognition, REC domain contacts, and conformational coupling (Strohkendl et al. 2024; CRISPRzip, Offerhaus et al. 2025). The hybrid dG ({(eb.hybrid_formation_dg || 0).toFixed(2)} kcal/mol) remains the best available predictor of relative guide performance across candidates, as the protein contribution is approximately constant.
                  </div>
                )}
                {/* References */}
                <div style={{ marginTop: "12px", fontSize: "10px", color: "#a3a3a3", fontStyle: "italic" }}>
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
          // Build scatter data — only rows with both kim and ed rho
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
                <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Cis vs Trans Cleavage Correlation</div>
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
                            <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>{d.label}</div>
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
              <div style={{ padding: "14px 18px", background: RS.seedBg, borderRadius: "8px", fontSize: "12px", color: RS.text, lineHeight: 1.7, marginBottom: "16px" }}>
                <strong>Key finding:</strong> Models optimised for cis-cleavage gene editing (Kim 2018 benchmark) show near-zero predictive value for diagnostic trans-cleavage (rho = 0.04). The production checkpoint (multi-dataset, no domain adversarial) achieves rho = 0.55 on trans-cleavage while retaining rho = 0.49 on cis-cleavage — the best all-rounder across both benchmarks. Domain-adversarial training (Ganin et al., JMLR 2016) is counter-productive: forcing domain invariance destroys trans-cleavage-specific signal.
              </div>

              {/* Table */}
              <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", overflow: "hidden" }}>
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
                              {isProd && <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 700, color: RS.accent, background: `${RS.accent}15`, padding: "2px 6px", borderRadius: "3px", fontFamily: FONT }}>PRODUCTION</span>}
                            </td>
                            <td style={{ ...tdStyle, color: RS.muted, fontFamily: FONT, fontSize: "11px" }}>{row.features}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{row.kim_rho?.toFixed(3) ?? "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: row.ed_rho ? RS.text : "#d4d4d4" }}>{row.ed_rho?.toFixed(3) ?? "—"}</td>
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
        <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px", marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Position Importance</div>
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
        <div style={{ background: RS.cardBg, border: `1px solid ${RS.border}`, borderRadius: "8px", padding: "20px 24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: RS.text, marginBottom: "4px" }}>Heuristic Feature Breakdown</div>
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
                      <div style={{ width: "80px", fontSize: "12px", fontFamily: MONO, fontWeight: item.isBase ? 800 : 600, color: item.isBase ? RS.text : (isPositive ? RS.positive : RS.negative), textAlign: "right", flexShrink: 0 }}>
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
  const [resultsScorer, setResultsScorer] = useState("heuristic");
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
    if (opts?.scorer && pg === "results") setResultsScorer(opts.scorer);
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
          <img src="/guard-wordmark.png" alt="GUARD" style={{ height: "22px", objectFit: "contain" }} />
          {!connected && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: T.danger, fontWeight: 600 }}>
              <WifiOff size={10} /> API disconnected
            </div>
          )}
        </header>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar page={page} setPage={setPage} connected={connected} mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <main style={{ flex: 1, overflow: "auto" }}>
          <div key={page} style={{ animation: "pageIn 0.15s ease-out" }}>
            {page === "home" && <HomePage goTo={goTo} connected={connected} />}
            {page === "pipeline" && <PipelinePage jobId={pipelineJobId} connected={connected} goTo={goTo} />}
            {page === "results" && <ResultsPage connected={connected} jobId={resultsJobId} scorer={resultsScorer} goTo={goTo} />}
            {page === "panels" && <PanelsPage connected={connected} />}
            {page === "mutations" && <MutationsPage />}
            {page === "scoring" && <ScoringPage connected={connected} />}
            {page === "research" && <ResearchPage connected={connected} />}
          </div>
        </main>
      </div>

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Urbanist:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pageIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
        @keyframes stepSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes stepSwipeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes statReveal { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes subtlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes indeterminateProgress { 0% { width: 0%; margin-left: 0%; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
        @keyframes statFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
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
