from iMIS import api
import json
from sys import exit, argv
from time import sleep

def modifyItem(item):

    if "MembershipDetails" in item and "$values" in item["MembershipDetails"] and len(item["MembershipDetails"]["$values"]) > 0:
        deets = item["MembershipDetails"]["$values"][0]
        #reset all dates... ignore 2030 ones...
        override = False
        while len(item["MembershipDetails"]["$values"]) > 1:
            #nuke extra entries...
            item["MembershipDetails"]["$values"].pop()
            override = True
        if not override and deets["ExpirationDate"] >= "2030-12-30T00:00:00" and deets["ExpirationDate"] < "2040-00-00T00:00:00": return
        deets["EffectiveDate"] = "2022-11-07T00:00:00"
        deets["ExpirationDate"] = "2030-12-30T00:00:00"
        sobj = json.dumps(item)
        sleep(0.5)
        r = api.session.post("api/GroupMember", data=sobj)
        if r.status_code != 201:
            print()
            print(r.status_code)
            print(r.text)
            print("----")
            print(sobj)
            print("----")
            print(r.__dict__)
            exit(1)


COUNT = 0
for item in api.apiIterator("/api/GroupMember", []):
    # look for product purchase group type
    # E88E66B1-9516-47F9-88DC-E2EB8A3EF13E
    if "Group" in item and "GroupClass" in item["Group"] and item["Group"]["GroupClass"]["GroupClassId"] == "E88E66B1-9516-47F9-88DC-E2EB8A3EF13E":
        # modify this entry...
        modifyItem(item)
    COUNT += 1
    print("\r{0}/114673".format(COUNT), end="", flush=True)
