# LinguaRoute

A browser-local NLP workspace for routing multilingual written content to a suitable language desk.

**Course:** Natural Language Processing (702AI0C009)  
**Group:** I081 Dhruv Paleja; I053 Manan Shah  
**Faculty:** Dr. Ami Munshi  
**Status:** Academic prototype; model performance is measured on a public benchmark.

## Problem and objectives

A multilingual content team can receive messages in several languages before a reader is assigned. Manually inspecting every message creates repetitive work. LinguaRoute suggests the likely language, shows competing matches and marks uncertain or very short messages for review.

The objectives are to identify 18 languages, make the classification understandable through character-pattern contributions, inspect language changes between sentences, process a small batch and export routing suggestions.

The project does not answer, translate or summarise the content. Routing is a suggestion for a person, and no messages are forwarded automatically.

## Run the project

Node 22 or newer is sufficient for the included application:

```text
npm test
npm run build
npm start
```

Open `http://127.0.0.1:4172`. The model is included, so Python training is not required to demonstrate the project. `npm run build` copies the static application to `dist/`, which can be deployed to Vercel without a serverless inference function.

For reproducible training, use Python 3.11 or later:

```text
python -m venv .venv
python -m pip install -r requirements.txt
python training.py
```

Activate the environment before installing if your shell does not automatically use it. The first run downloads the official 62.4 MB dataset archive. No API keys, paid models or GPU are required.

## Dataset

WiLI-2018 contains Wikipedia paragraphs labelled by language. This project selects 18 languages: Arabic, Bengali, Danish, Dutch, English, Finnish, French, German, Hindi, Indonesian, Italian, Marathi, Polish, Portuguese, Spanish, Swedish, Turkish and Vietnamese.

Each selected language has 500 original training and 500 official test examples. Closely related languages and languages using the same script are included, so the problem is more than recognizing an alphabet. Hindi/Marathi share Devanagari; several European languages share Latin script.

Before training, exact normalized duplicates within training and matches between training and test are removed from training. Conflicting duplicate training keys are excluded. Test rows remain untouched to retain the official benchmark population. A stratified 80/20 split of the cleaned training set is used for model selection.

The data licence, creator, checksum, source links and remaining leakage limitations are in [DATA_SOURCES.md](DATA_SOURCES.md).

## Method

1. Apply NFC Unicode normalization, lowercase and collapse whitespace. Preserve accents and scripts.
2. Extract character n-grams of lengths 2, 3 and 4 from at most the first 3,000 normalized characters.
3. Transform n-gram counts into TF-IDF vectors with logarithmic term frequency and L2 normalization.
4. Compare a Multinomial Naive Bayes baseline with a linear support vector machine. Select the SVM regularization value using validation macro F1.
5. Refit the selected configuration on the cleaned training data. Evaluate once on the official selected test split.
6. Export the vocabulary, IDF, coefficients and intercepts. A small JavaScript implementation reproduces the vectorization and linear decision function.
7. Suggest a language desk; flag short text, low feature coverage, a low top score or a small top-two score gap.

The browser model is supervised machine learning trained for this project. It does not call a pretrained language-identification service or a large language model. Scores are raw linear SVM decision values, not calibrated probabilities.

The sentence map applies the same paragraph classifier independently to punctuation/newline segments. It is an exploratory visualization, **not a trained token-level code-switching model**.

## Evaluation

Measured run: **98.80% accuracy** and **0.98813 macro F1** on **9,000** official test paragraphs. The Naive Bayes baseline achieved **97.54% accuracy** and **0.97647 macro F1**. The final SVM uses 40,000 features and C=2.0. Training took about **75 seconds on the tested CPU**, excluding the initial download.

The cleaned training set contains **8,975** paragraphs: 23 normalized training/test overlaps and two within-training duplicates were removed. English had the lowest per-language F1 (**0.9412**), so the overall result should not hide language-specific errors.

The review policy accepted 8,910/9,000 test paragraphs (**99% coverage**) with **99.34% accuracy within that accepted subset**. The remaining 90 were flagged for review. This is a conditional result on known-language Wikipedia text, not reliable detection of unknown languages.

The final measured figures are recorded in [metrics.json](public/model/metrics.json), with:

- Overall test accuracy and macro F1.
- Naive Bayes baseline results.
- Validation candidates and selected regularization.
- Per-language precision, recall and F1 in [classification-report.json](evaluation/classification-report.json).
- Full [confusion matrix](evaluation/confusion-matrix.csv) and [misclassified examples](evaluation/errors.json).
- Review-policy coverage and accuracy on accepted suggestions.
- Exact duplicate/filtering counts and measured training time.

