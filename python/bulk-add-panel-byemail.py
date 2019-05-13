from iMISutils import addToAlliance, allianceList, resolveAOUser
from sys import argv, exit
import unicodecsv

if len(argv) != 3:
    print "Require CSVfile and Alliance name"
    exit(1)

ALLIANCE_USERS = allianceList(argv[2])
print ALLIANCE_USERS

ALLIANCE = argv[2]
MISSING = {}
HEADERS = {}


f = open(argv[1], "rb")
fo = open("missing-all2.csv", "wb")
fe = open("errors.txt", "wb")
reader = unicodecsv.reader(f, encoding="utf-8", delimiter="\t")
header = True
for row in reader:
    if header:
        header = False
        for i,col in enumerate(row):
            HEADERS[col.lower().strip()] = i
        continue
    email = row[HEADERS["email"]].strip()
    # get iMIS ID
    print email,
    imisid = resolveAOUser(id)
    if imisid is 0 or imisid is None:
        if email not in MISSING:
            MISSING[email] = row
        continue

    if imisid not in ALLIANCE_USERS:
        print "Adding (%s,%s)..." % (email, imisid)
        if not addToAlliance(imisid, ALLIANCE):
            fe.write("%s,%s,%s\n" % (email, imisid, ALLIANCE))
