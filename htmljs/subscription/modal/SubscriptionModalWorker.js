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

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'processEmail':
        // console.log('Posting message back to main script');
        // generate CSVdata
        token = arg[0];
        processEmail(arg[1], arg[2]) //email, userid
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}

function checkForNoEmail(email) {
  // Maybe implement this... Need to make a new flow.
  return true;
}

FLOWURL = "FLOW_POST_URL_HERE"
function processEmail(email, userid) {
  if (checkForNoEmail(email)) {
    // add to subscriber thing
    result = dorequest(FLOWURL, null, null, [], genSubEmailBody(userid, email), "POST", false);
    if (result[0] == false) { console.log(result[1]); }
  }
  // Otherwise, or afterwards allow access.
  doneAndReturn();
}

function doneAndReturn() {
  postMessage({
    type: "processEmail",
    data: true,
  });
}
