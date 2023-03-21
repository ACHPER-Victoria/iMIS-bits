from iMISpy import openAPI
from sys import argv, exit
import csv

if len(argv) != 3:
    print "Require CSVfile and Alliance name"
    exit(1)

ALLIANCE = argv[2]
IDCOL = "External ID"

api = openAPI(json.load(open(join(home, ".iMIS.json"), "rb")))

ALLIANCE_USERS = api.allianceList(ALLIANCE)
print ALLIANCE_USERS

skipped = []

with open(argv[1], newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        imisid = row[IDCOL].strip()
        if not imisid:
            skipped.append(row)
            continue
    if imisid not in ALLIANCE_USERS: continue
    print "Removing (%s)..." % (imisid,)
    if not api.removeFromAlliance(imisid, ALLIANCE):
        print("Error on %s".format(imisid,))

print("Skipped:")
print(skipped)
