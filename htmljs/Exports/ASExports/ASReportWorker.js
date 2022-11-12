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

class NumberRef {
  constructor() {
    this.value = "";
  }
  updateValue(nv) {
    this.value = nv;
  }
  increment(inc=1) {
    if (this.value == "") { this.value = 0; }
    this.value += inc;
  }
  valueOf() { return this.value; }
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

PID_TO_Name = {};
function getName(id) {
  if (id == 0 || id == "0") {return id; }
  if (PID_TO_Name.hasOwnProperty(id)) { return PID_TO_Name[id]; }
  var result = dorequest("/api/Party/{0}".format(id));
  if (result[0]) {
    PID_TO_Name[id] = result[1]["Name"];
    PIDtoOID(id, result);
    return result[1]["Name"];
  } else { return id; }
}
var ASDATA_MAPPING = {
  "AVIC_AS_DATA" : [
    ["Rating/Band", "Rating"], ["Index", "Index"], ["Type", "Type"],
    ["LGA", "LGA"], ["Region", "Region"], ["Area", "Area"], // ["SchoolNumber", "SchoolNum"]
    ["SSV Region", "SSV_REGION"], ["TotalStudents", "TotalStudents"],
    ["School context", "SchoolContext"], ["PRI-ChangeNotes", "KeyPriorityNotes"],
    ["TotalFunding21", "TotalFunding21"], ["TotalFunding22", "TotalFunding22"],
  ]
};
var SCHOOLS = {}; // SchoolNum: SCHOOL_OBJ
var SCHOOL_OBJ = {
  "IDs" : [],
  "School Names": [],
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
  "Funded": "",
  "TotalStudents" : "",
  "COM_Discussion Post" : new NumberRef(),
  "COM_Discussion View" : new NumberRef(),
  "COM_Resource Posted" : new NumberRef(),
  "COM_Resource View" : new NumberRef(),
  "FC": {}
};
var PID_TO_OID = {}; // PersonID : OrgID  (maybe schoolID instead?)
var AVIC_AS_DATA = {}; // id : {k:v}
var AVIC_AS_ACH_CONTACT = {};
var AVIC_AS_FUNDING_CONTACT = {};
var AVIC_AS_CHAMPS = {};
var AVIC_AS_KeyPriorities = {};
var AVIC_AS_Grant_Progress = {};
var AVIC_AS_Notes = {};
var AVIC_AS_AnecdotalNotes = {};
var ContactInteraction = {};

function PIDtoOID(pid, obj=null) {
  if (pid == 0 || pid == "0" || pid == "") { return "-1"; }
  if (PID_TO_OID.hasOwnProperty(pid)) { return PID_TO_OID[pid]; }
  if (obj == null) {obj = dorequest("/api/Party/{0}".format(pid)); }
  if (obj[0]) {
    if (!PID_TO_Name.hasOwnProperty(pid)) { PID_TO_Name[pid] = obj[1]["Name"]; }
    if (obj[1].hasOwnProperty("PrimaryOrganization") && obj[1]["PrimaryOrganization"].hasOwnProperty("OrganizationPartyId")) {
        PID_TO_OID[pid] = obj[1]["PrimaryOrganization"]["OrganizationPartyId"];
    } else { PID_TO_OID[pid] = "-1"; }
  } else { PID_TO_OID[pid] = "-1"; }
  return PID_TO_OID[pid];
}

function cacheData(orgset, endpoint, dict, fc=null, date=null, dfrom=null, dto=null) {
  var iter = null;
  if (date == null) { iter = apiIterator("/api/{0}/".format(endpoint)); }
  else if (endpoint == "ContactInteraction") {
    iter = apiIterator("/api/{0}/".format(endpoint), [[date, "between:{0}|{1}".format(dfrom,dto)],
    ["InteractionActionCode", "ne:COMMUNITYMEMBERJOIN"], ["InteractionActionCode", "ne:COMMUNITYMEMBERLEAVE"],
    ["InteractionActionCode", "ne:COMMUNITYDISCUSSIONSVIEW"], ["InteractionTypeCode", "HL"]]);
  } else { iter = apiIterator("/api/{0}/".format(endpoint), [[date, "between:{0}|{1}".format(dfrom,dto)]]); }
  if (endpoint == "ContactInteraction") {
    for (let item of iter) {
      let entry = {};
      for (let [k,v] of Object.entries(item)) {
        if (k == "UpdateInformation") { continue; }
        entry[k] = v;
      }
      // check id
      let oid = entry["PrimaryOrganizationPartyId"];
      if (oid == "") {
        oid = PIDtoOID(entry["PartyId"]);
      }
      if (oid != "" && oid != "-1") {
        if (!dict.hasOwnProperty(oid)) { dict[oid] = []; }
        dict[oid].push(entry);
        orgset.add(oid);
      }
    }
  } else {
    for (let item of iter) {
      let entry = {};
      for (let prop of Object.values(item["Properties"]["$values"])) {
        if (prop["Value"].hasOwnProperty("$type")){ entry[prop["Name"]] = prop["Value"]["$value"];}
        else { entry[prop["Name"]] = prop["Value"]; }
      }
      if (fc == null ) { dict[entry["ID"]] = entry; }
      else {
        let ifc = entry[fc];
        if (ifc == "") { exportlog("ERROR: Missing Funding Category for {0} type in contact {1}".format(endpoint, entry["ID"])); }
        let key = "{0}-{1}".format(entry[fc], entry["ID"]);
        if (!dict.hasOwnProperty(key)) { dict[key] = []; }
        dict[key].push(entry);
      }
      orgset.add(entry["ID"]);
    }
  }
}

function compareASData(obj1, obj2) {
  for (let [k,v] of Object.entries(obj1)) {
    if (k == "FC" || k == "Funded2122" || k.startsWith("COM_")) { continue; }
    if (k == "IDs" || k == "School Names") {
      obj1[k].push(obj2[k][0]);
      continue;
    }
    if (v == "" && obj2[k] != "") {
      obj1[k] = obj2[k]; v = obj1[k];
    }
    if (v != obj2[k] && obj2[k] != "") {
      exportlog("WARNING: 2 Contacts share same DET school. {0} has a different value for {1}. Using {2}'s".format(obj1["IDs"].join(","), k, obj2["IDs"][0]));
      obj1[k] = obj2[k];
    }
  }
  return obj1;
}

function populateSchoolObj(org, inccontext, inckpn) {
  // get school num... if no school num school num is iMISprefix'd ID...
  let shnum = null;
  let id = org["Id"];
  if (AVIC_AS_DATA.hasOwnProperty(id)) { shnum = AVIC_AS_DATA[id]["SchoolNum"]; }
  if (shnum == null || shnum == "") {
    shnum = "iMIS-{0}".format(id);
  }
  var obj = JSON.parse(JSON.stringify(SCHOOL_OBJ));
  // remake COM_ properties... "COM_Discussion Post" : new NumberRef(),
  for (let k of Object.keys(obj)) { if (k.startsWith("COM_")) { obj[k] = new NumberRef(); }}
  obj["SchoolNumber"] = shnum;
  obj["School Names"].push(org["Name"]);
  obj["IDs"].push(id);
  if (AVIC_AS_DATA.hasOwnProperty(id)) {
    var dobj = AVIC_AS_DATA[id];
    for (let m of ASDATA_MAPPING["AVIC_AS_DATA"]) {
      if (m[0] == "School context" && !inccontext) { continue; }
      else if (m[0] == "PRI-ChangeNotes" && !inckpn) { continue; }
      if (PROPTABLEMAP.hasOwnProperty(m[1])) {
        obj[m[0]] = getGenPropDesc(GEN_MAP, PROPTABLEMAP[m[0]], dobj[m[1]]);
      } else {
        obj[m[0]] = dobj[m[1]];
      }
    }
    // compare objs
    if (SCHOOLS.hasOwnProperty(shnum)) {
      obj = compareASData(SCHOOLS[shnum], obj);
    }
  }
  SCHOOLS[shnum] = obj;
  return obj;
}
var FUNDING_CATEGORY = {
  "IDs" : [],
  "SchoolNumber":"",
  "School Names": [],
  "FC" : "",
  "Funded": "",
  "ACHPER Staff Contact": [],
  "PRI_QualityPE": "",
  "PRI_ActiveClassrooms": "",
  "PRI_ActiveRecreation": "",
  "PRI_ActiveTravel": "",
  "PRI_SupportiveSchoolEnviron": "",
  "PRI_QualitySport": "",
  "PRI-ChangeNotes": "",
  "School Key Contact": [],
  "School Key Contact Role": [],
  "School Champion": [],
  "School Champion Role": [],
  "CONTACT_Email": "",
  "CONTACT_Face to Face": "",
  "CONTACT_Phone": "",
  "CONTACT_Virtual meeting": "",
  "CONTACT_Other": "",
  "CONTACT_SUPPORT_ACQ": "",
  "CONTACT_SUPPORT_FC": "",
  "CONTACT_SUPPORT_IPD": "",
  "CONTACT_SUPPORT_PR": "",
  "CONTACT_SUPPORT_QF": "",
  "CONTACT_SUPPORT_PA": "",
  "CONTACT_SUPPORT_PD": "",
  "CONTACT_SUPPORT_AP": "",
  "CONTACT_SUPPORT_SS": "",
  "CONTACT_SUPPORT_CI": "",
  "CONTACT_SUPPORT_OTH": "",
  "CONTACT_PD": "",
  "CONTACT_PDR": "",
  "CONTACT_PDW": "",
  "CONTACT_PDM": "",
  "CONTACT_PD_Attendees": "",
  "CONTACT_PDR_Attendees": "",
  "CONTACT_PDW_Attendees": "",
  "CONTACT_PDM_Attendees": "",
  "GRANT_AllFundsSpent": "",
  "GRANT_AllFundsSpentWhen":"",
  "GRANT_FundsReceivedForThisFC": "",
  "TotalFunding21" : "",
  "TotalFunding22" : "",
  "TotalFunding" : "",
  "GRANT_FundsSpent": "",
  "GRANT_ActionPlanURL": "",
  "GRANT_ImplementationAuditComplete": "",
  "GRANT_MidYearProgressReport": "",
  "GRANT_AcquittalComplete": "",
  "GRANT_Case_Study":"",
  "GRANT_EXP_BKEDEQ": "",
  "GRANT_EXP_BKINF": "",
  "GRANT_EXP_BKPATH": "",
  "GRANT_EXP_CAMP": "",
  "GRANT_EXP_CLASS": "",
  "GRANT_EXP_CRT": "",
  "GRANT_EXP_CURRIC": "",
  "GRANT_EXP_EFEES": "",
  "GRANT_EXP_EXT": "",
  "GRANT_EXP_FITEQ": "",
  "GRANT_EXP_LINE": "",
  "GRANT_EXP_LUNEQ": "",
  "GRANT_EXP_LUNACT": "",
  "GRANT_EXP_PLAYEQ": "",
  "GRANT_EXP_PMPEQ": "",
  "GRANT_EXP_PROMO": "",
  "GRANT_EXP_SENSEQ": "",
  "GRANT_EXP_SPEQ": "",
  "GRANT_EXP_SPGOAL": "",
  "GRANT_EXP_SPUNI": "",
  "GRANT_EXP_STAFFPD": "",
  "GRANT_EXP_TSTOREQ": "",
  "GRANT_EXP_TRANS": "",
  "Anecdotes": "",
  "SupportingIn22" : "",
  "Rating/Band": "",
  "Index":"",
  "Type":"",
  "LGA":"",
  "Region": "",
  "Area": "",
  "SSV Region": "",
  "School context":"",
  "TotalStudents" : "",
  "COM_Discussion Post" : "",
  "COM_Discussion View" : "",
  "COM_Resource Posted" : "",
  "COM_Resource View" : ""
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
  if (!FUNDING_CATEGORIES[fc][schobj["SchoolNumber"]]) {
    FUNDING_CATEGORIES[fc][schobj["SchoolNumber"]] = newFC(fc, schobj);
  }
  if (!schobj["FC"].hasOwnProperty(fc)) {
    schobj["FC"][fc] = FUNDING_CATEGORIES[fc][schobj["SchoolNumber"]];
  } else {  } //exportlog("Warning, school already has FC:" + fc);
  return FUNDING_CATEGORIES[fc][schobj["SchoolNumber"]];
}

function newFC(fc, schobj) {
  var obj = JSON.parse(JSON.stringify(FUNDING_CATEGORY));
  for (const [k,v] of Object.entries(schobj)) { // copy school obj values
    if (k == "FC") { continue; }
    obj[k] = v;
  }
  obj["FC"] = fc;
  return obj;
}
function populateFC(fc, obj, id) {
  // populate with all generic items. Update with date range stuff later
  for (let itype of ["ACHPER Staff Contact", "School Key Contact*", "School Champion*"]) {
    ttype = itype[itype.length-1];
    if (itype.includes("*")) { itype = itype.slice(0, -1); }
    //for (let achcon of apiIterator("/api/{0}".format(ITYPE_PROP_MAP[itype][0]), [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
    for (let achcon of dictget(ITYPE_PROP_MAP[itype][0], "{0}-{1}".format(fc, id), [])) {
      let n = getName(achcon[ITYPE_PROP_MAP[itype][1]]);
      if (!obj[itype].includes(n)) {
        obj[itype].push(n);
        if (ttype == "*") {
          obj[itype+ " Role"].push(achcon["Role"]);
        }
      }
      // set supportingin22 data
      if (itype == "School Key Contact") {
        obj["SupportingIn22"] = achcon["SupportingIn22"];
      }
    }
  }
  let count = 0;
  // priorities AVIC_AS_KeyPriorities
  //for (let kpri of apiIterator("/api/AVIC_AS_KeyPriorities", [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
  for (let kpri of dictget(AVIC_AS_KeyPriorities, "{0}-{1}".format(fc, id), [])) {
    count += 1;
    bulkSetValue(obj, "PRI_", 0);
    for (let kprop of Object.keys(kpri)) {
      if (["ID", "Ordinal", "FundingCategory"].includes(kprop)) { continue; }
      if (obj["PRI_"+kprop] != "") {
        if (obj["PRI_"+kprop] == false && kpri[kprop] == true) {
          obj["PRI_"+kprop] = kpri[kprop];
          exportlog("Warning: Multiple Contact Cards for DET SchoolNo. {0} have different KeyPriorities for School {1} in funding category {2}. Merging true values. Probably should only have one contact card with Priority values.".format(obj["SchoolNumber"], id, fc));
        }
      } else { obj["PRI_"+kprop] = kpri[kprop]; }
    }
  }
  if (count > 1) { exportlog("ERROR: Multiple entries for KeyPriorities for School {0} in funding category {1}".format(id, fc)); }
  // Grant Infos AVIC_AS_Grant_Progress
  // if date == "0001-01-01T00:00:00" value = ""
  //for (let kpri of apiIterator("/api/AVIC_AS_Grant_Progress", [["FundingCategory", fc], ["ID", schobj["ID"]]])) {
  if (obj["GRANT_FundsSpent"] != "") {
    exportlog("ERROR: Already recorded grant info FC {0} for DET SchoolNo. {1}. Currently attempting to process Contact ID: {2}".format(fc, obj["SchoolNumber"], id));
    return obj;
  }
  count = 0;
  for (let grant of dictget(AVIC_AS_Grant_Progress, "{0}-{1}".format(fc, id), [])) {
    count += 1;
    obj["GRANT_AllFundsSpent"] = grant["AllFundsSpent"];
    obj["GRANT_AllFundsSpentWhen"] = grant["AllFundsSpentWhen"] == "0001-01-01T00:00:00" ? "" : grant["AllFundsSpentWhen"];
    obj["GRANT_FundsSpent"] = grant["FundsSpentToDate"];
    obj["GRANT_FundsReceivedForThisFC"] = grant["FundingReceivedForThisFC"];
    obj["GRANT_AcquittalComplete"] = grant["AcquittalComplete"];
    obj["GRANT_Case_Study"] = grant["CaseStudyLink"];
    obj["GRANT_ActionPlanURL"] = grant["ActionPlanURL"];
    obj["GRANT_ImplementationAuditComplete"] = grant["ImplementationAuditComplete"];
    obj["GRANT_MidYearProgressReport"] = grant["MidYearProgressReport"];
    bulkSetValue(obj, "GRANT_EXP_", false);
    for (let kprop of grant["FundingExpenditures"].split(",")) {
      obj["GRANT_EXP_" + kprop] = true;
    }
  }
  if (count > 1) { exportlog("ERROR: Multiple entries for GrantProgress for Contact ID {0} in funding category {1}".format(id, fc)); }
  return obj;
}
var PD_NOTES = ["PD", "PDR", "PDW", "PDM"];
// "CONTACT_PD_Attendees": "",
// "CONTACT_PDR_Attendees": "",
// "CONTACT_PDW_Attendees": "",
function processNotesWithDate(fc, obj, id) {
  // contact history AVIC_AS_Notes
  //for (let note of apiIterator("/api/AVIC_AS_Notes", [["Funding_Type", fc], ["ID", obj["ID"]], ["Note_Date", "between:{0}|{1}".format(dfrom,dto)]])) {
  let iter = dictget(AVIC_AS_Notes, "{0}-{1}".format(fc, id), []);
  if (iter.length > 0 && obj["CONTACT_Email"] === "") { bulkSetValue(obj, "CONTACT_", 0); }
  for (let note of iter) {
    let key = "";
    if (PD_NOTES.includes(note["Note_Type"])) { // check for attendee numbers
      key = "CONTACT_"+note["Note_Type"];
      if (!obj.hasOwnProperty(key+"_Attendees")) { obj[key+"_Attendees"] = 0; }
      obj[key+"_Attendees"] += note["PD_Attendees"];
    } else {
      key = "CONTACT_"+getGenPropDesc(GEN_MAP, "AVIC_AS_NOTE_TYPE", note["Note_Type"]);
    }
    if (!obj.hasOwnProperty(key)) { obj[key] = 0;}
    obj[key] += 1;
    for (let stype of note["TypesOfSupportOffered"].split(",")) {
      if (!obj.hasOwnProperty("CONTACT_SUPPORT_"+stype)) { obj["CONTACT_SUPPORT_"+stype] = 0;}
      obj["CONTACT_SUPPORT_"+stype] += 1; // Griff approves. thank amigo.
    }
  }
}
var COM_TABLE = {
  "MESSAGETHREADCREATE" : "COM_Discussion Post",
  "DISCUSSIONMESSAGEREPLY" : "COM_Discussion Post",
  "MESSAGETHREADVIEW" : "COM_Discussion View",
  "LIBRARYENTRYVIEW" : "COM_Resource View",
  "LIBRARYENTRYCREATE": "COM_Resource Posted"
};
function processCommunityData(schobj, id) {
  // ContactInteraction
  let iter = dictget(ContactInteraction, id, []);
  for (let con of iter) {
    // check if one of COM_TABLE:
    if (COM_TABLE.hasOwnProperty(con["InteractionActionCode"])) {
      if (con["InteractionActionCode"] == "LIBRARYENTRYCREATE" &&
            !con["Description"].endsWith('"')) {
        // ommit items unless has trailing " to signify root library.
        continue;
      }
      if (con["InteractionActionCode"] == "LIBRARYENTRYVIEW" &&
            con["Description"].includes('"RE: ')) {
        // ommit items that have "RE:  in them, suggesting attachment in a thread.
        continue;
      }
      schobj[COM_TABLE[con["InteractionActionCode"]]].increment();
    }
  }
}
function processAnecdotesWithDate(fc, obj, id) {
  // contact history AVIC_AS_AnecdotalNotes
  let notes = [];
  //for (let note of apiIterator("/api/AVIC_AS_AnecdotalNotes", [["FundingCategory", fc], ["ID", obj["ID"]], ["Date", "between:{0}|{1}".format(dfrom,dto)]])) {
  for (let note of dictget(AVIC_AS_AnecdotalNotes, "{0}-{1}".format(fc, id), [])) {
    notes.push(note["Anecdote"]);
  }
  obj["Anecdotes"] = notes.join(" || ");
}

var BOSEARCH = [AVIC_AS_FUNDING_CONTACT, AVIC_AS_CHAMPS, AVIC_AS_KeyPriorities,
  AVIC_AS_Notes, AVIC_AS_AnecdotalNotes, AVIC_AS_Grant_Progress, AVIC_AS_ACH_CONTACT];

function checkFC(id, fc) {
  for (let bo of BOSEARCH) {
    if (bo.hasOwnProperty("{0}-{1}".format(fc, id))) { return true; }
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
  postMessage({type: "exporttotal", data: "Counting and gathering... (8/8 sets)"});
  cacheData(orgIDs, "ContactInteraction", ContactInteraction, fc=null, "InteractionDate", dfrom, dto);
  postMessage({type: "exporttotal", data: orgIDs.size,});
  STARTT = Date.now();
  return orgIDs;
}

var FCYR = { "AS22" : "AS", "EC22": "EC21", "PEB22": "PEB" };

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
    // as soon as school object is got, process communication data that's bound to the school for current contact ID
    processCommunityData(schobj, id);
    // iterate over funding categories
    for (let fc of Object.values(GEN_MAP["code"]["AVIC_AS_CATEGORY"])){
      // check if school has any data for this category worth making...
      if (!checkFC(id, fc)) { continue; }
      let schfc = getCreateFC(fc, schobj);
      populateFC(fc, schfc, id);
      processNotesWithDate(fc, schfc, id);
      if (incanec) { processAnecdotesWithDate(fc, schfc, id); }
    }
  }
  console.log("T: {0}".format(Date.now() - STARTT));
  //prepare sheets...
  let sheets = {};
  sheets["alldata"] = [];
  // sheets["funded21spent21"] = [];
  // sheets["funded21nospend"] = [];
  // sheets["funded22"] = [];
  // sheets["funded2122"] = [];
  // sheets["funded2122"].push(schobj["FC"][t1]);

