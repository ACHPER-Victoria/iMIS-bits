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

importScripts('/common/Uploaded%20files/Code/papaparse.min.js');
importScripts('/common/Uploaded%20files/Code/utils.js');

var token = null;

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'startProcessing':
        // console.log('Posting message back to main script');
        // generate CSVdata
        token = arg[0];
        startProcessing(arg[1], arg[2], arg[3], arg[4], arg[5]);
        break;
      default:
        console.error('invalid type passed in');
    }
};

function exportlog(s) {
  postMessage({
    type: "exportlog",
    data: s,
  });
}
var GEN_TABLES = [ "AVIC_AS_RATING", "SCHOOLTYPE", "AVIC_LGA", "REGION",
  "SUBREGION", "AVIC_AS_SSVREG", "AVIC_AS_NOTE_TYPE", "AVIC_AS_CATEGORY"
];
var GEN_MAP = {}; // table: {key:value}
var PROPTABLEMAP = {
  "Rating" : "AVIC_AS_RATING", "Type" : "SCHOOLTYPE", "LGA": "AVIC_LGA",
  "Region" : "REGION", "Area" : "SUBREGION", "SSV_REGION" : "AVIC_AS_SSVREG"
};

function getName(id) {
  if (id == 0 || id == "0") {return id; }
  var result = dorequest("/api/Party/{0}".format(id));
  if (result[0]) { return result[1]["Name"]; }
  else { return id; }
}
var ASDATA_MAPPING = {
  "AVIC_AS_DATA" : [
    ["Rating/Band", "Rating"], ["Index", "Index"], ["Type", "Type"],
    ["LGA", "LGA"], ["Region", "Region"], ["Area", "Area"],
    ["SchoolNumber", "SchoolNum"], ["SSV Region", "SSV_REGION"],
    ["School context", "SchoolContext"], ["PRI-ChangeNotes", "KeyPriorityNotes"]
  ]
};
var SCHOOLS = {}; // SchoolNum: SCHOOL_OBJ
var SCHOOL_OBJ = {
  "ID" : "",
  "School Name": "",
  "Rating/Band": "",
  "Index":"",
  "Type":"",
  "LGA":"",
  "Region": "",
  "Area": "",
  "SchoolNumber":"",
  "SSV Region": "",
  "School context":"",
  "PRI-ChangeNotes": "",
  "Engagement" : 0,
  "FC": {}
};
var AVIC_AS_DATA = {}; // id : {k:v}
var AVIC_AS_ACH_CONTACT = {};
var AVIC_AS_FUNDING_CONTACT = {};
var AVIC_AS_CHAMPS = {};
var AVIC_AS_KeyPriorities = {};
var AVIC_AS_Grant_Progress = {};
var AVIC_AS_Notes = {};
var AVIC_AS_AnecdotalNotes = {};

function cacheData(orgset, endpoint, dict, fc=null, date=null, dfrom=null, dto=null) {
  var iter = null;
  if (date == null) { iter = apiIterator("/api/{0}/".format(endpoint)); }
  else { iter = apiIterator("/api/{0}/".format(endpoint), [[date, "between:{0}|{1}".format(dfrom,dto)]])}
  for (let item of iter) {
    let entry = {};
    for (let prop of Object.values(item["Properties"]["$values"])) {
      if (prop["Value"].hasOwnProperty("$type")){ entry[prop["Name"]] = prop["Value"]["$value"];}
      else { entry[prop["Name"]] = prop["Value"]; }
    }
    if (fc == null ) { dict[entry["ID"]] = entry; }
    else {
      let ifc = entry[fc];
      if (ifc == "") { exportlog("ERROR: Missing Funding Category for {0} type in contact {1}".format(endpoint, entry["ID"])) }
      let key = "{0}-{1}".format(entry[fc], entry["ID"]);
      if (!dict.hasOwnProperty(key)) { dict[key] = []; }
      dict[key].push(entry);
    }
    orgset.add(entry["ID"]);
  }
}

function compareASData() {

}

