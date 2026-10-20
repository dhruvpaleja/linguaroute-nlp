"""Create and execute the concise project walkthrough."""
from pathlib import Path
import os
import sys
import nbformat as nbf
from nbclient import NotebookClient
from jupyter_client import KernelManager

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
md=nbf.v4.new_markdown_cell
code=nbf.v4.new_code_cell
nb=nbf.v4.new_notebook(cells=[
md("# LinguaRoute\nI081 Dhruv Paleja · I053 Manan Shah  \nNatural Language Processing — Dr. Ami Munshi\n\nAim: identify the language of written content and suggest a language desk for review."),
md("## 1. Data\nUse 18 languages from WiLI-2018. The official test split stays separate. The training script downloads the archive and checks the publisher's checksum."),
code("from pathlib import Path\nimport json\nimport contextlib\nimport io\nfrom training import train, LANGUAGES\n\n# Fit and evaluate; show a compact summary instead of the full training log.\nwith contextlib.redirect_stdout(io.StringIO()):\n    result = train()\nprint('Languages:', len(LANGUAGES))\nprint('Training rows:', result['split']['train_used'])\nprint('Test rows:', result['split']['official_test_subset'])\nprint('Features:', result['features'])"),
md("## 2. Features\nKeep accents and scripts. Character 2–4 grams are converted to TF-IDF vectors. This example shows why whole-word vocabularies are not required."),
code("from training import normalize, grams\ntext = 'Bonjour à tous'\nprint(normalize(text))\nprint(grams(text)[:18])"),
md("## 3. Model comparison\nValidation macro F1 chooses the SVM regularization value. Naive Bayes provides a simple baseline. These results are for held-out Wikipedia paragraphs, not every possible message."),
code("print('Selected C:', result['selected_c'])\nfor name, key in [('Naive Bayes', 'baseline'), ('Linear SVM', 'test')]:\n    scores = result[key]\n    print(f\"{name:14} accuracy={scores['accuracy']:.4f}  macro F1={scores['macro_f1']:.4f}\")"),
md("## 4. Look at every language\nPrecision measures how often a predicted language was right. Recall measures how many true examples of that language were found."),
code("report = json.loads(Path('evaluation/classification-report.json').read_text())\nprint(f\"{'Language':14} {'Precision':>10} {'Recall':>8} {'F1':>8}\")\nfor label, name in sorted(LANGUAGES.items(), key=lambda item: item[1]):\n    row = report[label]\n    print(f\"{name:14} {row['precision']:10.3f} {row['recall']:8.3f} {row['f1-score']:8.3f}\")"),
md("## 5. Try a new sentence\nThe exported model uses the same TF-IDF calculation in Python and the browser. Decision scores are not probabilities."),
code("from inference import predict\nexamples = [\n    'Our team would like more information about the international conference.',\n    'Notre équipe souhaite recevoir davantage d’informations sur la conférence.',\n    'हमारी टीम अंतरराष्ट्रीय सम्मेलन के बारे में अधिक जानकारी प्राप्त करना चाहती है।'\n]\nfor text in examples:\n    output = predict(text)\n    print(text)\n    print([(r['language'], round(r['score'], 3)) for r in output])\n    print()"),
md("## 6. Review mistakes\nAn error can come from a short paragraph, shared vocabulary, a related language or a noisy source label. Read a few mistakes before treating a score as certainty."),
code("errors = json.loads(Path('evaluation/errors.json').read_text(encoding='utf-8'))\nprint('Misclassified test paragraphs:', len(errors))\nfor row in errors[:3]:\n    print('Actual:', LANGUAGES[row['actual']], '| Predicted:', LANGUAGES[row['predicted']])\n    print(row['text'][:160], '\\n')\nprint('Review policy:', result['review_policy'])\nprint('Coverage:', round(result['selective_test']['coverage'], 4))"),
md("## Conclusion\nCharacter patterns provide a small, inspectable language classifier. The application adds batch routing, explanations and a sentence map. Its limits are important: unsupported languages, transliteration and within-sentence code-switching need separate evaluation.\n\nSource: Martin Thoma, [WiLI-2018](https://doi.org/10.5281/zenodo.841984), ODbL. See DATA_SOURCES.md for attribution and exact data handling.")
])
nb.metadata={"kernelspec":{"display_name":"Python 3","language":"python","name":"python3"},
             "language_info":{"name":"python","version":"3.11"}}
client=NotebookClient(nb,timeout=600,kernel_name="python3",resources={"metadata":{"path":str(ROOT)}})
client.km=KernelManager(kernel_name="python3")
client.km.kernel_spec.argv=[sys.executable,"-m","ipykernel_launcher","-f","{connection_file}"]
client.execute()
nbf.write(nb,ROOT/"LinguaRoute.ipynb")
print("Executed LinguaRoute.ipynb")