The review policy's score/gap thresholds are selected on validation data only. Minimum length and feature-coverage rules are fixed safeguards. Accepted-suggestion accuracy applies only to the accepted subset; it must not be quoted as overall accuracy. Benchmark numbers do not establish performance on live customer messages or unsupported languages.

## Application features

- Single-document language prediction with top three alternatives.
- Positive character-pattern contributions explaining the leading score.
- Sentence-level language map with uncertainty indicators.
- Batch routing for up to 50 messages, a language distribution and CSV export.
- A visible evaluation panel including per-language metrics.
- Browser-local inference, no account and no stored message history.
- Responsive keyboard-accessible interface with error states.

Limits: 12,000 input characters; overall prediction uses the first 3,000 normalized characters; sentence map shows the first 80 segments. Use one message per line in the batch panel. Unicode text is preserved in display/export. CSV formula prefixes are escaped.

## Testing

`npm test` checks:

- JavaScript/Python prediction and full-score parity on 60 held-out paragraphs.
- Normalization, combining accents and supplementary Unicode characters.
- Empty/oversized input and incomplete model handling.
- Short and unfamiliar text review behavior.
- Representative supported-language sentences.
- Sentence segmentation and segment limits.
- Finite scores and feature contribution integrity.
- CSV quoting/formula-prefix protection.
- Absence of exact normalized train/test overlap after cleaning.

These software checks are distinct from model evaluation. The model metrics come from thousands of labelled held-out paragraphs, not from the demo examples.

## Limitations and future work

- Only 18 supported languages. An unknown language can receive a confident supported-language label.
- WiLI paragraphs differ from chats, product names, noisy text and short messages.
- Hindi written in Latin letters and code-mixed Hinglish are not validated.
- Mixed-language text within one sentence is not separately tagged.
- Nearby languages and borrowed words can be confused.
- Paragraph-level test splitting does not remove every article/topic overlap or near-duplicate.
- Thresholds selected on Wikipedia do not guarantee reliability in another domain.
- Sentence segmentation is punctuation-based and can split abbreviations incorrectly.

Useful future work is to add explicitly labelled out-of-scope data, collect a consented multilingual message evaluation set, evaluate short-text performance and test a token-level code-switching model separately.

## Course mapping and viva notes

CO1: NLP pipeline, language identification and evaluation.  
CO2: Unicode/text preprocessing, character n-grams and TF-IDF.  
CO3 is a discussion connection: distinguish orthographic patterns from semantic meaning. Semantic/pragmatic analysis is not claimed as an implemented component.  
CO4: A multilingual routing workflow with inspectable results.

**Why this project?** It turns a repeated content-routing task into a clear suggestion while keeping a human reviewer involved.

**Why character n-grams?** Short spelling patterns recur across words in a language. They also work when a complete word was not seen in training.

**Why preserve accents?** They can help distinguish languages. Removing them would discard useful information.

**Why TF-IDF?** It reduces the influence of character patterns common across many paragraphs and normalizes document length.

**Why a linear SVM?** Sparse TF-IDF features suit a fast linear model. Its weights can be exported and inspected, so browser inference needs no backend.

**Why compare with Naive Bayes?** It is a simple text-classification baseline. Comparison shows whether the extra modelling choice improves the same held-out task.

**What is macro F1?** Compute F1 separately for each language and average them equally. It prevents one language from dominating the summary.

**Why train/validation/test?** Training learns weights, validation chooses settings, and the untouched test set estimates final performance.

**What does review mean?** The input failed a length, vocabulary or score-separation rule. It is a request for a human check, not a new language class.

**Does it understand the meaning?** No. It learns language-specific character patterns; language identification is different from translation or semantic understanding.

**Can it identify Hinglish?** Not reliably. The dataset is mainly monolingual paragraphs in normal scripts. That would require a separate labelled evaluation and model.

**Is the language map code-switch detection?** It shows language changes between separately scored segments. It does not label each mixed-language token.

## Files

`training.py` downloads, audits, trains, evaluates and exports.  
`public/core.js` implements feature extraction and inference.  
`public/app.js` handles the application workflow.  
`public/model/` contains trained parameters and measured results.  
`evaluation/` contains detailed evaluation evidence and parity fixtures.  
`LinguaRoute.ipynb` provides a concise executable walkthrough.  
`tests/` checks the exported implementation.

This package is a learning and demonstration project. Group members should run it, inspect its errors, understand the method and follow the course's originality and topic-approval requirements before assessment.
