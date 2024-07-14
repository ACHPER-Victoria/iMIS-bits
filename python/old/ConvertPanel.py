from iMISutils import apiIterator, apipost
from sys import argv, exit
from json import loads
from pprint import pprint

if len(argv) != 1:
    exit(1)

TEMPLATE = open("AVIC_MemberData.json").read()

MAPPING = {
    "7-V": "SECONDARY,VCE",
    "F-6": "PRIMARY",
    "Org": "OTHER",
    "Other": "OTHER",
    "Tertiary": "TERTIARY"
}

def setAttrValue(d, k, v):
    for x in d["$values"]:
        if x["Name"] == k:
            x["Value"] = v

def getAttrValue(d, k):
    for x in d["$values"]:
        if x["Name"] == k:
            return x["Value"]

COUNT = 0
for aoitem in apiIterator("/api/AO_IndividualsData", []):
    #create item
    p = loads(TEMPLATE)
    #set id
    id = aoitem["Identity"]["IdentityElements"]["$values"][0]
    print("processing... {0}".format(id))
    p["Identity"]["IdentityElements"]["$values"][0] = id
    p["PrimaryParentIdentity"]["IdentityElements"]["$values"][0] = id
    setAttrValue(p["Properties"], "ID", id)

    # set HPE:
    hpe = getAttrValue(aoitem["Properties"], "HPETeachLevel")
    if hpe:
        #mapping
        hpe = MAPPING[hpe]
        setAttrValue(p["Properties"], "HPETeachLevel", hpe)
    COUNT += 1
    apipost("AVIC_MemberData", p)
print("Processed: ({0}) entries.".format(COUNT))
