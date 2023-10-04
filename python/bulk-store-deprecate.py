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
exit(1) # just in case...

home = expanduser("~")

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])

TEMPLATE = {
    "$type": "Asi.Soa.Core.DataContracts.MonetaryAmountData, Asi.Contracts",
    "Amount": 9999.9900,
    "Currency": {
        "$type": "Asi.Soa.Core.DataContracts.CurrencyData, Asi.Contracts",
        "CurrencyCode": "AUD",
        "DecimalPositions": 2
    },
    "IsAmountDefined": True
}

def archiveItem(ii):
    ii["ItemClass"]["ItemClassId"] = "SALES-VIC-PPPPP"
    ii["ItemStatus"] = 3
    ii["Name"] = f"PURGE-{ii['Name'][:50]}"
    api.put("Item", ii['ItemCode'], ii)
    print(f"Done: {ii['ItemCode']} - {ii['Name']}")

count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"SALES-{CAT}"]]):
    archiveItem(item)
    count += 1
    #if count > 2: break
