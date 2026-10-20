"""Train LinguaRoute on 18 languages from the official WiLI-2018 split."""
from pathlib import Path
import csv
import hashlib
import json
import re
import time
import unicodedata
import urllib.request
import zipfile
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "public" / "model"
SOURCE = "https://zenodo.org/records/841984/files/wili-2018.zip?download=1"
LANGUAGES = {"eng":"English", "fra":"French", "deu":"German", "spa":"Spanish",
             "por":"Portuguese", "ita":"Italian", "nld":"Dutch", "swe":"Swedish",
             "dan":"Danish", "fin":"Finnish", "pol":"Polish", "tur":"Turkish",
             "ind":"Indonesian", "vie":"Vietnamese", "hin":"Hindi", "mar":"Marathi",
             "ben":"Bengali", "ara":"Arabic"}


def normalize(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text).lower()).strip()[:3000]


def grams(text):
    text = normalize(text)
    return [text[i:i+n] for n in (2, 3, 4) for i in range(max(0, len(text)-n+1))]


def download():
    DATA.mkdir(exist_ok=True)
    archive = DATA / "wili-2018.zip"
    if not archive.exists():
        urllib.request.urlretrieve(SOURCE, archive)
    # Pin the publisher's file checksum so a changed download cannot silently retrain.
    assert hashlib.md5(archive.read_bytes()).hexdigest() == "3dc5bd41587811ad6b0d04ae2f235f84"
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        for target in ["x_train.txt", "y_train.txt", "x_test.txt", "y_test.txt", "README.txt", "labels.csv", "urls.txt"]:
            match = next((n for n in names if n.split("/")[-1] == target), None)
            if match:
                (DATA / target).write_bytes(z.read(match))
        for name in names:
            if any(term in name.lower() for term in ["license", "readme"]):
                (DATA / Path(name).name).write_bytes(z.read(name))


def load(split):
    texts = (DATA / f"x_{split}.txt").read_text(encoding="utf-8").splitlines()
    labels = (DATA / f"y_{split}.txt").read_text(encoding="utf-8").splitlines()
    assert len(texts) == len(labels) == 117500, "Official dataset schema/count changed"
    rows = [{"text":t, "label":y} for t,y in zip(texts,labels) if y in LANGUAGES]
    assert len(rows) == len(LANGUAGES) * 500
    return rows


def metrics(y, p):
    return {"accuracy":float(accuracy_score(y,p)), "macro_f1":float(f1_score(y,p,average="macro"))}


def make_vectorizer():
    return TfidfVectorizer(analyzer=grams, min_df=3, max_features=40000,
                           sublinear_tf=True, norm="l2")


