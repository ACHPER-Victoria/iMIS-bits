from iMISutils import apiIterator, apipost, accessAttrib, updateAttrib, apiGetId
from sys import argv, exit
from functools import reduce
from json import loads
from pprint import pprint

if len(argv) != 5:
    print("Need Old Panelname, New panelname, old attr, new attr.")
    exit(1)
OLDPANEL = argv[1]
NEWPANEL = argv[2]
OLDATTR = argv[3].split(",")
NEWATTR = argv[4].split(",")
if len(OLDATTR) != len(NEWATTR):
    print("Mismatching length")
    exit(1)

TEMPLATE = """{
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "AVIC_AS_Data",
    "PrimaryParentEntityTypeName": "Party",
    "Identity": {
        "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
        "EntityTypeName": "AVIC_AS_Data",
        "IdentityElements": {
            "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
            "$values": [
                "%s"
            ]
        }
    },
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
                "Name": "ACH_Staff",
                "Value": {
                    "$type": "System.Int32",
                    "$value": 0
                }
            }
        ]
    }
}"""


COUNT = 0
for olditem in apiIterator("/api/{0}".format(OLDPANEL), []):
    #id
    pid = olditem["Identity"]["IdentityElements"]["$values"][0] # only need the first item of the ID
    print("processing... {0}".format(pid))
    newitem = apiGetId(NEWPANEL, pid)
    bail = False
    if newitem is False:
        # abort.
        print("MISSING ITEM: {0} - {1}".format(NEWPANEL, pid))
        newitem = loads(TEMPLATE % (pid, pid))
        bail = True
    attrs = [False]*len(OLDATTR)
    for x in range(len(OLDATTR)):
        oldvar = accessAttrib(olditem, OLDATTR[x], collection="Properties")
        newvar = accessAttrib(newitem, NEWATTR[x], collection="Properties")
        if oldvar and oldvar != 0:
            if newvar != oldvar:
                print("Moving value {2},{3}, from {0} to {1}".format(OLDATTR[x], NEWATTR[x], oldvar, newvar))
                attrs[x] = True
                accessAttrib(newitem, NEWATTR[x], oldvar, collection="Properties")

    if reduce(lambda a, b: a|b, attrs): # only update if we need to set a value...
        print("UPDATING...")
        updateAttrib(newitem, NEWPANEL, idval=pid)
    COUNT += 1
print("Processed: ({0}) entries.".format(COUNT))
