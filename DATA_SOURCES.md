# Dataset and licence

- Creator: Martin Thoma.
- Dataset: **WiLI-2018 — Wikipedia Language Identification database**, version 1.0.0, 7 January 2018.
- Official archive: https://zenodo.org/records/841984/files/wili-2018.zip?download=1
- DOI: https://doi.org/10.5281/zenodo.841984
- Paper: https://arxiv.org/abs/1801.07779
- Publisher metadata: https://zenodo.org/api/records/841984
- Database licence: ODC Open Database License 1.0 (ODbL), https://opendatacommons.org/licenses/odbl/1-0/
- Creator's errata: https://github.com/MartinThoma/wili-2018
- Published archive checksum: MD5 `3dc5bd41587811ad6b0d04ae2f235f84`, size 62,403,646 bytes.

The source database licence is preserved for the selected database files. Underlying Wikipedia passage rights and attribution remain applicable; original passages are not claimed as project-authored. This is a selected and normalized derivative database, not a new public-domain corpus.

The application uses 18 languages, 500 original training and 500 test paragraphs per language. It removes normalized training/test overlaps and duplicate/conflicting training rows before splitting the cleaned training rows for validation. It does not remove near-duplicates or split by Wikipedia article/topic. The dataset may contain incorrect language labels; the source paper discusses dataset noise. No manual re-labelling was performed based on model outputs.

`data/train-selected.jsonl` and `data/test-selected.jsonl` contain the selected rows. `training.py` preserves the official train/test separation. `public/model/metrics.json` records the exact filtering counts, validation choice and final performance.

`data/urls.txt` preserves the publisher's collection of source-page permanent URLs. It is the original full collection list, not a claimed row-to-URL mapping for this subset. `data/README.txt` is preserved verbatim; its line-count typo is not used for parsing. Actual official files have 117,500 rows per split.

Citation:

Thoma, Martin. 2018. *The WiLI benchmark dataset for written language identification*. arXiv:1801.07779.
