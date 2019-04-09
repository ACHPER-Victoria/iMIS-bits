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
