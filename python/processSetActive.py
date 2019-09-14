from iMISutils import IterateExpiredUsers, updateExpired, refreshUserGroups
from sys import argv, exit
from random import shuffle, randint


for item in IterateExpiredUsers():
    #update status
    if not updateExpired(item): break
    #refresh groups
    refreshUserGroups(item["Identity"]["IdentityElements"]["$values"][0])
print "All done."
