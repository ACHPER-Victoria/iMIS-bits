from iMISutils import delParty
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
COUNT = 0
ACTION = "DEL"

with open(CSVFILE, newline='', encoding='utf-8-sig') as csvfile:
    dreader = csv.DictReader(csvfile)
    for row in dreader:
        pid = row["ID"].strip()
        print("Deleting (%s - %s)..." % (pid, row['Full Name'].strip()))
        if ACTION == "DEL":
            if delParty(pid) == False:
                print("ERR")
                break
