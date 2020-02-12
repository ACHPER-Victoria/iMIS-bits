from iMISutils import apiIterator, API_URL, HEADERS, populateAO_Org
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit

POST_PURCHASE_INFO = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">My Account</a> to access digital resources.'
DESCRIPTION_TEXT = 'SACs and suggested answers in downloadable Word format'

def modifyItem(storeobj):
    storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO
    storeobj["Description"] = DESCRIPTION_TEXT
    sobj = json.dumps(storeobj)
    r = requests.put("%s/api/Item/%s" % (API_URL, storeobj["ItemId"]), headers=HEADERS, data=sobj)
    if r.status_code != 201:
        print r.status_code
        print r.text
        print "----"
        print sobj
        print "----"
        exit(1)

CLASSES = ("SALES-VCE-SACS-M", "SALES-VCE-SACS" )
COUNT = 0
for cls in CLASSES:
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print storeobj["Name"].encode("utf-8")
        modifyItem(storeobj)
        print ".",
        COUNT += 1
