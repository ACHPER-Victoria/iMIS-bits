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

var eventid = null;
var token = null;

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'csvFormat':
        // console.log('Posting message back to main script');
        // generate CSVdata
        eventid = arg[0];
        token = arg[1];
        var reportdata = runReport();
        //exportlog("fields: {0}".format(reportdata["fields"]))
        var res = Papa.unparse(
          {"fields": reportdata["fields"], "data": reportdata["data"]},
          {"header": true}
        );
        postMessage({
          type: type,
          data: res,
        });
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

function dorequest(url, func, errfunc = null) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('RequestVerificationToken', token);
  xhr.onload = function() {
    if (xhr.status === 200) {
      func(JSON.parse(xhr.responseText));
    }
    else {
      if (errfunc) { errfunc(xhr.responseText); }
      else { exportlog("Request error ({0}). {1}".format(url, xhr.responseText)); }
    }
  };
  xhr.send();
}

function runReport() {
  // Start first query which then calls everything else
  // Get Event Details
  var reportdata = {};
  var xhr = new XMLHttpRequest();

  dorequest("/api/Event/{0}".format(eventid), function (data) {
    reportdata = startProcessingEvent(data);
    //exportlog("runfunc: {0}".format(reportdata["fields"]))
  });
  return reportdata;
}

function getName(pid) {
  var name = "";
  dorequest("/api/PartySummary/{0}".format(pid), function(data) {
      name = data["Name"];
  });
  return name;
}

function addInvoiceDetails(ref, rfperson) {
  var num = "";
  dorequest("/api/OrderInvoice?OrderNumber={0}".format(ref), function(data) {
    if (data["Items"]["$values"][0]) {
      data["Items"]["$values"][0]["Properties"]["$values"].forEach(function(ri){
        if (ri["Name"] == "InvoiceReferenceNumber") {
          dorequest("/api/CsInvoice/{0}".format(ri["Value"]["$value"]), function(irdata) {
              irdata["Properties"]["$values"].forEach(function(csip){
                if (csip["Name"] == "BALANCE") { rfperson["Balance"] = csip["Value"]["$value"]; }
                else if (csip["Name"] == "CHARGES") { rfperson["Amount"] = csip["Value"]["$value"]; }
                else if (csip["Name"] == "CUSTOMER_REFERENCE") { rfperson["PONumber"] = csip["Value"]; }
                else if (csip["Name"] == "INVOICE_NUM") { rfperson["InvoiceNumber"] = csip["Value"]["$value"]; }
              });
          }, function(errirdata) {
            exportlog("Cannot retrieve Invoice data for: OrderNum {0}, InvRef {1}".format(ref, ri["Value"]["$value"]));
          });
        }
      });
    } else { return ref; }
  });
  return num;
}

function addExOrgData(rfperson, ORGDATA, orgid) {
  if (ORGDATA[orgid]) {
    //rfperson["Sector"] = ORGDATA[orgid]["Sector"];
    rfperson["Region"] = ORGDATA[orgid]["Region"];
    rfperson["SchoolNumber"] = ORGDATA[orgid]["SchoolNumber"];
    rfperson["SFOifApplicable"] = ORGDATA[orgid]["SFOifApplicable"];
  } else {
    ORGDATA[orgid] = {};
    dorequest("/api/AO_OrganisationsData/{0}".format(orgid), function(data) {
        data["Properties"]["$values"].forEach(function(pdata) {
          if (pdata["Name"] == "Region") { rfperson["Region"] = ORGDATA[orgid]["Region"] = pdata["Value"]; }
          else if (pdata["Name"] == "SchoolNumber") { rfperson["SchoolNumber"] = ORGDATA[orgid]["SchoolNumber"] = pdata["Value"]; }
          else if (pdata["Name"] == "SFOifApplicable") { rfperson["SFOifApplicable"] = ORGDATA[orgid]["SFOifApplicable"] = pdata["Value"]; }
        });
    });
  }
}
function addExSector(rfperson) {
  dorequest("/api/AO_IndividualsData/{0}".format(rfperson["Id"]), function(data) {
      data["Properties"]["$values"].forEach(function(pdata) {
        if (pdata["Name"] == "Sector") { rfperson["Sector"] = pdata["Value"]; }
      });
  }, function(data) {}); // errfunc do nothing.
}

function addFormResponses(rfperson, FORMDEF) {
  dorequest("/api/FormResponse?FormDefinitionId={0}&ParticipantPartyId={1}".format(FORMDEF["_"], rfperson["Id"]),
    function(data) {
      data["Items"]["$values"].forEach(function(di) {
        di["Fields"]["$values"].forEach(function(field) {
          if (field["Value"]["$type"]) { rfperson[FORMDEF[field["Name"]]] = field["Value"]["$value"]; }
          else { rfperson[FORMDEF[field["Name"]]] = field["Value"]; }
        });
      });
  });
}

