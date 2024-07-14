from iMISutils import apiIterator, API_URL, HEADERS, existsItemCategory
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit, argv

if len(argv) != 2:
    print("Require source and destination category.")
    exit(1)

SOURCE = argv[1]

def modifyItem(storeobj):
    storeobj["ItemFinancialInformation"]["IncursHandling"] = True
    storeobj["ItemFinancialInformation"]["IncursShipping"] = False

    sobj = json.dumps(storeobj)
    r = requests.put("%s/api/Item/%s" % (API_URL, storeobj["ItemId"]), headers=HEADERS, data=sobj)
    if r.status_code != 201:
        print(r.status_code)
        print(r.url)
        print("----")
        print(sobj)
        print("----")
        exit(1)

for storeobj in apiIterator("/api/Item", (("ItemClassId", "SALES-%s" % SOURCE),)):
    print(storeobj["Name"].encode("utf-8"))
    modifyItem(storeobj)
