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
function getOrgsFromNo(schoolno) {
  var params = [["Sector", "GOVERNMENT"], ["SchoolNumber", "eq:{0}".format(schoolno.trim())]];
  var ids = [];
  for(let i of apiIterator("/api/AO_OrganisationsData", null, null, params)) {
    // check id to make sure org type... nevermind, there was only 2 and they were weirds.
    ids.push(i["PrimaryParentIdentity"]["IdentityElements"]["$values"][0])
  }
  return ids;
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

const GENMAP = {"sfoeband" : "AVIC_AS_RATING", "region": "REGION", };

function addGenValue(table, value, data) {

}

function addMissingValues(mapping) {
  for (const [key, value] of Object.entries(mapping)) {
    if (key === "") {
      if (value !== null) {
        addGenValue()
      }
    }
  }
}
// FIELDS = [["School Type", "schooltype"], ["SFOE Band", "sfoeband"], ["School no.", "schoolno"],
//  ["SFOE Index", "sfoeindex"], ["Region name", "region"], ["LGA Name", "lga"],
//  ["Area Name", "area"], ["SSV Region Abbreviation", "ssvregabb"], ["SSV Region", "ssvregion"]];
function updateOrgData(id, fields, row) {
  // build values
  var values = mapRow(fields, row);
  // verify if values exist in the GENTABLE if not, add them
  addMissingValues(values);
  var url = "/api/AVIC_AS_Data/{0}";
  // get OrgData:
  var result = dorequest(url.format(id));
  var data = null;
  var method = "";

  if (!result[0]) {
    // build data obj
    data = buildOrgData(id, values["schooltype"], values["sfoeband"],
      values["schoolno"], values["sfoeindex"], values["region"],
      values["lga"], values["area"], values["ssvregabb"], values["ssvregion"]);
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
      var ids = null;
      var field = fields["schoolno"];
      if (!field) {
        importlog("MISSING School No. FIELD.");
        return;
      }
      // look for all schools with school no and type of GOVT
      var schoolno = r["data"][0][field].trim()
      if (schoolno) {

        ids = getOrgsFromNo(r["data"][0][field].trim());
      }
      // process ID if found
      if (ids === null || ids.length === 0) {
        // not found
        notfound.push(r["data"][0])
      } else {
        // found
        for (let id of ids) {
          updateOrgData(id, fields, r["data"][0])
        }
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


var ASDATA = {
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "AVIC_AS_Data",
    "PrimaryParentEntityTypeName": "Party",
    "Identity": {
        "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
        "EntityTypeName": "AVIC_AS_Data",
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
                "Name": "ID",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "LGA",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Area",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Region",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Index",
                "Value": {
                    "$type": "System.Decimal",
                    "$value": 0.0
                }
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Rating",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Type",
                "Value": ""
            }
        ]
    }
}
function buildOrgData(id, locality, region, schoolno, schooltype, sector,
  sfoperct, sforank, subregion) {
  var obj = JSON.parse(JSON.stringify(ASDATA));
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
