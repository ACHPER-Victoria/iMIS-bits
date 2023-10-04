from iMISpy import openAPI
from iMISpy.helpers import genericProp
import json
import csv
from sys import exit, argv
from os.path import expanduser, join
from time import sleep
import base64
import re

home = expanduser("~")

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

def delitem(di):
    di["ItemStatus"] = 3
    api.put("Item", di["ItemId"], di)
    print(f"Removed: {di['ItemCode']} - {di['Name']}")

count = 0
for item in api.apiIterator("Item", [["ItemClassId", "startswith:SALES-TEST"]]):
    if "OU" not in item["ItemCode"]: continue
    if not item["ItemCode"].startswith("20"): continue
    if "ItemStatus" not in item:
        #delitem(item)
        pass
    #print(f"{item['ItemCode']} - {item['Name']}")
    count += 1
    #if count > 2: break