function populateSchoolObj(org, inccontext, inckpn) {
  // get school num... if no school num school num is iMISprefix'd ID...
  let shnum = null;
  let id = org["Id"];
  if (AVIC_AS_DATA.hasOwnProperty(id)) { shnum = AVIC_AS_DATA[id]["SchoolNum"]; }
  if (shnum == null || shnum == "") {
    shnum = "iMIS-{0}".format(obj["ID"]);
  }
  var obj = JSON.parse(JSON.stringify(SCHOOL_OBJ));
  if (SCHOOLS.hasOwnProperty(shnum)) {
    obj = SCHOOLS[shnum];
  } else {
    obj["School Name"] = org["Name"];
    obj["ID"] = id;
    if (AVIC_AS_DATA.hasOwnProperty(obj["ID"])) {
      var dobj = AVIC_AS_DATA[obj["ID"]];
      for (let m of ASDATA_MAPPING["AVIC_AS_DATA"]) {
        if (m[0] == "School context" && !inccontext) { continue; }
        else if (m[0] == "PRI-ChangeNotes" && !inckpn) { continue; }
        if (PROPTABLEMAP.hasOwnProperty(m[1])) {
          obj[m[0]] = getGenPropDesc(GEN_MAP, PROPTABLEMAP[m[0]], dobj[m[1]]);
        } else {
          obj[m[0]] = dobj[m[1]];
        }
      }
    }
    SCHOOLS[shnum] = obj;
  }
  obj["School Name"] = org["Name"];

  return obj;
}
var FUNDING_CATEGORY = {
  "ID" : "",
  "School Name": "",
  "FC" : "",
  "ACHPER Staff Contact": [],
  "School Key Contact": [],
  "School Key Contact Role": [],
  "School Champion": [],
  "School Champion Role": [],
  "PRI_QualityPE": "",
  "PRI_ActiveClassrooms": "",
  "PRI_ActiveRecreation": "",
  "PRI_ActiveTravel": "",
  "PRI_SupportiveSchoolEnviron": "",
  "PRI_QualitySport": "",
  "CONTACT_Email": "",
  "CONTACT_Face to Face": "",
  "CONTACT_Other": "",
  "CONTACT_PD": "",
  "CONTACT_Phone": "",
  "CONTACT_Virtual meeting": "",
  "CONTACT_SUPPORT_ACQ": "",
  "CONTACT_SUPPORT_FC": "",
  "CONTACT_SUPPORT_IPD": "",
  "CONTACT_SUPPORT_OTH": "",
  "CONTACT_SUPPORT_PA": "",
  "CONTACT_SUPPORT_PD": "",
  "CONTACT_SUPPORT_PR": "",
  "CONTACT_SUPPORT_QF": "",
  "Anecdotes": [],
  "GRANT_AllFundsSpent": "",
  "GRANT_AllFundsSpentWhen":"",
  "GRANT_FundsSpent": "",
  "GRANT_AcquittalComplete": "",
  "GRANT_EXP_BIKEED": "",
  "GRANT_EXP_CAMPEX": "",
  "GRANT_EXP_CFURN": "",
  "GRANT_EXP_ECP": "",
  "GRANT_EXP_ESTAFF": "",
  "GRANT_EXP_FITEQ": "",
  "GRANT_EXP_IMPDEV": "",
  "GRANT_EXP_LASACT": "",
  "GRANT_EXP_LIMA": "",
  "GRANT_EXP_OTHER": "",
  "GRANT_EXP_PEPD": "",
  "GRANT_EXP_PLAYEQ": "",
  "GRANT_EXP_SENSE": "",
  "GRANT_EXP_SPORTEQ": "",
  "GRANT_EXP_TRA": "",
  "GRANT_Case_Study":""
};
var FUNDING_CATEGORIES = {}; // fc : {id: FC}
function bulkSetValue(obj, prefix, value) {
  for (let k of Object.keys(obj)) {
    if (k.startsWith(prefix)) { obj[k] = value; }
  }
}
var ITYPE_PROP_MAP = {
  "ACHPER Staff Contact": [AVIC_AS_ACH_CONTACT, "ACH_Staff_ID"],
  "School Key Contact": [AVIC_AS_FUNDING_CONTACT, "Funding_Person_ID"],
  "School Champion" : [AVIC_AS_CHAMPS, "Contact_ID"]
};
function getCreateFC(fc, schobj) {
  if (!FUNDING_CATEGORIES.hasOwnProperty(fc)) { FUNDING_CATEGORIES[fc] = {}; }
  if (!FUNDING_CATEGORIES[fc][schobj["ID"]]) {
    FUNDING_CATEGORIES[fc][schobj["ID"]] = populateFC(fc, schobj);
  }
  if (!schobj["FC"].hasOwnProperty(fc)) {
    schobj["FC"][fc] = FUNDING_CATEGORIES[fc][schobj["ID"]];
  } else { exportlog("Warning, school already has FC:" + fc); }
  return FUNDING_CATEGORIES[fc][schobj["ID"]];
}
function populateFC(fc, schobj){
  var obj = JSON.parse(JSON.stringify(FUNDING_CATEGORY));
  for (const [k,v] of Object.entries(schobj)) { // copy school obj values
    if (k == "FC") { continue; }
    obj[k] = v;
  }
  obj["FC"] = fc;
  // populate with all generic items. Update with date range stuff later
  for (let itype of ["ACHPER Staff Contact", "School Key Contact*", "School Champion*"]) {
    let list = [];
    let list2 = [];
    ttype = itype[itype.length-1];
    if (itype.includes("*")) { itype = itype.slice(0, -1); }
    //for (let achcon of apiIterator("/api/{0}".format(ITYPE_PROP_MAP[itype][0]), [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
    for (let achcon of dictget(ITYPE_PROP_MAP[itype][0], "{0}-{1}".format(fc, schobj["ID"]), [])) {
      list.push(getName(achcon[ITYPE_PROP_MAP[itype][1]]));
      if (ttype == "*") {
        list2.push(achcon["role"]);
      }
    }
    obj[itype] = list;
    if (ttype == "*") { obj[itype+ " Role"] = list2; }
  }
  let count = 0;
  // priorities AVIC_AS_KeyPriorities
  //for (let kpri of apiIterator("/api/AVIC_AS_KeyPriorities", [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
  for (let kpri of dictget(AVIC_AS_KeyPriorities, "{0}-{1}".format(fc, schobj["ID"]), [])) {
    count += 1;
    bulkSetValue(obj, "PRI_", 0);
    for (let kprop of Object.keys(kpri)) {
      if (["ID", "Ordinal", "FundingCategory"].includes(kprop)) { continue; }
      obj["PRI_"+kprop] = kpri[kprop];
    }
  }
  if (count > 1) { exportlog("ERROR: Multiple entries for KeyPriorities for School {0} in funding category {1}".format(schobj["ID"], fc)); }
  // Grant Infos AVIC_AS_Grant_Progress
  // if date == "0001-01-01T00:00:00" value = ""
  //for (let kpri of apiIterator("/api/AVIC_AS_Grant_Progress", [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
  count = 0;
  for (let grant of dictget(AVIC_AS_Grant_Progress, "{0}-{1}".format(fc, schobj["ID"]), [])) {
    count += 1;
    obj["GRANT_AllFundsSpent"] = grant["AllFundsSpent"];
    obj["GRANT_AllFundsSpentWhen"] = grant["AllFundsSpentWhen"] == "0001-01-01T00:00:00" ? "" : grant["AllFundsSpentWhen"];
    obj["GRANT_FundsSpent"] = grant["FundsSpentToDate"];
    obj["GRANT_AcquittalComplete"] = grant["AcquittalComplete"];
    obj["GRANT_Case_Study"] = grant["CaseStudyLink"];
    bulkSetValue(obj, "GRANT_EXP_", false);
    for (let kprop of grant["FundingExpenditures"].split(",")) {
      obj["GRANT_EXP_" + kprop] = true;
    }
  }
  if (count > 1) { exportlog("ERROR: Multiple entries for GrantProgress for School {0} in funding category {1}".format(schobj["ID"], fc)); }
  return obj;
}
function processNotesWithDate(fc, obj) {
  // contact history AVIC_AS_Notes
  //for (let note of apiIterator("/api/AVIC_AS_Notes", [["Funding_Type", fc], ["ID", obj["ID"]], ["Note_Date", "between:{0}|{1}".format(dfrom,dto)]])) {
  let iter = dictget(AVIC_AS_Notes, "{0}-{1}".format(fc, obj["ID"]), []);
  if (iter.length > 0 ) { bulkSetValue(obj, "CONTACT_", 0); }
  for (let note of iter) {
    let key = "CONTACT_"+getGenPropDesc(GEN_MAP, "AVIC_AS_NOTE_TYPE", note["Note_Type"]);
    if (!obj.hasOwnProperty(key)) { obj[key] = 0;}
    obj[key] += 1;
    for (let stype of note["TypesOfSupportOffered"].split(",")) {
      if (!obj.hasOwnProperty("CONTACT_SUPPORT_"+stype)) { obj["CONTACT_SUPPORT_"+stype] = 0;}
      obj["CONTACT_SUPPORT_"+stype] += 1; // Griff approves. thank amigo.
    }
  }
}
function processAnecdotesWithDate(fc, obj) {
  // contact history AVIC_AS_AnecdotalNotes
  let notes = [];
  //for (let note of apiIterator("/api/AVIC_AS_AnecdotalNotes", [["FundingCategory", fc], ["ID", obj["ID"]], ["Date", "between:{0}|{1}".format(dfrom,dto)]])) {
  for (let note of dictget(AVIC_AS_AnecdotalNotes, "{0}-{1}".format(fc, obj["ID"]), [])) {
    notes.push(note["Anecdote"]);
  }
  obj["Anecdotes"] = notes.join(" || ");
}

