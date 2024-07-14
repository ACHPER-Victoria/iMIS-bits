from iMISpy import openAPI
from iMISpy.helpers import genericProp
import json
import csv
from sys import exit, argv
from os.path import expanduser, join

home = expanduser("~")
api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

NEWVALUES = {}
OLDVALUES = {}

def addVal(v, d, iid):
    if v not in d: d[v] = []
    if len(d[v]) > 3: return
    d[v].append(iid)

count = 0
for item in api.apiIterator("/api/ChangeLog", [["IdentityEntityTypeName", "Party"]]):
    if "Changes" in item:
        if len(item["Changes"]["$values"]) > 0:
            if item["Changes"]["$values"][0]["PropertyName"] == "Name.MEMBER_TYPE":
                print(item)
                addVal(item["Changes"]["$values"][0]["NewValue"], NEWVALUES, item["Identity"]["IdentityElements"]["$values"][0])
                addVal(item["Changes"]["$values"][0]["OriginalValue"], OLDVALUES, item["Identity"]["IdentityElements"]["$values"][0])

print("NEW")
print(NEWVALUES)
print("OLD")
print(OLDVALUES)