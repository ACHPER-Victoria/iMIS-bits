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
        var reportdata = startProcessing();
        postMessage({
          type: "fin",
          data: [],
        });
        break;
      case 'getTotal':
        token = arg[0];
        getTotal();
      break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function getTotal() {
  var params = [["QueryName", "$/ACHPERVIC/Utilities/Manage Students/VIC Pending > 7 days"]];
  var resp = dorequest("/api/query", null, null, params)
  postMessage({type: "importtotal", data: resp[1]["TotalCount"],});
}

function startProcessing() {
  count = 0;
  var params = [["QueryName", "$/ACHPERVIC/Utilities/Manage Students/VIC Pending > 7 days"]];
  for(const item of apiIterator("/api/query", params)) {
    // get  person
    var resp = dorequest("/api/Party/{0}".format(item["ID"]));
    if (!resp[0]) {
      postMessage({type: "importtotal", data: -1,});
      return;
    }
    // update person
    // 2021-02-02T00:00:00   date format
    // 2021-03-18T02:14:05.282Z"   ISOstring, split on T and add 00's
    var dt = (new Date()).toISOString().split("T")[0];
    dt = "{0}T00:00:00".format(dt);
    genericProp(resp[1], "PaidThruDate", dt, "AdditionalAttributes");
    genericProp(resp[1], "RenewedThruDate", dt, "AdditionalAttributes");
    genericProp(resp[1], "CustomerTypeCode", "NM", "AdditionalAttributes");
    deleteGenericProp(resp[1], "CustomerTypeDescription", "AdditionalAttributes");

    // put person back dorequest(url, func = null, errfunc = null, params = [], data = null, method="POST", put_token=true)
    var resp = dorequest("/api/Party/{0}".format(item["ID"]), null, null, [], resp[1], "PUT");
    if (!resp[0]) {
      postMessage({type: "importtotal", data: -1,});
      return;
    }
    count++;
    postMessage({type: "importprogress", data: count,});
  }
}
