#iMIS Util Functions
# TODO: Add current date to EffectiveDate, and calculate an appropriate
#   ExpirationDate based on current date

# TODO: Add more endpoints once I figure out how to use them.

# TODO: Perhaps add some timeout retrying. I've had a few timeouts on
#   longer scipts which is annoying
import re, time, requests, json
from os.path import expanduser, join
home = expanduser("~")

SETTINGS = json.load(open(join(home, ".iMIS.json"), "rb"))
SITE_NAME = SETTINGS["SITE_NAME"]
API_URL = SETTINGS["API_URL"]
h = {'content-type': "application/x-www-form-urlencoded"}
formdata = {"Username" : SETTINGS["username"], "Password": SETTINGS["password"], "Grant_type":"password"}
r = requests.post("%s/token" % API_URL, headers=h, data=formdata)
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
                "EffectiveDate": "2019-03-07T00:00:00",
                "ExpirationDate": "2022-03-03T00:00:00",
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
    "JoinDate": "2019-03-07T00:00:00",
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

ABTEST_BODY = """{
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "ABTest",
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
                "Name": "AB1",
                "Value": {
                    "$type": "System.Boolean",
                    "$value": %s
                }
            }
        ]
    }
}"""

GROUP_MAPPING = {}
MAPPING = {}

def findGroup(groupname):
    r = requests.get("%s/api/Group" % API_URL, headers=HEADERS, params={'Name': '%s' % groupname, "limit":1})
    if r.status_code == 404:
        print r.text
        return False
    elif r.status_code == 200:
        return r.json()["Items"]["$values"][0]["GroupId"]
    else:
        print r.text
        return None

def lookupGroup(groupName):
    if groupName in GROUP_MAPPING:
        return GROUP_MAPPING[groupName]
    else:
        id = findGroup(groupName)
        if id: return id
        else: abort

def giveAccess(imisid):
    data_body = ACCESS_BODY % imisid
    r = requests.get("%s/api/UserOptions/%s" % (API_URL, imisid), headers=HEADERS)
    if r.status_code == 200:
        for value in r.json()["Properties"]["$values"]:
            if value["Name"] == "CanPurchaseVCE":
                if value["Value"]["$value"]:
                    return True
        print "giving access"
        r = requests.put("%s/api/UserOptions/%s" % (API_URL, imisid), headers=HEADERS, data=data_body)
    elif r.status_code == 404:
        r = requests.post("%s/api/UserOptions" % (API_URL), headers=HEADERS, data=data_body)
    else:
        print "WAT:", r.text
        return None
    if r.status_code != 200 and r.status_code != 201:
        print r.status_code, " - ", r.text
        return False
    else: return True

def enableProgramItems(eventid, enable=True):
    r = requests.get("%s/api/Event/%s" % (API_URL, eventid), headers=HEADERS)
    if r.status_code == 200:
        # Modify functions
        event = r.json()
        for func in event["Functions"]["$values"]:
            for attr in func["AdditionalAttributes"]["$values"]:
                if attr["Name"] == "WebEnabled": attr["Value"]["$value"] = enable
        #upload modifications
        r = requests.put("%s/api/Event/%s" % (API_URL, eventid), headers=HEADERS, json=event)
        print r.status_code
        if r.status_code != 200 and r.status_code != 201:
            print r.text
    else:
        print r.status_code, r.text
        return False

def isUserInGroup(userid, groupname):
    groupID = lookupGroup(groupname)
    r = requests.get("%s/api/GroupMember" % API_URL, headers=HEADERS, params={'GroupId': '%s' % groupID, "PartyId": userid, "limit":1})
    return r.json()["Count"] > 0

