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

home = expanduser("~")
api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")), [413, 418, 429, 502, 503, 504])


count = 0
for item in api.apiIterator("Cart", []):
    api.delete("Cart", item["CartId"])
    print(f"Deleted: {item['CartId']}")
    count += 1
    #if count > 2: break
