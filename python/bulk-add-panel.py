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

f = open(argv[1], "rb")
fo = open("missing-all2.csv", "wb")
fe = open("errors.txt", "wb")
reader = unicodecsv.reader(f, encoding="utf-8")
header = True
for row in reader:
    if header:
        header = False
        continue
    imisid = row[0].strip()
    id = imisid
    # get iMIS ID
    #print id,
    #imisid = resolveAOUser(id)
    if imisid is None:
        if id not in MISSING:
            MISSING[id] = row
        continue

    if imisid not in ALLIANCE_USERS:
        print "Adding (%s,%s)..." % (id, imisid)
        if not addToAlliance(imisid, ALLIANCE):
            fe.write("%s,%s,%s\n" % (id, imisid, ALLIANCE))

writer = unicodecsv.writer(fo, encoding="utf-8")
for i in sorted(MISSING):
    writer.writerow(MISSING[i])
