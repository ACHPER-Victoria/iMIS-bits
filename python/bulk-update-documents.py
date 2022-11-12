from iMIS import api
import json
from sys import exit, argv
from time import sleep
import base64
import re

class Document:
    def __init__(self, did, pubdate, obj, doc):
        self.did = did
        self.pubdate = pubdate
        self.obj = obj
        self.doc = doc

DOCS = {} # @path : [list of docs(versions)]

DATE_RE = br"(<PublicationDate>)([\s\S]*?)(<\/PublicationDate>)"

COUNT = 0
for item in api.apiIterator("/api/DocumentSummary/", (("DocumentTypeId", "CON"),)):
    # look for news prefix in path
    path = item["Path"]
    if path.startswith("@/public/news/news-items/"):
        # look if publish date...
        did = item["DocumentId"]
        newsitem = api.get("/api/Document", did)
        #decode and store. only store 2022-10-27T23:19:07 this many digits.
        doc = base64.b64decode(newsitem["Data"]["$value"])
        # get date
        date = re.search(DATE_RE, doc).group(2)[:19]
        if path in DOCS:
            DOCS[path].append(Document(did, date, newsitem, doc))
        else:
            DOCS[path] = [Document(did, date, newsitem, doc)]
        print("X", end="", flush=True)
    else:
        print(".", end="", flush=True)
    if COUNT % 1000 == 0: print(f"\n{COUNT}")
    COUNT+=1

# sort all the lists in the dict
for value in DOCS.values():
    value.sort(key=lambda x: x.pubdate, reverse=True)

# iterate over each document, check date, if date starts with: 2022-10-27T23 - use the previous date
for path in DOCS:
    revisions = DOCS[path]
    #check most recent... for bad
    if revisions[0].pubdate.startswith(b"2022-10-27T23"):
        # get the next pubdate...
        olddate = revisions[1].pubdate
        # update the most recent with previous date
        doc = revisions[0].doc
        enc = base64.b64encode(re.sub(DATE_RE, br"\1 %s \3" % olddate, doc)).decode("utf-8")
        revisions[0].obj["Data"]["$value"] = enc
        print(api.put("/api/Document", revisions[0].did, revisions[0].obj)['AlternateName'])
