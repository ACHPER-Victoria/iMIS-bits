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

// url must not contain ?
function* apiIterator(url, p=[], errfunc = _i => {console.log("E: " + _i)}) {
  p = JSON.parse(JSON.stringify(p));
  p.push(["limit","100"])
  var error = false;
  var response = {};
  dorequest(url, resp => {response = resp; }, errText => { error = true; errfunc(errText); }, p)
  if (error) { return; }
  console.log("Total: " + response["TotalCount"])
  while (response["Count"] > 0){
      let nextoffset = response["NextOffset"]
      let values = response["Items"]["$values"];
      for (var i=0; i<values.length; i++) { yield values[i]; }
      if (nextoffset == 0){ return; }
      dorequest(url, resp => {response = resp; }, errText => { error = true; errfunc(errText); }, p.concat([['offset', nextoffset]]))
      if (error) { return; }
  }
}

function getError(resp) {
  try {
    j = JSON.parse(resp);
    if (j["Errors"] && j["Errors"]["$values"] && j["Errors"]["$values"][0])
      return j["Errors"]["$values"][0]["Message"];
    else {
      return resp;
    }
  } catch (e) {
    return resp;
  }
}

function formatQueryString(url, params) {
  if (params.length == 0 ) { return url; }
  var parts = [];
  params.forEach( p => { parts.push(encodeURIComponent(p[0]) + '=' +
    encodeURIComponent(p[1])) });
  return url + "?" + parts.join('&');
}

function dorequest(url, func = null, errfunc = null, params = [], data = null, method="POST", put_token=true) {
  var xhr = new XMLHttpRequest();
  if (data !== null) { xhr.open(method, url, false); }
  else { xhr.open('GET', formatQueryString(url, params), false); }
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (put_token) { xhr.setRequestHeader('RequestVerificationToken', token); }
  if (data) { params.forEach(param => { xhr.setRequestHeader(param[0], param[1]); }); }
  var response = "";
  var success = true;
  xhr.onload = function() {
    if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202) {
      if (xhr.responseText) { response = JSON.parse(xhr.responseText); }
      if (func) { func(response); }
      success = true;
    }
    else {
      response = xhr.responseText;
      if (errfunc) { errfunc(response); }
      else { response = getError(response); }
      success = false;
    }
  };
  if (data) { xhr.send(JSON.stringify(data)); }
  else { xhr.send(); }
  return [success, response];
}


ALLIANCE_BODY = {
    "$type": "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
    "EntityTypeName": "ACH_MarketingGroups",
    "PrimaryParentEntityTypeName": "Party",
    "PrimaryParentIdentity": {
        "$type": "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
        "EntityTypeName": "Party",
        "IdentityElements": {
            "$type": "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
            "$values": [
                "__"
            ]
        }
    },
    "Properties": {
    "$type": "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
    "$values": [
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "ID",
                "Value": "__"
            },
            {
                "$type": "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
                "Name": "GroupName",
                "Value": "__"
            }
        ]
    }
}
function genAllianceBody(id, alliance) {
  body = JSON.parse(JSON.stringify(ALLIANCE_BODY));
  body["PrimaryParentIdentity"]["IdentityElements"]["$values"][0] = id.toString();
  body["Properties"]["$values"][0]["Value"] = id;
  body["Properties"]["$values"][1]["Value"] = alliance;
  return body;
}
PREF_BODY = {
  "$type": "Asi.Soa.Membership.DataContracts.PartyCommunicationTypePreferenceData, Asi.Contracts",
  "CommunicationTypeId": "__",
  "OptInFlag": true
}
function genSubscriptionBody(typeid) {
  body = JSON.parse(JSON.stringify(PREF_BODY));
  body["CommunicationTypeId"] = typeid;
  return body;
}
function partyAddSubscriptions(obj, typeids) {
  var subs = JSON.parse(JSON.stringify(typeids));
  var tlist = obj["CommunicationTypePreferences"]["$values"];
  for (var i=0; i<tlist.length;i++) {
    var toremove = [];
    for (var x=0; x<subs.length;x++) {
      if (!subs[x]) { continue; }
      if (tlist[i]["CommunicationTypeId"] == subs[x]) {
        tlist[i]["OptInFlag"] = true;
        toremove.push(subs[x]);
      }
    }
    subs = subs.filter((v,i,a) => {return !toremove.includes(v);}); // remove types we've seen.
  }
  // if there's any typeids not seen, add them...
  subs.forEach(x => { tlist.push(genSubscriptionBody(x)); });
  return obj;
}