  // process "Funded2122" attribute.
  for (let sch of Object.values(SCHOOLS)) {
    // check for schobj's with no FC's. Create empty FC for NF schools with com data
    if (Object.keys(sch["FC"]) == 0) {
      getCreateFC("NF", sch);
    }

    for (let [fy2,fy1] of Object.entries(FCYR)) {
      if (sch["FC"].hasOwnProperty(fy2) && (sch["FC"][fy2]["School Key Contact"].length > 0) &&
          sch["FC"].hasOwnProperty(fy1) && (sch["FC"][fy1]["School Key Contact"].length > 0)) {
        sch["FC"][fy2]["Funded"] = "2122";
        sch["FC"][fy1]["Funded"] = "2122";
      } else if (sch["FC"].hasOwnProperty(fy2) && (sch["FC"][fy2]["School Key Contact"].length > 0)) {
        sch["FC"][fy2]["Funded"] = "22";
      } else if (sch["FC"].hasOwnProperty(fy1) && (sch["FC"][fy1]["School Key Contact"].length > 0)) {
        sch["FC"][fy1]["Funded"] = "21";
      }
      for (let fyi of [fy2, fy1]) {
        if (sch["FC"].hasOwnProperty(fyi) && (sch["FC"][fyi]["School Key Contact"].length > 0)) {
          if (sch["FC"][fyi]["GRANT_AllFundsSpent"] && sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] != "" && sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] < "2022-01-01T00:00:00") {
            sch["FC"][fyi]["Spent"] = "21";
          } else if (sch["FC"][fyi]["GRANT_AllFundsSpent"] && sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] != "") {
            sch["FC"][fyi]["Spent"] = "22";
          }
          // check and log incorrect data entry:
          if ((sch["FC"][fyi]["GRANT_AllFundsSpent"] && sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] == "") ||
              (!sch["FC"][fyi]["GRANT_AllFundsSpent"] && sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] != "")) {
            exportlog("CAUTION: School {0}-{1} has only one property of 'GRANT_AllFundsSpent' or 'GRANT_AllFundsSpentWhen' populated. They both should be populated.".format(
              sch["SchoolNumber"], fyi));
          }
        } else {
          // not funded school but has grant entry?
          if (sch["FC"].hasOwnProperty(fyi) && (sch["FC"][fyi]["GRANT_AllFundsSpent"] || sch["FC"][fyi]["GRANT_AllFundsSpentWhen"] != "")) {
            exportlog("CAUTION: NON FUNDED SCHOOL (no key contact) School {0}-{1} has Grant funds spent populated. This probably shouldn't be the case.".format(
              sch["SchoolNumber"], fyi));
          }
        }
      }
    }
  }
  // process contacts to merge list in to string, also flatten NumberRef obj
  for (let fc of Object.values(FUNDING_CATEGORIES)) {
    for (let fcobj of Object.values(fc)) {
      for (let k of ["IDs", "School Names", "ACHPER Staff Contact", "School Key Contact", "School Key Contact Role",
          "School Champion", "School Champion Role"]) {
        fcobj[k] = fcobj[k].join("\n");
      }
      fcobj["TotalFunding"] = parseInt(fcobj["TotalFunding21"],10) + parseInt(fcobj["TotalFunding22"],10);
      for (let cv of new Set(Object.values(COM_TABLE))) {
        fcobj[cv] = fcobj[cv].value;
      }
    }
  }
  for (let [fc, fcv] of Object.entries(FUNDING_CATEGORIES)) {
    sheets["alldata"] = sheets["alldata"].concat(Object.values(fcv));
  }
  endProcessing(sheets);
}

function endProcessing(sheets) {
  // create CSV data for args
  var sheetdata = {};
  for (let [k,v] of Object.entries(sheets)) {
    sheetdata[k] = Papa.unparse(v);
  }
  postMessage({
    type: "endProcessing",
    data: sheetdata,
  });
}
