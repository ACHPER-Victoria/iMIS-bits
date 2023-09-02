from iMISpy import openAPI
from iMISpy.helpers import genericProp
import json
import csv
from sys import exit, argv
from os.path import expanduser, join
from requests.exceptions import HTTPError
from copy import deepcopy

home = expanduser("~")

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

ORG_TEMPLATE = {
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "AO_OrganisationsData",
    "PrimaryParentEntityTypeName": "Party",
    "Properties": {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
        "$values": [
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ContactKey",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ACARA_ID",
                "Value": ""
            }
        ]
    }
}


with open(argv[1], newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    rownum = 0
    for row in dreader:
        rownum += 1
        imisid = row["IMIS ID"].strip()
        acara = row["ACARA ID"].strip()
        if not acara:
            print("MISSING ACARA ID FOR " + row + " ... " + imisid)
        if imisid:
            print("Doing... " + imisid)
            found = False
            try:
                data = api.get("AO_OrganisationsData", imisid)
                found = True
            except HTTPError as e:
                if e.response.status_code == 404:
                    data = deepcopy(ORG_TEMPLATE)
                    genericProp(data, "ContactKey", imisid)
                else:
                    print("UNEXPECTED HTTP Error." + str(e))
            genericProp(data, "ACARA_ID", acara)
            if found: api.put("AO_OrganisationsData", imisid, data)
            else: api.post("AO_OrganisationsData", data)
