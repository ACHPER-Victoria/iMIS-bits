from iMISutils import apiIterator, apipost, accessAttrib, updateAttrib
from sys import argv, exit
from json import loads
from pprint import pprint

if len(argv) != 4:
    print("Need Panelname, old attr, new attr.")
    exit(1)
PANEL = argv[1]
OLDATTR = argv[2].split(",")
NEWATTR = argv[3].split(",")
if len(OLDATTR) != len(NEWATTR):
    print("Mismatching length")
    exit(1)

COUNT = 0
for pitem in apiIterator("/api/{0}".format(PANEL), []):
    #id
    pid = "~{0}".format("|".join(pitem["Identity"]["IdentityElements"]["$values"]))
    print("processing... {0}".format(pid))

    for x in range(len(OLDATTR)):
        accessAttrib(pitem, NEWATTR[x], accessAttrib(pitem, OLDATTR[x], collection="Properties"), collection="Properties")
    updateAttrib(pitem, PANEL, idval=pid)
    COUNT += 1
print("Processed: ({0}) entries.".format(COUNT))
