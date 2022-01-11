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
  for(let i of apiIterator("/api/AO_OrganisationsData", params)) {
    // check id to make sure org type... nevermind, there was only 2 and they were weirds.
    ids.push(i["PrimaryParentIdentity"]["IdentityElements"]["$values"][0])
  }
  return ids;
}
function OrgDataAppend(data, id) {
  var result = dorequest("/api/Organization/{0}".format(id));
  if (result[0]) {
    data["ORG"] = result[1]["Name"];
    data["ORGID"] = id;
  }
  return data;
}

function setgenericProp(item, pname, value) {
  if (value != null && !Number.isNaN(value)) {
    if (GENMAP.hasOwnProperty(pname)) {
      var val = checkGenValue(GENMAP[pname], value);
      if (val) {
        genericProp(item, pname, val);
      }
    } else {
      genericProp(item, pname, value);
    }
  }
}
const GENMAP = {"Region": "REGION", "LGA" : "AVIC_LGA", "SubRegion" : "SUBREGION",
  "Locality" : "METROREGIONAL", "SchoolType" : "SCHOOLTYPE"};
const GENCODES = {}; // ["TABLE"][importdata] = code
const MISSING = {};
function buildGenMaps() {
  for (const v of Object.values(GENMAP)) {
    // /GenTable/?TableName=AVIC_AS_RATING
    var params = [["TableName", v]]
    for(let i of apiIterator("/api/GenTable", params)) {
      if (!GENCODES.hasOwnProperty(v)) { GENCODES[v] = {}; }
      GENCODES[v][i["Description"].toUpperCase()] = i["Code"];
    }
  }
}
function checkGenValue(table, value) {
  value = value.toUpperCase();
  if (GENCODES.hasOwnProperty(table) && GENCODES[table].hasOwnProperty(value)) {
    return GENCODES[table][value];
  } else {
    // log missing
    if (!MISSING.hasOwnProperty(table)){
      MISSING[table] = new Set();
    }
    if (!MISSING[table].has(value)) {
      MISSING[table].add(value)
      importlog("gV Error ({0}): {1}".format(table, value));
    }
  }
  return false;
}

function mapRow(fields, row) {
  var mr = {};
  for (const [key, value] of Object.entries(fields)) {
    var val = row[value];
    if (val != null) {
      mr[key] = val.trim();
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
    if (values["Sector"] == "" && values["SchoolNumber"] == "") {
      console.log("{0} - no data, no change".format(id));
      return;
    }
    data = buildOrgData(id, values);
    method = "POST";
    url = rsplit(url, "/", 1)[0];
  } else {
    data = result[1];
    // check if same data...
    if (genericProp(data, "Sector") == values["Sector"] && genericProp(data, "SchoolNumber") == values["SchoolNumber"]) {
      console.log("{0} - has data, no change".format(id));
      return;
    }
    setOrgData(data, values);
    method = "PUT";
    url = url.format(id);
  }
  // PUT THE DATA...
  result = dorequest(url, null, null, [], data, method);
  if (!result[0]) {
    importlog("uO Error ({0}): {1}".format(id, result[1]));
    return false;
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
      var ids = [];
      // iMIS ID available. Only process iMIS ID rows...
      if (fields["oid"]) {
        var field = fields["oid"];
        var imisid = r["data"][0][field].trim()
        if (imisid) {
          ids.push(getOrgFromID(imisid));
        }
      } else {
        // get all IDs that match school number
        importlog("BAD ROW {0}".format(r));
        p.abort();
        return;
        var sfield = fields["SchoolNum"];
        if (!sfield) { importlog("MISSING School No. FIELD."); return; }
        var schoolno = r["data"][0][field].trim()
        if (schoolno) {
          ids = getOrgsFromNo(r["data"][0][field].trim());
        }
      }
      // process ID if found
      if (ids === null || ids.length === 0) {
        // not found
        notfound.push(r["data"][0])
      } else {
        // found
        // updateOrgData(id, fields, r["data"][0])
        for (let id of ids) {
          found.push(OrgDataAppend(Object.assign({}, r["data"][0]), id));
          if (updateOrgData(id, fields, r["data"][0]) === false) {
            p.abort();
            return;
          }
        }
      }
      updateProgress(++row)
    },
    "complete": function(r,p) {
      endProcessing(notfound, found);
    },
    "skipEmptyLines": true,
    "fastMode": false,
  });

}
function endProcessing(nf, found) {
  // create CSV data for args
  postMessage({
    type: "endProcessing",
    data: [Papa.unparse(nf), Papa.unparse(found)],
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
        "Name": "LGA",
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

function buildOrgData(id, values) {
  var obj = JSON.parse(JSON.stringify(ORGDATA));
  genericProp(obj, "ContactKey", id);
  setOrgData(obj, values);
  return obj;
}
function setOrgData(obj, values) {
  setgenericProp(obj, "SchoolType", values["SchoolType"]);
  setgenericProp(obj, "Sector", values["Sector"]);
  setgenericProp(obj, "SchoolNumber", values["SchoolNumber"]);
  setgenericProp(obj, "SFORanking", parseInt(values["SFORanking"], 10));
  setgenericProp(obj, "Locality", values["Locality"]);
  setgenericProp(obj, "Region", values["Region"]);
  setgenericProp(obj, "LGA", values["LGA"]);
  setgenericProp(obj, "SFOPercentage", values["SFOPercentage"]);
  setgenericProp(obj, "SubRegion", values["SubRegion"]);
}
