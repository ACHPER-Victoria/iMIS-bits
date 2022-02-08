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

importScripts('/common/Uploaded%20files/Code/papaparse.min.js')
importScripts('/common/Uploaded%20files/Code/utils.js')

var eventid = null;
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
        startProcessing(arg[1], arg[2]);
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function exportlog(s) {
  postMessage({
    type: "exportlog",
    data: s,
  });
}
SCHOOLS = {} // ID: SCHOOL_OBJ
SCHOOL_OBJ = {
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
  "PRI_ChangeNotes"
}
FUNDING_CATEGORIES = {}
FUNDING_CATEGORY = {
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
  "ACHPER Staff Contact": [],
  "School Key Contact": [],
  "School Key Contact Role": [],
  "School Champions": [],
  "School Champion Role": [],
  "PRI_QualityPE":"No",
  "PRI_ActiveClassrooms":"No",
  "PRI_ActiveRecreation":"No",
  "PRI_ActiveTravel":"No",
  "PRI_SupportiveSchoolEnviron":"No",
  "PRI_QualitySport":"No",
  "CONTACT_Email":0,
  "CONTACT_Face2Face":0,
  "CONTACT_Other":0,
  "CONTACT_PD":0,
  "CONTACT_Phone":0,
  "CONTACT_VirtMeeting":0,
  "CONTACT_SUPPORT_ACQ":0,
  "CONTACT_SUPPORT_FC":0,
  "CONTACT_SUPPORT_IPD":0,
  "CONTACT_SUPPORT_OTH":0,
  "CONTACT_SUPPORT_PA":0,
  "CONTACT_SUPPORT_PD":0,
  "CONTACT_SUPPORT_PR":0,
  "CONTACT_SUPPORT_QF":0,
  "Anecdotes": [],
  "GRANT_AllFundsSpent":false,
  "GRANT_FundsSpent":0,
  "GRANT_AcquittalComplete":false,
  "GRANT_EXP_BIKEED":false,
  "GRANT_EXP_CAMPEX":false,
  "GRANT_EXP_CFURN":false,
  "GRANT_EXP_ECP":false,
  "GRANT_EXP_ESTAFF":false,
  "GRANT_EXP_FITEQ":false,
  "GRANT_EXP_IMPDEV":false,
  "GRANT_EXP_LASACT":false,
  "GRANT_EXP_LIMA":false,
  "GRANT_EXP_OTHER":false,
  "GRANT_EXP_PEPD":false,
  "GRANT_EXP_PLAYEQ":false,
  "GRANT_EXP_SENSE":false,
  "GRANT_EXP_SPORTEQ":false,
  "GRANT_EXP_TRA":false,
  "GRANT_Case_Study":""
}

function startProcessing(start, end) {
  // Iterate every Organisation
  // Look at AS_DATA BO... if no data for ID, look at AS_NOTES BO


  {"data": asData }
  endProcessing()
}

function endProcessing(nf, found) {
  // create CSV data for args
  postMessage({
    type: "endProcessing",
    data: [Papa.unparse(
      {"fields": reportdata["fields"], "data": reportdata["data"]},
      {"header": true}
    ), Papa.unparse(
      {"fields": reportdata["fields"], "data": reportdata["data"]},
      {"header": true}
    )],
  });
}
