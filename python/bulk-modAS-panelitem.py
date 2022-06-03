from iMISutils import apiIterator, accessAttrib, updateAttrib
from sys import argv, exit
import csv

if len(argv) != 5:
    print("Require CSVfile, Panelname, SourcePanel, SEARCH")
    exit(1)

CSVFILE = argv[1]
PANEL = argv[2]
SOURCE = argv[3]
SEARCH = argv[4]
FC = ["EC22", "EC21"]

with open(CSVFILE, newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        # find IDs...
        found = False
        for titem in apiIterator("/api/{0}".format(SOURCE), [[SEARCH, row[SEARCH]]]):
            # attempt find for FC22
            found = True
            print("ID: {0}".format(titem["Identity"]["IdentityElements"]["$values"][0]))
            ffound = False
            for f in FC:
                for item in apiIterator("/api/{0}/".format(PANEL), [["ID", titem["Identity"]["IdentityElements"]["$values"][0]], ["FundingCategory", f]]):
                    # set item
                    ffound = True
                    if accessAttrib(item, "SupportingIn22", True, "Properties") == None:
                        print("ERROR: Could not find param {0} in item {1}".format(param, item))
                        exit(1)
                    if not updateAttrib(item, PANEL, idval="~{0}".format("|".join(item["Identity"]["IdentityElements"]["$values"]))):
                        print ("err")
                        exit(1)
                if ffound: break
        if not found:
            print("Couldn't find Item: {0}".format(row[SEARCH]))
        #print(row)
        print(".", end="")
