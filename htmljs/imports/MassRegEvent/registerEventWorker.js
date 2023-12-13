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
importScripts('/common/Uploaded%20files/Code/papaparse.min.js')

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'getEvents':
        token = arg[0];
        postMessage({
          type: type,
          data: getEvents(),
        });
        break;
      case 'getRegOption':
        token = arg[0];
        getRegOptions(arg[1], arg[2], arg[3]) //f, column, event
        break;
      case 'getHeaders':
        token = arg[0];
        getHeaders(arg[1]) //f
        break;
      case 'getMemOption':
        token = arg[0];
        getMemOptions(arg[1], arg[2]) //f
        break;
      case 'startProcessing':
        token = arg[0];
        //CSVFILE, fields, actualevent, regopts, memopt, memopts, memdate
        startProcessing(arg[1], arg[2], arg[3], arg[4], arg[5], arg[6], arg[7]);
        break;
      case 'startReversing':
          token = arg[0];
          //CSVFILE, fields, actualevent, regopts, memopt, memopts, memdate
          reverseInvoices(arg[1]);
          break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function getEvents() {
  var tableitems = [];
  for (let i of apiIterator("/api/Event", [["Status", "P"]])) {
    tableitems.push([i["EventCode"], "{0} - {1}".format(i["EventCode"], i["Name"])]);
  }
  return tableitems;
}

var COUNT = 0;
function incrementProgress() {
  COUNT++;
  postMessage({
    type: "updateProgress",
    data: COUNT,
  });
}

function processMember(item, date) {
  // first find any membership invoice
  findInvoice(genericProp(item, "ID"));

  var modified = false;
  if (genericProp(item, "MemberType") != "VICF") {
    genericProp(item, "MemberType", "VICF");
    modified = true;
  }
  // check paidthru date:
  if (genericProp(item, "PaidThrough") < date) {
    genericProp(item, "PaidThrough", "{0}T00:00:00".format(date));
    modified = true;
  }
  if (modified) {
    var result = dorequest("/api/CsContact/{0}".format(genericProp(item, "ID")), null, null, [], item, "PUT");
    if (!result[1]) { mergelog("Error with Mem1: "+ result[1]); return false;}
  }
  return true;
}

function getUserFromID(id, memb, date) {
  var result = dorequest("/api/CsContact/{0}".format(id));
  if (result[0]) {
    if (memb) {
      if (!processMember(result[1], date)) {
        return false;
      }
    }
    return id;
  }
  else { return null; }
}

function NewRegWithTemplate(template) {
  var result = dorequest("/api/EventRegistration/_execute", null, null, [], template);
  if (!result[0]) { mergelog("Error with New Registration: "+result[1]); return false;}
  return true;
}
function RegisterWithTemplate(template) {
  var result = dorequest("/api/ComboOrder/_validate", null, null, [], template);
  if (!result[0]) { mergelog("Error with Reg1: "+result[1]); return false; }
  // check if validated true
  if (!result[1]["IsValid"]) { mergelog("Validation fail1:"+result[1]["ValidationResults"]); return false; }
  // execute the validated entity
  result = dorequest("/api/ComboOrder", null, null, [], result[1]["Entity"]);
  if (!result[1]) { mergelog("Error with Reg2: "+ result[1]); return false; }
  return true;
}

