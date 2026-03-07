# <img src="logo.png" alt="GUARD logo" height="32" style="vertical-align: middle;"> GUARD

**Guide RNA Automated Resistance Diagnostics**

Computational pipeline for designing multiplexed CRISPR-Cas12a diagnostic panels targeting drug-resistant *Mycobacterium tuberculosis*.

---

GUARD takes WHO-catalogued drug-resistance mutations as input and produces ready-to-order crRNA sequences, RPA primer pairs, and a fully optimised multiplex panel for CRISPR-Cas12a electrochemical diagnostics. The pipeline handles PAM deserts in the GC-rich *M. tuberculosis* genome (65.6% GC) through automatic proximity detection with allele-specific RPA primer design. Guide scoring uses a three-level hierarchy — biophysical heuristic, temperature-calibrated SeqCNN, and GUARD-Net (dual-branch CNN + RNA-FM with physics-informed R-loop attention) — blended via Spearman-optimised ensemble weighting. GUARD designs a complete 15-channel MDR-TB panel — covering rifampicin, isoniazid, ethambutol, pyrazinamide, fluoroquinolone, and aminoglycoside resistance plus an IS6110 species control — in under 15 seconds.

## Pipeline

<img width="3398" height="1147" alt="GUARD pipeline architecture" src="https://github.com/user-attachments/assets/89c58154-ba94-4e98-94ec-c2c8580c4c99" />

Ten modules execute sequentially:

1. **Target Resolution** — WHO-catalogued mutations → genomic coordinates on H37Rv (5-strategy offset resolver)
2. **PAM Scanning** — Both strands scanned for Cas12a-compatible PAMs (TTTV canonical + enAsCas12a relaxed: TTTN, TTCN, TCTV, CTTV) with variable spacer lengths (18–23 nt)
3. **Candidate Filtering** — Biophysical constraints: GC 30–70%, homopolymer < 5, self-complementarity ΔG check
4. **Off-Target Screening** — Bowtie2 alignment against complete H37Rv genome (4.41 Mb, ≤3 mismatches flagged)
5. **Scoring** — Three-level hierarchy (see below), producing ranked candidates with calibrated scores
6. **Mismatch Pairs + SM Enhancement** — WT/MUT spacer pairs generated; synthetic mismatches at seed positions 2–6 boost discrimination from 2–6× to 10–100×
7. **Discrimination Scoring** — Position-dependent MUT/WT activity ratio quantification
8. **Multiplex Optimisation** — Simulated annealing over candidate combinations (10,000 iterations), minimising cross-reactivity
9. **RPA Primer Design** — Standard (28–38 nt, Tm 57–72 °C) + allele-specific primers for proximity candidates, with dimer ΔG checking
10. **Panel Assembly + Export** — Final panel with crRNA sequences, primer pairs, amplicon maps, discrimination predictions → JSON, TSV, FASTA

For mutations in PAM-desert regions (e.g. *rpoB* RRDR, 70%+ GC with no T-rich PAM within 50 bp), the pipeline automatically falls back to **proximity detection**: the crRNA targets a nearby accessible site while an allele-specific RPA primer bridges the mutation for discrimination.

## Scoring Hierarchy

Three scoring levels, each temperature-calibrated. `composite_score` automatically selects the best available: ensemble > calibrated ML > raw ML > heuristic.

### Level 1 — Biophysical Heuristic

Weighted sum of five sequence features from high-throughput Cas12a activity profiling:

| Feature | Weight | Reference |
|---------|--------|-----------|
| Seed position (nt 1–8) | 0.35 | Strohkendl et al., *Mol Cell* 2018 |
| GC content | 0.20 | Kim et al., *Nat Biotechnol* 2018 |
| Secondary structure (ΔG) | 0.20 | Nearest-neighbour thermodynamics |
| Homopolymer penalty | 0.10 | Zetsche et al., *Cell* 2015 |
| Off-target count | 0.15 | Bowtie2; Langmead & Salzberg 2012 |

### Level 2 — SeqCNN

Convolutional neural network predicting Cas12a guide activity from one-hot encoded 34-nt input.

- **Architecture**: Multi-scale parallel Conv1d (k=3,5,7) → dilated Conv1d (d=1,2) with residual connections → adaptive pooling → dense head (128→64→32→1)
- **Parameters**: 110K
- **Training data**: 15,000 AsCas12a guides (Kim et al. 2018 HT-PAMDA)
- **Loss**: Huber (δ=1.0) + differentiable Spearman regulariser (λ=0.1)
- **Validation ρ**: 0.74 · Test ρ: 0.53 (cross-library)
- **Calibration**: T = 7.53, α = 0.007

