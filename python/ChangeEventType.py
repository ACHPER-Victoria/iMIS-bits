from iMISutils import apiIterator, accessAttrib, updateAttrib
from json import load
from sys import argv, exit
from random import shuffle, randint
import unicodecsv

if len(argv) != 3:
    print("Require OLD_TYPE and NEW_TYPE.")
    exit(1)

OLD_TYPE = argv[1]
NEW_TYPE = argv[2]

COUNT = 0
print("Processing events ({0})".format(OLD_TYPE))
for item in apiIterator("/api/Event", [["CategoryId", OLD_TYPE],]):
    #set value
    item["Category"]["EventCategoryId"] = NEW_TYPE
    # write value
    print("Updating value... {0}".format(item["EventId"]))
    if not updateAttrib(item, "Event", "EventId"):
        print("Unhappy result.")
        break
    COUNT += 1
print("Processed: ({0}) entries.".format(COUNT))
