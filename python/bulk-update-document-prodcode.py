#This tool copies the Publish File name and places it in the "Product CodeDocument" custom field.

from iMISpy import openAPI
import json
from os.path import expanduser, join
from sys import exit, argv
from time import sleep
import base64
import re

home = expanduser("~")
api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

PATH_PREFIX = "@/user-downloads/download-content/"

class Document:
    def __init__(self, did, pubdate, obj, doc):
        self.did = did
        self.pubdate = pubdate
        self.obj = obj
        self.doc = doc

SEARCH_TEMPLATE1 = br'<UserDefinedFields xmlns:a="http://schemas.imis.com/2008/01/DataContracts/ContentUserDefinedField"/>'
SEARCH_TEMPLATE2 = br'<UserDefinedFields xmlns:a="http://schemas\.imis\.com/2008/01/DataContracts/ContentUserDefinedField"><a:ContentUserDefinedField><StatusEvent i:nil="true" xmlns="http://schemas\.datacontract\.org/2004/07/Asi\.Atom"/><mStateParameters xmlns="http://schemas\.datacontract\.org/2004/07/Asi\.Atom" xmlns:b="http://schemas\.microsoft\.com/2003/10/Serialization/Arrays"/><a:UserDefinedFieldKey>4aa6a651-8518-4aa3-9bde-2b8036005311</a:UserDefinedFieldKey><a:Value i:type="b:string" xmlns:b="http://www\.w3\.org/2001/XMLSchema">(\S+)</a:Value></a:ContentUserDefinedField></UserDefinedFields>'
REPLACE_TEMPLATE = br'<UserDefinedFields xmlns:a="http://schemas.imis.com/2008/01/DataContracts/ContentUserDefinedField"><a:ContentUserDefinedField><StatusEvent i:nil="true" xmlns="http://schemas.datacontract.org/2004/07/Asi.Atom"/><mStateParameters xmlns="http://schemas.datacontract.org/2004/07/Asi.Atom" xmlns:b="http://schemas.microsoft.com/2003/10/Serialization/Arrays"/><a:UserDefinedFieldKey>4aa6a651-8518-4aa3-9bde-2b8036005311</a:UserDefinedFieldKey><a:Value i:type="b:string" xmlns:b="http://www.w3.org/2001/XMLSchema">PRODUCT_CODE_HERE</a:Value></a:ContentUserDefinedField></UserDefinedFields>'

COUNT = 0
for item in api.apiIterator("/api/DocumentSummary/", (("DocumentTypeId", "CON"),)):
    # look for news prefix in path
    path = item["Path"]
    if item["Status"] == "Published" and path.startswith(PATH_PREFIX):
        # get doc
        did = item["DocumentId"]
        docitem = api.get("/api/Document", did)
        # gen replacement
        replacement = REPLACE_TEMPLATE.replace(b"PRODUCT_CODE_HERE", docitem["Name"].encode("utf8"))
        doc = base64.b64decode(docitem["Data"]["$value"])
        # search
        result = re.search(SEARCH_TEMPLATE1, doc)
        if result: doc = re.sub(SEARCH_TEMPLATE1, replacement, doc)
        else:
            result = re.search(SEARCH_TEMPLATE2, doc)
            if result: doc = re.sub(SEARCH_TEMPLATE2, replacement, doc)
        enc = base64.b64encode(doc).decode("utf-8")
        docitem["Data"]["$value"] = enc
        api.put("/api/Document", did, docitem)
        print(f"{path}", flush=True)
    else:
        print(".", end="", flush=True)
    if COUNT % 1000 == 0: print(f"\n{COUNT}")
    COUNT+=1