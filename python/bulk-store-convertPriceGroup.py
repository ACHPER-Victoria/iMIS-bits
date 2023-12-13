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

# pricetype default to "AVIC - Full Member"
def genItemPrice(iid, price, pricetype="aa413b20-a64a-4115-b97e-92187de60164"):
    i = None
    for i in api.apiIterator("ItemPrice", [["ItemId", iid], ["PriceSheetId", pricetype]]):
        pass
    i["DefaultPrice"] = json.loads(json.dumps(TEMPLATE))
    i["DefaultPrice"]["Amount"] = price
    return i

def modifyExisting(iid, price):
    pps = api.get("ProductPriceSheet", f"~aa413b20-a64a-4115-b97e-92187de60164|{iid}")
    genericProp(pps, "ItemPrice1", price)
    api.put("ProductPriceSheet", f"~aa413b20-a64a-4115-b97e-92187de60164|{iid}", pps)

def addVICFPricing(ii):
    if "TempDefaultPrice" not in ii:
        return print(f"MISSING TEMP PRICE. Skipping: {ii['ItemCode']}" )
    oldPrice = ii["TempDefaultPrice"]
    memPrice = oldPrice - (20/100*oldPrice)
    # set "member" price as normal default price...
    np = genItemPrice(ii['ItemCode'], oldPrice, "Member")
    api.put("ItemPrice", ii["ItemCode"], np)
    np = genItemPrice(ii['ItemCode'], memPrice)
    try: api.put("ItemPrice", ii["ItemCode"], np)
    except HTTPError as e:
        if e.response.status_code == 500:
            #Assume I need to modify existing ProductPriceSheet
            modifyExisting(ii['ItemCode'], memPrice)
    print(f"Done: {item['ItemCode']}")

def isActive(ii):
    if "ItemStatus" in ii: print(f"{ii['ItemCode']} - {ii['ItemStatus']}")
    return "ItemStatus" not in ii

count = 0
for item in api.apiIterator("Item", [["ItemClassId", f"SALES-{CAT}"]]):
    if isActive(item):
        addVICFPricing(item)
    count += 1
    #if count > 2: break