SUBEMAILBODY =
{
    "emailaddress" : "",
    "imisid" : "",
    "entered" : ""
}
function genSubEmailBody(id, email) {
  body = JSON.parse(JSON.stringify(SUBEMAILBODY));
  body["entered"] = (new Date()).toJSON();
  body["emailaddress"] = email;
  if (id) { body["imisid"] = id.toString(); }
  return body;
}

function genericProp(item, pname, pval=null, collection="Properties") {
  for (const prop of item[collection]["$values"])
  {
    if (prop["Name"].toUpperCase() === pname.toUpperCase()) {
      if (prop["Value"]["$type"]) {
        if (pval !== null) { prop["Value"]["$value"] = pval; }
        return prop["Value"]["$value"]
      } else {
        if (pval !== null) { prop["Value"] = pval; }
        return prop["Value"]
      }
    }
  }
}
function deleteGenericProp(pitem, pname, collection="Properties") {
  var newprops = []; // we do this because it's an array.
  for (const prop of pitem[collection]["$values"]) {
    if (prop["Name"] != pname) {
      newprops.push(prop);
    }
  }
  pitem[collection]["$values"] = newprops;
}

REGISTRATION_BODY = {
    "$type": "Asi.Soa.Events.DataContracts.EventRegistrationRequest, Asi.Contracts",
    "EntityTypeName": "EventRegistration",
    "OperationName": "RegisterEvent",
    "RegistrationType": 3,
    "EventId": "",
    "RegistrationOptionFunctionId": "",
    "FunctionId": "",
    "RegistrantId": "",
    "RegisteredBy": "149",
    "BillTo": "",
    "Waitlist": false
}
function genRegistration(eventid, regoptid, id) {
  body = JSON.parse(JSON.stringify(REGISTRATION_BODY));
  body["EventId"] = eventid;
  body["RegistrationOptionFunctionId"] = "{0}/{1}".format(eventid, regoptid);
  body["FunctionId"] = regoptid;
  body["RegistrantId"] = id;
  body["BillTo"] = id;
  return body;
}


function iMISPing() {
  console.log("ping");
  var params = [["limit", 1]];
  var result = dorequest("/api/Person", null, null, params);
}

function iMISaPing() {
  // async ping
  var xhr = new XMLHttpRequest();
  xhr.open('GET', "/api/Person?limit=1", true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('RequestVerificationToken', document.getElementById("__RequestVerificationToken").value);
  xhr.send();
}

function buildGenMaps(listofgentables) {
  var genmap = {"desc": {}, "code":{}};
  for (const t of listofgentables) {
    // genmap {
    //  desc: {table:{code:desc}},
    //  code: {table: {desc:code}}}
    var params = [["TableName", t]]
    for(let i of apiIterator("/api/GenTable", params)) {
      if (!genmap["code"].hasOwnProperty(t)) { genmap["code"][t] = {}; }
      if (!genmap["desc"].hasOwnProperty(t)) { genmap["desc"][t] = {}; }
      genmap["code"][t][i["Description"].toUpperCase()] = i["Code"];
      genmap["desc"][t][i["Code"].toUpperCase()] = i["Description"];
    }
  }
  return genmap;
}
function getGenProp(type, genmap, table, prop) {
  if (table == null) { return prop; }
  if (genmap[type].hasOwnProperty(table)){
    if (genmap[type][table].hasOwnProperty(prop.toUpperCase())){
      return genmap[type][table][prop.toUpperCase()];
    }
  }
  return prop;
}
function getGenPropCode(genmap, table, prop) { getGenProp("code", genmap, table, prop);}
function getGenPropDesc(genmap, table, prop) { getGenProp("desc", genmap, table, prop);}
function* iterGenTable(tablename) {
  for(let ent of apiIterator("/api/GEN_TABLES", [["Table_Name", tablename]])) {
    yield [genericProp(ent, "CODE"), genericProp(ent, "DESCRIPTION")];
  }
}

function dictget(d, key, default_value) {
  if (d.hasOwnProperty(key)) { return d[key]; }
  else { return default_value; }
}
