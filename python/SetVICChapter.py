from iMISutils import apiIterator, accessAttrib, updateAttrib, getPerson, addAttrib
from json import load
from sys import argv, exit
from random import shuffle, randint
import unicodecsv
from pprint import pprint

if len(argv) != 2:
    print("Require MemberTypes.")
    exit(1)

MEMTYPES = argv[1].split(",")

CHAPTER = {
    "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
    "Name": "Chapter",
    "Value": "VIC"
}

COUNT = 0
for MEMT in MEMTYPES:
    print("Processing type ({0})".format(MEMT))
    for csitem in apiIterator("/api/CsContact", [["MemberType", MEMT], ["Chapter", "ne:VIC"], ["IsCompany", "false"]]):
        #get real person item:
        item = getPerson(csitem["Identity"]["IdentityElements"]["$values"][0])
        if item is False:
            print ("Couldn't find person? ({0})".format(csitem["Identity"]["IdentityElements"]))
            exit(1)
        #check chapter:
        chap = accessAttrib(item, "Chapter")
        #set value
        if not chap:
            print("Creating chapter prop")
            addAttrib(item, CHAPTER)
        else:
            accessAttrib(item, "Chapter", "VIC")
        # write value
        print("Updating value... {0}".format(item["Id"]))
        if not updateAttrib(item, "Person"):
            print("Unhappy result.")
            break
        COUNT += 1
print("Processed: ({0}) entries.".format(COUNT))