def resolveAOUser(aoid):
    r = requests.get("%s/api/CsContactBasic" % API_URL, headers=HEADERS, params={'MajorKey': '%s' % aoid, "limit":1})
    if r.json()["Count"] < 1:
        return None
    if len(r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"]) > 1:
        TOO_MANY_IDs
    return r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"][0]

def getUserIDByEmail(email):
    r = requests.get("%s/api/CsContactBasic" % API_URL, headers=HEADERS, params={'email': 'eq:%s' % email, "limit":2})
    if r.json()["Count"] < 1:
        return 0
    if r.json()["Count"] > 1:
        return None
    return r.json()["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"][0]

def addToGroup(user, groupname):
    groupID = lookupGroup(groupname)
    if isUserInGroup(user, groupname):
        return True
    r = requests.post("%s/api/GroupMember" % API_URL, headers=HEADERS, data=ADDGROUP_BODY % (groupID, user))
    if r.status_code != 201:
        print "Error Adding (%s) to (%s) %s" % (user, groupname, groupID)
        print r.text
        return False
    else:
        return True

def allianceList(alliancename):
    r = requests.get("%s/api/ACH_MarketingGroups" % API_URL, params={'GroupName': alliancename, "limit": 500}, headers=HEADERS)
    if r.status_code != 200:
        print "Error getting list" % (user, groupname, groupID)
        print r.text
        return False
    else:
        users = []
        for item in r.json()["Items"]["$values"]:
            users.append(item["PrimaryParentIdentity"]["IdentityElements"]["$values"][0])
        return users

def addToAlliance(userid, alliancename):
    r = requests.post("%s/api/ACH_MarketingGroups" % API_URL, headers=HEADERS, data=ALLIANCE_BODY % (userid, userid, alliancename))
    if r.status_code != 201:
        print "Error Adding (%s) to (%s)" % (userid, alliancename)
        print r.text
        return False
    else:
        return True

def getCommunicationPreferences():
    r = requests.get("%s/api/CommunicationType" % API_URL, headers=HEADERS)
    if r.status_code != 200:
        print "Error"
        print r.text
        return False
    else:
        return map(lambda x: x["ReasonCode"], r.json()["Items"]["$values"])

def getCommPrefIDs(commpref):
    r = requests.get("%s/api/CommunicationType" % (API_URL), headers=HEADERS, params={'ReasonCode': commpref})
    if r.status_code != 200:
        print "Error getting comm pref (%s)" % commpref
        print r.text
        return False
    else:
        if r.json()["Count"] != 1:
            print "Not enough/Too many results for (%s) %s" % (commpref, r.json()["Count"])
        typeid = r.json()["Items"]["$values"][0]["CommunicationTypeId"]
        print "Fetching all (%s) - %s" % (commpref, typeid)
        IDs = []
        r = requests.get("%s/api/iqa" % (API_URL), headers=HEADERS,
            params=(('limit', 500),
                ('QueryName', "$/%s/Contact Queries/CommunicationPrefs" % SITE_NAME),
                ('parameter',"eq:"+typeid)))
        if r.status_code != 200:
            print "ERROR: "+ r.text
            return
        i = 0
        while r.json()["Count"] > 0:
            i += 500
            for x in r.json()["Items"]["$values"]:
                IDs.append(filter(lambda z: z["Name"] == "ID", x["Properties"]["$values"])[0]["Value"])
            r = requests.get("%s/api/iqa" % (API_URL), headers=HEADERS,
                params=(('limit', 500), ('offset', i),
                    ('QueryName', "$/%s/Contact Queries/CommunicationPrefs" % SITE_NAME),
                    ('parameter',"eq:"+typeid)))
            if r.status_code != 200:
                print "ERROR: "+ r.text
                return
        return IDs

def ABset(uid, value):
    r = requests.put("%s/api/ABTest/%s" % (API_URL, uid), headers=HEADERS, data=ABTEST_BODY % (uid, uid, value))
    if r.status_code == 404:
        r = requests.post("%s/api/ABTest" % (API_URL), headers=HEADERS, data=ABTEST_BODY % (uid, uid, value))
        if r.status_code != 201:
            print "Error on post: " + r.text
            return False
    elif r.status_code != 201:
        print "Error: " + r.text
        return False
    return True
