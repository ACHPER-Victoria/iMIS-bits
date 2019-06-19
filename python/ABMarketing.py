from iMISutils import getCommunicationPreferences, getCommPrefIDs, ABset
from sys import argv, exit
from random import shuffle, randint
import unicodecsv

if len(argv) != 2:
    print "Require CommunicationPreference"
    print " ".join(map(lambda x: "'%s'" % x , getCommunicationPreferences()))
    exit(1)

COMS_PREF = argv[1]

ids = getCommPrefIDs(COMS_PREF)
print "Got IDs, shuffling..."
i = 0
limit = randint(10,20)
while i < limit:
    shuffle(ids)
    i+=1
print "Shuffle done..."
for i,x in enumerate(ids):
    if i % 2:
        ABset(x, "true")
        print ".",
    else: ABset(x, "false")
print "All done."
