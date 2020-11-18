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

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'getCategories':
        token = arg[0];
        postMessage({
          type: type,
          data: getCategories(),
        });
        break;
      case 'startProcessing':
        token = arg[0];
        startProcessing(arg[1], arg[2], arg[3]);
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}


var COUNT = 0;
function incrementProgress() {
  COUNT++;
  postMessage({
    type: "updateProgress",
    data: COUNT,
  });
}

function buildCount(cats) {
  var count = 0;
  // add included alliance users only:
  for (const cat of cats) {
    params = [["limit", 1], ["ItemClassId", cat]];
    var result = dorequest("/api/Item", null, null, params);
    if (result[0]) { count += result[1]["TotalCount"]; }
    else { mergelog("Count E: {0}".format(result[1])); }
  }
  postMessage({ type: "setMaxProgress", data: count });
}

function getProductsIDs(cats, inventory) {
  ids = new Set([]);
  for(const cat of cats) {
    var params = [["ItemClassId", cat]];
    for(const item of apiIterator("/api/Item", params)) {
      ids.add(item["ItemId"]);
      inventory[item["ItemId"]] = item["LocationInventoryQuantity"]["QuantityAvailable"]["Amount"];
    }
  }
  return ids;
}

function handleProduct(postobj, prodID, invamnts, amnt){
  // if item in invamnts use negative value, otherwise amnt.
  if ((prodID in invamnts) && (amnt == 0)) { amnt = -invamnts[prodID]; }
  // add item to postobj
  var item = JSON.parse(JSON.stringify(PRODUCT_VALUE));
  item["ItemId"] = prodID;
  item["Quantity"]["Amount"] = amnt;
  postobj["Parameters"]["$values"][0]["$values"].push(item)
}

function updateinventories(cats, amount, zero) {
  // build lists of product items and inventories
  if (zero) { amount = 0; }
  invamnts = {}
  //var exclude = getProductsIDs(excluded, false);
  // build list of IDs of potential add:
  var include = getProductsIDs(cats, invamnts)

  postobj = JSON.parse(JSON.stringify(PRODUCT_TRANS))

  for(const id of include) {
    if (true || !exclude.has(id)) {
      // add products in category to postobj
      handleProduct(postobj, id, invamnts, amount);

    }
    incrementProgress();
  }
  // execute batch
  result = dorequest("/api/ProductTransaction/_execute", null, null, [], postobj);
  if (!result[0]) { console.log(result[1]); }
}

function startProcessing(cats, amount, zero) {
  // ghetto reset count
  COUNT = -1;
  incrementProgress();

  // preprocess categories list.
  cats = cats.filter(i=>{ if (i) {return i} });
  mergelog("Building lists, progress will start when finished. Please wait...")
  // get counts
  buildCount(cats);

  updateinventories(cats, amount, zero);

  endProcessing();
}
function endProcessing() {
  postMessage({
    type: "endProcessing",
    data: [],
  });
}

function mergelog(s) {
  postMessage({
    type: "mergelog",
    data: s,
  });
}

function getCategories() {
  var tableitems = [];
  for (let i of apiIterator("/api/ItemClass", [["ItemClassId", "StartsWith:SALES-"]])) {
    tableitems.push([i["ItemClassId"], i["Name"]]);
  }
  return tableitems;
}

PRODUCT_TRANS = {
    "$type": "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
    "OperationName": "AddProductTransactionByGroup",
    "EntityTypeName": "ProductTransaction",
    "Parameters": {
        "$type": "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
        "$values": [
            {
                "$type": "Asi.Soa.Commerce.DataContracts.ProductTransactionDataCollection, Asi.Contracts",
                "$values": []
            }
        ]
    },
    "ParameterTypeName": {
        "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
        "$values": [
            "Asi.Soa.Commerce.DataContracts.ProductTransactionDataCollection"
        ]
    }
}

NDATE = new Date();
DATESTRING = "{0}-{1}-02T00:00:00".format(NDATE.getFullYear(), ('0' + (NDATE.getMonth()+1)).slice(-2), ('0' + NDATE.getDate()).slice(-2))

PRODUCT_VALUE = {
    "$type": "Asi.Soa.Commerce.DataContracts.ProductTransactionData, Asi.Contracts",
    "TransactionType": "Adjustment",
    "Description": "",
    "ItemId": "_____",
    "UnitCost": 0.00,
    "TotalAmount": 0.00,
    "EnteredDate": DATESTRING,
    "Quantity": {
        "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
        "Amount": 0
    },
    "ReferenceNumber": "",
    "TransactionDate": DATESTRING,
    "FromLocation": "DEFAULT",
    "FromBin": "",
    "ToLocation": "",
    "ToBin": ""
}
