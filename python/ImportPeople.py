from iMISutils import apiIterator, accessAttrib, updateAttrib
from json import load
from sys import argv, exit
from random import shuffle, randint
from json import loads
import csv
from pprint import pprint

if len(argv) != 2:
    print("Require CSVFILE")
    exit(1)

CSVFILE = argv[1]
TEMPLATE = open("person.json").read()
COUNT = 0

def setValue(d, k, r, rowkey=None):
    v = None
    if rowkey is not None: v = row[rowkey]
    else: v = row[k]
    v = v.strip()
    if v: d[k] = v
    else: d.pop(k)

def setAttrValue(d, k, r, rowkey=None):
    v = None
    if rowkey is not None: v = row[rowkey]
    else: v = row[k]
    v = v.strip()
    if v:
        # find key
        for x in d["$values"]:
            if x["Name"] == k:
                x["Value"] = v

with open(CSVFILE, newline='') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        p = loads(TEMPLATE)
        # set values:
        setValue(p["PersonName"], "FirstName", row)
        setValue(p["PersonName"], "LastName", row)
        setValue(p["PersonName"], "NamePrefix", row)

        setValue(p["PrimaryOrganization"], "Name", row, "PrimaryOrganizationName")
        setValue(p["PrimaryOrganization"], "Title", row, "Title")

        setAttrValue(p["AdditionalAttributes"], "CustomerTypeCode", row, "MemberType")
        setAttrValue(p["AdditionalAttributes"], "JoinDate", row)
        setAttrValue(p["AdditionalAttributes"], "PaidThruDate", row, "PaidThrough")
        setAttrValue(p["AdditionalAttributes"], "RenewedThruDate", row, "RenewedThrough")
        setAttrValue(p["AdditionalAttributes"], "Chapter", row)

        # merge and add address lines:
        l1 = row["AddressLine1"].strip()
        l2 = row["AddressLine2"].strip()
        lines = []
        if l1: lines.append(l1)
        if l2: lines.append(l2)
        p["Addresses"]["$values"][0]["Address"]["AddressLines"]["$values"] = lines

        setValue(p["Addresses"]["$values"][0]["Address"], "CityName", row)
        setValue(p["Addresses"]["$values"][0]["Address"], "CountryCode", row)
        setValue(p["Addresses"]["$values"][0]["Address"], "CountrySubEntityCode", row)
        setValue(p["Addresses"]["$values"][0]["Address"], "PostalCode", row)
        setValue(p["Addresses"]["$values"][0], "Email", row)
        setValue(p["Addresses"]["$values"][0], "Phone", row, "WorkPhone")

        p["Emails"]["$values"][0]["Address"] = row["Email"].strip()
        p["Emails"]["$values"][1]["Address"] = row["Email"].strip()

        p["Phones"]["$values"][0]["Number"] = row["WorkPhone"].strip()
        p["Phones"]["$values"][1]["Number"] = row["MobilePhone"].strip()
        p["Phones"]["$values"][2]["Number"] = row["WorkPhone"].strip()
        p["Phones"]["$values"][3]["Number"] = row["HomePhone"].strip()
    pprint(p)
