from iMISutils import apiIterator, getParty, accessAttrib
from sys import argv, exit
import csv

if len(argv) != 2:
    print("Require Panelname")
    exit(1)

PANEL = argv[1]
CATS = ["PEB", "PEB22", "EC21", "EC22", "NF"]
TODELETE = set()
for cat in CATS:
    for item in apiIterator("/api/{0}".format(PANEL), [["FundingCategory", cat]]):
        iid = tuple(item["Identity"]["IdentityElements"]["$values"]) # id elems
        fc = accessAttrib(item, "FundingCategory", collection="Properties")
        print("Will delete: {0} - {1}".format(iid[0], fc))
        TODELETE.add(iid)
for iid in TODELETE:
    fid = "~{0}|{1}".format(*iid)
    print("Deleting... {0}/{1}")
exit()

CATS = ["AS", "AS22"]
with open("output.csv", 'w', newline='', encoding='utf-8-sig') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(["iMIS ID", "FC", "SchoolName"])
    for cat in CATS:
        items = set()
        for item in apiIterator("/api/{0}".format(PANEL), [["FundingCategory", cat]]):
            iid = item["Identity"]["IdentityElements"]["$values"] # id elems
            if iid[0] in items:
                print("Duplicate detected... ")
                writer.writerow([iid[0], cat, getParty(iid[0])["OrganizationName"]])
            items.add(iid[0])
            print(".", end="")