function CheckAndRegister(eventID, imisID, funccode) {
  // If registration, check registration option. If same, continue, if not, modify registration I guess ??
  // If registration and need to change: 1) use template 2) validate 3) post validated body.
  var result = dorequest("/api/EventRegistration/{0}-{1}".format(eventID, imisID));
  if (result[0] && "Status" in result[1]) {
    // get AssociatedInvoiceId
    var associatedInvoiceID = result[1]["AdditionalAttributes"]["$values"][0]["Value"]
    // check status.
    if (result[1]["Status"] == 1) {
      // check registration Option
      var regOpt = result[1]["Functions"]["$values"][0]["EventFunction"]["EventFunctionCode"];
      if (funccode === "") {
        implementthis;
      }
      if (regOpt != funccode) {
        // modify registration. broken at the moment. FIX PLEASE.
        mergelog("User: {0} has changed registration. Please manually update their registration from {1} to {2}".format(imisID, regOpt, funccode))
        return true;
        //return RegisterWithTemplate(generateTemplate(imisID, eventID, associatedInvoiceID, funccode, regOpt));
      } else {
        // registration is fine, no change(s) needed.
        return true;
      }
    } else {
      //register new registration using template
      return RegisterWithTemplate(generateTemplate(imisID, eventID, associatedInvoiceID, funccode));
    }
  }
  else { //register new registration
    return NewRegWithTemplate(generateNewTemplate(eventID, funccode, imisID));
  }
}

//CSVFILE, fields, actualevent, regopts
function startProcessing(f, fields, actualevent, regopts, memopts, memdate) {
  // ghetto reset count
  COUNT = -1;
  incrementProgress();
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      // check ID
      var id = null;
      var field = fields["uid"];
      if (field && r["data"][0][field].trim()) {
        // get ID and also update membership while at it I guess ??
        // check if doing member things...
        var memb = false;
        if (fields["membership"] && r["data"][0][fields["membership"]].trim()) {
          if (memopts.includes(r["data"][0][fields["membership"]].trim())) { memb = true; }
        }
        id = getUserFromID(r["data"][0][field].trim(), memb, memdate);
      }
      if (id === null) { // didn't find/or don't have ID
        mergelog("Couldn't find user for ID: "+ r["data"][0][field].trim())
      } else if (id === false) {
        mergelog("Stopping due to error."); p.abort();
        return;
      }else {
        // get registration...
        field = fields["regoption"];
        var funccode = "";
        if (field) {
          funccode = regopts[r["data"][0][field].trim()];
        }
        if (!CheckAndRegister(actualevent, id, funccode)) {
          mergelog("Stopping due to error, for ID: "+id);
          p.abort();
          return;
        }
      }
      incrementProgress();
    },
    "complete": function(r,p) {
      endProcessing();
    },
    "skipEmptyLines": true,
    "fastMode": false,
  });
}
function endProcessing() {
  postMessage({
    type: "endProcessing",
    data: [],
  });
}

function getFunctions(event) {
  var tableitems = [];
  if (event) {
    var result = dorequest("/api/Event/{0}".format(event));
    if (result[0]) {
      for (let i of result[1]["RegistrationOptions"]["$values"]) {
        tableitems.push([i["EventFunctionCode"], "{0} - {1}".format(i["EventFunctionCode"], i["Name"])]);
      }
    }
  }
  return tableitems;
}

function getRegOptions(f, column, event) {
  const regOptions = new Set();
  // get event regOptions
  var eventregoptions = getFunctions(event);
  Papa.parse(f, {
    "header": true,
    "step": function(r,p) {
      var regopt = r["data"][0][column].trim();
      if (regopt) {
        regOptions.add(regopt);
      }
    },
    "complete": function(r,p) {
      sendRegOptions(regOptions, eventregoptions);
    },
    "skipEmptyLines": true,
    "fastMode": false,
  });
}
function sendRegOptions(regoptions, eventregoptions) {
  postMessage({
    type: "getRegOption",
    data: [regoptions, eventregoptions],
  });
}

