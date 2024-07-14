from iMISutils import apiIterator, API_URL, HEADERS, populateAO_Org
from addrtemplate import PRINCIPAL_TMPL
import requests
import json
from sys import exit

def subscribe(orgobj):
    # get billing
    newsub = dict(PRINCIPAL_TMPL)
    for subs in orgobj["CommunicationTypePreferences"]["$values"]:
        if subs["CommunicationTypeId"] == "6076139f-6751-464c-aaa6-a117bd15e445" and subs.get("OptInFlag"): return

    orgobj["CommunicationTypePreferences"]["$values"].append(newsub)
    print "%s" % orgobj["PartyId"]
    jobj = json.dumps(orgobj)
    r = requests.put("%s/api/Party/%s" % (API_URL, orgobj["PartyId"]), headers=HEADERS, data=jobj)
    if r.status_code != 201:
        print r.status_code
        print r.text
        print "----"
        print jobj
        print "----"
        print HEADERS
        exit(1)

SCHOOLS = ("LANGUAGE", "PRI/SEC", "PRIMARY", "SECONDARY", "SPECIAL" )
COUNT = 0
for orgobj in apiIterator("/api/Party", (("Status", "A"), ("CustomerTypeCode", "ORG"))):
    print ".",
    if orgobj["Name"].startswith("*"): continue
    aoorg = {}
    orgobj["ID"] = orgobj["Id"]
    populateAO_Org(orgobj, aoorg)
    del orgobj["ID"]
    if aoorg["SchoolType"] in SCHOOLS:
        # subscribe this.
        subscribe(orgobj)
    COUNT += 1
