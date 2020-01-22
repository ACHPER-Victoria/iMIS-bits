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
const rsplit = function(source, sep, maxsplit) {
      var split = source.split(sep);
      return maxsplit ? [ split.slice(0, -maxsplit).join(sep) ].concat(split.slice(-maxsplit)) : split;
  };

var token = "";

importScripts('/common/Uploaded%20files/Code/utils.js')
importScripts('/common/Uploaded%20files/Code/papaparse.min.js')

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'getHeaders':
        token = arg[0];
        getHeaders(arg[1]);
        break;
      case 'startProcessing':
        token = arg[0];
        startProcessing(arg[1], arg[2]);
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function getUserFromID(id) {
  var result = dorequest("/api/CsContact/{0}".format(id));
  if (result[0]) { return id; }
  else { return null; }
}
function getOrgFromID(id) {
  var result = dorequest("/api/CsContact/{0}".format(id));
  if (result[0]) { return id; }
  else { return null; }
}
function getOrgFromName(name) {
  var params = [["limit", 1], ["Company", "eq:{0}".format(name.trim())], ["IsCompany", "true"]];
  var result = dorequest("/api/CsContact", null, null, params);
  if (result[0]) {
    if (result[1]["TotalCount"] > 1) {
      return false;
    } else if (result[1]["TotalCount"] < 1){
      if (name.includes("-")) {
        return getOrgFromName(name.replace("-", '\u2013'));
      }
      else {
        return null;
      }
    } else {
      return result[1]["Items"]["$values"][0]["Identity"]["IdentityElements"]["$values"][0];
    }
  }
  else {
    importlog("G: Error ({0}) {1}".format(name, result[1]));
    return null;
  }
}

function mapRow(fields, row) {
  var mr = {};
  for (const [key, value] of Object.entries(fields)) {
    if (row[value]) {
      mr[key] = row[value].trim();
    } else {
      mr[key] = null;
    }
  }
  return mr;
}
// FIELDS = [["ID", "oid"], ["Org Name", "orgname"], ["Type", "schooltype"],
//   ["Sector", "sector"], ["Ranking No.", "rankingno"], ["School No.", "schoolno"],
//   ["Metro/Regional", "locality"],["Region", "region"], ["SFO %", "sfoperct"],
//   ["Sub Region", "subregion"]];
function updateOrgData(id, fields, row) {
  // build values
  var values = mapRow(fields, row);
  var url = "/api/AO_OrganisationsData/{0}";
  // get OrgData:
  var result = dorequest(url.format(id));
  var data = null;
  var method = "";

  if (!result[0]) {
    // build data obj
    data = buildOrgData(id, values["locality"], values["region"],
      values["schoolno"], values["schooltype"], values["sector"],
      values["sfoperct"], values["rankingno"], values["subregion"]);
    method = "POST";
    url = url.slice(0, -4);
  } else {
    data = result[1];
    setOrgData(data, values["locality"], values["region"],
      values["schoolno"], values["schooltype"], values["sector"],
      values["sfoperct"], values["rankingno"], values["subregion"]);
    method = "PUT";
    url = url.format(id);
  }
  // PUT THE DATA...
  result = dorequest(url, null, null, [], data, method);
  if (!result[0]) {
    importlog("uO Error ({0}): {1}".format(id, result[1]));
  }
}