function getMemOptions(f, column) {
  const memOptions = new Set();
  Papa.parse(f, {
    "header": true,
    "step": (r, p) => {
      var regopt = r["data"][0][column].trim();
      if (regopt) {
        memOptions.add(regopt);
      }
    },
    "complete": (r,p) => { sendMemOptions(memOptions); },
    "skipEmptyLines": true,
    "fastMode": false,
  });
}
function sendMemOptions(memoptions) {
  postMessage({
    type: "getMemOption",
    data: memoptions,
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

function mergelog(s) {
  postMessage({
    type: "mergelog",
    data: s,
  });
}

function generateTemplate(imisID, eventID, associatedInvoiceID, funccode, removeCode=null) {
  var template = JSON.parse(JSON.stringify(DUMBORDERTEMPLATE));
  template["Order"]["BillToCustomerParty"]["PartyId"] = imisID;
  template["Order"]["Delivery"]["$values"][0]["CustomerParty"]["PartyId"] = imisID;
  template["Order"]["Lines"]["$values"][0]["Event"]["EventId"] = eventID;
  template["Order"]["Lines"]["$values"][0]["AdditionalAttributes"]["$values"][0]["Value"] = associatedInvoiceID;
  var code = "{0}/{1}".format(eventID, funccode);
  template["Order"]["Lines"]["$values"][0]["ChildOrderLines"]["$values"][0]["Item"]["ItemCode"] = code;
  template["Order"]["Lines"]["$values"][0]["ChildOrderLines"]["$values"][0]["Item"]["ItemId"] = code;
  // if remove code, add on the negative removal function template to the end of childorderlines.
  if (removeCode != null) {
    template["Order"]["Lines"]["$values"][0]["ChildOrderLines"]["$values"].unshift(generateNegative(associatedInvoiceID, removeCode));
  }
  code = "EVENT-{0}".format(eventID);
  template["Order"]["Lines"]["$values"][0]["Item"]["ItemCode"] = code;
  template["Order"]["Lines"]["$values"][0]["Item"]["ItemId"] = code;
  template["Order"]["OriginatorCustomerParty"]["PartyId"] = imisID;
  template["Order"]["SoldToCustomerParty"]["PartyId"] = imisID;
  return template;
}

DUMBORDERTEMPLATE = {
  "$type": "Asi.Soa.Commerce.DataContracts.ComboOrderData, Asi.Contracts",
  "Order": {
      "$type": "Asi.Soa.Commerce.DataContracts.OrderData, Asi.Contracts",
      "BillToCustomerParty": {
          "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts",
          "PartyId": ""
      },
      "Delivery": {
          "$type": "Asi.Soa.Commerce.DataContracts.DeliveryDataCollection, Asi.Contracts",
          "$values": [
              {
                  "$type": "Asi.Soa.Commerce.DataContracts.DeliveryData, Asi.Contracts",
                  "CustomerParty": {
                      "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts",
                      "PartyId": ""
                  },
                  "DeliveryId": "f7779f90-3d5f-4a8b-8ae5-39dbea026313"
              }
          ]
      },
      "Lines": {
          "$type": "Asi.Soa.Commerce.DataContracts.OrderLineDataCollection, Asi.Contracts",
          "$values": [
              {
                  "$type": "Asi.Soa.Events.DataContracts.EventOrderLineData, Asi.Contracts",
                  "Event": {
                      "$type": "Asi.Soa.Events.DataContracts.EventSummaryData, Asi.Contracts",
                      "EventId": ""
                  },
                  "AdditionalAttributes": {
                      "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
                      "$values": [
                          {
                              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                              "Name": "AssociatedInvoiceId",
                              "Value": ""
                          }
                      ]
                  },
                  "ChildOrderLines": {
                      "$type": "Asi.Soa.Commerce.DataContracts.OrderLineDataCollection, Asi.Contracts",
                      "$values": [
                          {
                              "$type": "Asi.Soa.Events.DataContracts.EventFunctionOrderLineData, Asi.Contracts",
                              "Item": {
                                  "$type": "Asi.Soa.Commerce.DataContracts.ItemSummaryData, Asi.Contracts",
                                  "ItemClass": {
                                      "$type": "Asi.Soa.Commerce.DataContracts.ItemClassSummaryData, Asi.Contracts",
                                      "ItemClassId": "MEETING"
                                  },
                                  "ItemCode": "2022NOVCON/T",
                                  "ItemId": "2022NOVCON/T",
                              },
                              "QuantityOrdered": {
                                  "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
                                  "Amount": 1.0
                              },
                              "QuantityShipped": {
                                  "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
                                  "Amount": 1.0
                              },
                              "CanCombine": true
                          }
                      ]
                  },
                  "DeliveryId": "f7779f90-3d5f-4a8b-8ae5-39dbea026313",
                  "Item": {
                      "$type": "Asi.Soa.Commerce.DataContracts.ItemSummaryData, Asi.Contracts",
                      "ItemCode": "EVENT-2022NOVCON",
                      "ItemId": "EVENT-2022NOVCON",
                  },
                  "LineNumber": 1,
                  "QuantityOrdered": {
                      "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
                      "Amount": 1.0
                  },
                  "QuantityShipped": {
                      "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
                      "Amount": 1.0
                  }
              }
          ]
      },
      "OriginatorCustomerParty": {
          "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts",
          "PartyId": "33276"
      },
      "SoldToCustomerParty": {
          "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts",
          "PartyId": "33276"
      },
      "AdditionalAttributes": {
          "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
          "$values": [
              {
                  "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                  "Name": "OrderTotalExcludingCredits",
                  "Value": {
                      "$type": "System.Decimal",
                      "$value": 0.0
                  }
              }
          ]
      }
  },
  "Invoices": {
      "$type": "Asi.Soa.Commerce.DataContracts.InvoiceSummaryDataCollection, Asi.Contracts",
      "$values": []
  },
  "Payments": {
      "$type": "Asi.Soa.Commerce.DataContracts.RemittanceDataCollection, Asi.Contracts",
      "$values": []
  }
}

function generateNegative(associatedInvoiceID, removecode) {
  var template = JSON.parse(JSON.stringify(NEGATIVETEMPLATE));
  template["AdditionalAttributes"]["$values"][0]["Value"] = associatedInvoiceID;
  template["Item"]["ItemCode"]["ItemId"] = removecode;
  return template;
}
NEGATIVETEMPLATE = {
  "$type": "Asi.Soa.Events.DataContracts.EventFunctionOrderLineData, Asi.Contracts",
  "AdditionalAttributes": {
      "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
      "$values": [
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "AssociatedInvoiceId",
              "Value": ""
          },
          {
              "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
              "Name": "IsEventFunctionCancellation",
              "Value": {
                  "$type": "System.Boolean",
                  "$value": true
              }
          }
      ]
  },
  "Item": {
      "$type": "Asi.Soa.Commerce.DataContracts.ItemSummaryData, Asi.Contracts",
      "ItemClass": {
          "$type": "Asi.Soa.Commerce.DataContracts.ItemClassSummaryData, Asi.Contracts",
          "ItemClassId": "MEETING"
      },
      "ItemCode": "2022NOVCON/B",
      "ItemId": "2022NOVCON/B",
  },
  "QuantityOrdered": {
      "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
      "Amount": -1.000000
  },
  "QuantityShipped": {
      "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib",
      "Amount": -1.000000
  },
  "CanCombine": true
}

function generateNewTemplate(eventID, funccode, imisID) {
  var template = JSON.parse(JSON.stringify(NEWREGTEMPLATE));
  template["EventId"] = eventID;
  var code = "{0}/{1}".format(eventID, funccode);
  template["RegistrationOptionFunctionId"] = code;
  template["FunctionId"] = funccode;
  template["RegistrantId"] = imisID;
  template["BillTo"] = imisID;
  return template;
}
NEWREGTEMPLATE = {
  "$type": "Asi.Soa.Events.DataContracts.EventRegistrationRequest, Asi.Contracts",
  "EntityTypeName": "EventRegistration",
  "OperationName": "RegisterEvent",
  "RegistrationType": 3,
  "EventId": "",
  "RegistrationOptionFunctionId": "",
  "FunctionId": "F",
  "RegistrantId": "",
  "RegisteredBy": "194",
  "BillTo": "33276",
  "Waitlist": false
}

// Invoice related stuff
// dorequest(url, func = null, errfunc = null, params = [], data = null, method="POST", put_token=true)
function findInvoice(imisid) {
  var result = dorequest("/api/InvoiceSummary", null, null,
    [["SourceSystem", "DUES"], ["Balance", "gt:0"], ["SoldToPartyId", imisid]]);
  if (result[0]) {
    if (result[1]["Count"] == 1) {
      var item = result[1]["Items"]["$values"][0];
      postMessage({
        type: "getInvoiceData",
        data: [imisid, item["InvoiceId"], item["SoldToParty"]["Name"], item["Description"]]
      });
    }
    else if (result[1]["Count"] > 1) {
      mergelog("Found too many invoices for iMIS ID {0}. You should look this iMIS ID up and reverse membership invoices manually.".format(imisid));
    }
  }
}

// result[0] yay/nay, result[1]["Result"] yay result[1]["Message"] if err
function checkInvoice(invid) {
  var template = JSON.parse(JSON.stringify(CHECKTEMPLATE));
  template["Parameters"]["$values"][0]["$value"] = invid;
  return dorequest("/api/Invoice/_execute", null, null, [], template);
}

function reverseInvoices(invoices) {
  postMessage({
    type: "setMaxProgress",
    data: invoices.length,
  });
  // ghetto reset count
  COUNT = -1;
  incrementProgress();
  for (let invid of invoices) {
    var result = checkInvoice(invid);
    if (result[0] && result[1]["IsSuccessStatusCode"]) { 
      // do actual reversal...
      result = reverseInvoice(invid);
      if (!result[0]) { mergelog("Error reversing invoice ID {0} (this is not invoice number)".format(invid)); }
      else if (result[0] && !result[1]["IsSuccessStatusCode"]) { mergelog("Error reversing invoice ID {0} (this is not invoice number). Error message: {1}".format(invid, result[1]["Message"])); }
      // success
      else { postMessage({ type: "doneInvoice", data: invid }); }
    }
    else if (!result[0]) { mergelog("Error reversing invoice ID {0} (this is not invoice number)".format(invid)); }
    else { mergelog("Error reversing invoice ID {0} (this is not invoice number). Error message: {1}".format(invid, result[1]["Message"])); }
    incrementProgress();
  }
  mergelog("Done reversing.");
}

function reverseInvoice(invid) {
  t = (new Date()).toISOString().slice(0,19);
  var template = JSON.parse(JSON.stringify(REVERSETEMPLATE));
  template["Parameters"]["$values"][0]["AdjustmentDate"] = t;
  template["Parameters"]["$values"][0]["InvoiceID"] = invid;
  return dorequest("/api/Invoice/_execute", null, null, [], template);
}

CHECKTEMPLATE = {
  "$type": "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
  "OperationName": "CanInvoiceBeReversed",
  "EntityTypeName": "Invoice",
  "Parameters": {
    "$type": "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
    "$values": [
      {
        "$type": "System.Int32",
        "$value": 0
      }
    ]
  },
  "ParameterTypeName": {
    "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
    "$values": [
      "System.Int32"
    ]
  },
  "UseJson": false
}
REVERSETEMPLATE = {
  "$type": "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
  "OperationName": "ProcessAccrualReversal",
  "EntityTypeName": "Invoice",
  "Parameters": {
    "$type": "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
    "$values": [
      {
        "$type": "Asi.Soa.Commerce.DataContracts.InvoiceActionDuesReversalData, Asi.Contracts",
        "InvoiceID": 0, 
        "AdjustmentDate" :"2023-10-30T00:00:00", 
        "AdjustmentReason": "Conference complimentary membership", 
        "ReverseShipping" : true, 
        "ReverseHandling" : true, 
        "AffectsInventory": true 
      }
    ]
  },
  "ParameterTypeName": {
    "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
    "$values": [
      "Asi.Soa.Commerce.DataContracts.InvoiceActionDuesReversalData, Asi.Contracts"
    ]
  },
  "UseJson": false
}