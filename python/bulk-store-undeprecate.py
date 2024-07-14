from iMISpy import openAPI
from iMISpy.helpers import genericProp
import json
import csv
from sys import exit, argv
from os.path import expanduser, join
from time import sleep
import base64
import re
from requests import HTTPError

if len(argv) != 3:
    print("Missing source category, destination category.")
    exit(1)
CATSOURCE = argv[1]
CATDEST = argv[2]
#exit(1) # just in case...

home = expanduser("~")
api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

def unarchiveItem(ii):
    ii["ItemClass"]["ItemClassId"] = f"SALES-{CATDEST}"
    api.put("Item", ii['ItemCode'], ii)
    print(f"Done: {ii['ItemCode']} - {ii['Name']}")

CODES_TO_PROCESS = []
count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"startswith:SALES-{CATSOURCE}"], ]):
    CODES_TO_PROCESS.append(item["ItemCode"]+"M")

for iid in CODES_TO_PROCESS:
    i = None
    try: i = api.get("Item", iid)
    except: pass
    if i is not None: unarchiveItem(i)
    count += 1
    #if count > 2: break
