#iMIS Util Functions
# TODO: Add current date to EffectiveDate, and calculate an appropriate
#   ExpirationDate based on current date

# TODO: Add more endpoints once I figure out how to use them.

# TODO: Perhaps add some timeout retrying. I've had a few timeouts on
#   longer scipts which is annoying
from __future__ import print_function
from sys import stderr
import re, requests, json
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from collections import OrderedDict
from datetime import datetime
from time import sleep
from os.path import expanduser, join
home = expanduser("~")

rsession = requests.Session()
retries = Retry(total=25,
                backoff_factor=0.1,
                status_forcelist=[ ])
rsession.mount('https://', HTTPAdapter(max_retries=retries))

SETTINGS = json.load(open(join(home, ".iMIS.json"), "rb"))
SITE_NAME = SETTINGS["SITE_NAME"]
API_URL = SETTINGS["API_URL"]
h = {'content-type': "application/x-www-form-urlencoded"}
formdata = {"Username" : SETTINGS["username"], "Password": SETTINGS["password"], "Grant_type":"password"}
r = rsession.post("%s/token" % API_URL, headers=h, data=formdata)
TOKEN = "Bearer %s" % r.json()[u'access_token']
HEADERS = {
    'content-type': "application/json",
    "Authorization" : TOKEN
}

ACCESS_BODY = """{
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "UserOptions",
    "Properties": {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
        "$values": [
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ID",
                "Value": "%s"
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "CanPurchaseVCE",
                "Value": {
                    "$type": "System.Boolean",
                    "$value": true
                }
            }
        ]
    }
}"""

ADDGROUP_BODY = """{
  "$type": "Asi.Soa.Membership.DataContracts.GroupMemberData, Asi.Contracts",
  "MembershipDetails": {
      "$type": "Asi.Soa.Membership.DataContracts.GroupMemberDetailDataCollection, Asi.Contracts",
      "$values": [
          {
              "$type": "Asi.Soa.Membership.DataContracts.GroupMemberDetailData, Asi.Contracts",
              "Stage": {
                  "$type": "Asi.Soa.Membership.DataContracts.GroupStageData, Asi.Contracts"
              },
              "EffectiveDate": "%s",
              "ExpirationDate": "%s",
              "IsActive": true,
              "Role": {
                  "$type": "Asi.Soa.Membership.DataContracts.GroupRoleData, Asi.Contracts",
                  "RoleId": "29AAE912-660E-4C53-B884-AD9EE27DEE0C",
                  "Description": "Member",
                  "Name": "Member"
              }
          }
      ]
  },
  "Group": {
      "$type": "Asi.Soa.Membership.DataContracts.GroupSummaryData, Asi.Contracts",
      "GroupId": "%s",
  },
  "Party": {
      "$type": "Asi.Soa.Membership.DataContracts.PartySummaryData, Asi.Contracts",
      "PartyId": "%s",
  },
  "JoinDate": "%s",
  "IsActive": true
}"""

ALLIANCE_BODY = """{
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "ACH_MarketingGroups",
    "PrimaryParentEntityTypeName": "Party",
    "PrimaryParentIdentity": {
        "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
        "EntityTypeName": "Party",
        "IdentityElements": {
            "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
            "$values": [
                "%s"
            ]
        }
    },
    "Properties": {
    "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
    "$values": [
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ID",
                "Value": "%s"
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "GroupName",
                "Value": "%s"
            }
        ]
    }
}"""

SPECTEST_BODY = """{
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "ACH_SpecialOffers",
    "PrimaryParentEntityTypeName": "Party",
    "PrimaryParentIdentity": {
        "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
        "EntityTypeName": "Party",
        "IdentityElements": {
            "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
            "$values": [
                "%s"
            ]
        }
    },
    "Properties": {
    "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
    "$values": [
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ID",
                "Value": "%s"
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "SAC2020Used",
                "Value": {
                    "$type": "System.Boolean",
                    "$value": "%s"
                }
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "SAC2020Qualify",
                "Value": {
                    "$type": "System.Boolean",
                    "$value": "%s"
                }
            }
        ]
    }
}"""

GROUP_MAPPING = {}
MAPPING = {}