### Level 3 — GUARD-Net

Dual-branch architecture with physics-informed attention, purpose-built for diagnostic guide scoring.

```
Target DNA (4×34 one-hot) ──→ [CNN Branch: multi-scale Conv1d] ──→ (B, 34, 64) ─┐
                                                                                   ├─→ concat ─→ [RLPA] ─→ pool ─→ [Efficiency Head] ─→ score
crRNA spacer (20×640 RNA-FM) ─→ [Projection + zero-pad to 34] ──→ (B, 34, 64) ─┘
```

- **CNN branch**: Multi-scale Conv1d (k=3,5,7,9) with batch norm → 64-dim per-position features from target DNA
- **RNA-FM branch**: Frozen RNA-FM embeddings (640-dim) projected to 64-dim, zero-padded from 20 to 34 positions (crRNA spacer → full target alignment)
- **RLPA** (R-Loop Propagation Attention): Causal self-attention encoding Cas12a R-loop propagation directionality (PAM-proximal → distal). Biophysically motivated: Cas12a unwinds DNA directionally from the PAM, so position 1 influences all downstream positions but not vice versa
- **Efficiency head**: 128→64→32→1 with GELU + dropout, sigmoid output
- **Parameters**: ~235K total (RNA-FM frozen; CNN ~65K, projection ~60K, RLPA ~25K, heads ~85K)
- **Training data**: Kim et al. 2018 + Huang et al. 2024 (EasyDesign)
- **Validation ρ**: 0.71 · Test ρ: 0.50
- **Calibration**: T = 0.74 (quantile-matched), α = 0.028

### Temperature Calibration & Ensemble

Each scorer applies: `calibrated = sigmoid(logit(raw) / T)`, then `ensemble = α × heuristic + (1 − α) × calibrated`.

Temperature calibration maps raw sigmoid outputs onto the target activity distribution via quantile matching at the 10th/25th/50th/75th/90th percentiles. This ensures Block 3 threshold decisions (efficiency ≥ 0.3/0.4/0.6) operate on properly scaled values rather than compressed sigmoid ranges. The near-zero α values reflect the ML scorers' superior ranking ability (ρ > 0.7) over the simplified heuristic (ρ ≈ 0.18).

| Scorer | T | α | Calibrated range | Val ρ |
|--------|---|---|-----------------|-------|
| SeqCNN | 7.53 | 0.007 | [0.36, 0.61] | 0.74 |
| GUARD-Net | 0.74 | 0.028 | [0.01, 0.97] | 0.71 |

## Block 3 — Optimisation & Diagnostics

Three configurable presets control candidate selection stringency:

| Preset | Efficiency ≥ | Discrimination ≥ | Use case |
|--------|-------------|-------------------|----------|
| High sensitivity | 0.30 | 2× | Early screening, maximum coverage |
| Balanced | 0.40 | 3× | WHO TPP-aligned clinical deployment |
| High specificity | 0.60 | 5× | Confirmatory testing, minimal false positives |

Diagnostic metrics include per-drug-class sensitivity/specificity against WHO Target Product Profiles, coverage gap identification, and per-test cost estimation.

## Example: 14-plex MDR-TB Panel

Input: 14 WHO-catalogued resistance mutations across 6 drug classes.

| Target | Drug | Strategy | Disc. | Score | Primers | SM |
|--------|------|----------|-------|-------|---------|----|
| *rpoB* S450L | RIF | Proximity | — | 0.607 | AS-RPA | No |
| *rpoB* H445D | RIF | Direct | 5.7× | 0.632 | Standard | Yes |
| *rpoB* H445Y | RIF | Direct | 5.7× | 0.645 | Standard | Yes |
| *rpoB* D435V | RIF | Direct | 5.7× | 0.634 | Standard | Yes |
| *rpoB* S450W | RIF | Proximity | — | 0.607 | AS-RPA | No |
| *katG* S315T | INH | Proximity | — | 0.635 | AS-RPA | No |
| *katG* S315N | INH | Proximity | — | 0.635 | AS-RPA | No |
| *inhA* C-15T | INH | Direct | 4.6× | 0.628 | Standard | Yes |
| *embB* M306V | EMB | Proximity | — | 0.595 | AS-RPA | No |
| *embB* M306I | EMB | Proximity | — | 0.595 | AS-RPA | No |
| *pncA* H57D | PZA | Proximity | — | 0.645 | AS-RPA | No |
| *gyrA* D94G | FQ | Direct | 5.2× | 0.618 | Standard | Yes |
| *gyrA* A90V | FQ | Proximity | — | 0.580 | AS-RPA | No |
| *rrs* A1401G | AG | Direct | 3.3× | 0.598 | Standard | No |
| IS6110 | Control | Direct | — | — | Standard | No |

