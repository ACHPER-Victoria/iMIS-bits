from iMISutils import IterateOrgs
from sys import argv, exit
from random import shuffle, randint
import unicodecsv as csv

# ADDRFIELDS = ("Address1", "Address2", "Address3", "City", "Country", "County",
#     "Email", "Fax", "FullAddress", "LastUpdated", "Phone",
#     "AddressPurpose", "StateProvince", "Zip" )
HEADERS = ["ID", "Company", "FullName", "MemberType", "AccountsEmail",
    "Status", "1:Email", "1:FullAddress", "1:StateProvince", "1:AddressPurpose",
    "2:Email", "2:FullAddress", "2:StateProvince", "2:AddressPurpose",
    "3:Email", "3:FullAddress", "3:StateProvince", "3:AddressPurpose",
    "Level", "MarketingCategory", "MelbArch", "Region", "SchoolNumber",
    "SFOifApplicable", "LastUpdated"]
NMAP = ["Billing - ", "Home Address - ", "Reception - "]
def getAllOrgs():
    f = open("AllOrgs.csv", "wb")
    w = csv.writer(f, encoding='utf-8')
    w.writerow((x.replace("1:", NMAP[0]).replace("2:", NMAP[1]).replace("3:", NMAP[2]) for x in HEADERS))
    for item in IterateOrgs():
        print ".",
        row = []
        for h in HEADERS:
            if ":" in h:
                n, h = h.split(":")
                if "_GOT" in item["AddressNumber%s"%n]:
                    row.append(item["AddressNumber%s"%n][h])
                else: row.append("")
            else:
                row.append(item[h])
        w.writerow(row)

def updateAllOrgs(fname):
    pass

if len(argv) > 2:
    print "Only require update file."
    exit(1)

if len(argv) == 2:
    updateAllOrgs(argv[1])
else:
    getAllOrgs()
