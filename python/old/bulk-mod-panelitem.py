from iMISutils import apiIterator, accessAttrib, updateAttrib
from sys import argv, exit
import csv

if len(argv) != 5:
    print("Require CSVfile, Panelname, SourcePanel, SEARCH, ATTRLIST")
    exit(1)

CSVFILE = argv[1]
PANEL = argv[2]
SOURCE = argv[3]
SEARCH = argv[4]
ATTRLIST = argv[5].split(",")

with open(CSVFILE, newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        # find IDs...
        found = False
        for titem in apiIterator("/api/{0}".format(SOURCE), [[SEARCH, row[SEARCH]]]):
            for item in apiIterator("/api/{0}/".format(PANEL), [["ID", titem["Identity"]["IdentityElements"]], ["FundingCategory", row[ATTRLIST]]]):
                # set item
                for param in ATTRLIST:
                    if param not in row:
                        print("ERROR: param {0} not in row {1}".format(param, row))
                        exit(1)
                    value = row[param]
                    if accessAttrib(item, param, value, "Properties") == None:
                        print("ERROR: Could not find param {0} in item {1}".format(param, item))
                        exit(1)
                updateAttrib(item, PANEL, idval=item["Identity"]["IdentityElements"]["$values"][0])
        if not found:
            print("Couldn't find Item: {0}".format(row[COL]))
        #print(row)
        print(".", end="")
