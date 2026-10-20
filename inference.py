"""Small Python equivalent of the browser's exported linear model."""
from pathlib import Path
import json
import math
from collections import Counter
import numpy as np
from training import grams, normalize

ROOT=Path(__file__).resolve().parent


def predict(text):
    model=json.loads((ROOT/"public/model/model.json").read_text(encoding="utf-8"))
    weights=np.fromfile(ROOT/"public/model/weights.f32",dtype="<f4").reshape(len(model["classes"]),-1)
    counts=Counter(grams(text)); entries={}
    for gram,count in counts.items():
        index=model["vocabulary"].get(gram)
        if index is not None:
            entries[index]=(1+math.log(count))*model["idf"][index]
    norm=math.sqrt(sum(value*value for value in entries.values())) or 1
    scores=np.array(model["bias"],dtype=float)
    for index,value in entries.items():
        scores+=weights[:,index].astype(float)*value/norm
    ranking=np.argsort(scores)[::-1]
    return [{"language":model["names"][model["classes"][i]],"score":float(scores[i])} for i in ranking[:3]]


if __name__=="__main__":
    print(predict(input("Text: ")))
