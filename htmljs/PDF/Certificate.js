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
var myWorker = new Worker('/common/Uploaded%20Files/Code/PDF/CertificateWorker-25.js');

function certlog(s) {
  var ta = jQuery('textarea#certlog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#progress').text(i);
}

function saveFile(data) {
  // PDF here
  if (data == null) { certlog("Error."); return; }
  var pdf = data[0]
  if (pdf == null) { certlog("Error."); return; }
  var eventid = data[1]
  var name = data[2]
  var filename = "{0}-{1}.pdf".format(eventid, name)
  certlog("Downloading now...");
  //IE11 & Edge
  if (navigator.msSaveBlob) {
      navigator.msSaveBlob(pdf, filename);
  } else {
      //In FF link must be added to DOM to be clicked
      var link = document.createElement('a');
      link.href = window.URL.createObjectURL(pdf);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}

function runCert() {
  // set expected count
  jQuery('span#certtotal').text("6");
  jQuery('span#progress').text("0");
  var eventid = (new URLSearchParams(window.location.search)).get("EventKey")
  var userid = JSON.parse(document.getElementById("__ClientContext").value)["selectedPartyId"]
  if (!eventid || !userid) {
    certlog("Invalid event data.");
    return;
  }
  workerMaker('MakeCert', [eventid, userid, document.getElementById("__RequestVerificationToken").value]);
}

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'MakeCert') {
    saveFile(data);
  } else if (type === 'certlog') {
    certlog(data);
  } else if (type === 'progress') {
    updateProgress(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}
