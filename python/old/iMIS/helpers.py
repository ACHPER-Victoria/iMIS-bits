def genericProp(pitem, pname, pval=None, collection="Properties"):
    for prop in pitem[collection]["$values"]:
        if prop["Name"] == pname:
            if isinstance(prop["Value"], dict):
                if pval != None:
                    prop["Value"]["$value"] = pval
                return prop["Value"]["$value"]
            else:
                if pval != None:
                    prop["Value"] = pval
                return prop["Value"]

def deleteGenericProp(pitem, pname, collection="Properties"):
    newprops = [] # we do this because it's an array. Alternatively we could find the index then delete the index but I dunno about that...
    for prop in pitem[collection]["$values"]:
        if prop["Name"] != pname:
            newprops.append(prop)
    pitem[collection]["$values"] = newprops