from iMISutils import apiIterator, API_URL, HEADERS, populateAO_Org
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit

POST_PURCHASE_INFO = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">My Account</a> - Downloads to access digital resources.'
SAC_DESC = 'SACs and suggested answers in downloadable Word format'
TE_DESC = 'Trial Exams and suggested answers in downloadable PDF format'

def modifyItem(storeobj, desc=None):
    storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO
    if desc: storeobj["Description"] = desc
    sobj = json.dumps(storeobj)
    r = requests.put("%s/api/Item/%s" % (API_URL, storeobj["ItemId"]), headers=HEADERS, data=sobj)
    if r.status_code != 201:
        print r.status_code
        print r.text
        print "----"
        print sobj
        print "----"
        exit(1)

COUNT = 0
if False:
    for cls in ("SALES-VCE-SACS-M", "SALES-VCE-SACS" ):
        for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
            print storeobj["Name"].encode("utf-8")
            modifyItem(storeobj, SAC_DESC)
            print ".",
            COUNT += 1
    for cls in ("SALES-VCE-TE", "SALES-VCE-TE-M"):
        for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
            print storeobj["Name"].encode("utf-8")
            modifyItem(storeobj, TE_DESC)
            print ".",
            COUNT += 1

for cls in ("SALES-HPEH", "SALES-HPEH-M", "SALES-WEBREC", "SALES-WEBREC-M"):
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print storeobj["Name"].encode("utf-8")
        modifyItem(storeobj, False)
        print ".",
        COUNT += 1