function startProcessing(f, fields) {
  // process file
  var notfound = [];
  var notunique = [];
  var found = [];
  var row = 0;
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      var id = null;
      // iMIS ID available. Only process iMIS ID rows...
      if (fields["oid"]) {
        var field = fields["oid"];
        var imisid = r["data"][0][field].trim()
        if (imisid) {
          id = getOrgFromID(imisid);
        }
      } else {
        // blindly match orgname... figure out smarter way later...
        var field = fields["orgname"];
        if (!field) {
          importlog("MISSING ORG NAME FIELD.");
          return;
        }
        var orgname = r["data"][0][field].trim()
        if (orgname) {
          orgname = orgname.replace("  ", " ");
          id = getOrgFromName(r["data"][0][field].trim());
          // if not found attempt to append the suburb
          if (id === null || id === false) {
            field = fields["suburb"];
            if (field && r["data"][0][field].trim()) {
              var suburb = r["data"][0][field].trim();
              id = getOrgFromName("{0} - {1}".format(orgname, suburb));
              // If still not found, try adding "Campus" to the end...
              if (id === null || id === false) { id = getOrgFromName("{0} - {1} Campus".format(orgname, suburb)); }
            }
          }
          // If still not found, try variants: +" Incorporated"
          if (id === null || id === false) {
            id = getOrgFromName("{0} {1}".format(orgname, "Incorporated"));
          }
          // If still not found, take off the last word and insert a hyphen in there. (then try 2 words)
          if (id === null || id === false) {
            var namesplit = rsplit(orgname, " ", 1);
            id = getOrgFromName("{0} - {1}".format(namesplit[0], namesplit[1]));
            if (id === null || id === false) {
              var namesplit = rsplit(orgname, " ", 2);
              id = getOrgFromName("{0} - {1}".format(namesplit[0], namesplit.slice(1).join(" ")));
            }
          }
          // try replace "Grammar" with "Grammar School"
          if ((id === null || id === false) && orgname.includes("Grammar") && !orgname.includes("Grammar School")) {
            id = getOrgFromName(orgname.replace("Grammar", "Grammar School"));
          }
        }
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
        updateOrgData(id, fields, r["data"][0])
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
  if (!f) {return;}
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

function importlog(s) {
  postMessage({
    type: "importlog",
    data: s,
  });
}


var ORGDATA = {
  "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
  "EntityTypeName": "AO_OrganisationsData",
  "PrimaryParentEntityTypeName": "Party",
  "Identity": {
    "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
    "EntityTypeName": "AO_OrganisationsData",
    "IdentityElements": {
      "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
      "$values": [
        ""
      ]
    }
  },
  "PrimaryParentIdentity": {
    "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
    "EntityTypeName": "Party",
    "IdentityElements": {
      "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
      "$values": [
          ""
      ]
    }
  },
  "Properties": {
    "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
    "$values": [
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "ContactKey",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "AccountsEmail",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "Level",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "Locality",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "Region",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "SchoolNumber",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "SchoolType",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "Sector",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "SFOPercentage",
        "Value": ""
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "SFORanking",
        "Value": {
            "$type": "System.Int32",
            "$value": 0
        }
      },
      {
        "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
        "Name": "SubRegion",
        "Value": ""
      }
    ]
  }
}
function buildOrgData(id, locality, region, schoolno, schooltype, sector,
  sfoperct, sforank, subregion) {
  var obj = JSON.parse(JSON.stringify(ORGDATA));
  obj["Identity"]["IdentityElements"]["$values"][0] = id
  obj["PrimaryParentIdentity"]["IdentityElements"]["$values"][0] = id
  genericProp(obj, "ContactKey", id);
  setOrgData(obj, locality, region, schoolno, schooltype, sector,
    sfoperct, sforank, subregion);
  return obj;
}
function setOrgData(obj, locality, region, schoolno, schooltype, sector,
  sfoperct, sforank, subregion) {
  if (locality !== null) { genericProp(obj, "Locality", locality.toUpperCase()); }
  if (region !== null) { genericProp(obj, "Region", region.toUpperCase()); }
  if (schoolno !== null) { genericProp(obj, "SchoolNumber", schoolno); }
  if (schooltype !== null) { genericProp(obj, "SchoolType", schooltype.toUpperCase()); }
  if (sector !== null) { genericProp(obj, "Sector", sector.toUpperCase()); }
  if (sfoperct !== null) { genericProp(obj, "SFOPercentage", sfoperct); }
  if (sforank !== null) {
    if (!isNaN(sforank)) { genericProp(obj, "SFORanking", parseInt(sforank, 10)); }
  }
  if (subregion !== null) { genericProp(obj, "SubRegion", subregion); }
}
