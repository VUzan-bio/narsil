# GUARD

**Guide RNA Automated Resistance Diagnostics**

Computational design of multiplexed CRISPR-Cas12a diagnostic panels for
drug-resistant *Mycobacterium tuberculosis*
---

GUARD is an end-to-end computational pipeline that takes WHO-catalogued drug-resistance mutations as input and produces ready-to-order crRNA spacer sequences and RPA primer pairs for a multiplexed CRISPR-Cas12a electrochemical diagnostic panel. The pipeline handles PAM deserts in the GC-rich *M. tuberculosis* genome (65.6% GC) through automatic proximity detection with allele-specific RPA primer design, and integrates biophysical heuristic scoring with a temperature-calibrated convolutional neural network ensemble (Spearman ρ = 0.74 on validation). GUARD designs a complete 15-channel MDR-TB panel — covering rifampicin, isoniazid, ethambutol, pyrazinamide, fluoroquinolone, and aminoglycoside resistance plus an IS6110 species control — in under 15 seconds. The output is compatible with isothermal (37 °C) recombinase polymerase amplification and electrochemical transduction from clinical blood samples.

## Features

| Feature | Description |
|---------|-------------|
| Multi-PAM scanning | enAsCas12a expanded PAM recognition (TTTV/TTTN/TTCN/TCTV/CTTV) with variable spacer lengths (18–23 nt) |
| PAM desert handling | Automatic proximity fallback with allele-specific RPA primer design for high-GC regions |
| Dual scoring | Heuristic biophysical features + temperature-calibrated SeqCNN ensemble (ρ = 0.74) |
| Discrimination modelling | Position-dependent mismatch penalties with synthetic mismatch enhancement (2–6× → 10–100×) |
| Off-target screening | Bowtie2 alignment against complete H37Rv genome (≤3 mismatches, 4.41 Mb) |
| Multiplex optimisation | Simulated annealing panel selection (10,000 iterations) minimising cross-reactivity |
| RPA primer co-design | Standard (28–38 nt) + allele-specific primers with crRNA compatibility validation |
| Pipeline transparency | Per-module statistics with candidate funnel tracking (34,364 → 238 → 15) |

## Pipeline

<img width="3398" height="1147" alt="Gemini_Generated_Image_xkbngfxkbngfxkbn" src="https://github.com/user-attachments/assets/89c58154-ba94-4e98-94ec-c2c8580c4c99" />

## Quick Start

### Prerequisites

- Python ≥ 3.11
- Node.js ≥ 18 (frontend)
- Bowtie2 (off-target screening; optional, heuristic fallback available)

### Installation

```bash
git clone https://github.com/vuzan/guard.git
cd guard

# Backend
pip install -e ".[dev]"

# Frontend
cd guard-ui
npm install

# (Optional) Bowtie2 index for off-target screening
bowtie2-build data/references/H37Rv.fasta data/references/H37Rv
```

### Run

```bash
# Backend (FastAPI)
uvicorn api.main:app --reload --port 8000

# Frontend (separate terminal)
cd guard-ui
npm run dev
```

Navigate to `http://localhost:5173`.

### CLI

```bash
guard run-full -c configs/mdr_14plex.yaml    # Modules 1–10 (end-to-end)
guard run -c configs/mdr_14plex.yaml          # Modules 1–5 (basic)
guard design -r H37Rv.fasta -g H37Rv.gff3     # 14-plex MDR-TB panel
guard info                                     # Pipeline version + capabilities
```

## Scoring Models

### Biophysical Heuristic

Weighted sum of five sequence features derived from high-throughput Cas12a activity profiling:

| Feature | Weight | Reference |
|---------|--------|-----------|
| Seed position (nt 1–8) | 0.35 | Strohkendl et al., *Mol Cell* 2018 |
| GC content | 0.20 | Kim et al., *Nat Biotechnol* 2018 |
| Secondary structure (ΔG) | 0.20 | Nearest-neighbour thermodynamics |
| Homopolymer penalty | 0.10 | Zetsche et al., *Cell* 2015 |
| Off-target count | 0.15 | Bowtie2; Langmead & Salzberg, *Nat Methods* 2012 |

### SeqCNN

Convolutional neural network predicting Cas12a guide activity from one-hot encoded 34-nt input sequences.

