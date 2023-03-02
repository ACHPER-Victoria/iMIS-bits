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
      case 'getFundingCats':
        token = arg[0];
        getFundingCats();
        break;
      case 'startProcessing':
        token = arg[0];
        startProcessing(arg[1], arg[2], arg[3], arg[4], arg[5]); // CSVFILE, fields, fundingcat, removeold
        break;
      case 'ping':
          postMessage({
            type: type,
            data: iMISPing(),
          });
          break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function getUserFromID(id) {
  var result = dorequest("/api/Person/{0}".format(id));
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
    if(i["PrimaryParentIdentity"]["IdentityElements"]["$values"][0] != "") {
      ids.push(i["PrimaryParentIdentity"]["IdentityElements"]["$values"][0])
    }
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

function setgenericProp(item, pname, value) {
  if (value) {
    if (!genericProp(item, pname)) {
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
}

const GENMAP = {"Region": "REGION", "Rating" : "AVIC_AS_RATING", "LGA" : "AVIC_LGA",
  "Area" : "SUBREGION", "SSV_REGION" : "AVIC_AS_SSVREG", "Type" : "SCHOOLTYPE"};
const GENCODES = {}; // ["TABLE"][importdata] = code
const MISSING = {};
function buildCustomGenMaps() {
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
      if (value.includes("UNKNOWN")) {
        importlog("Returning Unknown...");
        return "UK";
      }
    }
  }
  return false;
}

function checkMissingValues(mapping) {
  for (const [key, value] of Object.entries(mapping)) {
    if (key && key != "" && value && value !== null) {
      if (GENMAP.hasOwnProperty(key)) {
        checkGenValue(GENMAP[key], value);
      }
    }
  }
}

function orgRemoveContactIDs(type, cat, id) {
  var removes = [];
  var params = [["ID", id], ["FundingCategory", cat]];
  for(let i of apiIterator("/api/{0}".format(type), params)) {
    // check id to make sure org type... nevermind, there was only 2 and they were weirds.
    removes.push([
      i["Identity"]["IdentityElements"]["$values"][0],
      i["Identity"]["IdentityElements"]["$values"][1]
    ]);
  }
  for (const [rid, rord] of removes) {
    var result = dorequest("/api/{0}/~{1}|{2}".format(type, rid, rord), null, null, [], "", "DELETE");
    if (!result[0]) {
      importlog("dF Error: {0}|{1}".format(rid, rord));
    }
  }
}
// FIELDS = [["iMIS ID", "imisid"], ["School no.", "SchoolNum"], ["School Type", "Type"], ["SFOE Band", "Rating"],
//   ["SFOE Index", "Index"], ["Region name", "Region"], ["LGA Name", "LGA"],
//   ["Area Name", "Area"], ["SSV Region Abbreviation", "ssvregabb"], ["SSV Region", "SSV_REGION"]];
function updateOrgData(id, fields, row, fundingcat, removeold) {
  // build values
  var values = mapRow(fields, row);
  var url = "/api/AVIC_AS_Data/{0}";
  // get OrgData:
  var result = dorequest(url.format(id));
  var data = null;
  var method = "";

  if (!result[0]) {
    // build data obj
    data = buildOrgData(id, values);
    method = "POST";
    url = rsplit(url, "/", 1)[0];
  } else {
    data = result[1];
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
  // remove old contact
  if (removeold) {
    orgRemoveContactIDs("AVIC_AS_FUNDING_CONTACT", fundingcat, id);
  }
  // put contact... AVIC_AS_FUNDING_CONTACT, AVIC_AS_ACH_CONTACT
  // Funding_Person_ID or ACH_Staff_ID
  if (values["imisid"]) {
    // check existing:
    var params = [["ID", id], ["Funding_Person_ID", values["imisid"]], ["FundingCategory", fundingcat]];
    result = dorequest("/api/AVIC_AS_FUNDING_CONTACT", null, null, params);
    if (result[0] && result[1]["Count"] == 0) {
      //create
      data = buildContactData(id, "AVIC_AS_FUNDING_CONTACT", values["imisid"], "Funding_Person_ID", fundingcat);
      result = dorequest("/api/AVIC_AS_FUNDING_CONTACT", null, null, [], data, "POST");
      if (!result[0]) {
        importlog("uO AS FC Error: {0}".format(values["imisid"]));
        console.log(result[1]);
        return false;
      }
    } else { console.log("Skipped: Org: {0}, ID: {1}".format(id, values["imisid"]))}
  } else {
    // check if there exists a funding contact there, if not make a dummy one.
    var params = [["ID", id], ["FundingCategory", fundingcat]];
    result = dorequest("/api/AVIC_AS_FUNDING_CONTACT", null, null, params);
    if (result[0] && result[1]["Count"] == 0) {
      data = buildContactData(id, "AVIC_AS_FUNDING_CONTACT", 0, "Funding_Person_ID", fundingcat);
      result = dorequest("/api/AVIC_AS_FUNDING_CONTACT", null, null, [], data, "POST");
      if (!result[0]) {
        importlog("uO AS FC Error: {0}".format(values["imisid"]));
        console.log(result[1]);
        return false;
      }
    }
  }
  if (values["achid"]) {
    data = buildContactData(id, "AVIC_AS_ACH_CONTACT", contactid, "ACH_Staff_ID", fundingcat);
  }
  var result = dorequest(url.format(id));
}

function OrgDataAppend(data, id) {
  var result = dorequest("/api/Organization/{0}".format(id));
  if (result[0]) {
    data["ORG"] = result[1]["Name"];
    data["ORGID"] = id;
  }
  return data;
}

function startProcessing(f, fields, fundingcat, removeold, dry) { // CSVFILE, fields, fundingcat, removeold
  // process file
  var notfound = [];
  var found = [];
  var row = 0;
  // build GENMAP VALUES
  buildCustomGenMaps();
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      var ids = null;
      var field = fields["SchoolNum"];
      if (!field) {
        importlog("MISSING School No. FIELD.");
        return;
      }
      // If iMIS ID see that it exists.
      var ifield = fields["imisid"];
      if (ifield) {
        var uimisid = r["data"][0][ifield].trim();
        if (uimisid && getUserFromID(uimisid) == null) {
          importlog("WARNING: iMIS ID Not found for: {0}".format(uimisid));
        }
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
          found.push(OrgDataAppend(Object.assign({}, r["data"][0]), id));
          if (!dry && updateOrgData(id, fields, r["data"][0], fundingcat, removeold) === false) {
            p.abort();
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


var ASDATA = {
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "AVIC_AS_Data",
    "PrimaryParentEntityTypeName": "Party",
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
                "Name": "SchoolNum",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "OriginalAppEmail",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "OriginalAppFName",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ACH_Staff",
                "Value": {
                    "$type": "System.Int32",
                    "$value": 0
                }
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Area",
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
                "Name": "LGA",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Rating",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Region",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "SSV_REGION",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "Type",
                "Value": ""
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "TotalStudents",
                "Value": ""
            }
        ]
    }
}
ASCONTACT = {
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "PrimaryParentEntityTypeName": "Party",
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
                "Name": "Funding_Person_ID",
                "Value": {
                    "$type": "System.Int32",
                    "$value": 0
                }
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "FundingCategory",
                "Value": ""
            }
        ]
    }
}

