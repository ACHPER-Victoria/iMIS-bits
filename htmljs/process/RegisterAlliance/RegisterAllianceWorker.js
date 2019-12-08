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
      case 'getEvents':
        token = arg[0];
        postMessage({
          type: type,
          data: getEvents(),
        });
        break;
      case 'getAlliances':
          token = arg[0];
          postMessage({
            type: type,
            data: getAlliances(),
          });
          break;
      case 'getFunctions':
          token = arg[0];
          postMessage({
            type: type,
            data: getFunctions(arg[1]),
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

function addRegistration(eventid, regoptid, id) {
  // check if already registered...
  var result = dorequest("/api/EventRegistration/{0}-{1}".format(eventid, id));
  if (result[0] && ("Status" in result[1])) {
    console.log("Checking Reg...");
    // check if cancelled:
    if (result[1]["Status"] != 1)
    {
      console.log("Cancelled Reg...");
      result[1]["Status"] = 1;
      result = dorequest("/api/EventRegistration/{0}-{1}".format(eventid, id), null, null, [], result[1], method="PUT");
      if (!result[0]) { console.log(result[1]); }
    }
  } else {
    console.log("New Reg...");
    result = dorequest("/api/EventRegistration/_execute", null, null, [], genRegistration(eventid, regoptid, id));
    if (!result[0]) { console.log(result[1]); }
  }
}

function buildCount(included) {
  var count = 0;
  // add included alliance users only:
  for (const alliance of included) {
    params = [["limit", 1], ["GroupName", alliance]];
    var result = dorequest("/api/ACH_MarketingGroups", null, null, params);
    if (result[0]) { count += result[1]["TotalCount"]; }
    else { mergelog("Count E: {0}".format(result[1])); }
  }
  postMessage({ type: "setMaxProgress", data: count });
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

function registerPeople(included, excluded, eventid, regoptid) {
  // build exclude list of IDs
  mergelog("Building lists, progress will start when finished. Please wait...")
  var exclude = getAlliancesIDs(excluded);
  // build list of IDs of potential add:
  var include = getAlliancesIDs(included)

  for(const id of include) {
    if (!exclude.has(id)) {
      // add user to alliance
      addRegistration(eventid, regoptid, id)
    }
    incrementProgress();
  }
}

function startProcessing(included, excluded, eventid, regoptid) {
  // ghetto reset count
  COUNT = -1;
  incrementProgress();

  // preprocess subscriptions (and alliances) list.
  included = included.filter(i=>{ if (i) {return i} });
  excluded = excluded.filter(i=>{ if (i) {return i} });

  // get counts
  buildCount(included);

  registerPeople(included, excluded, eventid, regoptid);

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

function getEvents() {
  var tableitems = [];
  for (let i of apiIterator("/api/Event", [["Status", "P"]])) {
    tableitems.push([i["EventCode"], "{0} - {1}".format(i["EventCode"], i["Name"])]);
  }
  return tableitems;
}

function getFunctions(event) {
  var tableitems = [];
  if (event) {
    var result = dorequest("/api/Event/{0}".format(event));
    if (result[0]) {
      for (let i of result[1]["RegistrationOptions"]["$values"]) {
        tableitems.push([i["EventFunctionCode"], "{0} - {1}".format(i["EventFunctionCode"], i["Name"])]);
      }
    }
  }
  return tableitems;
}

function getAlliances() {
  var tableitems = [];
  for (let i of apiIterator("/api/GenTable", [["TableName", "MARKETINGGROUPS"]])) {
    tableitems.push([i["Code"], i["Description"]]);
  }
  return tableitems;
}
