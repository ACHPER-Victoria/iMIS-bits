from iMISutils import apiIterator, API_URL, HEADERS
from addrtemplate import ADDR_TMPL
import requests
import json
from sys import exit

#Finance looking e-mails:
FINANCE_EMAILS_CONTAINS = ("finance", "accounts", "creditor", "payable", "accpay")
FINANCE_EMAILS_BEGINS = ("ap@", )

def getAddr(orgobj, purpose):
    for addr in orgobj["Addresses"]["$values"]:
        if addr["AddressPurpose"] == purpose:
            return addr

def checkAndAdd(orgobj):
    # get billing
    addr = getAddr(orgobj, "Billing")
    if addr:
        email = addr.get("Email", "").lower()
        if not email: return
        for x in FINANCE_EMAILS_BEGINS:
            if email.startswith(x): return
        if any(x in email for x in FINANCE_EMAILS_CONTAINS): return
        # if no finance words found, dupe this record and place in Reception
        newaddr = dict(ADDR_TMPL)
        newaddr["AddressPurpose"] = "Reception"
        newaddr["Email"] = email
        orgobj["Addresses"]["$values"].append(newaddr)
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

COUNT = 0
for orgobj in apiIterator("/api/Party", (("Status", "A"), ("CustomerTypeCode", "ORG"))):
    print ".",
    if orgobj["Name"].startswith("*"): continue
    if getAddr(orgobj, "Reception"): continue
    checkAndAdd(orgobj)
