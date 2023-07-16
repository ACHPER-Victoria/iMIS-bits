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

if len(argv) != 3:
    print("Require CSVfile and Join Date (2023-12-30)")
    exit(1)

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

with open(argv[1], newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        imisid = row["ID"].strip()
        if imisid:
            print("Doing... " + imisid)
            data = api.getContact(imisid)
            genericProp(data, "JoinDate", argv[2], collection="AdditionalAttributes")
            api.updateContact(data)