var BOSEARCH = [AVIC_AS_FUNDING_CONTACT, AVIC_AS_CHAMPS, AVIC_AS_KeyPriorities,
  AVIC_AS_Notes, AVIC_AS_AnecdotalNotes, AVIC_AS_Grant_Progress, AVIC_AS_ACH_CONTACT];

function checkFC(obj, fc) {
  for (let bo of BOSEARCH) {
    if (bo.hasOwnProperty("{0}-{1}".format(fc, obj["ID"]))) { return true; }
  }
  return false;
}
var STARTT = "";
function buildlistoforgs(dfrom, dto) {
  postMessage({type: "exporttotal", data: "Counting and gathering... (0/8 sets)"});
  const orgIDs = new Set();
  cacheData(orgIDs, "AVIC_AS_DATA", AVIC_AS_DATA, fc=null);
  postMessage({type: "exporttotal", data: "Counting and gathering... (1/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_ACH_CONTACT", AVIC_AS_ACH_CONTACT, fc="FundingCategory");
  postMessage({type: "exporttotal", data: "Counting and gathering... (2/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_FUNDING_CONTACT", AVIC_AS_FUNDING_CONTACT, fc="FundingCategory");
  postMessage({type: "exporttotal", data: "Counting and gathering... (3/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_CHAMPS", AVIC_AS_CHAMPS, fc="FundingCategory");
  postMessage({type: "exporttotal", data: "Counting and gathering... (4/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_KeyPriorities", AVIC_AS_KeyPriorities, fc="FundingCategory");
  postMessage({type: "exporttotal", data: "Counting and gathering... (5/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_Grant_Progress", AVIC_AS_Grant_Progress, fc="FundingCategory");
  postMessage({type: "exporttotal", data: "Counting and gathering... (6/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_Notes", AVIC_AS_Notes, fc="Funding_Type", "Note_Date", dfrom, dto);
  postMessage({type: "exporttotal", data: "Counting and gathering... (7/8 sets)"});
  cacheData(orgIDs, "AVIC_AS_AnecdotalNotes", AVIC_AS_AnecdotalNotes, fc="FundingCategory", "Date", dfrom, dto);
  postMessage({type: "exporttotal", data: orgIDs.size,});
  STARTT = Date.now();
  return orgIDs;
}

function startProcessing(start, end, incanec, inccontext, inckpn) {
  GEN_MAP = buildGenMaps(GEN_TABLES);
  let count = 0;
  // Iterate every Organisation
  // Look at AS_DATA BO... if no data for ID, look at AS_NOTES BO
  //for(let org of apiIterator("/api/Party", [["isOrganization", "true"], ["Status", "A"]])) {
  for (let id of buildlistoforgs(start, end)){
    count++;
    postMessage({type: "exportprogress", data: count,});
    // Build School Obj and put in mapping
    var schobj = populateSchoolObj(dorequest("/api/Party/{0}".format(id))[1], inccontext, inckpn);
    // iterate over funding categories
    for (let fc of Object.values(GEN_MAP["code"]["AVIC_AS_CATEGORY"])){
      // check if school has any data for this category worth making...
      if (!checkFC(schobj, fc)) { continue; }
      let schfc = getCreateFC(fc, schobj);
      processNotesWithDate(fc, schfc);
      if (incanec) { processAnecdotesWithDate(fc, schfc); }
    }
  }
  console.log("T: {0}".format(Date.now() - STARTT));

  sheets = {};
  for (let [fc, fcv] of Object.entries(FUNDING_CATEGORIES)) {
    sheets[fc] = Object.values(fcv);
  }
  for (let type of ["AS", "EC", "PEB"]){
    let funded21spent21 = [];
    let funded21nospend = [];
    let funded22 = [];
    let funded2122 = [];

    for (let schobj of Object.values(SCHOOLS)) {
      var t1 = type+"21";
      if (t1 == "AS21") { t1 = "AS"; }
      if (t1 == "PEB21") { t1 = "PEB"; }
      var t2 = type+"22";
      if (schobj["FC"].hasOwnProperty(t1) && (schobj["FC"][t1]["School Key Contact"].length > 0)
          && schobj["FC"].hasOwnProperty(t2) && (schobj["FC"][t2]["School Key Contact"].length > 0)) {
        funded2122.push(schobj["FC"][t1]);
        funded2122.push(schobj["FC"][t2]);
      } else if (schobj["FC"].hasOwnProperty(t2) && (schobj["FC"][t2]["School Key Contact"].length > 0)) {
        funded22.push(schobj["FC"][t2]);
      } else if (schobj["FC"].hasOwnProperty(t1) && (schobj["FC"][t1]["School Key Contact"].length > 0)) {
        // spent
        if (schobj["FC"][t1]["GRANT_AllFundsSpent"] || schobj["FC"][t1]["GRANT_AllFundsSpentWhen"] != "") {
          if (!(schobj["FC"][t1]["GRANT_AllFundsSpent"] && schobj["FC"][t1]["GRANT_AllFundsSpentWhen"] != "")) {
            exportlog("CAUTION: School {0}-{1} has only one property of 'GRANT_AllFundsSpent' or 'GRANT_AllFundsSpentWhen' populated. They both should be populated.".format(
              schobj["ID"], t1));
          }
          funded21spent21.push(schobj["FC"][t1]);
        } else {
          // not spent
          funded21nospend.push(schobj["FC"][t1]);
        }
      }
      // final check to see if 22 has spent fields correctly populated.
      if (schobj["FC"].hasOwnProperty(t2) && (schobj["FC"][t2]["School Key Contact"].length > 0)) {
        // spent
        if (schobj["FC"][t2]["GRANT_AllFundsSpent"] || schobj["FC"][t2]["GRANT_AllFundsSpentWhen"] != "") {
          if (!(schobj["FC"][t2]["GRANT_AllFundsSpent"] && schobj["FC"][t2]["GRANT_AllFundsSpentWhen"] != "")) {
            exportlog("CAUTION: School {0}-{1} has only one property of 'GRANT_AllFundsSpent' or 'GRANT_AllFundsSpentWhen' populated. They both should be populated.".format(
              schobj["ID"], t2));
          }
        }
      }
    }
    // add to sheets...
    sheets[type+"-funded2122"] = funded2122;
    sheets[type+"-funded22"] = funded22;
    sheets[type+"-funded21nospend"] = funded21nospend;
    sheets[type+"-funded21spent21"] = funded21spent21;
  }
  endProcessing(sheets)
}

function endProcessing(sheets) {
  // create CSV data for args
  var sheetdata = {}
  for (let [k,v] of Object.entries(sheets)) {
    sheetdata[k] = Papa.unparse(v);
  }
  postMessage({
    type: "endProcessing",
    data: sheetdata,
  });
}
