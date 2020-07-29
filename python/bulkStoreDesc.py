from iMISutils import apiIterator, API_URL, HEADERS, populateAO_Org
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit

POST_PURCHASE_INFO = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources.'
POST_PURCHASE_INFO_EL = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products - eLearn to access your eLearn courses.'
POST_PURCHASE_INFO_TE = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources. Downloads to access Trial Exams when <a href="https://achper.vic.edu.au/public/shop/trial-exams.aspx#releasedate">released (Schedule)</a>.'
POST_PURCHASE_INFO_SAC = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources. Downloads to access SACs when <a href="https://achper.vic.edu.au/public/shop/sacs.aspx#releasedate">released (Schedule)</a>.'
SAC_DESC = 'SACs and suggested answers in downloadable Word format'
TE_DESC = 'Trial Exams and suggested answers in downloadable PDF format'

def modifyItem(storeobj, desc=None, type=""):
    if type == "sac": storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_SAC
    elif type == "te": storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_TE
    elif type == "el": storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_EL
    else: storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO
    if desc: storeobj["Description"] = desc
    sobj = json.dumps(storeobj)
    r = requests.put("%s/api/Item/%s" % (API_URL, storeobj["ItemId"]), headers=HEADERS, data=sobj)
    if r.status_code != 201:
        print(r.status_code)
        print(r.text)
        print("----")
        print(sobj)
        print("----")
        exit(1)

COUNT = 0
for cls in ("SALES-VCE-SACS-M", "SALES-VCE-SACS" ):
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print(storeobj["Name"].encode("utf-8"))
        modifyItem(storeobj, SAC_DESC, type="sac")
        print(".", end=" ")
        COUNT += 1
for cls in ("SALES-VCE-TE", "SALES-VCE-TE-M"):
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print(storeobj["Name"].encode("utf-8"))
        modifyItem(storeobj, TE_DESC, type="te")
        print(".", end=" ")
        COUNT += 1

for cls in ("SALES-HPEH", "SALES-HPEH-M", "SALES-WEBREC", "SALES-WEBREC-M"):
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print(storeobj["Name"].encode("utf-8"))
        modifyItem(storeobj, False)
        print(".", end=" ")
        COUNT += 1
for cls in ("SALES-VIC-EL", "SALES-VIC-EL-M", ):
    for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
        print(storeobj["Name"].encode("utf-8"))
        modifyItem(storeobj, False, type="el")
        print(".", end=" ")
        COUNT += 1
