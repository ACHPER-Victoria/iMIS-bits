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
        setupSync(arg[1]) //categories
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function checkMemberCat(cat) {
  var result = dorequest("/api/CsProductCategory/{0}-M".format(cat));
  return result[0];
}

function countItems(categories) {
  var itemCount = 0;
  for (const cat of categories.split(",")) {
    // get count and add to total
    // Also check if member category exists...
    var params = [["limit", 1], ["ProductCategory", cat], ["Status", "A"]];
    var result = dorequest("/api/CsProduct", null, null, params);
    if (result[0] && result[1]["TotalCount"] > 0) {
      // add count
      if (checkMemberCat(cat)) {
        itemCount += result[1]["TotalCount"];
      } else {
        synclog("Store category (-M suffix) not found for ({0})".format(cat));
      }
    } else if (result[0]) { synclog("No items for ({0})".format(cat)); }
    else { synclog("Error ({0})".format(result[1]))}
  }
  return itemCount;
}

var PROCESSED = 0;
function incrementProcessed() {
  PROCESSED++;
  postMessage({ type: "currentcount", data: PROCESSED });
}

function itemMExists(code) {
  var result = dorequest("/api/CsProduct/{0}M".format(code));
  return result[0];
}

function prodProp(item, pname, pval=null) {
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

var REMOVE_PROPS = ["DeferredIncomeAccount", "Description", "IMAGE_URL", "ProductMinor", "THUMBNAIL_URL"];
function cleanProps(item) {
  var newprops = [];
  for (const prop of item["Properties"]["$values"]) {
    if (!REMOVE_PROPS.includes(prop["Name"])) {
      newprops.push(prop);
    }
  }
  item["Properties"]["$values"] = newprops;
}

// TODO: Handle IS_KIT case

function updateMItem(item) {
  var icode = prodProp(item, "ProductCode");
  var newitem = dorequest("/api/CsProduct/{0}M".format(icode))[1];
  // append " - Member" to item title for newitem, swap price to discount price
  console.log("Updating item... ({0})".format(icode))
  if (prodProp(item, "IS_KIT")) {
    actionlog("({0}) is an updated collection. Make sure it has all it's items.".format(prodProp(item, "Title")));
  }
  // set item code(s)
  var nicode = prodProp(newitem, "ProductCode");
  prodProp(item, "ProductCode", nicode);
  prodProp(item, "ProductMajor", nicode);
  delete item["Identity"]
  // adjust category code.
  var ncat = "{0}-M".format(prodProp(item, "ProductCategory"))
  prodProp(item, "ProductCategory", ncat);
  // Change name
  var nname = "{0} - Member".format(prodProp(item, "Title"))
  prodProp(item, "Title", nname);
  prodProp(item, "TitleKey", "{0} MEMBER".format(prodProp(item, "TitleKey")));
  // set price accordingly... price1 (discount) -> Price 2
  prodProp(item, "Price2", prodProp(item, "Price1"));
  // clean up blank values API complains about
  cleanProps(item);
  var result = dorequest("/api/ACH_CsProduct/{0}".format(nicode), null, null, [], item, "PUT")
  if (result[0]) { return true; }
  else {
    synclog("Error ({0})".format(result[1]));
    return false;
  }
}
function createMItem(item) {
  var newCode = "{0}M".format(prodProp(item, "ProductCode"));
  console.log("Creating item... ({0})".format(newCode))
  if (prodProp(item, "IS_KIT")) {
    actionlog("({0}) is a *NEW* collection. Make sure to ADD all it's items.".format(prodProp(item, "Title")));
  }
}

function setupSync(categories) {
  // push total count back, then start for real...
  postMessage({ type: "totalcount", data: countItems(categories) });

  for (const cat of categories.split(",")) {
    // for category iterate over it's items...
    if (!checkMemberCat(cat)) {
      // skip categories that don't have Member category
      continue;
    }
    var params = [["ProductCategory", cat], ["Status", "A"]];
    for (const item of apiIterator("/api/CsProduct", params)) {
      // check if M suffix version exists...
      if (itemMExists(prodProp(item, "ProductCode"))) {
        // update with PUT
        updateMItem(item);
      } else {
        // make new with POST
        createMItem(item)
      }
      incrementProcessed();
    }
  }
  doneAndReturn();
}

function doneAndReturn() {
  postMessage({
    type: "syncDone",
    data: true,
  });
}
