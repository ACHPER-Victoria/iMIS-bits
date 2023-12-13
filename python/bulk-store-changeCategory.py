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
    print("Missing Category from, category to")
    exit(1)
CATFROM = argv[1]
CATTO = argv[2]
#exit(1) # just in case...
home = expanduser("~")
api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

def existsItemCategory(cat):
    api.get("ItemClass", "SALES-{0}".format(cat)) # will exception on error

# check if destination and source exists
existsItemCategory(CATFROM)
existsItemCategory(CATTO)

def moveCat(ti):
    ti["ItemClass"]["ItemClassId"] = "SALES-{0}".format(CATTO)
    del ti["ItemClass"]["Name"]
    api.put("Item", ti['ItemCode'], ti)
    print(f"Done: {ti['ItemCode']} - {ti['Name']}")

count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"SALES-{CATFROM}"], ]):
    moveCat(item)
    count += 1
    #if count > 2: break