def findGroup(groupname):
    r = rsession.get("%s/api/Group" % API_URL, headers=HEADERS, params={'Name': '%s' % groupname, "limit":1})
    if r.status_code == 404:
        print(r.text)
        return False
    elif r.status_code == 200:
        return r.json()["Items"]["$values"][0]["GroupId"]
    else:
        print(r.text)
        return None

def doRequest(endpoint, params=None):
    if params is None: params = {}
    r = rsession.get("%s/%s" % (API_URL, endpoint), headers=HEADERS, params=params)
    if r.status_code == 404:
        print(r.text)
        raise ValueError("Not found.")
    elif r.status_code == 200:
        return r.json()
    else:
        print(r.text)
        raise RuntimeError("What happen?")

def lookupGroup(groupName):
    if groupName in GROUP_MAPPING:
        return GROUP_MAPPING[groupName]
    else:
        id = findGroup(groupName)
        if id: return id
        else: abort

def giveAccess(imisid):
    data_body = ACCESS_BODY % imisid
    r = rsession.get("%s/api/UserOptions/%s" % (API_URL, imisid), headers=HEADERS)
    if r.status_code == 200:
        for value in r.json()["Properties"]["$values"]:
            if value["Name"] == "CanPurchaseVCE":
                if value["Value"]["$value"]:
                    return True
        print("giving access")
        r = rsession.put("%s/api/UserOptions/%s" % (API_URL, imisid), headers=HEADERS, data=data_body)
    elif r.status_code == 404:
        r = rsession.post("%s/api/UserOptions" % (API_URL), headers=HEADERS, data=data_body)
    else:
        print("WAT: %s" % r.text)
        return None
    if r.status_code != 200 and r.status_code != 201:
        print(r.status_code, " - ", r.text)
        return False
    else: return True

def enableProgramItems(eventid, enable=True):
    r = rsession.get("%s/api/Event/%s" % (API_URL, eventid), headers=HEADERS)
    if r.status_code == 200:
        # Modify functions
        event = r.json()
        for func in event["Functions"]["$values"]:
            for attr in func["AdditionalAttributes"]["$values"]:
                if attr["Name"] == "WebEnabled": attr["Value"]["$value"] = enable
        #upload modifications
        r = rsession.put("%s/api/Event/%s" % (API_URL, eventid), headers=HEADERS, json=event)
        print(r.status_code)
        if r.status_code != 200 and r.status_code != 201:
            print(r.text)
    else:
        print(r.status_code, r.text)
        return False

def isUserInGroup(userid, groupname):
    groupID = lookupGroup(groupname)
    r = rsession.get("%s/api/GroupMember" % API_URL, headers=HEADERS, params={'GroupId': '%s' % groupID, "PartyId": userid, "limit":1})
    return r.json()["Count"] > 0

