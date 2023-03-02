from iMISpy import openAPI
import json
from os.path import expanduser, join
from sys import exit, argv
from time import sleep
import base64
import re

home = expanduser("~")

class Document:
    def __init__(self, did, pubdate, obj, doc):
        self.did = did
        self.pubdate = pubdate
        self.obj = obj
        self.doc = doc

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

PATH_PREFIX = "@/public/news/news-items"
MAX_LEN = 90

COUNT = 0
for item in api.apiIterator("/api/DocumentSummary/", (("DocumentTypeId", "CON"),)):
    # look for news prefix in path
    path = item["Path"]
    name = item["Name"]
    if path.startswith(PATH_PREFIX) and item["Status"] == "Published" and len(name) >= 90:
        print(name)
        print(item["DocumentId"])
        item["Name"] = name[:89]
        print(api.put("/api/DocumentSummary", item["DocumentId"], item)['AlternateName'])
    else:
        if COUNT % 5 == 0: print(".", end="", flush=True)
    if COUNT % 2000 == 0: print(f"\n{COUNT}")
    COUNT+=1
