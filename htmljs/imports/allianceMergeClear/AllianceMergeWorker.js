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
      case 'getFieldItems':
        token = arg[0];
        postMessage({
          type: type,
          data: getFieldItems(),
        });
        break;
      case 'createAlliance':
        token = arg[0];
        postMessage({
          type: type,
          data: createAlliance(arg[1], arg[2]),
        });
        break;
      case 'startProcessing':
        token = arg[0];
        startProcessing(arg[1], arg[2], arg[3], arg[4]);
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

function addToAlliance(id, alliance) {
  if (!alliance) { return; }
  result = dorequest("/api/ACH_MarketingGroups", null, null, [], genAllianceBody(id, alliance));
  if (result[0] == false) { console.log(result[1]); }
}

function buildCount(everyone, included, output) {
  var count = 0;
  // count output to be cleared
  var params = [["limit", 1], ["GroupName", output]];
  var result = dorequest("/api/ACH_MarketingGroups", null, null, params);
  if (result[0]) { count += result[1]["TotalCount"]; }
  else { mergelog("Count E: {0}".format(result[1])); }

  // if everyone, tack on everyone:
  if (everyone) {
    params = [["limit", 1], ["IsCompany", "false"]];
    var result = dorequest("/api/CsContactBasic", null, null, params);
    if (result[0]) { count += result[1]["TotalCount"]; }
    else { mergelog("Count E: {0}".format(result[1])); }
  } else {
    // add included alliance users only:
    for (const alliance of included) {
      params = [["limit", 1], ["GroupName", alliance]];
      var result = dorequest("/api/ACH_MarketingGroups", null, null, params);
      if (result[0]) { count += result[1]["TotalCount"]; }
      else { mergelog("Count E: {0}".format(result[1])); }
    }
  }
  postMessage({ type: "setMaxProgress", data: count });
}

function clearAlliance(alliance) {
  var params = [["GroupName", alliance]];
  var todelete = [];
  for(const item of apiIterator("/api/ACH_MarketingGroups", params)) {
    todelete.push(item["Identity"]["IdentityElements"]["$values"]);
  }
  for(const delitem of todelete) {
    var result = dorequest("/api/ACH_MarketingGroups/~{0}|{1}".format(delitem[0], delitem[1]), null, null, [], "", method="DELETE");
    if (!result[0]) { mergelog("Delete E: {0}".format(result[1])); }
    incrementProgress();
  }
}

function getAlliancesIDs(alliances) {
  ids = new Set([]);
  for(const alliance of alliances) {
    var params = [["GroupName", alliance]];
    for(const item of apiIterator("/api/ACH_MarketingGroups", params)) {
      ids.add(item["PrimaryParentIdentity"]["IdentityElements"]["$values"][0]);
    }
  }
  return ids;
}

function getEveryoneID() {
  ids = [];
  var params = [["IsCompany", "false"]];
  for(const item of apiIterator("/api/CsContactBasic", params)) {
    var idnum = item["PrimaryParentIdentity"]["IdentityElements"]["$values"][0];
    if (idnum.length > 3) { ids.push(idnum); } // exclude system contacts
  }
  return ids;
}

function addPeople(everyone, included, excluded, output) {
  // build exclude list of IDs
  mergelog("Building lists, progress will start when finished. Please wait...")
  var exclude = getAlliancesIDs(excluded);
  // build list of IDs of potential add:
  var include = getAlliancesIDs(included)
  if (everyone) {
    include = getEveryoneID();
  }
  for(const id of include) {
    if (!exclude.has(id)) {
      // add user to alliance
      addToAlliance(id, output)
    }
    incrementProgress();
  }
}

function startProcessing(everyone, included, excluded, output) {
  // ghetto reset count
  COUNT = -1;
  incrementProgress();
  
  // preprocess subscriptions (and alliances) list.
  included = included.filter(i=>{ if (i) {return i} });
  excluded = excluded.filter(i=>{ if (i) {return i} });

  // get counts
  buildCount(everyone, included, output);

  // clear output alliance, delete all alliance entries
  clearAlliance(output);

  addPeople(everyone, included, excluded, output);

  endProcessing();
}
function endProcessing() {
  postMessage({
    type: "endProcessing",
    data: [],
  });
}

function createAlliance(code, desc) {
  data = {
    "$type": "Asi.Soa.Core.DataContracts.GenTableData, Asi.Contracts",
    "Table_Name": "MARKETINGGROUPS",
    "Code": code,
    "Description": desc
  };
  var result = dorequest("/api/GenTable", null, null, [], data);
  if (!result[0]) {
    importlog(result[1]);
  }
  return result[0];
}

function mergelog(s) {
  postMessage({
    type: "mergelog",
    data: s,
  });
}

function getFieldItems() {
  var tableitems = [];
  for (let i of apiIterator("/api/GenTable", [["TableName", "MARKETINGGROUPS"]])) {
    tableitems.push([i["Code"], i["Description"]]);
  }
  return tableitems;
}
