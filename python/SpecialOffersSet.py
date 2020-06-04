from iMISutils import IterateQuery, accessProperty, SITE_NAME, IterateIndividuals, SpecOfferSet
from sys import argv, exit
from random import shuffle, randint
import unicodecsv

QUERY = "$/%s/Code-Queries/SpecialOffers - Unit 4 2020 SAC Purchasers" % SITE_NAME

# get allowed
IDs = set()
for x in IterateQuery(QUERY):
    IDs.add(accessProperty(x, "ID"))

c = 0
# Iterate everyone, set allowed
for p in IterateIndividuals():
    iid = accessProperty(p, "ID")
    if not iid:
        print("Error on person: %s" % p)
        exit(1)
    if iid in IDs:
        SpecOfferSet(iid, False, True)
        breakonfound = True
    else:
        SpecOfferSet(iid, False, False)
    print(".", end=" ")
    c += 1