function populateRegistration(rfperson, conflicttable, sessionblocks, ORGDATA, FORMDEF) {
  dorequest("/api/EventRegistration/{0}-{1}".format(eventid, rfperson["Id"]),
    function(data) {
      // populate function data:
      if (data["Functions"]) {
        data["Functions"]["$values"].forEach(function(funcdata) {
          //Code
          var code = funcdata["EventFunction"]["EventFunctionCode"];
          if (conflicttable[code]) {
            var head1 = "Session {0}".format(conflicttable[code]);
            var head2 = "Session {0} Title".format(conflicttable[code])
            rfperson[head1] = code;
            rfperson[head2] = funcdata["EventFunction"]["Name"];
            if (!sessionblocks.includes(head1)) {sessionblocks.push(head1); }
            if (!sessionblocks.includes(head2)) {sessionblocks.push(head2); }
          } else {
            //exportlog("Code not found in conflict table. ({0})".format(code));
          }
        });
      }
      // person info
      if (data["Registrant"]["Title"]) {
        rfperson["Title"] = data["Registrant"]["Title"];
      } else if (data["Registrant"]["FunctionalTitle"]) {
        rfperson["Title"] = data["Registrant"]["FunctionalTitle"];
      }
      rfperson["FirstName"] = data["Registrant"]["PersonName"]["FirstName"];
      rfperson["LastName"] = data["Registrant"]["PersonName"]["LastName"];
      rfperson["Prefix"] = data["Registrant"]["PersonName"]["NamePrefix"];
      if (data["Registrant"]["Emails"] && data["Registrant"]["Emails"]["$values"]) {
        if (data["Registrant"]["Emails"]["$values"][0]) {
          rfperson["Email"] = data["Registrant"]["Emails"]["$values"][0]["Address"]}
      }
      if (data["Registrant"]["Phones"] && data["Registrant"]["Phones"]["$values"]) {
        data["Registrant"]["Phones"]["$values"].forEach(function(phdata){
          if (phdata["PhoneType"] == "Mobile") { rfperson["Mobile"] = phdata["Number"]; }
        });
      }
      if (data["Registrant"]["PrimaryOrganization"]) {
        rfperson["Organisation"] = data["Registrant"]["PrimaryOrganization"]["Name"];
        // Get extra org data:
        if (data["Registrant"]["PrimaryOrganization"]["OrganizationPartyId"]) {
          addExOrgData(rfperson, ORGDATA, data["Registrant"]["PrimaryOrganization"]["OrganizationPartyId"]);
        }
      }
      // Registration Date
      rfperson["RegistrationDate"] = data["RegistrationDate"];

      // temporarily get Sector from contact card
      addExSector(rfperson);

      // iterate over extra Data
      data["Registrant"]["AdditionalAttributes"]["$values"].forEach(function(exdata) {
        if (exdata["Name"] == "CustomerTypeDescription") { rfperson["MemberType"] = exdata["Value"]; }
      });

      // add form responses:
      addFormResponses(rfperson, FORMDEF);
  });
}

function buildFormDef(FORMDEF, formid) {
  FORMDEF["_"] = formid; // cheating
  dorequest("/api/FormDefinition?FormDefinitionId={0}".format(formid),
    function(data) {
      data["Items"]["$values"].forEach(function(di) {
        di["Sections"]["$values"].forEach(function(section){
          section["Fields"]["$values"].forEach(function(field) {
            FORMDEF[field["PropertyId"]] = field["Caption"];
          });
        });
      });
  });
}

function startProcessingEvent(data) {
  // collate Conflict Code data
  var REGISTRATIONS = []; // [{regdata}]
  var sessionblocks = [];
  var conflicttable = {};
  var ORGDATA = {};
  var FORMDEF = {};
  var count = 0;
  buildFormDef(FORMDEF, data["EventFormId"]);
  var regoptions = {};
  data["Functions"]["$values"].forEach(function(item) {
    // check if contains digit, ignore if so
    item["ConflictCodes"]["$values"].forEach(function(ci) {
      if (!(/\d/.test(ci))) {
        if (item["EventFunctionCode"] in conflicttable) {}
        else { conflicttable[item["EventFunctionCode"]] = ci; }
      }
    });
  });
  // iterate over registration options
  data["RegistrationOptions"]["$values"].forEach(function(item) {
    regoptions[item["EventFunctionId"]] = item["Name"]
    dorequest("/api/vCsRegFunctions?ProductCode={0}".format(item["EventFunctionId"]),
      function(regfuncdata) {
        regfuncdata["Items"]["$values"].forEach(function(rfi) {
          var rfperson = {};
          rfperson["RegistrationOption"] = item["Name"];
          rfi["Properties"]["$values"].forEach(function(rfip) {
            if (rfip["Name"] == "Status") {
              if (rfip["Value"]) { rfperson["Status"] = rfip["Value"]; }
              else { rfperson["Status"] = ""; }
            }
            else if (rfip["Name"] == "BillToId") { rfperson["BillTo"] = getName(rfip["Value"]); }
            //else if (rfip["Name"] == "ExtendedAmount") { rfperson["Amount"] = rfip["Value"]["$value"]; }
            else if (rfip["Name"] == "OrderNumber") {
              rfperson["OrderNumber"] = rfip["Value"]["$value"];
              addInvoiceDetails(rfip["Value"]["$value"], rfperson);
            }
            else if (rfip["Name"] == "ShipToId") { rfperson["Id"] = rfip["Value"]; }
          });
          // Now we have some basic info, get all registration information:
          populateRegistration(rfperson, conflicttable, sessionblocks, ORGDATA, FORMDEF);
          REGISTRATIONS.push(rfperson);
          count++;
          postMessage({type: "exportprogress", data: count,});
        });
    });
  });
  // build Fields
  var fields = ["Prefix", "FirstName", "LastName", "Organisation", "Title", "Email",
    "Mobile", "Id", "RegistrationDate", "RegistrationOption", "Status", "Region", "Sector",
    "SchoolNumber", "SFOifApplicable", "MemberType", "BillTo", "Amount", "Balance",
    "PONumber", "InvoiceNumber", "OrderNumber" ]
  // Add sessions and form questions
  sessionblocks.sort();
  fields = fields.concat(sessionblocks);
  delete FORMDEF["_"];
  fields = fields.concat(Object.values(FORMDEF));
  // questions
  //exportlog("procfields: {0}".format(fields))
  return {"fields": fields, "data": REGISTRATIONS };
}
