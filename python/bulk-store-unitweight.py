from iMISpy import openAPI
from iMISpy.helpers import genericProp
import json
import csv
from sys import exit, argv
from os.path import expanduser, join
from time import sleep
from requests import HTTPError

if len(argv) != 3:
    print("Missing Category to convert and offset from end. E.g. 2TE is -3, 2SAC is -4")
    exit(1)
CAT = argv[1]
OFFSET = int(argv[2])
#exit(1) # just in case...

home = expanduser("~")

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

def setWeight(ii):
    try:
        ii["Weight"]["Amount"] = int(ii["ItemCode"][OFFSET])
    except ValueError:
        return
    api.put("Item", ii['ItemCode'], ii)
    print(f"Done: {ii['ItemCode']} - {ii['Name']}")

count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"SALES-{CAT}"]]):
    setWeight(item)
    count += 1
    #if count > 2: break