15/15 candidates with primers · 6 direct targets with diagnostic-grade discrimination (≥3×) · 42 SM-enhanced candidates · 34,364 → 1,037 → 238 → 15 · 14.4 s

## Training

### SeqCNN

```bash
python -m guard.scoring.train_cnn --data-dir guard/data/kim2018/ --epochs 200
python -m guard.scoring.calibrate
```

### GUARD-Net

```bash
# Phase 1: CNN + RNA-FM + RLPA
cd guard-net && python scripts/run_phase1_rlpa.py

# Temperature calibration (quantile-matched on Kim 2018 validation)
python -m guard.scoring.calibrate_guard_net
```

Training data: Kim et al. 2018 HT-PAMDA — three independent HEK293T libraries (HT1/HT2/HT3) with ~15,000 AsCas12a guides each. HT1 for training, HT2 for validation and calibration, HT3 for held-out testing. Labels are log₂-transformed indel frequencies normalised to [0, 1]. Source: [Paired-Library (GitHub)](https://github.com/MyungjaeSong/Paired-Library).

## References

1. Kim HK, et al. Deep learning improves prediction of CRISPR–Cpf1 guide RNA activity. *Nat Biotechnol* **36**, 239–241 (2018). [DOI](https://doi.org/10.1038/nbt.4061)
2. Strohkendl I, et al. Kinetic basis for DNA target specificity of CRISPR-Cas12a. *Mol Cell* **71**, 816–824 (2018). [DOI](https://doi.org/10.1016/j.molcel.2018.06.043)
3. Kleinstiver BP, et al. Engineered CRISPR-Cas12a variants with increased activities and improved targeting ranges. *Nat Biotechnol* **37**, 276–282 (2019). [DOI](https://doi.org/10.1038/s41587-018-0011-0)
4. Chen JS, et al. CRISPR-Cas12a target binding unleashes indiscriminate single-stranded DNase activity. *Science* **360**, 436–439 (2018). [DOI](https://doi.org/10.1126/science.aar6245)
5. Zetsche B, et al. Cpf1 is a single RNA-guided endonuclease of a class 2 CRISPR-Cas system. *Cell* **163**, 759–771 (2015). [DOI](https://doi.org/10.1016/j.cell.2015.09.038)
6. Langmead B, Salzberg SL. Fast gapped-read alignment with Bowtie 2. *Nat Methods* **9**, 357–359 (2012). [DOI](https://doi.org/10.1038/nmeth.1923)
7. Chen J, et al. Interpretable RNA Foundation Model from Unannotated Data for Highly Accurate RNA Structure and Function Predictions. *arXiv:2204.00300* (2022). [arXiv](https://arxiv.org/abs/2204.00300)
8. Huang B, et al. Deep learning enhancing guide RNA design for CRISPR/Cas12a-based diagnostics. *iMeta* **3**, e214 (2024). [DOI](https://doi.org/10.1002/imt2.214)
9. Broughton JP, et al. CRISPR–Cas12-based detection of SARS-CoV-2. *Nat Biotechnol* **38**, 870–874 (2020). [DOI](https://doi.org/10.1038/s41587-020-0513-4)
10. WHO. Catalogue of mutations in *Mycobacterium tuberculosis* complex and their association with drug resistance, 2nd edition. Geneva: World Health Organization (2023).

## Citation

```bibtex
@software{guard2025,
  author = {Uzan, Valentin},
  title = {GUARD: Guide RNA Automated Resistance Diagnostics},
  year = {2025},
  url = {https://github.com/VUzan-bio/guard},
  note = {Computational pipeline for multiplexed CRISPR-Cas12a MDR-TB diagnostics}
}
```

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgements

Developed for the BRIDGE Discovery grant project on CRISPR-Cas12a electrochemical diagnostics for drug-resistant tuberculosis.
