if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var token = "";

importScripts('/common/Uploaded%20files/Code/utils.js')

function synclog(s) {
  postMessage({
    type: "synclog",
    data: s,
  });
}
function actionlog(s) {
  postMessage({
    type: "actionlog",
    data: s,
  });
}

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'startSync':
        // console.log('Posting message back to main script');
        token = arg[0];
        setupSync(arg[1], arg[2], arg[3]) //categories, percentdisc, freeitems
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

CLASSID = "SALES-{0}";

function checkMemberCat(cat) {
  var result = dorequest("/api/ItemClass/{0}-M".format(CLASSID.format(cat)));
  return result[0];
}

function countItems(categories) {
  var itemCount = 0;
  for (const cat of categories.split(",")) {
    // get count and add to total
    // Also check if member category exists...
    //var params = [["limit", 1], ["ItemClassId", CLASSID.format(cat)], ["ItemStatus", "A"]];
    var params = [["limit", 1], ["ItemClassId", CLASSID.format(cat)],];
    var result = dorequest("/api/Item", null, null, params);
    if (result[0] && result[1]["TotalCount"] > 0) {
      // add count
      if (checkMemberCat(cat)) {
        itemCount += result[1]["TotalCount"];
      } else {
        synclog("Store category (-M suffix) not found for ({0})".format(cat));
      }
    } else if (result[0]) { synclog("No items for ({0})".format(cat)); }
    else { synclog("CI Error ({0})".format(result[1])); return false; }
  }
  return itemCount;
}

var PROCESSED = 0;
function incrementProcessed() {
  PROCESSED++;
  postMessage({ type: "currentcount", data: PROCESSED });
}

function itemMExists(code) {
  var result = dorequest("/api/Item/{0}M".format(code));
  return result[0];
}

function genericProp(item, pname, pval=null) {
  for (const prop of item["Properties"]["$values"])
  {
    if (prop["Name"] === pname) {
      if (prop["Value"]["$type"]) {
        if (pval !== null) { prop["Value"]["$value"] = pval; }
        return prop["Value"]["$value"]
      } else {
        if (pval !== null) { prop["Value"] = pval; }
        return prop["Value"]
      }
    }
  }
}
function deleteGenericProp(pitem, pname) {
  var newprops = [];
  for (const prop of pitem["Properties"]["$values"]) {
    if (prop["Name"] != pname) {
      newprops.push(prop);
    }
  }
  pitem["Properties"]["$values"] = newprops;
}

function processSetItem(item) {
  // list member item items:
  var result = dorequest("/api/Product_Kit?PRODUCT_CODE={0}M".format(item["ItemCode"]))
  if (result[0]) {
    for (const kitem of result[1]["Items"]["$values"]) {
      // remove Product_Kit items:
      if (!deleteProductKit(kitem["Identity"]["IdentityElements"]["$values"][0])) { return false; }
    }
  } else { synclog("pSI-1 Error ({0})".format(result[1])); return false; }
  // add/remake the original Kit Items:
  result = dorequest("/api/Product_Kit?PRODUCT_CODE={0}".format(item["ItemCode"]))
  if (result[0]) {
    for (const kitem of result[1]["Items"]["$values"]) {
      // add Product_Kit items:
      if (!addProductKit(kitem, "{0}M".format(item["ItemCode"]))) { return false; }
    }
  } else { synclog("pSI Error ({0})".format(result[1])); return false; }
  return true;
}

function processItem(item, setItem=false) {
  var code = item["ItemCode"];
  var mcode = "{0}M".format(code);
  // update code
  item["ItemCode"] = mcode;
  item["ItemId"] = mcode;
  // Name, append " - Member" to item title for newitem
  if (item["Name"].length > 55) {
    synclog("WARNING: Item name too long ({0})".format(item["Name"]));
    item["Name"] = item["Name"].slice(0, 56);
    synclog("WARNING: Shrinking to ({0})".format("{0} - Member".format(item["Name"]).slice(0,60)));
  } else if ("{0} - Member".format(item["Name"]).length > 60) {
    synclog("WARNING: Item name too long ({0})".format(item["Name"]));
    synclog("WARNING: Shrinking to ({0})".format("{0} - Member".format(item["Name"]).slice(0,60)));
  }
  item["Name"] = "{0} - Member".format(item["Name"]).slice(0,60);
  // adjust category code.
  item["ItemClass"]["ItemClassId"] = "{0}-M".format(item["ItemClass"]["ItemClassId"]);
  delete item["ItemClass"]["Name"];
  // if setItem, nuke the Components list only on item creation.
  if (setItem) {
    item["Components"]["$values"] = [];
  }
  return item;
}

function deleteProductKit(id) {
  var result = dorequest("/api/Product_Kit/{0}".format(id), null, null, [], "", "DELETE");
  if (result[0]) { return true; }
  else {
    synclog("DPK Error ({0})".format(result[1]));
    return false;
  }
}
function addProductKit(kitem, pcode) {
  delete kitem["Identity"];
  genericProp(kitem, "PRODUCT_CODE", pcode)
  deleteGenericProp(kitem, "SEQN");
  var result = dorequest("/api/Product_Kit", null, null, [], kitem);
  if (result[0]) { return true; }
  else {
    synclog("APK Error ({0})".format(result[1]));
    return false;
  }
}

