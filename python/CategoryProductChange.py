from iMISutils import apiIterator, API_URL, HEADERS, existsItemCategory
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit, argv

if len(argv) != 3:
    print("Require source and destination category.")
    exit(1)

SOURCE = argv[1]
DESTINATION = argv[2]
# check if destination and source exists
if not existsItemCategory(SOURCE):
    print("Source category not found.")
    exit(1)
if not existsItemCategory(DESTINATION):
    print("Destination category not found.")
    exit(1)

def modifyItem(storeobj):
    storeobj["ItemClass"]["ItemClassId"] = "SALES-%s" % DESTINATION
    del storeobj["ItemClass"]["Name"]

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
