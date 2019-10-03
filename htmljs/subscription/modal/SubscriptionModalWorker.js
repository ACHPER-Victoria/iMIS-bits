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
      case 'processEmail':
        // console.log('Posting message back to main script');
        // generate CSVdata
        token = arg[0];
        postMessage({
          type: type,
          data: processEmail(arg[1], arg[2]), //email, userid
        });
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function checkForEmail(email) {
  // query to see if email address is already in the list.
}

function addToAlliances(id, alliances) {
  alliances.forEach(function (a) {
    if (!a) { return; }
    // check if exists:
    var params = [["ID", id], ["GroupName", a]];
    var result = dorequest("/api/ACH_MarketingGroups", null, null, params);
    if (result[0] && result[1]["TotalCount"] < 1) {
      result = dorequest("/api/ACH_MarketingGroups", null, null, [], genAllianceBody(id, a));
      if (result[0] == false) { console.log(result[1]); }
    }
  });
}
function addToSubscriptions(id, subscriptions) {
  if (subscriptions.length == 0) { return; }
  var partyobj = null;
  var result = dorequest("/api/Party/{0}".format(id));
  if (result[0]) {
    var partyobj = partyAddSubscriptions(result[1], subscriptions)
    // modified obj, now push it back:
    result = dorequest("/api/Party/{0}".format(id), null, null, [], partyobj, "PUT");
    if (!result[0]) {
      importlog("Error updating subscriptions for ({0}) - {1}".format(id, result[1]));
    }
  } else {
    importlog("Error fetching party id: {0}".format(id));
  }
}

function getUserFromAddrProps(email, phone, firstname, lastname) {
  // search addresses.
  var p = "parameter"
  var attrs = [
    // Search 1 - Everything
    [[p, email], [p, phone], [p, email], [p, phone], [p, email], [p, phone], [p, email],
      [p, phone], [p, email], [p, phone], [p, email], [p, phone], [p, firstname], [p, lastname]],
    // search 2 - Minus phone (keep mobile search [last 3])
    [[p, email], [p, ""], [p, email], [p, ""], [p, email], [p, ""], [p, email], [p, phone],
      [p, email], [p, phone], [p, email], [p, phone], [p, firstname], [p, lastname]],
  ];
  attrs.forEach(l => { l.unshift(["QueryName", "$/ACHPERVIC/Code-Queries/Code-AddressSearch"]); });
  var result = dorequest("/api/iqa", null, null, attrs[0]);
  var i = 1;
  while (result[0] && result[1]["TotalCount"] > 1 && i < attrs.length) {
    // narrow search
    result = dorequest("/api/iqa", null, null, attrs[i]);
    i++;
  }
  if (result[0]) {
    if (result[1]["TotalCount"] != result[1]["TotalCount"]) { return false; } // ignore too many results
    else if (result[1]["TotalCount"] < 1) { return null; }
    else if (result[1]["TotalCount"] > 1) { return false; }
    else {
      //return ID
      return parseInt(result[1]["Items"]["$values"][0]["PrimaryParentIdentity"]["IdentityElements"]["$values"][0]);
    }
  } else { return null; }
}

function startProcessing(f, fields, alliances, subscriptions) {
  // preprocess subscriptions (and alliances) list.
  alliances = alliances.filter(i=>{ if (i) {return i} });
  subscriptions = subscriptions.filter(i=>{ if (i) {return i} });
  // process file
  var notfound = [];
  var notunique = [];
  var found = [];
  var row = 0;
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      // check ID
      var id = null;
      var field = fields["uid"];
      if (field && r["data"][0][field].trim()) {
        id = getUserFromID(r["data"][0][field].trim())
      }
      if (id === null) { // didn't find/or don't have ID
        var email = "", phone = "", firstname = "", lastname = "" ;
        var emailfield = fields["email"], phonefield = fields["phone"], firstnamefield = fields["firstname"], lastnamefield = fields["lastname"];
        if (emailfield && r["data"][0][emailfield].trim()) { email = r["data"][0][emailfield].trim(); }
        if (phonefield && r["data"][0][phonefield].trim()) { phone = r["data"][0][phonefield].trim(); }
        if (firstnamefield && r["data"][0][firstnamefield].trim()) { firstname = r["data"][0][firstnamefield].trim(); }
        if (lastnamefield && r["data"][0][lastnamefield].trim()) { lastname = r["data"][0][lastnamefield].trim(); }
        id = getUserFromAddrProps(email, phone, firstname, lastname)
      }
      // process ID if found
      if (id === null) {
        // not found
        notfound.push(r["data"][0])
      } else if (id === false){
        // not unique
        notunique.push(r["data"][0])
      } else {
        // found
        addToAlliances(id, alliances);
        addToSubscriptions(id, subscriptions);
        found.push(r["data"][0]);
      }
      updateProgress(++row)
    },
    "complete": function(r,p) {
      endProcessing(notfound, notunique, found);
    },
    "skipEmptyLines": true,
    "fastMode": false,
  });

}
function endProcessing(nf, nu, found) {
  // create CSV data for args
  postMessage({
    type: "endProcessing",
    data: [Papa.unparse(nf), Papa.unparse(nu), Papa.unparse(found)],
  });
}

function getHeaders(f) {
  var rows = 0;
  var headers = null;
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      if (headers === null) {
        headers = r["meta"]["fields"];
      }
      rows++;
    },
    "complete": function(r,p) {
      sendHeaders(rows, headers);
    },
    "skipEmptyLines": true,
    "fastMode": false,
  });
}

function updateProgress(i) {
  postMessage({
    type: "updateProgress",
    data: i,
  });
}

function sendHeaders(rows, headers) {
  postMessage({
    type: "setMaxProgress",
    data: rows,
  });
  postMessage({
    type: "getHeaders",
    data: headers,
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

function importlog(s) {
  postMessage({
    type: "importlog",
    data: s,
  });
}

function getFieldItems() {
  var tableitems = [];
  for (let i of apiIterator("/api/GenTable", [["TableName", "MARKETINGGROUPS"]])) {
    tableitems.push([i["Code"], i["Description"]]);
  }
  var commsitems = [];
  for (let i of apiIterator("/api/CommunicationType", [["IsSystem", "false"]])) {
    commsitems.push([i["CommunicationTypeId"], i["CommunicationTypeDisplay"]]);
  }
  return [tableitems, commsitems];
}