def resolveAOUser(aoid):
    r = rsession.get("%s/api/CsContactBasic" % API_URL, headers=HEADERS, params={'MajorKey': '%s' % aoid, "limit":1})
    if r.json()["Count"] < 1:
        return None
    if len(r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"]) > 1:
        TOO_MANY_IDs
    return r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"][0]

def getUserIDByEmail(email):
    r = rsession.get("%s/api/CsContactBasic" % API_URL, headers=HEADERS, params={'email': 'eq:%s' % email, "limit":2})
    if r.json()["Count"] < 1:
        return 0
    if r.json()["Count"] > 1:
        return None
    return r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"][0]

def addToGroup(user, groupname):
    groupID = lookupGroup(groupname)
    if isUserInGroup(user, groupname):
        return True
    r = rsession.post("%s/api/GroupMember" % API_URL, headers=HEADERS, data=ADDGROUP_BODY % (groupID, user))
    if r.status_code != 201:
        print("Error Adding (%s) to (%s) %s" % (user, groupname, groupID))
        print(r.text)
        return False
    else:
        return True

def allianceList(alliancename):
    r = rsession.get("%s/api/ACH_MarketingGroups" % API_URL, params={'GroupName': alliancename, "limit": 500}, headers=HEADERS)
    if r.status_code != 200:
        print("Error getting list" % (user, groupname, groupID))
        print(r.text)
        return False
    else:
        users = []
        for item in r.json()["Items"]["$values"]:
            users.append(item["PrimaryParentIdentity"]["IdentityElements"]["$values"][0])
        return users

def addToAlliance(userid, alliancename):
    r = rsession.post("%s/api/ACH_MarketingGroups" % API_URL, headers=HEADERS, data=ALLIANCE_BODY % (userid, userid, alliancename))
    if r.status_code != 201:
        print("Error Adding (%s) to (%s)" % (userid, alliancename))
        print(r.text)
        return False
    else:
        return True

def getCommunicationPreferences():
    r = rsession.get("%s/api/CommunicationType" % API_URL, headers=HEADERS)
    if r.status_code != 200:
        print("Error")
        print(r.text)
        return False
    else:
        return map(lambda x: x["ReasonCode"], r.json()["Items"]["$values"])

def getCommPrefIDs(commpref):
    r = rsession.get("%s/api/CommunicationType" % (API_URL), headers=HEADERS, params={'ReasonCode': commpref})
    if r.status_code != 200:
        print("Error getting comm pref (%s)" % commpref)
        print(r.text)
        return False
    else:
        if r.json()["Count"] != 1:
            print("Not enough/Too many results for (%s) %s" % (commpref, r.json()["Count"]))
        typeid = r.json()["Items"]["$values"][0]["CommunicationTypeId"]
        print("Fetching all (%s) - %s" % (commpref, typeid))
        IDs = []
        r = rsession.get("%s/api/iqa" % (API_URL), headers=HEADERS,
            params=(('limit', 500),
                ('QueryName', "$/%s/Contact Queries/CommunicationPrefs" % SITE_NAME),
                ('parameter',"eq:"+typeid)))
        if r.status_code != 200:
            print("ERROR: "+ r.text)
            return
        i = 0
        while r.json()["Count"] > 0:
            i += 500
            for x in r.json()["Items"]["$values"]:
                IDs.append(filter(lambda z: z["Name"] == "ID", x["Properties"]["$values"])[0]["Value"])
            r = rsession.get("%s/api/iqa" % (API_URL), headers=HEADERS,
                params=(('limit', 500), ('offset', i),
                    ('QueryName', "$/%s/Contact Queries/CommunicationPrefs" % SITE_NAME),
                    ('parameter',"eq:"+typeid)))
            if r.status_code != 200:
                print("ERROR: "+ r.text)
                return
        return IDs

def SpecOfferSet(uid, used, allowed):
    r = rsession.put("%s/api/ACH_SpecialOffers/%s" % (API_URL, uid), headers=HEADERS, data=SPECTEST_BODY % (uid, uid, used, allowed))
    if r.status_code == 404:
        r = rsession.post("%s/api/ACH_SpecialOffers" % (API_URL), headers=HEADERS, data=SPECTEST_BODY % (uid, uid, used, allowed))
        if r.status_code != 201:
            print("Error on post: " + r.text)
            return False
    elif r.status_code != 201:
        print("Error: " + r.text)
        return False
    return True

AOORGFIELDS = ("ContactKey", "AccountsEmail", "Level", "Locality", "Region", "SchoolNumber", "SchoolType", "Sector", "SFOPercentage", "SubRegion")
def populateAO_Org(orgent, newDict=False):
    r = rsession.get("%s/api/AO_OrganisationsData/%s" % (API_URL, orgent["ID"]), headers=HEADERS)
    if r.status_code == 200:
        for p in r.json()["Properties"]["$values"]:
            if p["Name"] in AOORGFIELDS:
                if newDict is False: orgent[p["Name"]] = p["Value"]
                else: newDict[p["Name"]] = p["Value"]
    for key in AOORGFIELDS:
        if newDict is False:
            if key not in orgent: orgent[key] = ""
        else:
            if key not in newDict: newDict[key] = ""

ADDRFIELDS = ("Address1", "Address2", "Address3", "City", "Country", "County",
    "Email", "Fax", "FullAddress", "LastUpdated", "Phone",
    "AddressPurpose", "StateProvince", "Zip" )
ADDRMAP = { "Billing":"AddressNumber1", "Home Address": "AddressNumber2",
    "Reception": "AddressNumber3"
}
def populateOrgAddresses(orgent):
    r = rsession.get("%s/api/CsAddress" % (API_URL), headers=HEADERS,
        params=(('ID', orgent["ID"]),))
    if r.status_code != 200:
        print("ERROR: "+ r.text)
        raise
    addrj = r.json()
    for addr in addrj["Items"]["$values"]:
        a = {"_GOT" : True}
        for prop in addr["Properties"]["$values"]:
            if prop["Name"] in ADDRFIELDS: a[prop["Name"]] = prop["Value"]
        if "AddressPurpose" in a and a["AddressPurpose"]:
            orgent[ADDRMAP[a["AddressPurpose"]]] = a

def IterateExpiredUsers():
    for x in apiIterator("/api/CsContact", (("IsCompany", "false"), ("Status","ne:A"),
        ('IsCompany', "false"))):
        yield x

def IterateQuery(q, params=None):
    qparams = (("queryname", q),)
    if params: qparams = qparams + params
    for x in apiIterator("/api/iqa", qparams):
        yield x

def apiIterator(url, p):
    p = list(p)
    p.append(("limit","100"))
    r = rsession.get("%s%s" % (API_URL, url), headers=HEADERS, params=p)
    if r.status_code != 200:
        print("ERROR: "+ r.text)
        return
    #print("Total: %s" % r.json()["TotalCount"], file=stderr)
    while r.json()["Count"] > 0:
        nextoffset = r.json()["NextOffset"]
        for x in r.json(object_pairs_hook=OrderedDict)["Items"]["$values"]:
            yield x
        if nextoffset == 0: return
        print(nextoffset)
        r = rsession.get("%s%s" % (API_URL, url), headers=HEADERS,
            params=p+[('offset', nextoffset)])
        if r.status_code != 200:
            print("ERROR: "+ r.text)
            return

def refreshUserGroups(pid):
    mdremove = []
    readd = set([])
    for x in apiIterator("/api/GroupMember", (("PartyId", pid),)):
        if x["Group"]["GroupClass"]["GroupClassId"] == "E88E66B1-9516-47F9-88DC-E2EB8A3EF13E":
            # Purchased Products
            # iterate Membership Details, remove all
            for md in x["MembershipDetails"]["$values"]:
                mdremove.append(md["GroupMemberDetailId"])
            readd.add((x["Group"]["Name"], x["Group"]["GroupId"]))
    # delete mds
    print("Removing: %s" % mdremove)
    print("THEN Adding: %s" % readd)
    for md in mdremove:
        r = rsession.delete("%s/api/GroupMemberDetail/%s" % (API_URL, md), headers=HEADERS)
        if r.status_code != 200:
            print("ERROR: "+ r.text)
            return
    dt = datetime.now()
    df = dt.replace(dt.year+4)
    for gname, gid in readd:
        r = rsession.post("%s/api/GroupMember" % API_URL, headers=HEADERS,
            data=ADDGROUP_BODY % (dt.isoformat(), df.isoformat(), gid, pid, dt.isoformat()))
        if r.status_code != 201:
            print("Error Adding (%s) to (%s) %s" % (pid, gname, gid))
            print(r.text)
            return


def modifyEngagement(entity):
    for i, prop in enumerate(entity["Properties"]["$values"]):
        if prop["Name"] == "Status":
            entity["Properties"]["$values"][i]["Value"] = "A"
            return True
    return False

def updateExpired(entity):
    uid = entity["Identity"]["IdentityElements"]["$values"][0]
    print("Updating: %s" % uid)
    if not modifyEngagement(entity):
        "Failed to update ???"
    r = rsession.put("%s/api/CsContact/%s" % (API_URL, uid), headers=HEADERS, json=entity)
    if r.status_code != 201:
        print(r.text)
        return False
    return True

ITERFIELDS = ("ID", "AddressNumber1", "AddressNumber2", "AddressNumber3", "Company",
"Country", "FullAddress", "LastUpdated", "MemberType", "Status", "FullName")
def IterateOrgs():
    r = rsession.get("%s/api/CsContact" % (API_URL), headers=HEADERS,
        params=(('limit', 100),
            ('IsCompany', "true"),))
    if r.status_code != 200:
        print("ERROR: "+ r.text)
        return
    i = 0
    while r.json()["Count"] > 0:
        i += 100
        for x in r.json()["Items"]["$values"]:
            entry = {}
            for p in x["Properties"]["$values"]:
                if p["Name"] in ITERFIELDS:
                    entry[p["Name"]] = p["Value"]
            populateAO_Org(entry)
            populateOrgAddresses(entry)
            yield entry
        r = rsession.get("%s/api/CsContact" % (API_URL), headers=HEADERS,
            params=(('limit', 100), ('offset', i),
                ('IsCompany', "true"),))
        if r.status_code != 200:
            print("ERROR: "+ r.text)
            return

def IterateIndividuals():
    for x in apiIterator("/api/CsContact", (("IsCompany", "false"), )):
        yield x

### DEPRECATED ??? ###
def accessProperty(item, pname, pval=None):
    for prop in item["Properties"]["$values"]:
        if prop["Name"] == pname:
            if isinstance(prop["Value"], dict):
                if (pval is not None): prop["Value"]["$value"] = pval
                return prop["Value"]["$value"]
            else:
                if (pval is not None): prop["Value"] = pval
                return prop["Value"]
def updateProperty(item, url):
    iid = item["Identity"]["IdentityElements"]["$values"][0]
    r = rsession.put("%s/api/%s/%s" % (API_URL, url, iid), headers=HEADERS, data=json.dumps(item))
    if r.status_code != 200 and r.status_code != 201:
        print(r.status_code, " - ", r.text)
        return False
    return True
### ###

def accessAttrib(item, pname, pval=None, collection="AdditionalAttributes"):
    for prop in item[collection]["$values"]:
        if prop["Name"] == pname:
            if isinstance(prop["Value"], dict):
                if (pval is not None): prop["Value"]["$value"] = pval
                return prop["Value"]["$value"]
            else:
                if (pval is not None): prop["Value"] = pval
                return prop["Value"]
def addAttrib(item, pval):
    item["AdditionalAttributes"]["$values"].append(pval)

def updateAttrib(item, url, iidparam="Id", idval=None):
    if idval is None: idval = item[iidparam]
    r = rsession.put("%s/api/%s/%s" % (API_URL, url, idval), headers=HEADERS, data=json.dumps(item))
    if r.status_code != 200 and r.status_code != 201:
        print(r.status_code, " - ", r.text)
        return False
    return True

def deleteItem(url, iid):
    if not url and not iid:
        print("ERROR: Missing val. Got U: {0} and ID: {1}".format(url, iid))
    r = rsession.delete("%s/api/%s/%s" % (API_URL, url, iid), headers=HEADERS)
    if r.status_code != 200 and r.status_code != 201:
        print(r.status_code, " - ", r.text)
        return False
    return True

def getParty(pid):
    r = rsession.get("%s/api/Party/%s" % (API_URL, pid), headers=HEADERS)
    if r.status_code != 200:
        print(r.status_code, " - ", r.text)
        return False
    return r.json()

def getPerson(pid):
    r = rsession.get("%s/api/Person/%s" % (API_URL, pid), headers=HEADERS)
    if r.status_code != 200:
        print(r.status_code, " - ", r.text)
        return False
    return r.json()
def delParty(pid):
    r = rsession.delete("%s/api/Party/%s" % (API_URL, pid), headers=HEADERS)
    if r.status_code != 200 and r.status_code != 404:
        print(r.status_code, " - ", r.text)
        return False
    return True

def apipost(api, postdata):
    r = rsession.post("%s/api/%s" % (API_URL, api), headers=HEADERS, data=json.dumps(postdata))
    if r.status_code != 200 and r.status_code != 201:
        print(r.status_code, " - ", r.text)
        return False
    return True
def apiGetId(endpoint, eid):
    r = rsession.get("%s/api/%s/%s" % (API_URL, endpoint, eid), headers=HEADERS)
    if r.status_code != 200:
        print(r.status_code, " - ", r.text)
        return False
    return r.json()

def existsItemCategory(cat):
    if doRequest("/api/ItemClass/SALES-%s" % cat, params=None):
        return True