def train():
    started = time.time()
    download()
    OUT.mkdir(parents=True,exist_ok=True)
    (ROOT/"evaluation").mkdir(exist_ok=True)
    raw, test = load("train"), load("test")
    test_keys = {normalize(r["text"]) for r in test}
    seen, clean, overlaps, duplicate_count, conflicts = {}, [], 0, 0, set()
    for row in raw:
        key = normalize(row["text"])
        if key in test_keys:
            overlaps += 1
        elif key in seen:
            duplicate_count += 1
            if seen[key] != row["label"]:
                conflicts.add(key)
        else:
            seen[key] = row["label"]
            clean.append(row)
    clean = [r for r in clean if normalize(r["text"]) not in conflicts]
    x = [r["text"] for r in clean]; y = np.array([r["label"] for r in clean])
    xt = [r["text"] for r in test]; yt = np.array([r["label"] for r in test])
    fit,val = train_test_split(np.arange(len(x)),test_size=.2,random_state=42,stratify=y)
    vec = make_vectorizer()
    xf = vec.fit_transform([x[i] for i in fit])
    xv = vec.transform([x[i] for i in val])
    candidates = []
    for c in [.5,1.,2.]:
        clf = LinearSVC(C=c,random_state=42,max_iter=5000).fit(xf,y[fit])
        candidates.append((metrics(y[val],clf.predict(xv))["macro_f1"],c,clf))
    best_f1,best_c,clf = max(candidates,key=lambda row:row[0])
    s = clf.decision_function(xv); order=np.argsort(s,axis=1)
    top=s[np.arange(len(val)),order[:,-1]]
    margin=top-s[np.arange(len(val)),order[:,-2]]
    correct=clf.classes_[order[:,-1]]==y[val]
    policies=[]
    for floor in [-.25,0,.25,.5]:
        for gap in [.25,.5,.75,1.]:
            accept=(top>=floor)&(margin>=gap)
            if accept.sum() and correct[accept].mean()>=.98:
                policies.append((int(accept.sum()),floor,gap,float(correct[accept].mean())))
    _,floor,gap,val_precision=max(policies) if policies else (0,.5,1.,0.)
    policy={"score_floor":floor,"margin_floor":gap,"min_letters":30,"min_feature_coverage":.08}
    vec=make_vectorizer()
    xx=vec.fit_transform(x); t=vec.transform(xt)
    clf=LinearSVC(C=best_c,random_state=42,max_iter=5000).fit(xx,y)
    nb=MultinomialNB(alpha=.1).fit(xx,y)
    pred=clf.predict(t); score=clf.decision_function(t); order=np.argsort(score,axis=1)
    top=score[np.arange(len(test)),order[:,-1]]
    margin=top-score[np.arange(len(test)),order[:,-2]]
    coverage=np.array([sum(g in vec.vocabulary_ for g in grams(text))/max(1,len(grams(text))) for text in xt])
    letters=np.array([sum(c.isalpha() for c in normalize(text)) for text in xt])
    accept=(top>=floor)&(margin>=gap)&(letters>=30)&(coverage>=.08)
    report=classification_report(yt,pred,output_dict=True,zero_division=0)
    result={"dataset":"WiLI-2018 (18-language subset)","source":"https://doi.org/10.5281/zenodo.841984",
        "languages":LANGUAGES,"features":len(vec.vocabulary_),"seed":42,"selected_c":best_c,
        "split":{"official_train_subset":len(raw),"train_used":len(clean),"official_test_subset":len(test),
                 "train_test_normalized_overlaps_removed":overlaps,"train_duplicates_removed":duplicate_count,
                 "conflicting_train_duplicate_keys":len(conflicts),"test_duplicate_keys":len(test)-len(test_keys),
                 "near_duplicate_audit":"Not performed; article/topic overlap may remain.",
                 "fit":len(fit),"validation":len(val)},
        "validation_candidates":[{"C":c,"macro_f1":f} for f,c,_ in candidates],
        "validation_macro_f1":best_f1,"validation_score_margin_accepted_accuracy":val_precision,
        "test":metrics(yt,pred),"baseline":metrics(yt,nb.predict(t)),
        "baseline_name":"Character TF-IDF + Multinomial Naive Bayes (alpha 0.1)",
        "review_policy":policy,"selective_test":{"accepted":int(accept.sum()),"review":int((~accept).sum()),
            "coverage":float(accept.mean()),"accepted_accuracy":float((pred[accept]==yt[accept]).mean())},
        "runtime_seconds":round(time.time()-started,2),
        "limitations":"Wikipedia paragraphs, 18 known languages only. Sentence map is exploratory; no code-switch benchmark or unknown-language detection guarantee.",
        "archive_md5":"3dc5bd41587811ad6b0d04ae2f235f84"}
    meta={"version":1,"classes":clf.classes_.tolist(),"names":LANGUAGES,
          "vocabulary":{k:int(v) for k,v in vec.vocabulary_.items()},
          "idf":vec.idf_.tolist(),"bias":clf.intercept_.tolist(),"features":len(vec.vocabulary_),
          "policy":policy,"metrics":result}
    (OUT/"model.json").write_text(json.dumps(meta,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    clf.coef_.astype("<f4").tofile(OUT/"weights.f32")
    (OUT/"metrics.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    (ROOT/"evaluation"/"classification-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    (OUT/"classification-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    with (ROOT/"evaluation"/"confusion-matrix.csv").open("w",encoding="utf-8",newline="") as f:
        w=csv.writer(f); w.writerow(["actual / predicted"]+clf.classes_.tolist())
        for label,row in zip(clf.classes_,confusion_matrix(yt,pred,labels=clf.classes_)):
            w.writerow([label]+row.tolist())
    errors=[{"text":t,"actual":a,"predicted":p} for t,a,p in zip(xt,yt,pred) if a!=p]
    (ROOT/"evaluation"/"errors.json").write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding="utf-8")
    fixtures=[{"text":xt[i],"scores":score[i].tolist(),"predicted":str(pred[i])} for i in np.linspace(0,len(test)-1,60,dtype=int)]
    (ROOT/"evaluation"/"parity-fixtures.json").write_text(json.dumps(fixtures,ensure_ascii=False),encoding="utf-8")
    (DATA/"train-selected.jsonl").write_text("\n".join(json.dumps(r,ensure_ascii=False) for r in clean),encoding="utf-8")
    (DATA/"test-selected.jsonl").write_text("\n".join(json.dumps(r,ensure_ascii=False) for r in test),encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result


if __name__=="__main__":
    train()