// ["Staff iMIS ID", "simisid"]
function buildOrgData(id, values) {
  var obj = JSON.parse(JSON.stringify(ASDATA));
  genericProp(obj, "ID", id);
  setOrgData(obj, values);
  return obj;
}
function setOrgData(obj, values) {
  setgenericProp(obj, "SchoolNum", values["SchoolNum"]);
  if (values.hasOwnProperty("OriginalAppEmail")) { genericProp(obj, "OriginalAppEmail", values["OriginalAppEmail"]); }
  if (values.hasOwnProperty("OriginalAppFName")) { genericProp(obj, "OriginalAppFName", values["OriginalAppFName"]); }
  if (values.hasOwnProperty("ACH_Staff") && !isNaN(parseInt(values["ACH_Staff"])) ) { genericProp(obj, "ACH_Staff", parseInt(values["ACH_Staff"])); }
  if (values.hasOwnProperty("Type")) { setgenericProp(obj, "Type", values["Type"]); }
  if (values.hasOwnProperty("Rating")) { setgenericProp(obj, "Rating", values["Rating"]); }
  if (values.hasOwnProperty("Index")) {
    if(!isNaN(parseFloat(values["Index"]))) { genericProp(obj, "Index", parseFloat(values["Index"])); }
  }
  if (values.hasOwnProperty("TotalStudents")) {
    if(!isNaN(parseFloat(values["TotalStudents"]))) { genericProp(obj, "TotalStudents", parseFloat(values["TotalStudents"])); }
  }
  if (values.hasOwnProperty("Region")) { setgenericProp(obj, "Region", values["Region"]); }
  if (values.hasOwnProperty("LGA")) { setgenericProp(obj, "LGA", values["LGA"]); }
  if (values.hasOwnProperty("Area")) { genericProp(obj, "Area", values["Area"]); }
  if (values.hasOwnProperty("ssvregabb")) { genericProp(obj, "SSV_REGION", values["ssvregabb"]); }
}
function buildContactData(id, ent_type, contactid, id_prop, fundingcat) {
  var obj = JSON.parse(JSON.stringify(ASCONTACT));
  genericProp(obj, "ID", id);
  obj["EntityTypeName"] = ent_type
  if (contactid) {
    if (!isNaN(contactid)) { genericProp(obj, id_prop, parseInt(contactid, 10)); }
  }
  genericProp(obj, "FundingCategory", fundingcat);
  return obj;
}

function getFundingCats() {
  var params = [["TableName", "AVIC_AS_CATEGORY"]]
  var values = [];
  for(let i of apiIterator("/api/GenTable", params)) {
    values.push([i["Code"], i["Description"]]);
  }
  postMessage({
    type: "getFundingCats",
    data: values,
  });
}
