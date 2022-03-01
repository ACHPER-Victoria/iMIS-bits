from iMISutils import apiIterator, accessAttrib, updateAttrib
from sys import argv, exit
import csv

if len(argv) != 5:
    print("Require CSVfile, Panelname, ColumnName Used to find, attributelist commasep (must be same in spreadsheet and panel item [rename csv columns to suit])")
    exit(1)

CSVFILE = argv[1]
PANEL = argv[2]
SEARCH = argv[3]
ATTRLIST = argv[4].split(",")

with open(CSVFILE, newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        # find items...
        print(row)
        for item in apiIterator("/api/{0}".format(PANEL), [[SEARCH, row[SEARCH]]]):
            for param in ATTRLIST:
                if param not in row:
                    print("ERROR: param {0} not in row {1}".format(param, row))
                    exit(1)
                value = row[param].replace("$", "").replace(",", "")
                if accessAttrib(item, param, value, "Properties") == None:
                    print("ERROR: Could not find param {0} in item {1}".format(param, item))
                    exit(1)
            updateAttrib(item, PANEL, idval=item["Identity"]["IdentityElements"]["$values"][0])
        print(".", end="")