function getPrice(itemID, type){
  var params = [["ItemId", itemID], ["PriceSheetId", type]];
  var result = dorequest("/api/ItemPrice", null, null, params);
  if (result[0] && result[1]["Count"] > 0) {
    var price = result[1]["Items"]["$values"][0]["DefaultPrice"]["Amount"];
    if (price) { return price; }
    else { return 0.0;}
  } else {
    synclog("uP Error: ({0})".format(result[1])); return false;
  }
}
function setPrice(itemID, type, val){
  var params = [["ItemId", itemID], ["PriceSheetId", type]];
  var result = dorequest("/api/ItemPrice", null, null, params);
  if (result[0] && result[1]["Count"] > 0) {
    // get structure
    var ipricedata = result[1]["Items"]["$values"][0];
    // set value
    ipricedata["DefaultPrice"]["Amount"] = val;
    // PUT structure
    var putresult = dorequest("/api/ItemPrice/{0}".format(itemID), null, null, [], ipricedata, "PUT");
    if (putresult[0]) {

    } else {
      synclog("sP-1 Error: ({0})".format(putresult[1])); return false;
    }
  } else {
    synclog("sP Error: ({0})".format(result[1])); return false;
  }
}

function updatePrices(itemID, percentdisc, freeitems) {
  var member = 99999;
  var standard = 99999;
  // get original prices Member, then Standard
  member = getPrice(itemID, "Member");
  standard = getPrice(itemID, "Standard");
  if (member === false || standard === false) { return false; }
  //itemID for member item ID
  var itemIDM = "{0}M".format(itemID);
  // for orig item, set both to standard.
  var imember = setPrice(itemID, "Member", standard);
  var istandard = setPrice(itemID, "Standard", standard);
  if (imember === false || istandard === false) { return false; }
  // set price for both to member price discounted percentage.
  if (freeitems.includes(itemID)) {
    member = setPrice(itemIDM, "Member", 0.0);
    standard = setPrice(itemIDM, "Standard", 0.0);
  } else {
    var memprice = (standard - (standard * (percentdisc/100.0)));
    member = setPrice(itemIDM, "Member", memprice);
    standard = setPrice(itemIDM, "Standard", memprice);
  }
  if (member === false || standard === false) { return false; }
  return true;
}

function doMemberItem(item, percentdisc, freeitems) {
  // POST/PUT update
  var origcode = item["ItemCode"];
  var method = "POST";
  var url = "/api/Item";
  var setItem = false;
  if (item["$type"].includes("Asi.Soa.Commerce.DataContracts.ItemSetItemData")) {
    setItem = true;
    url = "{0}SetItem".format(url);
  }

  var exists = itemMExists(origcode);
  var ret = null;
  if (exists) {
    method = "PUT";
    url = "{0}/{1}M".format(url, origcode);
  }

  if (setItem) {
    // nuke Product_Kits:
    processSetItem(item);
    if (!exists) {
      // pre-make new item with empty components making a copy of item
      var sitem = processItem(JSON.parse(JSON.stringify(item)), setItem);
      var sresult = dorequest(url, null, null, [], sitem, "POST")
      if (!sresult[0]) { synclog("dMI-1 Error ({0})".format(sresult[1])); return false; }
      method = "PUT"
      url = "/api/ItemSetItem/{0}M".format(origcode)
    }
  }
  item = processItem(item); // reassignment not really needed
  // submit
  var result = dorequest(url, null, null, [], item, method)
  if (!result[0]) { synclog("dMI Error ({0})".format(result[1])); return false; }
  // Check then update priceitem
  ret = updatePrices(origcode, percentdisc, freeitems);
  if (!ret) { return false; }
  return true;
}

//categories, percentdisc, freeitems
function setupSync(categories, percentdisc, freeitems) {
  // push total count back, then start for real...
  freeitems = freeitems.split(",")
  var totalcount = countItems(categories);
  if (totalcount === false) { return; }
  postMessage({ type: "totalcount", data: totalcount });
  var running = true;
  for (const cat of categories.split(",")) {
    // for category iterate over it's items...
    if (!checkMemberCat(cat)) {
      // skip categories that don't have Member category
      continue;
    }
    //var params = [["ItemClassId", CLASSID.format(cat)], ["ItemStatus", "A"]];
    var params = [["ItemClassId", CLASSID.format(cat)],];
    for (const item of apiIterator("/api/Item", params,
        _i => {console.log("E: " + _i); running = false; }
        )) {
      // process store item
      if (!doMemberItem(item, percentdisc, freeitems)) { running = false; break; }
      incrementProcessed();
    }
    if (!running) { break; }
  }
  doneAndReturn();
}

function doneAndReturn() {
  postMessage({
    type: "syncDone",
    data: true,
  });
}
