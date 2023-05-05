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

const self = this;
onmessage = function(e) {
  const data = e.data;
  const type = data.type;
  const arg = data.arg;
  // console.log('Message received from main script');
  if (type in self) { postMessage({ type: type, data: self[type](arg)}); }
  else { console.error('Invalid Worker type passed in'); }
};

var token = null;
importScripts('/common/Uploaded%20files/Code/utils.js');

function setToken(data) { token = data; }
function log(s) { postMessage({ type: "exportlog", data: s}); }
function setTotal(i) { postMessage({ type: "updateTotal", data: i}); }
function setProgress(i) { postMessage({ type: "updateProgress", data: i}); }
function getNameFromID(id) {
  resp = dorequest("/api/Party/{0}".format(id));
  if (resp[0]) { return resp[1]["Name"]; }
  else { return ""; }
}

function getMySchools(id) {
  let schools = [];
  for(let objdata of apiIterator("/api/AVIC_AS_MYSCHOOLS", [["ID", id],])) {
    let sid = genericProp(objdata, "IMISID");
    let listname = genericProp(objdata, "ListName");
    let name = getNameFromID(sid);
    let displaylistname = "";
    if (listname) { displaylistname = " - {0}".format(listname); }
    schools.push([sid, "{0} ({1}){2}".format(name, sid, displaylistname), listname]);
  }
  schools.sort( (a,b) => { if (a[1] < b[1]) return -1; else if (a[1] > b[1]) return 1; else return 0; });
  return schools;
}

function getGenTableItems(table) {
  let items = [];
  for(let objdata of apiIterator("/api/GenTable", [["TableName", table]])) {
    let code = objdata["Code"];
    let name = objdata["Description"];
    items.push([code, name]);
  }
  return items;
}
function getContactTypes() { return getGenTableItems("AVIC_AS_NOTE_TYPE"); }
function getFCs() { return getGenTableItems("AVIC_AS_CATEGORY"); }
function getStaff() { return getGenTableItems("AVIC_AS_STAFF"); }
function getSupportTypes() { return getGenTableItems("AVIC_AS_SUPPORTOFFER"); }

function idExists(id) {
  resp = dorequest("/api/Party/{0}".format(id));
  if (resp[0] && resp[1]["Status"]["PartyStatusId"] == "A") { return true; }
  else { return false; }
}
function startProcessing(data) {
  // check school ids
  let extraschools = data["extraschools"].split(",");
  // remove blank entry
  extraschools = extraschools.filter(a=>{return a != "";});
  if (!data["myschools"].every((a)=>{ return idExists(a); })) { return log("Error: A school in MySchools was not found. Please check your MySchools Page and make sure all entries show a name."); }
  if (!extraschools.every((a)=>{ return idExists(a); })) { return log("Error: A school in Extra Schools was not found. Please check that the IDs you have provided in the Extra Schools field are correct."); }
  // check that there is a Date
  // set counter(s)
  let schools = new Set(extraschools.concat(data["myschools"]));
  setTotal(schools.size);
  if (!data["startdate"]) { return log("Error: Missing date."); }
  // Check that there is a contact type
  if (!data["contacttype"]) { return log("Error: Missing Type of contact."); }
  // Check that IF there are attendees, that it is a PD type
  if (data["pdattendees"] && !data["contacttype"].every(a=>{ return a.startsWith("PD");})) {
    return log("Error: pdattendees entered, but a non PD contact type was selected.");
  } else {
    if (data["pdattendees"] == "") { data["pdattendees"] = 0; }
    else {
      data["pdattendees"] = parseInt(data["pdattendees"]);
      if (isNaN(data["pdattendees"])) { return log("PD Attendees is not a number. Either leave it blank or correct the typo."); }
    }
  }
  // Check that there is an FC
  if (!data["fc"]) { return log("Error: Missing Funding Category."); }
  // Check that there is a staff member
  if (!data["staff"]) { return log("Error: Missing Staff."); }
  if (!idExists(data["staff"])) { return log("Error: Staff ID invalid."); }
  // don't care if supports offered
  // don't care if summary or not.
  let count = 0;
  // modify template
  setupTemplate(data["fc"], data["summary"], data["startdate"], data["contacttype"],
    data["pdattendees"], data["staff"], data["supporttypes"]);
  //iterate... GOGOGOGO
  for (const schid of schools) {
    if (!postnote(notecopy(NOTE_TEMPLATE, schid))) { return; }
    count++;
    setProgress(count);
  }
  log("Process complete.");
}

function setupTemplate(fundingtype, note, notedate, notetype, pdattendees,
  staff, supporttypes) {
  genericProp(NOTE_TEMPLATE, "Funding_Type", fundingtype.join(","));
  genericProp(NOTE_TEMPLATE, "Note", note);
  genericProp(NOTE_TEMPLATE, "Note_Date", "{0}T00:00:00".format(notedate));
  genericProp(NOTE_TEMPLATE, "Note_Type", notetype);
  genericProp(NOTE_TEMPLATE, "PD_Attendees", pdattendees);
  genericProp(NOTE_TEMPLATE, "Staff", staff);
  genericProp(NOTE_TEMPLATE, "TypesOfSupportOffered", supporttypes.join(","));
}
function notecopy(note, id) {
  let obj = JSON.parse(JSON.stringify(note));
  genericProp(obj, "ID", id);
  return obj;
}
function postnote(note) {
  var result = dorequest("/api/AVIC_AS_Notes", null, null, [], note, "POST");
  if (!result[0]) {
    log("Error: " + result[1]);
    return false;
  } else { return true; }
}
NOTE_TEMPLATE = {
  "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
  "EntityTypeName": "AVIC_AS_Notes",
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
              "Name": "Funding_Type",
              "Value": ""
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "Note",
              "Value": ""
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "Note_Date",
              "Value": "0000-00-00T00:00:00"
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "Note_Type",
              "Value": ""
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "PD_Attendees",
              "Value": {
                  "$type": "System.Int32",
                  "$value": 0
              }
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "Staff",
              "Value": ""
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "TypesOfSupportOffered",
              "Value": ""
          }
      ]
  }
}
