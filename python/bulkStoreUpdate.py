from iMISutils import apiIterator, API_URL, HEADERS
import requests
import json
from sys import exit, argv

POST_PURCHASE_INFO = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access digital resources.'
POST_PURCHASE_INFO_EL = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products - eLearn to access your eLearn courses.'
POST_PURCHASE_INFO_TE = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access Trial Exams when <a href="https://achper.vic.edu.au/releasedates">released (Schedule)</a>.'
POST_PURCHASE_INFO_SAC = 'Please go to <a href="https://achper.vic.edu.au/MyAccount">myACHPER</a> - My Products to access SACs when <a href="https://achper.vic.edu.au/releasedates">released (Schedule)</a>.'

TERM_LENGTH = 99

TE_DESC = {
    "2020" : "Trial Exams and suggested answers in downloadable PDF format. Aligned to the 2020 adjusted study design",
    "__DESC__" : 'Trial Exams and suggested answers in downloadable PDF format'
}
SAC_DESC = {
    "__DESC__" : 'SACs and suggested answers in downloadable Word format'
}
VQUE_DESC = {
    "__DESC__" : "Practice Questions and suggested answers in downloadable PDF format."
}

def modifyDescription(storeobj, descdict):
    for key,value in descdict.items():
        if key in storeobj["ItemCode"]:
            storeobj["Description"] = value
            break
    else:
        storeobj["Description"] = descdict["__DESC__"]

def modifyItem(storeobj):
    type = storeobj["ItemClass"]["ItemClassId"].split("-", 2)[-1]
    if type.endswith("-M"): type = type[:-2]
    if type == "SAC":
        storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_SAC
        modifyDescription(storeobj, SAC_DESC)
    elif type == "TE":
        storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_TE
        modifyDescription(storeobj, TE_DESC)
    elif type == "EL": storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO_EL
    else: storeobj["RelatedContentMessage"] = POST_PURCHASE_INFO
    if type == "VQUE": modifyDescription(storeobj, VQUE_DESC)
    if "GroupTermPolicy" in storeobj and "TermSpan" in storeobj["GroupTermPolicy"]:
        storeobj["GroupTermPolicy"]["TermSpan"] = TERM_LENGTH

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

for item in apiIterator("/api/Item", (("ItemClassId", "startsWith:SALES-VIC"), ("ItemStatus", "A"))):
    modifyItem(item)
    print(".", end=" ", flush=True)
    COUNT += 1
    if COUNT % 20==0: print(item["Name"].encode("utf-8"))
