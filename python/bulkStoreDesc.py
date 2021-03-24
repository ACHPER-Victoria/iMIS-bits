from iMISutils import apiIterator, API_URL, HEADERS
import requests
import json
from sys import exit, argv

POST_PURCHASE_INFO = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources.'
POST_PURCHASE_INFO_EL = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products - eLearn to access your eLearn courses.'
POST_PURCHASE_INFO_TE = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources. Downloads to access Trial Exams when <a href="https://achper.vic.edu.au/public/shop/trial-exams.aspx#releasedate">released (Schedule)</a>.'
POST_PURCHASE_INFO_SAC = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources. Downloads to access SACs when <a href="https://achper.vic.edu.au/public/shop/sacs.aspx#releasedate">released (Schedule)</a>.'


TE_DESC = {
    "2020" : "Trial Exams and suggested answers in downloadable PDF format. Aligned to the 2020 adjusted study design",
    "__DESC__" : 'Trial Exams and suggested answers in downloadable PDF format'
}
SAC_DESC = {
    "__DESC__" : 'SACs and suggested answers in downloadable Word format'
}

def modifyDescription(storeobj, descdict):
    for key,value in descdict.items():
        if key in storeobj["ItemCode"]:
            storeobj["Description"] = value
            break
    else:
        storeobj["Description"] = descdict["__DESC__"]

def modifyItem(storeobj, type=""):
    if type == "sac":
        storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_SAC
        modifyDescription(storeobj, SAC_DESC)
    elif type == "te":
        storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_TE
        modifyDescription(storeobj, TE_DESC)
    elif type == "el": storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_EL
    else: storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO

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
if len(argv != 2):
    print("Need comma list of shop types to process. [SAC,TE,WEB,HPE]")
    exit(1)
for type in argv[1].split(","):
    if type == "SAC":
        for cls in ("SALES-VCE-SACS-M", "SALES-VCE-SACS" ):
            for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
                print(storeobj["Name"].encode("utf-8"))
                modifyItem(storeobj, type="sac")
                print(".", end=" ")
                COUNT += 1
    elif type == "TE":
        for cls in ("SALES-VCE-TE", "SALES-VCE-TE-M"):
            for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
                print(storeobj["Name"].encode("utf-8"))
                modifyItem(storeobj, type="te")
                print(".", end=" ")
                COUNT += 1
    elif type == "WEB" or type == "HPE":
        for cls in ("SALES-HPEH", "SALES-HPEH-M", "SALES-WEBREC", "SALES-WEBREC-M"):
            for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
                print(storeobj["Name"].encode("utf-8"))
                modifyItem(storeobj)
                print(".", end=" ")
                COUNT += 1
    elif type == "EL":
        for cls in ("SALES-VIC-EL", "SALES-VIC-EL-M", "SALES-EL-MAN"):
            for storeobj in apiIterator("/api/Item", (("ItemClassId", cls), ("ItemStatus", "A"))):
                print(storeobj["Name"].encode("utf-8"))
                modifyItem(storeobj, type="el")
                print(".", end=" ")
                COUNT += 1