- **Architecture**: Multi-scale parallel Conv1d (k=3,5,7) → dilated Conv1d (d=1,2) with residual connections → adaptive average pooling → dense head (128→64→32→1)
- **Parameters**: 110,009
- **Training data**: 15,000 AsCas12a guides (Kim et al., *Nat Biotechnol* 2018)
- **Loss**: Huber (δ=1.0) + differentiable Spearman regulariser (λ=0.1)
- **Validation ρ**: 0.74 (Spearman, within-library HT2)
- **Test ρ**: 0.53 (Spearman, cross-library generalisation HT3)
- **Calibration**: Temperature scaling (T=7.5) spreads saturated sigmoid outputs from [0.01, 0.97] to [0.36, 0.61]

### Ensemble

Final score = α × heuristic + (1 − α) × calibrated CNN, where α = 0.007 is optimised to maximise Spearman ρ on the validation set. The near-zero α reflects the CNN's superior ranking ability over the simplified heuristic applied to raw sequences.

## Example: 14-plex MDR-TB Panel

Input: 14 WHO-catalogued resistance mutations across 6 drug classes (RIF, INH, EMB, PZA, FQ, AG).

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

15/15 candidates with primers · 6 direct targets with diagnostic-grade discrimination (≥3×) · 42 SM-enhanced candidates · 34,364 positions scanned → 1,037 PAM sites → 238 candidates → 15 selected · 14.4 seconds

## Project Structure

```
guard/
├── core/                       # Data models, config, constants
│   ├── types.py                # CrRNACandidate, Target, PanelMember
│   ├── config.py               # YAML-driven PipelineConfig
│   └── constants.py            # IS6110 control, gene synonyms
├── targets/                    # M1: target resolution
│   ├── resolver.py             # 5-strategy offset resolver
│   └── who_parser.py           # WHO catalogue parser
├── candidates/                 # M2–M3: generation + filtering
│   ├── scanner.py              # Multi-PAM scanning
│   ├── filters.py              # Organism-aware biophysical filtering
│   ├── mismatch.py             # M5.5: MUT/WT spacer pair generation
│   └── synthetic_mismatch.py   # M6: SM enhancement engine
├── offtarget/                  # M4: off-target screening
│   └── screener.py             # Bowtie2 + heuristic fallback
├── scoring/                    # M5–M6.5: scoring hierarchy
│   ├── base.py                 # Abstract Scorer interface
│   ├── heuristic.py            # Level 1: rule-based composite
│   ├── seq_cnn.py              # SeqCNN model architecture (PyTorch)
│   ├── sequence_ml.py          # Level 2: CNN scorer with calibration
│   ├── preprocessing.py        # One-hot encoding, input windows
│   ├── train_cnn.py            # Training script (Huber + Spearman loss)
│   ├── calibrate.py            # Temperature scaling + ensemble optimisation
│   ├── discrimination.py       # Mismatch discrimination scorer
│   └── jepa.py                 # Level 3: B-JEPA integration (stub)
├── multiplex/                  # M7: panel optimisation
│   └── optimizer.py            # Simulated annealing
├── primers/                    # M8–M8.5: primer design
│   ├── standard_rpa.py         # Standard RPA (28–38 nt, Tm 60–65 °C)
│   ├── as_rpa.py               # AS-RPA with deliberate 3' mismatches
│   └── coselection.py          # crRNA–primer compatibility
├── pipeline/                   # Orchestration
│   ├── runner.py               # GUARDPipeline.run_full() — M1–M10
│   └── cli.py                  # CLI entry points
├── data/
│   ├── references/             # H37Rv FASTA + Bowtie2 index
│   └── kim2018/                # Training data (not tracked — see README)
├── weights/
│   ├── seq_cnn_best.pt         # Trained CNN checkpoint
│   └── calibration.json        # Temperature + ensemble parameters
├── viz/                        # Publication figure modules
│   └── style.py                # Nature Methods–style plotting
└── panels/                     # Pre-defined panel configurations
    └── mdr_tb.py               # 14-plex MDR-TB definitions

api/                            # FastAPI backend
├── main.py                     # Application factory + CORS + SPA middleware
├── routes/                     # REST endpoints (pipeline, results, figures)
├── schemas.py                  # Pydantic response models
├── state.py                    # Job queue + AppState
└── ws.py                       # WebSocket progress streaming

guard-ui/                       # React + Vite frontend
└── src/App.jsx                 # Single-page application
```

## Training Data

The CNN is trained on the Seq-deepCpf1 dataset:

