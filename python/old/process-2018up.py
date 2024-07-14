# Script to bulk add people to groups (translating from old group names),
# and setting custom property

import unicodecsv
from sys import argv, exit
import re, time

from iMISutils import giveAccess, resolveAOUser, addToGroup

EARLYMAP = {
	"* CURRENT VCE VET Pack1" : "2017VETRES1",
	"* CURRENT VCE VET Pack2" : "2017VETRES2",
	"* CURRENT VCE VET Pack3" : "2017VETRES3",
	"* CURRENT VCE VET Pack4" : "2017VETRES4",
	"* CURRENT VCE VET Pack5" : "2017VETRES5",
	"* CURRENT VCE VET Pack6" : "2017VETRES6",
    "* Movement and Physical Activity Chart" : "MPAC",
    "* Personal- Social and Community Health" : "PSCHC",
    "2017 VCE VET TExam Purchased" : "2017VETTE",
    "* 2018 VET TExam" : "2018VETTE",
    "V801 Handout and Recording Access" : "V801R",
    "V802 Handout and Recording Access" : "V802R",
    "V803 Handout and Recording Access" : "V803R",
    "V804 Handout and Recording Access" : "V804R",
}

ACCESS_GIVEN = set() #id

REGEX = re.compile(r".*201(\d) U(\d|\d&\d) (HHD|OES|PE) (SAC|TExam|Exam).*")

SUBMAP = {"OES" : "O", "HHD": "H", "PE":"P"}
TYPEMAP = {"TExam":"TE", "Exam": "TE", "SAC":"SAC"}
def procReg(s):
    m = REGEX.match(s)
    if m:
        mg = m.groups()
        u = mg[1].replace("&", "")
        return "201%s%sU%s%s" % (mg[0], SUBMAP[mg[2]], u, TYPEMAP[mg[3]])
    return None

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
    id = row[0]
    # get iMIS ID
    print id,
    imisid = resolveAOUser(id)
    if imisid is None:
        if id not in MISSING:
            MISSING[id] = row
        continue
    groups = row[42]
    for group in groups.split(","):
        group = group.strip()
        if group in EARLYMAP:
            group = EARLYMAP[group]
        else:
            group = procReg(group)
        if group:
            if (id not in ACCESS_GIVEN) and (group.startswith("2019") or group.startswith("2018")):
                giveAccess(imisid)
                ACCESS_GIVEN.add(id)
            if not addToGroup(imisid, group):
                fe.write("%s,%s,%s\n" % (id, imisid, group))

writer = unicodecsv.writer(fo, encoding="utf-8")
for i in sorted(MISSING):
    writer.writerow(MISSING[i])
