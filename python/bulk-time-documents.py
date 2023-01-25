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

PUBDATE_RE = br"(<PublicationDate>)([\s\S]*?)(<\/PublicationDate>)"
ITEMDATE_RE = br"""(<a:Value i:type="b:dateTime" xmlns:b="http://www.w3.org/2001/XMLSchema">)([\s\S]*?)(</a:Value>)"""
INSERTPOINT = b"</UseDynamicPageTitle>"
INSERTPOINT_L = len(INSERTPOINT)

UDF_TEMPLATE = b"""<UserDefinedFields xmlns:a="http://schemas.imis.com/2008/01/DataContracts/ContentUserDefinedField"><a:ContentUserDefinedField><StatusEvent i:nil="true" xmlns="http://schemas.datacontract.org/2004/07/Asi.Atom"/><mStateParameters xmlns="http://schemas.datacontract.org/2004/07/Asi.Atom" xmlns:b="http://schemas.microsoft.com/2003/10/Serialization/Arrays"/><a:UserDefinedFieldKey>02c8bedf-f9b8-4417-bd90-775b495ef0b9</a:UserDefinedFieldKey><a:Value i:type="b:dateTime" xmlns:b="http://www.w3.org/2001/XMLSchema">DT_REPLACEMENT_FIELD</a:Value></a:ContentUserDefinedField></UserDefinedFields>"""
# use with .replace(b"DT_REPLACEMENT_FIELD",)


COUNT = 0
for item in api.apiIterator("/api/DocumentSummary/", (("DocumentTypeId", "CON"),)):
    # look for news prefix in path
    path = item["Path"]
    if path.startswith(PATH_PREFIX):
        #ignore non-published items.
        if item["Status"] != "Published": continue
        # look if publish date...
        did = item["DocumentId"]
        newsitem = api.get("/api/Document", did)
        #decode document
        doc = base64.b64decode(newsitem["Data"]["$value"])
        # get date
        pubdate = re.search(PUBDATE_RE, doc).group(2)
        itemdate = re.search(ITEMDATE_RE, doc)
        if itemdate:
            # Change date
            doc = re.sub(ITEMDATE_RE, br"\1 %s \3" % pubdate, doc)
        else:
            # insert date
            doc = doc[:doc.find(INSERTPOINT)+INSERTPOINT_L] + UDF_TEMPLATE.replace(b"DT_REPLACEMENT_FIELD", pubdate) + doc[doc.find(INSERTPOINT)+INSERTPOINT_L:]
        enc = base64.b64encode(doc).decode("utf-8")
        newsitem["Data"]["$value"] = enc
        print(api.put("/api/Document", did, newsitem)['AlternateName'])

    else:
        if COUNT % 5 == 0: print(".", end="", flush=True)
    if COUNT % 2000 == 0: print(f"\n{COUNT}")
    COUNT+=1
