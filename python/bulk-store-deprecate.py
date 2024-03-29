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

if len(argv) != 2:
    print("Missing Category to convert")
    exit(1)
CAT = argv[1]
#exit(1) # just in case...

ITEMCODE_CONTAINS = ["21", "22", "23", "24"]

home = expanduser("~")

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

def archiveItem(ii):
    ii["ItemClass"]["ItemClassId"] = "SALES-VIC-PPPPP"
    ii["ItemStatus"] = 3
    ii["Name"] = f"PURGE-{ii['Name'][:50]}"
    api.put("Item", ii['ItemCode'], ii)
    print(f"Done: {ii['ItemCode']} - {ii['Name']}")

count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"SALES-{CAT}"], ]):
    if not any(substring in item["ItemId"] for substring in ITEMCODE_CONTAINS):
        archiveItem(item)
    count += 1
    #if count > 2: break
