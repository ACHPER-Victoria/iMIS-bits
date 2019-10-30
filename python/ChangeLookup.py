from iMISutils import apiIterator, accessProperty, updateProperty
from json import load
from sys import argv, exit
from random import shuffle, randint
import unicodecsv

if len(argv) != 4:
    print("Require Business object, property, and JSON file for mapping old to new.")
    exit(1)

BUSINESS_OBJ = argv[1]
PROPERTY = argv[2]
JSON_MAP = load(open(argv[3], "rb"))
PROP_GOOD_VALS = set(JSON_MAP.values())

UNKNOWNS = [] # [[ID, data],]
print("Processing business object ({0})".format(BUSINESS_OBJ))
for item in apiIterator("/api/{0}".format(BUSINESS_OBJ), []):
    itemvalue = accessProperty(item, PROPERTY)
    if itemvalue in JSON_MAP:
        accessProperty(item, PROPERTY, JSON_MAP[itemvalue])
        # write value
        print("Updating value...")
        if not updateProperty(item, BUSINESS_OBJ):
            print("Unhappy result.")
            break
    elif itemvalue == "" or itemvalue is None: pass
    elif itemvalue not in PROP_GOOD_VALS:
        print("Bad data: ({0}) - {1}".format(item["Identity"]["IdentityElements"]["$values"][0], itemvalue))
