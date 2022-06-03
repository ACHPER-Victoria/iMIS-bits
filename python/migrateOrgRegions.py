from iMISutils import apiIterator, accessAttrib, updateAttrib, apiGetId
from sys import argv, exit
from random import shuffle, randint

GOODVALUES = {"NORTH-EASTERN VICTORIA", "SOUTH-EASTERN VICTORIA", "SOUTH-WESTERN VICTORIA", "NORTH-WESTERN VICTORIA", "INTERNATIONAL", "OTHER STATE"}
SKIP = {"Southern Metro", "Western Metro", "Eastern Metro", "Northern Metro"}
REGIONMAP = {
    "3. North-Eastern Region" : "NORTH-EASTERN VICTORIA",
    "North-Eastern Victoria" : "NORTH-EASTERN VICTORIA",
    "North-Eastern Region" : "NORTH-EASTERN VICTORIA",
    "1. South-Eastern Region" : "SOUTH-EASTERN VICTORIA",
    "South-Eastern Victoria" : "SOUTH-EASTERN VICTORIA",
    "South-Eastern Region" : "SOUTH-EASTERN VICTORIA",
    "2. South-Western Region": "SOUTH-WESTERN VICTORIA",
    "South-Western Victoria": "SOUTH-WESTERN VICTORIA",
    "South-Western Region": "SOUTH-WESTERN VICTORIA",
    "4. North-Western Region": "NORTH-WESTERN VICTORIA",
    "North-Western Victoria": "NORTH-WESTERN VICTORIA",
    "North-Western Region": "NORTH-WESTERN VICTORIA",
    "Hume": "NORTH-WESTERN VICTORIA",
    "Lodden-Mallee": "NORTH-WESTERN VICTORIA",
    "Grampians" : "SOUTH-WESTERN VICTORIA",
    "Gippsland": "SOUTH-EASTERN VICTORIA",
    "Overseas": "INTERNATIONAL",
    "International" : "INTERNATIONAL",
    "Other State or Territory": "OTHER STATE",
    "Barwon-South Western": "SOUTH-WESTERN VICTORIA",
}

for item in apiIterator("/api/AO_OrganisationsData", []):
    region = accessAttrib(item, "Region", collection="Properties")
    if not region: continue
    if region in GOODVALUES: continue
    oid = item["Identity"]["IdentityElements"]["$values"][0]
    if region in SKIP:
        j = apiGetId("AVIC_AS_DATA", oid)
        if j != False: print("*************{0} Seems to be -> {1}".format())
        continue
    if region not in REGIONMAP:
        print("REGION NOT FOUND: {0} for {1}".format(region, oid))
        exit(1)
    accessAttrib(item, "Region", REGIONMAP[region], collection="Properties")
    print("Updating {0} - {1} -> {2}".format(oid, region, REGIONMAP[region]))
    updateAttrib(item, "AO_OrganisationsData", idval=oid)