> Kim HK, Min S, Song M, et al. Deep learning improves prediction of CRISPR–Cpf1 guide RNA activity. *Nature Biotechnology* **36**, 239–241 (2018). DOI: [10.1038/nbt.4061](https://doi.org/10.1038/nbt.4061)

Data source: [Paired-Library (GitHub)](https://github.com/MyungjaeSong/Paired-Library)

Three independent HEK293T libraries (HT1/HT2/HT3) with ~15,000 AsCas12a guides each. HT1 is used for training, HT2 for validation and hyperparameter tuning, HT3 for held-out testing. Labels are log₂-transformed indel frequencies normalised to [0, 1].

To train from scratch:

```bash
python -m guard.scoring.train_cnn --data-dir guard/data/kim2018/ --epochs 200
python -m guard.scoring.calibrate
```

## References

1. Kim HK, Min S, Song M, et al. Deep learning improves prediction of CRISPR–Cpf1 guide RNA activity. *Nat Biotechnol* **36**, 239–241 (2018). [DOI](https://doi.org/10.1038/nbt.4061)

2. Strohkendl I, Saifuddin FA, Rybarski JR, et al. Kinetic basis for DNA target specificity of CRISPR-Cas12a. *Mol Cell* **71**, 816–824 (2018). [DOI](https://doi.org/10.1016/j.molcel.2018.06.043)

3. Kleinstiver BP, Sobers AN, Calvo SE, et al. Engineered CRISPR-Cas12a variants with increased activities and improved targeting ranges. *Nat Biotechnol* **37**, 276–282 (2019). [DOI](https://doi.org/10.1038/s41587-018-0011-0)

4. Chen JS, Ma E, Harrington LB, et al. CRISPR-Cas12a target binding unleashes indiscriminate single-stranded DNase activity. *Science* **360**, 436–439 (2018). [DOI](https://doi.org/10.1126/science.aar6245)

5. Zetsche B, Gootenberg JS, Abudayyeh OO, et al. Cpf1 is a single RNA-guided endonuclease of a class 2 CRISPR-Cas system. *Cell* **163**, 759–771 (2015). [DOI](https://doi.org/10.1016/j.cell.2015.09.038)

6. Langmead B, Salzberg SL. Fast gapped-read alignment with Bowtie 2. *Nat Methods* **9**, 357–359 (2012). [DOI](https://doi.org/10.1038/nmeth.1923)

7. Piepenburg O, Williams CH, Stemple DL, Armes NA. DNA detection using recombination proteins. *PLoS Biol* **4**, e204 (2006). [DOI](https://doi.org/10.1371/journal.pbio.0040204)

8. Ai JW, Zhou X, Xu T, et al. CRISPR-based rapid and ultra-sensitive diagnostic test for *Mycobacterium tuberculosis*. *Emerg Microbes Infect* **8**, 1361–1369 (2019). [DOI](https://doi.org/10.1080/22221751.2019.1664939)

9. Broughton JP, Deng X, Yu G, et al. CRISPR–Cas12-based detection of SARS-CoV-2. *Nat Biotechnol* **38**, 870–874 (2020). [DOI](https://doi.org/10.1038/s41587-020-0513-4)

10. Gootenberg JS, Abudayyeh OO, Kellner MJ, et al. Multiplexed and portable nucleic acid detection platform with Cas13, Cas12a, and Csm6. *Science* **360**, 439–444 (2018). [DOI](https://doi.org/10.1126/science.aaq0179)

11. Huang B, Guo L, Yin H, et al. Deep learning enhancing guide RNA design for CRISPR/Cas12a-based diagnostics. *iMeta* **3**, e214 (2024). [DOI](https://doi.org/10.1002/imt2.214)

12. WHO. Catalogue of mutations in *Mycobacterium tuberculosis* complex and their association with drug resistance, 2nd edition. Geneva: World Health Organization (2023).

## Citation

If you use GUARD in your research, please cite:

```bibtex
@software{guard2025,
  author = {Uzan, Valentin},
  title = {GUARD: Guide RNA Automated Resistance Diagnostics},
  year = {2025},
  url = {https://github.com/vuzan/guard},
  note = {Computational pipeline for multiplexed CRISPR-Cas12a MDR-TB diagnostics}
}
```

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgements

Developed for the BRIDGE Discovery grant project on CRISPR-Cas12a electrochemical diagnostics for drug-resistant tuberculosis.
